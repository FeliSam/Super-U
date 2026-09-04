import { ConfirmModal } from '@/components/ConfirmModal';
import { HandoffCodeSheet } from '@/components/HandoffCodeSheet';
import { LibreMap } from '@/components/LibreMap';
import { PillButton } from '@/components/ui';
import { haversineMeters, mapStyles, remainingToPoint, type LngLat, type MapMarker } from '@/constants/map';
import { bodyFont, colors, displayFont, iceSurface, radius, shadow } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useLocation } from '@/context/LocationContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useAppViewport } from '@/components/PhoneShell';
import { useRoadRoute } from '@/hooks/useRoadRoute';
import { useMultiRoadRoute } from '@/hooks/useMultiRoadRoute';
import { courierThreadId, kmLabel, minLabel, shortOrderId } from '@/lib/format';
import { showToast } from '@/lib/toastBus';
import { ApiError } from '@/lib/api/http';
import { claimDelivery, fetchOrder, setDeliveryStatus, startDeliveryRun } from '@/lib/api/ops';
import { clientCoord, courierAnchor, DELIVERY_PHASE, offsetBeside, storeCoord } from '@/lib/courierTrack';
import { goBack, tabPaths } from '@/lib/navigation';
import { prefetchRoadRoute } from '@/lib/roadRoute';
import { headingAlongRoute, liveEtaSeconds } from '@/lib/vehicleMotion';
import {
  buildCourierTourPlan,
  buildTourMapMarkers,
  googleMapsTourUrl,
  nextDeliveryInTour,
  rememberLastDropoff,
  rememberLastDropoffPoint,
  readLastDropoff,
  clearLastDropoff,
  tourRouteSummary,
} from '@/lib/tourRoute';
import {
  MAX_ACTIVE_DELIVERIES,
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

type ClosedRun = {
  kind: 'delivered' | 'failed' | 'cancelled' | 'taken' | 'unpacked' | 'missing';
  title: string;
  body: string;
  orderRef?: string;
};

function closedTone(kind: ClosedRun['kind']) {
  if (kind === 'delivered') return { icon: 'check-circle' as const, fg: colors.teal, bg: colors.tealSoft };
  if (kind === 'failed') return { icon: 'x-circle' as const, fg: colors.coral, bg: colors.coralSoft };
  if (kind === 'cancelled') return { icon: 'slash' as const, fg: colors.muted, bg: colors.bg };
  if (kind === 'taken') return { icon: 'user-check' as const, fg: colors.teal, bg: colors.tealSoft };
  if (kind === 'unpacked') return { icon: 'package' as const, fg: colors.amber, bg: colors.amberSoft };
  return { icon: 'search' as const, fg: colors.muted, bg: colors.bg };
}

export default function RunScreen() {
  const { id, hop } = useLocalSearchParams<{ id: string; hop?: string }>();
  const delId = decodeURIComponent(id ?? '');
  const { deliveries, tourHop, refresh } = useBoard();
  const { staff } = useStaffAuth();
  const { mapPosition, heading: gpsHeading, routeCoordinates } = useLocation();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useAppViewport();
  const sheetMin = Math.round(screenH * 0.42 * 0.85);
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
  const [closed, setClosed] = useState<ClosedRun | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [arriveOpen, setArriveOpen] = useState(false);
  const [nextLeg, setNextLeg] = useState<{
    id: string;
    orderRef: string;
    address: string;
    from: LngLat;
    fromLabel: string;
  } | null>(null);
  const [navMode, setNavMode] = useState(false);
  const [resumeTick, setResumeTick] = useState(0);

  useEffect(() => {
    if (nextLeg) return;
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
        const ref = shortOrderId(String(row.id ?? row.order_id ?? oid));
        if (shop === 'delivered' || del === 'delivered') {
          setClosed({
            kind: 'delivered',
            title: 'Commande déjà livrée',
            body: 'Cette course est terminée. Rien à faire sur le terrain — retrouvez-la dans l’historique.',
            orderRef: ref,
          });
        } else if (del === 'failed') {
          setClosed({
            kind: 'failed',
            title: 'Livraison non aboutie',
            body: 'Cette course s’est arrêtée avant la remise. Consultez l’historique pour le détail.',
            orderRef: ref,
          });
        } else if (shop === 'cancelled' || del === 'cancelled') {
          setClosed({
            kind: 'cancelled',
            title: 'Course annulée',
            body: 'Le client ou le magasin a annulé. Cette commande n’est plus à livrer.',
            orderRef: ref,
          });
        } else if (courier) {
          setClosed({
            kind: 'taken',
            title: 'Course déjà prise',
            body: 'Un autre livreur s’en occupe. Revenez à la file pour une autre mission.',
            orderRef: ref,
          });
        } else if (String(row.pick_status ?? '') !== 'packed') {
          setClosed({
            kind: 'unpacked',
            title: 'Colis pas encore prêt',
            body: 'Le ramassage n’est pas terminé. Attendez que le magasin valide le colis.',
            orderRef: ref,
          });
        }
      })
      .catch(() => {
        if (live) {
          setClosed({
            kind: 'missing',
            title: 'Course introuvable',
            body: 'Cette mission n’est plus disponible. Elle a peut-être déjà été clôturée.',
          });
        }
      });
    return () => {
      live = false;
    };
  }, [d, delId, nextLeg]);

  useEffect(() => {
    if (nextLeg) return;
    if (!d || !staff?.id) return;
    const status = normalizeDeliveryStatus(d.delivery_status);
    if (status !== 'delivered' && status !== 'failed') return;
    const next = nextDeliveryInTour(deliveries, staff.id, d.id);
    if (next) {
      const fromLabel =
        d.address_label?.trim() ||
        [d.address_line, d.address_city].filter(Boolean).join(', ') ||
        'Dernière remise';
      rememberLastDropoff(staff.id, d);
      setNextLeg({
        id: next.id,
        orderRef: shortOrderId(next.order_id),
        address:
          next.address_label?.trim() ||
          [next.address_line, next.address_city].filter(Boolean).join(', ') ||
          'Prochain client',
        from: clientCoord(d),
        fromLabel,
      });
      return;
    }
    clearLastDropoff(staff.id);
    router.replace('/(tabs)/missions');
  }, [d?.delivery_status, d?.id, deliveries, staff?.id, nextLeg]);

  useEffect(() => {
    if (String(hop) === '1') setNavMode(true);
  }, [hop, delId]);

  const pickup: LngLat = storeCoord(d);
  const drop: LngLat = clientCoord(d);
  const toClient = deliveryNavLeg(d?.delivery_status) === 'client';
  const dest = toClient ? drop : pickup;

  const rememberedDrop = staff?.id ? readLastDropoff(staff.id, d?.store_id) : null;
  const tourPlan = useMemo(
    () =>
      buildCourierTourPlan(deliveries, staff?.id, {
        focusDeliveryId: d?.id,
        courierPosition: mapPosition,
        lastDrop: rememberedDrop?.from ?? (tourHop ? [tourHop.lng, tourHop.lat] : null),
        lastDropLabel: rememberedDrop?.label ?? tourHop?.label,
        lastDropStoreId: rememberedDrop?.storeId ?? tourHop?.storeId,
      }),
    [deliveries, staff?.id, d?.id, mapPosition, tourHop, rememberedDrop?.from?.[0], rememberedDrop?.from?.[1], hop],
  );

  const vehicle = staff?.vehicle;
  // Origine stable (magasin / dernière remise) — le tronçon restant est coupé sur la carte.
  const legRoad = useRoadRoute(tourPlan?.routeFrom ?? pickup, tourPlan?.navTo ?? dest, vehicle);
  const tourRoad = useMultiRoadRoute(
    tourPlan && tourPlan.routeWaypoints.length >= 2 ? tourPlan.routeWaypoints : null,
    vehicle,
  );
  // Priorité : géométrie suivie par la simu, puis jambe OSRM, puis tour.
  const road = useMemo(() => {
    if (routeCoordinates && routeCoordinates.length >= 2) {
      return {
        coordinates: routeCoordinates,
        distanceMeters:
          legRoad && !legRoad.approximated
            ? legRoad.distanceMeters
            : remainingToPoint(
                routeCoordinates[0],
                routeCoordinates[routeCoordinates.length - 1],
                routeCoordinates,
              ),
        durationSeconds: legRoad && !legRoad.approximated ? legRoad.durationSeconds : 0,
        approximated: false as const,
      };
    }
    if (legRoad && !legRoad.approximated) return legRoad;
    if (tourRoad && !tourRoad.approximated) return tourRoad;
    return legRoad ?? tourRoad;
  }, [routeCoordinates, legRoad, tourRoad]);

  useEffect(() => {
    if (tourPlan && tourPlan.routeWaypoints.length >= 2) {
      prefetchRoadRoute(tourPlan.routeWaypoints, vehicle);
    }
  }, [tourPlan?.focusDelivery.id, tourPlan?.routeFromKind, tourPlan?.routeFrom[0], tourPlan?.routeFrom[1], vehicle]);
  const tourSummary = tourPlan ? tourRouteSummary(tourPlan) : null;
  const cur = normalizeDeliveryStatus(d?.delivery_status);
  const here = courierAnchor(cur);
  const phase = DELIVERY_PHASE[cur];
  const remainM =
    here === 'client' ? 0 : remainingToPoint(mapPosition, dest, road?.coordinates ?? legRoad?.coordinates);
  const etaS = liveEtaSeconds(remainM, vehicle, road);
  const distM = remainM;

  /** Pin livreur : chez le client → à ~8 m du point commande. */
  const courierPinAt = useMemo((): LngLat => {
    if (here === 'client') {
      if (haversineMeters(mapPosition, drop) > 35) return offsetBeside(drop, pickup, 8);
      return mapPosition;
    }
    if (here === 'store' && haversineMeters(mapPosition, pickup) > 50) {
      return offsetBeside(pickup, drop, 12);
    }
    return mapPosition;
  }, [here, mapPosition, drop, pickup]);

  const markers = useMemo((): MapMarker[] => {
    if (tourPlan) {
      const you =
        here === 'client' ? 'Vous · chez le client' : here === 'route' ? 'Vous · en route' : 'Vous · magasin';
      return buildTourMapMarkers(
        tourPlan,
        courierPinAt,
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
    list.push({
      id: 'me',
      coordinate: courierPinAt,
      kind: 'courier',
      vehicle: (staff?.vehicle as MapMarker['vehicle']) || 'moto',
      label: you,
    });
    return list;
  }, [tourPlan, pickup, drop, courierPinAt, d?.store_name, here, staff?.vehicle, toClient]);
  const packed = !d || d.pick_status === 'packed';
  const jobId = d?.id ?? delId;
  const note = d?.comment?.trim() ?? '';
  const held = Boolean(d && isDeliveryHeld(d));
  const heldCount = useMemo(
    () => deliveries.filter((x) => x.courier_id === staff?.id && isDeliveryHeld(x)).length,
    [deliveries, staff?.id],
  );
  const canAddMoreOrders = held && packed && heldCount > 0 && heldCount < MAX_ACTIVE_DELIVERIES;
  const driving = cur === 'picked_up' || cur === 'en_route';
  const onSite = cur === 'arrived';
  const nearClientM = haversineMeters(mapPosition, dest);
  const nearClient = (driving || onSite) && (nearClientM <= 300 || (typeof distM === 'number' && distM <= 300));

  useEffect(() => {
    if (!driving) {
      setNavMode(false);
    }
  }, [driving]);

  const nearToastFor = useRef<string | null>(null);
  useEffect(() => {
    if (!nearClient || !jobId) return;
    if (nearToastFor.current === jobId) return;
    nearToastFor.current = jobId;
    showToast({
      title: 'Moins de 300 m du client',
      body: 'Préparez la remise et demandez le code.',
      tone: 'error',
      durationMs: 7000,
    });
  }, [nearClient, jobId]);

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
        const nextJob =
          (res.nextDeliveryId ? deliveries.find((x) => x.id === res.nextDeliveryId) : null) ||
          (staff ? nextDeliveryInTour(deliveries, staff.id, jobId) : null);
        const nextId = nextJob?.id ?? res.nextDeliveryId ?? null;
        if (nextId) {
          setCodeOpen(false);
          const fromLabel =
            d?.address_label?.trim() ||
            [d?.address_line, d?.address_city].filter(Boolean).join(', ') ||
            'Dernière remise';
          setNextLeg({
            id: nextId,
            orderRef: shortOrderId(nextJob?.order_id ?? nextId),
            address:
              nextJob?.address_label?.trim() ||
              [nextJob?.address_line, nextJob?.address_city].filter(Boolean).join(', ') ||
              'Prochain client',
            from: clientCoord(d),
            fromLabel,
          });
          if (nextJob) prefetchRoadRoute([clientCoord(d), clientCoord(nextJob)]);
          return;
        }
        goAfterStop(null);
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

  const startNextLeg = async () => {
    if (!nextLeg) return;
    setBusy(true);
    try {
      if (staff?.id) {
        rememberLastDropoffPoint(staff.id, nextLeg.from, nextLeg.fromLabel);
      }
      const nextJob = deliveries.find((x) => x.id === nextLeg.id);
      if (nextJob) prefetchRoadRoute([nextLeg.from, clientCoord(nextJob)]);
      await setDeliveryStatus(nextLeg.id, 'en_route');
      await refresh();
      const id = nextLeg.id;
      setNextLeg(null);
      router.replace(`/run/${encodeURIComponent(id)}?hop=1`);
    } catch (e) {
      showErr(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const maps = () => {
    const origin = tourPlan?.routeFrom ?? mapPosition;
    const next = tourPlan?.navTo ?? dest;
    void Linking.openURL(googleMapsTourUrl(origin, [next]));
  };

  const mapRoute = useMemo(() => {
    // Toujours la géométrie du déplacement en premier.
    if (routeCoordinates && routeCoordinates.length >= 2) return routeCoordinates;
    if (road?.coordinates && road.coordinates.length >= 2) return road.coordinates;
    const from = tourPlan?.routeFrom ?? pickup;
    const to = tourPlan?.navTo ?? dest;
    if (
      Number.isFinite(from?.[0]) &&
      Number.isFinite(from?.[1]) &&
      Number.isFinite(to?.[0]) &&
      Number.isFinite(to?.[1])
    ) {
      return [from, to] as LngLat[];
    }
    return undefined;
  }, [
    road?.coordinates,
    routeCoordinates,
    tourPlan?.routeFrom?.[0],
    tourPlan?.routeFrom?.[1],
    tourPlan?.navTo?.[0],
    tourPlan?.navTo?.[1],
    pickup[0],
    pickup[1],
    dest[0],
    dest[1],
  ]);
  const bearing = (gpsHeading != null && Number.isFinite(gpsHeading) ? gpsHeading : headingAlongRoute(mapPosition, mapRoute ?? [mapPosition, dest])) ?? 0;
  const mapMarkers = useMemo(
    () =>
      markers.map((m) =>
        m.kind === 'courier' ? { ...m, heading: navMode ? 0 : bearing } : m,
      ),
    [markers, navMode, bearing],
  );

  const threadId = d?.comms_thread_id || courierThreadId(d?.order_id ?? '');

  if (nextLeg) {
    return (
      <View style={[styles.root, styles.closedRoot, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.closedBody}>
          <View style={[styles.closedMark, { backgroundColor: colors.tealSoft }]}>
            <Feather name="navigation" size={36} color={colors.teal} />
          </View>
          <Text style={styles.closedKicker}>COMMANDE SUIVANTE</Text>
          <Text style={styles.closedTitle}>Livraison {nextLeg.orderRef} commencée</Text>
          <Text style={styles.closedBodyTxt}>
            Le colis précédent est remis. Direction le client suivant : {nextLeg.address}.
          </Text>
          <View style={styles.closedRef}>
            <Feather name="map-pin" size={14} color={colors.muted} />
            <Text style={styles.closedRefTxt}>{nextLeg.address}</Text>
          </View>
        </View>
        <View style={[styles.closedActions, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <PillButton
            label={busy ? '…' : 'Commencer la course'}
            onPress={() => void startNextLeg()}
            disabled={busy}
          />
        </View>
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

  if (!d && closed) {
    const tone = closedTone(closed.kind);
    return (
      <View style={[styles.root, styles.closedRoot, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.closedNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() => goBack(tabPaths.missions)}
            style={({ pressed }) => [styles.navBtn, iceSurface(), pressed && { opacity: 0.85 }]}>
            <Feather name="chevron-left" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.closedBody}>
          <View style={[styles.closedMark, { backgroundColor: tone.bg }]}>
            <Feather name={tone.icon} size={36} color={tone.fg} />
          </View>
          <Text style={styles.closedKicker}>
            {closed.kind === 'delivered'
              ? 'TERMINÉ'
              : closed.kind === 'failed'
                ? 'ÉCHEC'
                : closed.kind === 'cancelled'
                  ? 'ANNULÉ'
                  : 'INDISPONIBLE'}
          </Text>
          <Text style={styles.closedTitle}>{closed.title}</Text>
          <Text style={styles.closedBodyTxt}>{closed.body}</Text>
          {closed.orderRef ? (
            <View style={styles.closedRef}>
              <Feather name="file-text" size={14} color={colors.muted} />
              <Text style={styles.closedRefTxt}>{closed.orderRef}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.closedActions, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <PillButton label="VOIR L’HISTORIQUE" onPress={() => router.replace('/(tabs)/history')} />
          <PillButton label="RETOUR AUX COURSES" variant="ghost" onPress={() => router.replace('/(tabs)/missions')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LibreMap
        style={styles.map}
        mapStyle={mapStyles.light}
        center={navMode || here === 'route' ? mapPosition : here === 'client' ? courierPinAt : drop}
        zoom={navMode ? 16.8 : here === 'route' ? 14.4 : 13.6}
        route={mapRoute}
        markers={mapMarkers}
        fitToMarkers={String(hop) === '1' || (here !== 'route' && !navMode)}
        fitIncludeCourier={false}
        fitPadding={RUN_FIT_PAD}
        followCamera={navMode || here === 'route'}
        navigationMode={navMode && driving}
        bearing={bearing}
        followResumeTick={resumeTick}
        showNavigation={!navMode}
      />
      <View style={[styles.nav, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => goBack(tabPaths.missions)}
          style={({ pressed }) => [styles.navBtn, iceSurface(), pressed && { opacity: 0.85 }]}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <View style={[styles.navCard, iceSurface()]}>
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
          style={[styles.eta, iceSurface()]}
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
              const next = !navMode;
              setResumeTick((n) => n + 1);
              setNavMode(next);
            }}
            style={({ pressed }) => [styles.navModeBtn, navMode && styles.navModeBtnOn, pressed && { opacity: 0.88 }]}>
            <Feather name="navigation" size={16} color={navMode ? colors.onAccent : colors.teal} />
            <Text style={[styles.navModeTxt, navMode && styles.navModeTxtOn]}>
              {navMode ? 'Navigation' : 'Mode navigation'}
            </Text>
            </Pressable>
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
              {canAddMoreOrders
                ? `Vous avez ${heldCount} colis sur ${MAX_ACTIVE_DELIVERIES}. Vous pouvez encore en ajouter dans le même Super U, ou démarrer la tournée.`
                : 'Colis dans le sac ? Un geste : je démarre. Ensuite vous ne revenez plus au magasin.'}
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
            <View style={styles.ctaStack}>
              {canAddMoreOrders ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter d’autres commandes"
                  onPress={() => router.push('/(tabs)/missions')}
                  disabled={busy}
                  style={({ pressed }) => [styles.addMore, pressed && { opacity: 0.85 }, busy && { opacity: 0.5 }]}>
                  <Text style={styles.addMoreTxt}>
                    Ajouter d’autres commandes ({heldCount}/{MAX_ACTIVE_DELIVERIES})
                  </Text>
                </Pressable>
              ) : null}
              <PillButton
                label={busy ? '…' : 'Je démarre la tournée'}
                onPress={() => void startTourNow()}
                disabled={busy}
              />
            </View>
          ) : driving ? (
            <PillButton
              label={busy ? '…' : 'Je suis arrivé'}
              onPress={() => setArriveOpen(true)}
              disabled={busy}
            />
          ) : onSite ? (
            <PillButton
              label={busy ? '…' : 'Je remets le colis'}
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
        visible={arriveOpen}
        title="Vous êtes arrivé ?"
        body="Confirmez uniquement si vous êtes chez le client. La remise du colis suivra."
        cancelLabel="Pas encore"
        confirmLabel="Oui, je suis arrivé"
        busy={busy}
        onCancel={() => setArriveOpen(false)}
        onConfirm={() => {
          setArriveOpen(false);
          void act('arrived');
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...displayFont('800'), fontSize: 14, color: colors.text, flexShrink: 1 },
  sub: { ...bodyFont('500'), fontSize: 11, color: colors.muted, marginTop: 1 },
  eta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
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
  closedRoot: { backgroundColor: colors.bg },
  closedNav: { paddingHorizontal: 12, paddingBottom: 8 },
  closedBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  closedMark: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  closedKicker: {
    ...displayFont('800'),
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.teal,
  },
  closedTitle: {
    ...displayFont('800'),
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.text,
    textAlign: 'center',
  },
  closedBodyTxt: {
    ...bodyFont('500'),
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 340,
  },
  closedRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closedRefTxt: { ...displayFont('700'), fontSize: 13, color: colors.text },
  closedActions: { paddingHorizontal: 20, gap: 10 },
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
  cod: {
    ...bodyFont('600'),
    fontSize: 13,
    lineHeight: 19,
    color: colors.teal,
    backgroundColor: colors.tealSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ctaStack: { gap: 10, width: '100%' },
  addMore: {
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.teal,
  },
  addMoreTxt: { ...displayFont('800'), fontSize: 15, color: colors.teal, textAlign: 'center' },
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
