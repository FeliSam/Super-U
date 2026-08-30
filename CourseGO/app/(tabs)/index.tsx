import { ApiBanner } from '@/components/ApiBanner';
import { LibreMap } from '@/components/LibreMap';
import { MissionCard, deliveryCardProps, pickCardProps } from '@/components/MissionCard';
import { IconBtn, PillButton } from '@/components/ui';
import { cotonouMap, mapStyles, type LngLat, type MapMarker } from '@/constants/map';
import { bodyFont, colors, displayFont, radius, shadow, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useLocation } from '@/context/LocationContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useStaffNotifications } from '@/context/NotificationsContext';
import { useAppViewport } from '@/components/PhoneShell';
import { useRoadRoute } from '@/hooks/useRoadRoute';
import { formatFcfa, kmLabel, minLabel, shortOrderId } from '@/lib/format';
import { ApiError } from '@/lib/api/http';
import { claimDelivery } from '@/lib/api/ops';
import {
  deliveryNavLeg,
  isActivePickStatus,
  isDeliveryActive,
  isDeliveryClaimable,
  isPickBoardStatus,
} from '@/lib/opsModel';
import { staffPhotoSource } from '@/lib/staffPhoto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { staff } = useStaffAuth();
  const { unreadCount } = useStaffNotifications();
  const { jobs, deliveries, online, setOnline, refresh, refreshing, lastError } = useBoard();
  const { mapPosition } = useLocation();

  useFocusEffect(
    useCallback(() => {
      void refresh({ silent: true });
    }, [refresh]),
  );
  const insets = useSafeAreaInsets();
  const { height: screenH } = useAppViewport();
  const tabLift = TAB_BAR_HEIGHT + TAB_BAR_MARGIN + Math.max(insets.bottom, 8);
  const sheetMin = Math.round(screenH * 0.28);
  const sheetMax = Math.max(sheetMin, Math.round(screenH * 0.48));
  const [sheetOpen, setSheetOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
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

  const minePick = jobs.filter((j) => isActivePickStatus(j.pick_status)).slice(0, 1);
  const mineDel = deliveries.filter(isDeliveryActive).slice(0, 1);
  const blockedByWork = minePick.length > 0 || mineDel.length > 0;
  const claimable = deliveries.filter(isDeliveryClaimable);
  const preferredDel = claimable.find((d) => d.picker_id === staff?.id) ?? claimable[0];
  const readyToTake = blockedByWork ? [] : preferredDel ? [preferredDel] : [];
  const filePick = jobs.filter((j) => isPickBoardStatus(j.pick_status)).length;
  const greet = staff?.firstName ?? 'Coursier';

  const focusDel = mineDel[0] ?? deliveries.find((d) => d.order_id === minePick[0]?.order_id) ?? readyToTake[0];
  const storePt: LngLat =
    focusDel?.pickup_lng != null && Math.abs(focusDel.pickup_lng) > 0.2
      ? [focusDel.pickup_lng, focusDel.pickup_lat!]
      : cotonouMap.store;
  const clientPt: LngLat | null =
    focusDel?.dropoff_lng != null && Math.abs(focusDel.dropoff_lng) > 0.2
      ? [focusDel.dropoff_lng, focusDel.dropoff_lat!]
      : null;
  const goingToClient = Boolean(mineDel[0] && deliveryNavLeg(mineDel[0].delivery_status) === 'client');
  const dest: LngLat = goingToClient && clientPt ? clientPt : storePt;
  const road = useRoadRoute(mapPosition, dest);
  const etaS = road?.durationSeconds;
  const destName = goingToClient
    ? [focusDel?.address_line, focusDel?.address_city].filter(Boolean).join(', ') ||
      focusDel?.address_label ||
      'Client'
    : focusDel?.store_name || 'Magasin';
  const destKicker = minePick[0]
    ? `Ramassage ${shortOrderId(minePick[0].order_id)}`
    : goingToClient
      ? `Livraison ${shortOrderId(focusDel?.order_id ?? '')}`
      : mineDel[0]
        ? `Aller au magasin · ${shortOrderId(mineDel[0].order_id)}`
        : 'En attente';

  const mapMarkers = useMemo(() => {
    const markers: MapMarker[] = [
      { id: 'store', coordinate: storePt, kind: 'store', label: focusDel?.store_name || 'Magasin' },
    ];
    if (clientPt) {
      markers.push({ id: 'home', coordinate: clientPt, kind: 'home', label: 'Client' });
    }
    markers.push({
      id: 'me',
      coordinate: mapPosition,
      kind: 'courier',
      label: `Vous · ${minLabel(etaS).replace('≈', '')}`,
    });
    return markers;
  }, [storePt, clientPt, mapPosition, etaS, focusDel?.store_name]);

  const pickupRoute = road?.coordinates?.length ? road.coordinates : [mapPosition, dest];

  const goCourses = () => router.push('/(tabs)/missions');

  const takeDelivery = async (id: string) => {
    setBusy(id);
    try {
      await claimDelivery(id);
      await refresh();
      router.push(`/run/${encodeURIComponent(id)}`);
    } catch (e) {
      Alert.alert('Livraison', e instanceof ApiError ? e.message : (e as Error).message);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <LibreMap
        style={styles.map}
        mapStyle={mapStyles.light}
        center={mapPosition}
        zoom={13.2}
        markers={mapMarkers}
        route={pickupRoute}
        fitToMarkers
        fitIncludeCourier
        fitPadding={{ top: 100, bottom: Math.round(screenH * 0.4), left: 40, right: 40 }}
        showNavigation={false}
      />

      <View style={[styles.top, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.identity}>
          <Image source={staffPhotoSource(staff?.photoUrl)} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Bonjour,</Text>
            <Text style={styles.name} numberOfLines={1}>
              {greet}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => setOnline(!online)} style={[styles.statusChip, !online && styles.statusOff]}>
          <View style={styles.dot} />
          <Text style={styles.statusTxt}>{online ? 'En ligne' : 'Repos'}</Text>
        </Pressable>
        <IconBtn name="bell" bg={colors.white} badge={unreadCount} onPress={() => router.push('/notifications')} />
      </View>

      <Animated.View
        style={[styles.etaCard, { bottom: Animated.add(sheetH, 12) }]}
        pointerEvents="box-none">
        <Pressable
          style={styles.etaInner}
          onPress={
            mineDel[0]
              ? () => router.push(`/run/${encodeURIComponent(mineDel[0].id)}`)
              : minePick[0]
                ? () => router.push(`/job/${encodeURIComponent(minePick[0].id)}`)
                : undefined
          }>
          <View style={{ flex: 1 }}>
            <Text style={styles.etaKicker}>{destKicker}</Text>
            <Text style={styles.etaStore} numberOfLines={1}>
              {destName}
            </Text>
            {goingToClient && focusDel?.address_phone ? (
              <Text style={styles.etaMeta} numberOfLines={1}>
                {focusDel.address_phone}
                {(focusDel.cash_to_collect ?? 0) > 0 ? ` · COD ${formatFcfa(focusDel.cash_to_collect)}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.etaValue}>{minLabel(etaS)}</Text>
            <Text style={styles.etaKm}>{kmLabel(road?.distanceMeters)}</Text>
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.sheet, { height: sheetH, paddingBottom: tabLift }]}>
        <View {...handlePan.panHandlers} style={styles.handleHit}>
          <View style={styles.handle} />
        </View>
        {lastError ? <ApiBanner message={lastError} onRetry={() => void refresh()} /> : null}
        <ScrollView
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listInner}
          scrollEventThrottle={16}
          bounces
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          {!online ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Vous êtes en pause</Text>
              <Text style={styles.emptySub}>Passez en ligne pour reprendre une course.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.kicker}>Maintenant</Text>
              {minePick.map((j) => (
                <MissionCard
                  key={j.id}
                  {...pickCardProps(j)}
                  cta="CONTINUER"
                  onAccept={() => router.push(`/job/${encodeURIComponent(j.id)}`)}
                  onPress={() => router.push(`/job/${encodeURIComponent(j.id)}`)}
                />
              ))}
              {mineDel.map((d) => (
                <MissionCard
                  key={d.id}
                  {...deliveryCardProps(d)}
                  cta="SUIVRE"
                  onAccept={() => router.push(`/run/${encodeURIComponent(d.id)}`)}
                  onPress={() => router.push(`/run/${encodeURIComponent(d.id)}`)}
                />
              ))}
              {readyToTake.map((d) => (
                <MissionCard
                  key={d.id}
                  {...deliveryCardProps(d)}
                  cta={busy === d.id ? '…' : 'PRENDRE'}
                  onAccept={() => void takeDelivery(d.id)}
                  onPress={() => void takeDelivery(d.id)}
                />
              ))}
              {!minePick.length && !mineDel.length && !readyToTake.length ? (
                <Text style={styles.emptySub}>
                  Rien en cours. Les nouvelles commandes à ramasser sont dans Courses.
                </Text>
              ) : !minePick.length && !mineDel.length && readyToTake.length ? (
                <Text style={styles.emptySub}>Colis prêt — prenez la livraison pour partir.</Text>
              ) : null}
              {filePick > 0 || readyToTake.length ? (
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text style={styles.statN}>{filePick}</Text>
                    <Text style={styles.statL}>file magasin</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={[styles.statN, { color: colors.coral }]}>{readyToTake.length}</Text>
                    <Text style={styles.statL}>colis prêts</Text>
                  </View>
                </View>
              ) : null}
              <PillButton label="VOIR LA FILE · COURSES" onPress={goCourses} variant="ghost" />
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  map: { ...StyleSheet.absoluteFill },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 8,
    ...shadow.card,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  hello: { ...bodyFont('400'), fontSize: 11, color: colors.muted },
  name: { ...displayFont('800'), fontSize: 15, color: colors.text },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.teal,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...shadow.card,
  },
  statusOff: { backgroundColor: '#6b7280' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  statusTxt: { ...displayFont('800'), fontSize: 12, color: colors.onAccent },
  etaCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 6,
  },
  etaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...shadow.card,
  },
  etaKicker: { ...bodyFont('600'), fontSize: 11, color: colors.muted },
  etaValue: { ...displayFont('900'), fontSize: 20, color: colors.teal },
  etaStore: { ...displayFont('800'), fontSize: 13, color: colors.text, marginTop: 1 },
  etaMeta: { ...bodyFont('600'), fontSize: 11, color: colors.muted, marginTop: 2 },
  etaKm: { ...bodyFont('600'), fontSize: 11, color: colors.muted, marginTop: 2 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 16,
    paddingTop: 8,
    overflow: 'hidden',
    ...shadow.tabBar,
  },
  handleHit: { alignItems: 'center', paddingVertical: 14, marginHorizontal: -16 },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.placeholder,
    marginBottom: 8,
  },
  list: { flex: 1 },
  listInner: { gap: 12, paddingBottom: 16 },
  kicker: {
    ...displayFont('800'),
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  stats: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statN: { ...displayFont('900'), fontSize: 22, color: colors.teal },
  statL: { ...bodyFont('600'), fontSize: 12, color: colors.muted, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyTitle: { ...displayFont('800'), fontSize: 16 },
  emptySub: { ...bodyFont('400'), fontSize: 14, color: colors.muted, textAlign: 'center' },
});
