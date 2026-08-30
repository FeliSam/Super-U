import { ConfirmModal, StarPicker } from '@/components/ConfirmModal';
import { LibreMap } from '@/components/LibreMap';
import { OpsStepper } from '@/components/OpsStepper';
import { PillButton } from '@/components/ui';
import { cotonouMap, mapStyles, type LngLat, type MapMarker } from '@/constants/map';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useLocation } from '@/context/LocationContext';
import { useAppViewport } from '@/components/PhoneShell';
import { useRoadRoute } from '@/hooks/useRoadRoute';
import { courierThreadId, formatFcfa, kmLabel, minLabel, shortOrderId } from '@/lib/format';
import { ApiError } from '@/lib/api/http';
import { claimDelivery, setDeliveryStatus } from '@/lib/api/ops';
import {
  DELIVERY_STEPS,
  NEXT_DELIVERY_LABEL,
  deliveryNavLeg,
  nextDeliveryStatus,
  normalizeDeliveryStatus,
  orderIdFromOpsId,
  sameOpsId,
} from '@/lib/opsModel';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RUN_FIT_PAD = { top: 88, bottom: 280, left: 40, right: 40 } as const;

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const delId = decodeURIComponent(id ?? '');
  const { deliveries, refresh } = useBoard();
  const { mapPosition } = useLocation();
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
  const [modal, setModal] = useState<'deliver' | 'fail' | 'ok' | 'err' | null>(null);
  const [modalText, setModalText] = useState('');
  const [customerRating, setCustomerRating] = useState(5);
  const [customerComment, setCustomerComment] = useState('');

  const pickup: LngLat =
    d?.pickup_lng != null && d?.pickup_lat != null ? [d.pickup_lng, d.pickup_lat] : cotonouMap.store;
  const drop: LngLat =
    d?.dropoff_lng != null && d?.dropoff_lat != null ? [d.dropoff_lng, d.dropoff_lat] : cotonouMap.home;
  const toClient = deliveryNavLeg(d?.delivery_status) === 'client';
  const dest = toClient ? drop : pickup;
  const road = useRoadRoute(mapPosition, dest);
  const etaS = road?.durationSeconds ?? d?.route_duration_s;
  const distM = road?.distanceMeters ?? d?.route_distance_m;

  const markers = useMemo((): MapMarker[] => {
    const list: MapMarker[] = [
      { id: 'store', coordinate: pickup, kind: 'store', label: d?.store_name || 'Magasin' },
      { id: 'home', coordinate: drop, kind: 'home', label: 'Client' },
    ];
    if (mapPosition) {
      list.push({ id: 'me', coordinate: mapPosition, kind: 'courier', label: `Vous · ${minLabel(etaS).replace('≈', '')}` });
    }
    return list;
  }, [pickup, drop, mapPosition, d?.store_name, etaS]);

  const cur = normalizeDeliveryStatus(d?.delivery_status);
  const nextStatus = nextDeliveryStatus(cur);
  const packed = !d || d.pick_status === 'packed';
  const jobId = d?.id ?? delId;
  const cash = d?.cash_to_collect ?? 0;
  const note = d?.comment?.trim() ?? '';
  const customerName = [d?.customer_first, d?.customer_last].filter(Boolean).join(' ').trim() || 'le client';

  const showOk = (message: string) => {
    setModalText(message);
    setModal('ok');
  };
  const showErr = (message: string) => {
    setModalText(message);
    setModal('err');
  };

  const act = async (
    status: string,
    extra?: { customerRating?: number; customerComment?: string },
  ) => {
    if (!packed) {
      showErr('Terminez d’abord le ramassage.');
      return;
    }
    setBusy(true);
    try {
      if (!d?.courier_id) {
        await claimDelivery(jobId);
        await refresh();
        if (status === 'unassigned' || status === 'assigned') return;
      }
      if (status === 'unassigned' || status === 'assigned') return;
      const res = await setDeliveryStatus(jobId, status, extra);
      await refresh();
      if (status === 'delivered') {
        const bonus = Number(res.payout ?? 0);
        showOk(bonus > 0 ? `Colis remis. +${formatFcfa(bonus)} ajoutés à vos revenus.` : 'Course clôturée.');
        return;
      }
      if (status === 'failed') {
        showOk('Échec signalé. La course quitte vos missions.');
        return;
      }
    } catch (e) {
      showErr(e instanceof ApiError ? e.message : (e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const maps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest[1]},${dest[0]}&travelmode=driving`;
    void Linking.openURL(url);
  };

  const threadId = courierThreadId(d?.order_id ?? '');

  return (
    <View style={styles.root}>
      <LibreMap
        style={styles.map}
        mapStyle={mapStyles.light}
        center={drop}
        zoom={13.6}
        route={road?.coordinates?.length ? road.coordinates : [mapPosition, dest]}
        markers={markers}
        fitToMarkers
        fitIncludeCourier
        fitPadding={RUN_FIT_PAD}
      />
      <View style={[styles.nav, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backTxt}>Retour</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Livraison {shortOrderId(d?.order_id ?? '')}</Text>
          <Text style={styles.sub}>
            {toClient ? `Client · ${d?.address_phone ?? '—'}` : d?.store_name || 'Magasin'}
          </Text>
        </View>
        <View style={styles.eta}>
          <Text style={styles.etaTxt}>{minLabel(etaS).replace('≈', '').toUpperCase()}</Text>
        </View>
      </View>
      <Animated.View style={[styles.sheet, { height: sheetH, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View {...handlePan.panHandlers} style={styles.handleHit}>
          <View style={styles.handle} />
        </View>
        <ScrollView
          ref={listRef}
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetInner}
          showsVerticalScrollIndicator={false}>
          <OpsStepper steps={DELIVERY_STEPS} status={cur} />
          <View style={styles.addr}>
            <View style={[styles.pin, { backgroundColor: colors.teal }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrTitle}>Magasin</Text>
              <Text style={styles.addrLine}>{d?.store_name || 'Marché Doré'}</Text>
            </View>
          </View>
          <View style={styles.addr}>
            <View style={styles.pin} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrTitle}>Client</Text>
              <Text style={styles.addrLine}>
                {[d?.address_line, d?.address_city].filter(Boolean).join(', ') || d?.address_label || 'Cotonou'}
              </Text>
              {d?.address_phone ? <Text style={styles.addrLine}>{d.address_phone}</Text> : null}
            </View>
          </View>
          <View style={styles.specs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.specL}>{toClient ? 'VERS LE CLIENT' : 'VERS LE MAGASIN'}</Text>
              <Text style={styles.specV}>{kmLabel(distM)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.specL}>TEMPS RÉEL</Text>
              <Text style={styles.specV}>{minLabel(etaS)}</Text>
            </View>
          </View>
          {(d?.cash_to_collect ?? 0) > 0 ? (
            <Text style={styles.cod}>Espèces à encaisser · {formatFcfa(d!.cash_to_collect)}</Text>
          ) : null}
          {note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>NOTE DU CLIENT</Text>
              <Text style={styles.noteTxt}>{note}</Text>
            </View>
          ) : null}
          {!packed ? (
            <Text style={styles.cod}>Ramassage incomplet · le colis n’est pas encore disponible.</Text>
          ) : cur === 'unassigned' ? (
            <PillButton label={busy ? '…' : 'PRENDRE LA COURSE'} onPress={() => void act('assigned')} disabled={busy} />
          ) : nextStatus && nextStatus !== 'unassigned' ? (
            <PillButton
              label={busy ? '…' : NEXT_DELIVERY_LABEL[cur] ?? nextStatus.toUpperCase()}
              onPress={() => {
                if (nextStatus === 'delivered') {
                  setCustomerRating(5);
                  setCustomerComment('');
                  setModal('deliver');
                  return;
                }
                void act(nextStatus);
              }}
              disabled={busy}
            />
          ) : null}
          <PillButton label="NAVIGUER (GOOGLE MAPS)" onPress={maps} />
          <PillButton
            label="CONTACTER LE CLIENT"
            variant="ghost"
            onPress={() => router.push(`/chat/${encodeURIComponent(threadId)}`)}
          />
          <Pressable onPress={() => setModal('fail')}>
            <Text style={styles.fail}>Signaler un échec</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
      <ConfirmModal
        visible={modal === 'deliver'}
        title="Confirmer la livraison"
        body={
          cash > 0
            ? `Encaisser ${formatFcfa(cash)} auprès de ${customerName}, puis clôturer la course.`
            : `Remettre le colis à ${customerName} et clôturer la course.`
        }
        confirmLabel="Marquer livré"
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => {
          void act('delivered', { customerRating, customerComment });
        }}>
        {note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>NOTE DU CLIENT</Text>
            <Text style={styles.noteTxt}>{note}</Text>
          </View>
        ) : null}
        <Text style={styles.noteLabel}>NOTER {customerName.toUpperCase()}</Text>
        <StarPicker value={customerRating} onChange={setCustomerRating} />
        <TextInput
          value={customerComment}
          onChangeText={setCustomerComment}
          placeholder="Comment s’est passée la remise ? (optionnel)"
          placeholderTextColor={colors.placeholder}
          style={styles.reviewInput}
          multiline
        />
      </ConfirmModal>
      <ConfirmModal
        visible={modal === 'fail'}
        title="Signaler un échec"
        body="Le client n’a pas pu être livré. La course quittera vos missions."
        confirmLabel="Confirmer l’échec"
        danger
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => {
          void act('failed');
        }}
      />
      <ConfirmModal
        visible={modal === 'ok'}
        title="C’est noté"
        body={modalText}
        cancelLabel="Fermer"
        onCancel={() => {
          setModal(null);
          router.replace('/(tabs)/missions');
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
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  back: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadow.card,
  },
  backTxt: { ...displayFont('700'), fontSize: 13, color: colors.text },
  title: { ...displayFont('800'), fontSize: 16, color: colors.text },
  sub: { ...bodyFont('400'), fontSize: 13, color: colors.muted },
  eta: { backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, ...shadow.card },
  etaTxt: { ...displayFont('800'), color: colors.teal, fontSize: 13 },
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
  sheetInner: { paddingHorizontal: 24, paddingBottom: 24, gap: 14 },
  addr: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pin: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.coral },
  addrTitle: { ...displayFont('800'), fontSize: 16 },
  addrLine: { ...bodyFont('400'), fontSize: 14, color: colors.muted },
  specs: { flexDirection: 'row', gap: 16 },
  specL: { ...bodyFont('400'), fontSize: 12, color: colors.placeholder },
  specV: { ...displayFont('800'), fontSize: 16, marginTop: 2 },
  cod: { ...bodyFont('700'), color: colors.coral },
  fail: { ...displayFont('800'), color: colors.danger, textAlign: 'center' },
  noteBox: {
    backgroundColor: colors.amberSoft,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  noteLabel: { ...bodyFont('700'), fontSize: 11, color: colors.placeholder, letterSpacing: 0.4 },
  noteTxt: { ...bodyFont('600'), fontSize: 15, color: colors.text, lineHeight: 22 },
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
