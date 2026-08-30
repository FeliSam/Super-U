import { ConfirmModal } from '@/components/ConfirmModal';
import { HandoffCodeSheet } from '@/components/HandoffCodeSheet';
import { LibreMap } from '@/components/LibreMap';
import { PillButton } from '@/components/ui';
import { mapStyles, type LngLat, type MapMarker } from '@/constants/map';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useLocation } from '@/context/LocationContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useAppViewport } from '@/components/PhoneShell';
import { useRoadRoute } from '@/hooks/useRoadRoute';
import { useMultiRoadRoute } from '@/hooks/useMultiRoadRoute';
import { courierThreadId, kmLabel, minLabel, shortOrderId } from '@/lib/format';
import { ApiError } from '@/lib/api/http';
import { claimDelivery, fetchOrder, setDeliveryStatus, startDeliveryRun } from '@/lib/api/ops';
import { clientCoord, courierAnchor, DELIVERY_PHASE, storeCoord } from '@/lib/courierTrack';
import { headingAlongRoute } from '@/lib/vehicleMotion';
import {
  buildCourierTourPlan,
  buildTourMapMarkers,
  googleMapsTourUrl,
  nextDeliveryInTour,
  rememberLastDropoff,
  clearLastDropoff,
  tourRouteSummary,
} from '@/lib/tourRoute';
import {
  NEXT_DELIVERY_LABEL,
  deliveryNavLeg,
  isDeliveryHeld,
  normalizeDeliveryStatus,
  orderIdFromOpsId,
  sameOpsId,
} from '@/lib/opsModel';
import * as Linking from 'expo-linking';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RUN_FIT_PAD = { top: 88, bottom: 280, left: 40, right: 40 } as const;

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const delId = decodeURIComponent(id ?? '');
  const { deliveries, tourHop, refresh } = useBoard();
  const { staff } = useStaffAuth();
  const { mapPosition, heading: gpsHeading } = useLocation();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useAppViewport();
  const sheetMin = Math.round(screenH * 0.42);
  const sheetMax = Math.max(sheetMin, Math.round(screenH * 0.8));
  const [sheetOpen, setSheetOpen] = useState(true);
  const sheetOpenRef = useRef(true);
  sheetOpenRef.current = sheetOpen;
  const sheetH = useRef(new Animated.Value(sheetMax)).current;
  const listRef = useRef<ScrollView>(null);

  useEffect(() => {
    Animated.timing(sheetH, {
      toValue: sheetOpen ? sheetMax : sheetMin,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [sheetOpen, sheetMax, sheetMin, sheetH]);

  const setSheet = (open: boolean) => {
    setSheetOpen((prev) => {
      if (prev === open) return prev;
      if (!open) listRef.current?.scrollTo({ y: 0, animated: true });
      return open;
    });
  };
  const setSheetRef = useRef(setSheet);
  setSheetRef.current = setSheet;

  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -12 || g.vy < -0.15) setSheetRef.current(true);
        else if (g.dy > 12 || g.vy > 0.15) setSheetRef.current(false);
        else setSheetRef.current(!sheetOpenRef.current);
      },
    }),
  ).current;

  const d = deliveries.find((x) => sameOpsId(x.id, delId) || x.order_id === orderIdFromOpsId(delId));
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'ok' | 'err' | null>(null);
  const [modalText, setModalText] = useState('');
  const [closed, setClosed] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [navMode, setNavMode] = useState(false);
  const [followPaused, setFollowPaused] = useState(false);
  const [resumeTick, setResumeTick] = useState(0);

  useEffect(() => {
    if (d) {
      setClosed(null);
      return;
    }
    const oid = orderIdFromOpsId(delId);
    if (!oid) return;
    let live = true;
    void fetchOrder(oid)
      .then((res) => {
        if (!live) return;
        const row = res.order ?? {};
        const del = String(row.delivery_status ?? '');
        const shop = String(row.status ?? '');
        const courier = row.courier_id ? String(row.courier_id) : '';
        if (shop === 'delivered' || del === 'delivered') setClosed('Cette commande est déjà livrée.');
        else if (del === 'failed') setClosed('Cette livraison n’a pas abouti.');
        else if (shop === 'cancelled' || del === 'cancelled') setClosed('Cette course a été annulée.');
        else if (courier) setClosed('Cette course a déjà été prise.');
        else if (String(row.pick_status ?? '') !== 'packed') setClosed('Le colis n’est pas encore prêt.');
      })
      .catch(() => {
        if (live) setClosed('Course introuvable ou déjà terminée.');
      });
    return () => {
      live = false;
    };
  }, [d, delId]);

  useEffect(() => {
    if (!d || !staff?.id) return;
    const status = normalizeDeliveryStatus(d.delivery_status);
    if (status !== 'delivered' && status !== 'failed') return;
    const next = nextDeliveryInTour(deliveries, staff.id, d.id);
    if (next) {
      router.replace(`/run/${encodeURIComponent(next.id)}`);
      return;
    }
    clearLastDropoff(staff.id);
    router.replace('/(tabs)/missions');
  }, [d?.delivery_status, d?.id, deliveries, staff?.id]);

  const pickup: LngLat = storeCoord(d);
  const drop: LngLat = clientCoord(d);
  const toClient = deliveryNavLeg(d?.delivery_status) === 'client';
  const dest = toClient ? drop : pickup;

  const tourPlan = useMemo(
    () =>
      buildCourierTourPlan(deliveries, staff?.id, {
        focusDeliveryId: d?.id,
        courierPosition: mapPosition,
        lastDrop: tourHop ? [tourHop.lng, tourHop.lat] : null,
        lastDropLabel: tourHop?.label,
        lastDropStoreId: tourHop?.storeId,
      }),
    [deliveries, staff?.id, d?.id, mapPosition, tourHop],
  );

  const vehicle = staff?.vehicle;
  const legRoad = useRoadRoute(tourPlan?.navFrom ?? mapPosition, tourPlan?.navTo ?? dest, vehicle);
  const tourRoad = useMultiRoadRoute(
    tourPlan && tourPlan.routeWaypoints.length >= 2 ? tourPlan.routeWaypoints : null,
    vehicle,
  );
  const road =
    tourPlan && tourPlan.routeWaypoints.length >= 2 ? tourRoad : legRoad;
  const etaS = legRoad?.durationSeconds ?? road?.durationSeconds ?? d?.route_duration_s;
  const distM = legRoad?.distanceMeters ?? road?.distanceMeters ?? d?.route_distance_m;
  const tourSummary = tourPlan ? tourRouteSummary(tourPlan) : null;
  const cur = normalizeDeliveryStatus(d?.delivery_status);
  const here = courierAnchor(cur);
  const phase = DELIVERY_PHASE[cur];

  const markers = useMemo((): MapMarker[] => {
    if (tourPlan) {
      const you =
        here === 'client' ? 'Vous · chez le client' : here === 'route' ? 'Vous · en route' : 'Vous · magasin';
      return buildTourMapMarkers(
        tourPlan,
        mapPosition,
        (staff?.vehicle as MapMarker['vehicle']) || 'moto',
        you,
      );
    }
    const you =
      here === 'client' ? 'Vous · chez le client' : here === 'route' ? 'Vous · en route' : 'Vous · magasin';
    const list: MapMarker[] = [];
    if (!toClient) {
      list.push({ id: 'store', coordinate: pickup, kind: 'store', label: d?.store_name || 'Magasin' });
    }
    list.push({ id: 'home', coordinate: drop, kind: 'home', label: 'Client' });
    list.push({ id: 'me', coordinate: mapPosition, kind: 'courier', vehicle: 'moto', label: you });
    return list;
  }, [tourPlan, pickup, drop, mapPosition, d?.store_name, here, staff?.vehicle, toClient]);
  const packed = !d || d.pick_status === 'packed';
  const jobId = d?.id ?? delId;
  const note = d?.comment?.trim() ?? '';
  const held = Boolean(d && isDeliveryHeld(d));
  const driving = cur === 'picked_up' || cur === 'en_route';
  const onSite = cur === 'arrived';

  useEffect(() => {
    if (!driving) {
      setNavMode(false);
      setFollowPaused(false);
    }
  }, [driving]);

  const showErr = (message: string) => {
    setModalText(message);
    setModal('err');
  };

  const goAfterStop = (nextId?: string | null) => {
    setCodeOpen(false);
    if (nextId) {
      router.replace(`/run/${encodeURIComponent(nextId)}`);
      return;
    }
    if (staff?.id) clearLastDropoff(staff.id);
    router.replace('/(tabs)/missions');
  };

  const act = async (
    status: string,
    extra?: { customerRating?: number; customerComment?: string; handoffCode?: string },
  ) => {
    if (!packed) {
      showErr('Terminez d’abord le ramassage.');
      return;
    }
    setBusy(true);
    setCodeError(null);
    try {
      if (!d?.courier_id) {
        await claimDelivery(jobId);
        await refresh();
        if (status === 'unassigned' || status === 'assigned') return;
      }
      if (status === 'unassigned' || status === 'assigned') return;
      const res = await setDeliveryStatus(jobId, status, extra);
      if ((status === 'delivered' || status === 'failed') && staff?.id && d) {
        rememberLastDropoff(staff.id, d);
      }
      await refresh();
      if (status === 'delivered' || status === 'failed') {
        const next =
          res.nextDeliveryId ||
          (staff ? nextDeliveryInTour(deliveries, staff.id, jobId)?.id : null);
        goAfterStop(next);
        return;
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      if (status === 'delivered') setCodeError(msg);
      else showErr(msg);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const startTourNow = async () => {
    setBusy(true);
    try {
      const res = await startDeliveryRun();
      await refresh();
      router.replace(`/run/${encodeURIComponent(res.deliveryId)}`);
    } catch (e) {
      showErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const maps = () => {
    const next = tourPlan?.focusDelivery ? clientCoord(tourPlan.focusDelivery) : dest;
    const from = tourPlan?.routeFrom ?? mapPosition;
    void Linking.openURL(googleMapsTourUrl(from, [next]));
  };

  const mapRoute = road?.coordinates?.length ? road.coordinates : [mapPosition, dest];
  const bearing = (gpsHeading != null && Number.isFinite(gpsHeading) ? gpsHeading : headingAlongRoute(mapPosition, mapRoute)) ?? 0;
  const mapMarkers = useMemo(
    () =>
      markers.map((m) =>
        m.kind === 'courier' ? { ...m, heading: navMode ? 0 : bearing } : m,
      ),
    [markers, navMode, bearing],
  );

  const threadId = d?.comms_thread_id || courierThreadId(d?.order_id ?? '');

  if (!d && closed) {
    return (
      <View style={[styles.root, { justifyContent: 'center', padding: 24 }]}>
        <Text style={styles.title}>{closed}</Text>
        <Text style={[styles.sub, { marginTop: 8 }]}>L’écran a été mis à jour selon l’état actuel de la commande.</Text>
        <Pressable
          style={styles.closedBtn}
          onPress={() => router.replace('/(tabs)/history')}>
          <Text style={styles.closedBtnTxt}>Voir l’historique</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)/missions')}>
          <Text style={styles.sub}>Retour aux courses</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LibreMap
        style={styles.map}
        mapStyle={mapStyles.light}
        center={here === 'route' ? mapPosition : drop}
        zoom={navMode ? 16.8 : here === 'route' ? 14.4 : 13.6}
        route={mapRoute}
        markers={mapMarkers}
        fitToMarkers={here !== 'route' && !navMode}
        fitIncludeCourier={false}
        fitPadding={RUN_FIT_PAD}
        followCamera={here === 'route'}
        navigationMode={navMode && driving}
        bearing={bearing}
        followResumeTick={resumeTick}
        onFollowBreak={() => setFollowPaused(true)}
        showNavigation={!navMode}
      />
      <View style={[styles.nav, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.85 }]}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.navCard}>
          <View style={styles.navStatus}>
            <Feather
              name={
                here === 'route'
                  ? 'navigation'
                  : here === 'client'
                    ? 'map-pin'
                    : toClient
                      ? 'package'
                      : 'home'
              }
              size={14}
              color={colors.teal}
            />
            <Text style={styles.title} numberOfLines={1}>
              {phase.title}
            </Text>
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {shortOrderId(d?.order_id ?? '')}
            {toClient ? ` · ${d?.address_label || d?.address_city || 'Client'}` : ` · ${d?.store_name || 'Magasin'}`}
          </Text>
        </View>
        <View
          style={styles.eta}
          accessibilityRole="text"
          accessibilityLabel={`Reste ${kmLabel(distM)}, ${minLabel(etaS)}`}>
          <Text style={styles.etaKm}>{kmLabel(distM)}</Text>
          <Text style={styles.etaTxt}>{minLabel(etaS)}</Text>
        </View>
      </View>
      {driving ? (
        <Animated.View style={[styles.navModeDock, { bottom: Animated.add(sheetH, 14) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={navMode ? 'Quitter le mode navigation' : 'Activer le mode navigation'}
            onPress={() => {
              if (!navMode) {
                setFollowPaused(false);
                setResumeTick((n) => n + 1);
              }
              setNavMode((v) => !v);
            }}
            style={({ pressed }) => [styles.navModeBtn, navMode && styles.navModeBtnOn, pressed && { opacity: 0.88 }]}>
            <Feather name="navigation" size={16} color={navMode ? colors.onAccent : colors.teal} />
            <Text style={[styles.navModeTxt, navMode && styles.navModeTxtOn]}>
              {navMode ? 'Navigation' : 'Mode navigation'}
            </Text>
          </Pressable>
          {navMode && followPaused ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Recentrer"
              onPress={() => {
                setFollowPaused(false);
                setResumeTick((n) => n + 1);
              }}
              style={({ pressed }) => [styles.navModeBtn, pressed && { opacity: 0.88 }]}>
              <Feather name="crosshair" size={16} color={colors.teal} />
              <Text style={styles.navModeTxt}>Recentrer</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.sheet, { height: sheetH, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View {...handlePan.panHandlers} style={styles.handleHit}>
          <View style={styles.handle} />
        </View>
        <ScrollView
          ref={listRef}
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetInner}
          showsVerticalScrollIndicator={false}>
          {tourSummary ? (
            <View style={styles.tourBox}>
              <Text style={styles.tourTitle}>{tourSummary}</Text>
              <Text style={styles.tourSub}>
                {tourPlan?.routeFromKind === 'lastDrop'
                  ? 'Prochain départ : dernière remise'
                  : 'Départ Super U, puis les clients dans l’ordre'}
              </Text>
              {tourPlan?.stops
                .filter((s) => s.status !== 'done')
                .sort((a, b) => a.stopIndex - b.stopIndex)
                .map((s) => (
                  <Pressable
                    key={s.delivery.id}
                    style={[styles.tourStop, s.status === 'current' && styles.tourStopOn]}
                    onPress={() => router.push(`/run/${encodeURIComponent(s.delivery.id)}`)}>
                    <Text style={styles.tourStopNum}>{s.stopIndex}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tourStopLabel}>
                        {s.delivery.address_label || shortOrderId(s.delivery.order_id)}
                      </Text>
                      <Text style={styles.tourStopMeta} numberOfLines={1}>
                        {[s.delivery.address_line, s.delivery.address_city].filter(Boolean).join(', ') ||
                          'Adresse client'}
                      </Text>
                    </View>
                    {s.status === 'current' ? <Text style={styles.tourStopNow}>Maintenant</Text> : null}
                  </Pressable>
                ))}
            </View>
          ) : null}
          {held ? (
            <Text style={styles.cod}>
              Colis dans le sac ? Un geste : je démarre. Ensuite vous ne revenez plus au magasin.
            </Text>
          ) : null}
          {tourPlan?.routeFromKind === 'store' && !toClient ? (
            <View style={[styles.leg, styles.legOn]}>
              <View style={[styles.pin, { backgroundColor: colors.teal }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.legKicker}>Départ</Text>
                <Text style={styles.addrTitle}>Super U</Text>
                <Text style={styles.addrLine}>{d?.store_name || 'Magasin'}</Text>
              </View>
            </View>
          ) : null}
          {tourPlan?.routeFromKind === 'lastDrop' ? (
            <View style={styles.leg}>
              <View style={[styles.pin, { backgroundColor: colors.teal }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.legKicker}>Vous venez de</Text>
                <Text style={styles.addrTitle}>Dernière remise</Text>
                <Text style={styles.addrLine}>{tourPlan.routeFromLabel}</Text>
              </View>
            </View>
          ) : null}
          <View style={[styles.leg, (here === 'client' || here === 'route' || toClient) && styles.legOn]}>
            <View style={styles.pin} />
            <View style={{ flex: 1 }}>
              <Text style={styles.legKicker}>
                {here === 'client' ? 'Vous êtes ici' : 'Prochain arrêt'}
              </Text>
              <Text style={styles.addrTitle}>Client</Text>
              <Text style={styles.addrLine}>
                {[d?.address_line, d?.address_city].filter(Boolean).join(', ') || d?.address_label || 'Cotonou'}
              </Text>
              {d?.address_phone ? <Text style={styles.addrLine}>{d.address_phone}</Text> : null}
            </View>
          </View>
          <View style={styles.specs}>
            <View style={styles.spec}>
              <Text style={styles.specL}>Reste à parcourir</Text>
              <Text style={styles.specV}>{kmLabel(distM)}</Text>
            </View>
            <View style={styles.spec}>
              <Text style={styles.specL}>Temps estimé</Text>
              <Text style={styles.specV}>{minLabel(etaS)}</Text>
            </View>
          </View>
          {note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>NOTE DU CLIENT</Text>
              <Text style={styles.noteTxt}>{note}</Text>
            </View>
          ) : null}
          {!packed ? (
            <Text style={styles.cod}>Ramassage incomplet · le colis n’est pas encore disponible.</Text>
          ) : held ? (
            <PillButton label={busy ? '…' : 'Je démarre la tournée'} onPress={() => void startTourNow()} disabled={busy} />
          ) : driving ? (
            <PillButton label={busy ? '…' : 'Je suis arrivé'} onPress={() => void act('arrived')} disabled={busy} />
          ) : onSite ? (
            <PillButton
              label="Je remets le colis"
              onPress={() => {
                setCodeError(null);
                setCodeOpen(true);
              }}
              disabled={busy}
            />
          ) : cur === 'unassigned' ? (
            <PillButton label={busy ? '…' : NEXT_DELIVERY_LABEL.unassigned} onPress={() => void act('assigned')} disabled={busy} />
          ) : null}
          <View style={styles.tools}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Itinéraire Google Maps"
              onPress={maps}
              style={({ pressed }) => [styles.tool, styles.toolMaps, pressed && styles.toolPressed]}>
              <View style={[styles.toolIcon, { backgroundColor: colors.tealSoft }]}>
                <Feather name="navigation" size={18} color={colors.teal} />
              </View>
              <Text style={styles.toolLabel}>Itinéraire</Text>
              <Text style={styles.toolHint}>Maps</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Contacter le client"
              onPress={() => router.push(`/chat/${encodeURIComponent(threadId)}`)}
              style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}>
              <View style={[styles.toolIcon, { backgroundColor: colors.bg }]}>
                <Feather name="message-circle" size={18} color={colors.text} />
              </View>
              <Text style={styles.toolLabel}>Contacter</Text>
              <Text style={styles.toolHint}>Chat</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Signaler un incident"
              onPress={() => router.push(`/incident/${encodeURIComponent(jobId)}`)}
              style={({ pressed }) => [styles.tool, styles.toolDanger, pressed && styles.toolPressed]}>
              <View style={[styles.toolIcon, { backgroundColor: colors.dangerSoft }]}>
                <Feather name="alert-triangle" size={18} color={colors.danger} />
              </View>
              <Text style={[styles.toolLabel, { color: colors.danger }]}>Incident</Text>
              <Text style={styles.toolHint}>Signaler</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
      <HandoffCodeSheet
        visible={codeOpen}
        busy={busy}
        error={codeError}
        onClose={() => {
          setCodeOpen(false);
          setCodeError(null);
        }}
        onSubmit={(code) => {
          if (code.length !== 4) {
            setCodeError('Saisissez les 4 chiffres.');
            return;
          }
          void act('delivered', { handoffCode: code });
        }}
      />
      <ConfirmModal
        visible={modal === 'err'}
        title="Livraison"
        body={modalText}
        cancelLabel="Fermer"
        onCancel={() => setModal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  map: { ...StyleSheet.absoluteFill },
  nav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  navBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  navCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadow.card,
  },
  navStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...displayFont('800'), fontSize: 14, color: colors.text, flexShrink: 1 },
  sub: { ...bodyFont('500'), fontSize: 11, color: colors.muted, marginTop: 1 },
  eta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    ...shadow.card,
  },
  etaKm: { ...bodyFont('600'), fontSize: 11, color: colors.muted },
  etaTxt: { ...displayFont('800'), color: colors.teal, fontSize: 13, marginTop: 1 },
  navModeDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 4,
  },
  navModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadow.card,
  },
  navModeBtnOn: { backgroundColor: colors.teal },
  navModeTxt: { ...displayFont('800'), fontSize: 13, color: colors.teal },
  navModeTxtOn: { color: colors.onAccent },
  closedBtn: {
    alignSelf: 'center',
    marginTop: 24,
    backgroundColor: colors.teal,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closedBtnTxt: { ...displayFont('800'), fontSize: 13, color: colors.onAccent },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
    ...shadow.tabBar,
  },
  handleHit: { alignItems: 'center', paddingVertical: 14 },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.placeholder,
  },
  sheetScroll: { flex: 1 },
  sheetInner: { paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
  leg: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  legOn: { backgroundColor: colors.tealSoft, borderColor: 'transparent' },
  legKicker: { ...bodyFont('700'), fontSize: 11, letterSpacing: 0.4, color: colors.teal, marginBottom: 2 },
  pin: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.coral, marginTop: 6 },
  addrTitle: { ...displayFont('800'), fontSize: 16, letterSpacing: -0.2 },
  addrLine: { ...bodyFont('400'), fontSize: 14, lineHeight: 20, color: colors.muted },
  specs: { flexDirection: 'row', gap: 10 },
  spec: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.bg,
  },
  specL: { ...bodyFont('600'), fontSize: 11, color: colors.muted },
  specV: { ...displayFont('800'), fontSize: 18, marginTop: 4, letterSpacing: -0.3, color: colors.text },
  cod: { ...bodyFont('700'), color: colors.coral },
  tools: { flexDirection: 'row', gap: 10, marginTop: 4 },
  tool: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 18,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolMaps: { backgroundColor: '#f3fbfa', borderColor: 'rgba(5,141,129,0.18)' },
  toolDanger: { backgroundColor: '#fff7f7', borderColor: 'rgba(239,68,68,0.16)' },
  toolPressed: { opacity: 0.82 },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: { ...displayFont('800'), fontSize: 12, color: colors.text, textAlign: 'center' },
  toolHint: { ...bodyFont('600'), fontSize: 10, color: colors.placeholder, textAlign: 'center' },
  noteBox: {
    backgroundColor: colors.amberSoft,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  noteLabel: { ...bodyFont('700'), fontSize: 11, color: colors.placeholder, letterSpacing: 0.4 },
  noteTxt: { ...bodyFont('600'), fontSize: 15, color: colors.text, lineHeight: 22 },
  tourBox: {
    backgroundColor: colors.bg,
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tourTitle: { ...displayFont('800'), fontSize: 14, color: colors.text },
  tourSub: { ...bodyFont('500'), fontSize: 12, color: colors.muted, marginBottom: 4 },
  tourStop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tourStopOn: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  tourStopNum: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.teal,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 28,
    ...displayFont('800'),
    fontSize: 13,
  },
  tourStopLabel: { ...displayFont('700'), fontSize: 14, color: colors.text },
  tourStopMeta: { ...bodyFont('400'), fontSize: 12, color: colors.muted, marginTop: 1 },
  tourStopNow: { ...bodyFont('700'), fontSize: 11, color: colors.teal },
  reviewInput: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    ...bodyFont('500'),
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
  },
});
