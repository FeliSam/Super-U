import { ApiBanner } from '@/components/ApiBanner';
import { LibreMap } from '@/components/LibreMap';
import { MissionCard, deliveryCardProps, pickCardProps } from '@/components/MissionCard';
import { NowPresence } from '@/components/NowPresence';
import { PullBanner, pullRefreshControl } from '@/components/PullRefresh';
import { IconBtn, PillButton } from '@/components/ui';
import { cotonouMap, mapStyles, remainingToPoint, type LngLat, type MapMarker } from '@/constants/map';
import { bodyFont, colors, displayFont, iceSurface, radius, shadow, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useLocation } from '@/context/LocationContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useStaffNotifications } from '@/context/NotificationsContext';
import { useAppViewport } from '@/components/PhoneShell';
import { useRoadRoute } from '@/hooks/useRoadRoute';
import { useMultiRoadRoute } from '@/hooks/useMultiRoadRoute';
import { kmLabel, minLabel, shortOrderId } from '@/lib/format';
import {
  deliveryNavLeg,
  isActivePickStatus,
  isDeliveryActive,
  isDeliveryHeld,
  isDeliveryStarted,
  MAX_ACTIVE_DELIVERIES,
} from '@/lib/opsModel';
import { livePosKey, mapStoresForNow, suggestedStore } from '@/lib/nearestStore';
import { liveEtaSeconds, motoEtaSeconds } from '@/lib/vehicleMotion';
import {
  buildCourierTourPlan,
  buildTourMapMarkers,
  readLastDropoff,
  tourRouteSummary,
} from '@/lib/tourRoute';
import { staffPhotoSource } from '@/lib/staffPhoto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { staff } = useStaffAuth();
  const { unreadCount } = useStaffNotifications();
  const { jobs, deliveries, tourHop, mapStores, online, canPause, setOnline, refresh, refreshing, lastError } = useBoard();
  const { mapPosition, routeCoordinates } = useLocation();

  useFocusEffect(
    useCallback(() => {
      void refresh({ silent: true });
    }, [refresh]),
  );
  const insets = useSafeAreaInsets();
  const { height: screenH } = useAppViewport();
  const tabLift = TAB_BAR_HEIGHT + TAB_BAR_MARGIN + Math.max(insets.bottom, 8);
  const sheetMin = Math.round(screenH * 0.32 * 0.85);
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

  const minePick = jobs.filter((j) => isActivePickStatus(j.pick_status) && j.picker_id === staff?.id);
  const mineDel = deliveries.filter((d) => isDeliveryActive(d) && d.courier_id === staff?.id).slice(0, MAX_ACTIVE_DELIVERIES);
  const tourStarted = mineDel.some(isDeliveryStarted);
  const heldDel = mineDel.filter(isDeliveryHeld);
  const startedDel = mineDel.filter(isDeliveryStarted);
  const greet = staff?.firstName ?? 'Coursier';
  const idle = !minePick[0] && !mineDel[0];
  const lockedStoreId = minePick[0]?.store_id ?? mineDel[0]?.store_id ?? null;
  const liveKey = livePosKey(mapPosition);
  const suggested = useMemo(
    () => suggestedStore(mapStores, mapPosition, lockedStoreId),
    [mapStores, liveKey, lockedStoreId],
  );

  const localDrop = staff?.id ? readLastDropoff(staff.id, mineDel[0]?.store_id) : null;
  const tourPlan = useMemo(
    () =>
      buildCourierTourPlan(deliveries, staff?.id, {
        courierPosition: mapPosition,
        lastDrop: localDrop?.from ?? (tourHop ? [tourHop.lng, tourHop.lat] : null),
        lastDropLabel: localDrop?.label ?? tourHop?.label,
        lastDropStoreId: localDrop?.storeId ?? tourHop?.storeId,
      }),
    [deliveries, staff?.id, mapPosition, tourHop, localDrop?.from?.[0], localDrop?.from?.[1]],
  );

  const focusDel = tourPlan?.focusDelivery ?? mineDel[0] ?? deliveries.find((d) => d.order_id === minePick[0]?.order_id);
  const storePt: LngLat = tourPlan?.store ??
    (idle && suggested?.coordinate
      ? suggested.coordinate
      : focusDel?.pickup_lng != null && Math.abs(focusDel.pickup_lng) > 0.2
        ? [focusDel.pickup_lng, focusDel.pickup_lat!]
        : cotonouMap.store);
  const clientPt: LngLat | null =
    !tourPlan?.multiStop && focusDel?.dropoff_lng != null && Math.abs(focusDel.dropoff_lng) > 0.2
      ? [focusDel.dropoff_lng, focusDel.dropoff_lat!]
      : null;
  const goingToClient = Boolean(focusDel && deliveryNavLeg(focusDel.delivery_status) === 'client');
  const dest: LngLat = goingToClient && clientPt ? clientPt : storePt;
  const vehicle = staff?.vehicle;
  const legRoad = useRoadRoute(tourPlan?.routeFrom ?? storePt, tourPlan?.navTo ?? dest, vehicle);
  const tourRoad = useMultiRoadRoute(
    tourPlan && tourPlan.routeWaypoints.length >= 2 ? tourPlan.routeWaypoints : null,
    vehicle,
  );
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
  const remainM = remainingToPoint(mapPosition, dest, road?.coordinates ?? legRoad?.coordinates);
  const etaS = liveEtaSeconds(remainM, vehicle, road);
  const tourSummary = tourPlan ? tourRouteSummary(tourPlan) : null;
  const destKicker = !online
    ? 'Pause'
    : minePick[0]
      ? `Ramassage ${shortOrderId(minePick[0].order_id)}`
      : tourSummary
        ? tourSummary
        : goingToClient
          ? `Livraison ${shortOrderId(focusDel?.order_id ?? '')}`
          : mineDel[0]
            ? `Aller au magasin · ${shortOrderId(mineDel[0].order_id)}`
            : 'En attente';
  const destName = tourPlan?.tourStarted
    ? [focusDel?.address_line, focusDel?.address_city].filter(Boolean).join(', ') ||
      focusDel?.address_label ||
      `Client ${tourPlan.stops.find((s) => s.status === 'current')?.stopIndex ?? 1}`
    : tourPlan?.multiStop
      ? `${mineDel.length} colis · ${tourPlan.storeName}`
      : goingToClient
      ? [focusDel?.address_line, focusDel?.address_city].filter(Boolean).join(', ') ||
        focusDel?.address_label ||
        'Client'
      : idle
        ? suggested?.name || 'Magasin'
        : focusDel?.store_name || 'Magasin';

  const mapMarkers = useMemo(() => {
    if (tourPlan) {
      return buildTourMapMarkers(
        tourPlan,
        mapPosition,
        (staff?.vehicle as MapMarker['vehicle']) || 'moto',
        `Vous · ${minLabel(etaS).replace('≈', '')}`,
      );
    }

    const markers: MapMarker[] = [];
    const seen = new Set<string>();
    for (const store of mapStoresForNow(mapStores, lockedStoreId, idle)) {
      if (!store.coordinate) continue;
      seen.add(store.id);
      const short = store.name.replace(/^Super U\s+/i, '').replace(/^U Express\s+/i, '');
      markers.push({
        id: store.id,
        coordinate: store.coordinate,
        kind: 'store',
        label: short,
        badge: idle && store.parcels > 0 ? store.parcels : undefined,
        highlight: idle && suggested?.id === store.id,
      });
    }
    if (!seen.size && !idle) {
      markers.push({
        id: 'store',
        coordinate: storePt,
        kind: 'store',
        label: focusDel?.store_name || 'Magasin',
      });
    }
    if (clientPt) {
      markers.push({ id: 'home', coordinate: clientPt, kind: 'home', label: 'Client' });
    }
    markers.push({
      id: 'me',
      coordinate: mapPosition,
      kind: 'courier',
      vehicle: (staff?.vehicle as 'moto' | 'voiture' | 'velo' | 'tricycle' | 'pied') || 'moto',
      label: `Vous · ${minLabel(etaS).replace('≈', '')}`,
    });
    return markers;
  }, [tourPlan, mapStores, storePt, clientPt, mapPosition, etaS, focusDel?.store_name, staff?.vehicle, suggested?.id, idle, lockedStoreId]);

  const onMapMarker = useCallback(
    (id: string) => {
      if (id === 'me') return;
      if (id.startsWith('del-')) {
        router.push(`/run/${encodeURIComponent(id)}`);
        return;
      }
      if (mineDel.length > 0) return;
      const store = mapStores.find((s) => s.id === id);
      if (store?.parcels) {
        router.push('/(tabs)/missions');
        return;
      }
      if (mineDel[0] && (id === mineDel[0].store_id || id === 'store')) {
        router.push(`/run/${encodeURIComponent(mineDel[0].id)}`);
      }
    },
    [mapStores, mineDel],
  );

  const pickupRoute = useMemo(() => {
    if (routeCoordinates && routeCoordinates.length >= 2) return routeCoordinates;
    if (road?.coordinates && road.coordinates.length >= 2) return road.coordinates;
    const from = tourPlan?.routeFrom ?? storePt;
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
    routeCoordinates,
    road?.coordinates,
    tourPlan?.routeFrom?.[0],
    tourPlan?.routeFrom?.[1],
    tourPlan?.navTo?.[0],
    tourPlan?.navTo?.[1],
    storePt[0],
    storePt[1],
    dest[0],
    dest[1],
  ]);

  const goCourses = () => router.push('/(tabs)/missions');

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
        fitIncludeCourier={false}
        fitPadding={{ top: 100, bottom: Math.round(screenH * 0.72), left: 40, right: 40 }}
        fitMaxZoom={12.6}
        followCamera={false}
        showNavigation
        onMarkerPress={onMapMarker}
      />

      <View style={[styles.top, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={[styles.identity, iceSurface()]}>
          <Image source={staffPhotoSource(staff?.photoUrl)} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Bonjour,</Text>
            <Text style={styles.name} numberOfLines={1}>
              {greet}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            online
              ? canPause
                ? 'Passer en pause'
                : 'Pause impossible, terminez d’abord la mission en cours'
              : 'Passer en ligne'
          }
          onPress={() => setOnline(!online)}
          style={[styles.statusChip, iceSurface(), !online && styles.statusOff]}>
          <View style={[styles.dot, !online && styles.dotOff]} />
          <Text style={[styles.statusTxt, !online && styles.statusTxtOff]}>
            {online ? 'En ligne' : 'Pause'}
          </Text>
        </Pressable>
        <IconBtn name="bell" ice badge={unreadCount} onPress={() => router.push('/notifications')} />
      </View>

      <Animated.View
        style={[styles.etaCard, { bottom: Animated.add(sheetH, 12) }]}
        pointerEvents="box-none">
        <Pressable
          style={[styles.etaInner, iceSurface()]}
          onPress={
            mineDel[0]
              ? () => router.push(`/run/${encodeURIComponent(tourPlan?.focusDelivery.id ?? mineDel[0].id)}`)
              : minePick[0]
                ? () => router.push(`/job/${encodeURIComponent(minePick[0].id)}`)
                : undefined
          }>
          <View style={{ flex: 1 }}>
            <Text style={styles.etaKicker}>{destKicker}</Text>
            <Text style={styles.etaStore} numberOfLines={1}>
              {!online ? 'Radar fermé' : destName}
            </Text>
            {goingToClient && focusDel?.address_phone ? (
              <Text style={styles.etaMeta} numberOfLines={1}>
                {focusDel.address_phone}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.etaValue}>{minLabel(etaS)}</Text>
            <Text style={styles.etaKm}>{kmLabel(remainM)}</Text>
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.sheet, { height: sheetH }]}>
        <View {...handlePan.panHandlers} style={styles.handleHit}>
          <View style={styles.handle} />
        </View>
        {lastError ? <ApiBanner message={lastError} onRetry={() => void refresh()} /> : null}
        <ScrollView
          ref={listRef}
          style={styles.list}
          contentContainerStyle={[styles.listInner, { paddingBottom: tabLift + 16 }]}
          scrollEventThrottle={16}
          bounces
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          refreshControl={pullRefreshControl(refreshing, refresh)}>
          <PullBanner visible={refreshing} />
          <NowPresence
            online={online}
            pickCount={minePick.length}
            deliveryCount={startedDel.length}
            heldCount={heldDel.length}
            tourStarted={tourStarted}
            onResume={() => setOnline(true)}
          />
          {online && idle && suggested ? (
            <Pressable
              onPress={goCourses}
              style={styles.suggest}
              accessibilityRole="button"
              accessibilityLabel={`${suggested.name}, Super U le plus proche`}>
              <View style={styles.suggestTop}>
                <Text style={styles.suggestKicker}>
                  {lockedStoreId === suggested.id ? 'VOTRE SUPER U' : 'LE PLUS PROCHE'}
                </Text>
                {suggested.waiting > 0 ? (
                  <View style={styles.suggestTag}>
                    <Text style={styles.suggestTagTxt}>
                      {suggested.waiting} commande{suggested.waiting > 1 ? 's' : ''} en attente
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.suggestName}>{suggested.name}</Text>
              <Text style={styles.suggestMeta}>
                {kmLabel(suggested.distanceM)} · {minLabel(motoEtaSeconds(mapPosition, suggested.coordinate as LngLat))}
              </Text>
            </Pressable>
          ) : null}
          {online ? (
            <>
              {minePick.map((j) => (
                <MissionCard
                  key={j.id}
                  {...pickCardProps(j)}
                  nearest={idle && Boolean(suggested?.id && j.store_id === suggested.id)}
                  distanceM={suggested?.id === j.store_id ? suggested.distanceM : undefined}
                  cta="CONTINUER"
                  onAccept={() => router.push(`/job/${encodeURIComponent(j.id)}`)}
                  onPress={() => router.push(`/job/${encodeURIComponent(j.id)}`)}
                />
              ))}
              {startedDel.map((d) => (
                <MissionCard
                  key={d.id}
                  {...deliveryCardProps(d)}
                  cta="SUIVRE"
                  onAccept={() => router.push(`/run/${encodeURIComponent(d.id)}`)}
                  onPress={() => router.push(`/run/${encodeURIComponent(d.id)}`)}
                />
              ))}
              {heldDel.length && !tourStarted ? (
                <Text style={styles.heldHint}>
                  {heldDel.length} colis sélectionné{heldDel.length > 1 ? 's' : ''} · démarrez depuis Courses
                </Text>
              ) : null}
              <PillButton label="VOIR LA FILE · COURSES" onPress={goCourses} variant="ghost" />
            </>
          ) : null}
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
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  hello: { ...bodyFont('400'), fontSize: 11, color: colors.muted },
  name: { ...displayFont('800'), fontSize: 15, color: colors.text },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusOff: {},
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal },
  dotOff: { backgroundColor: '#fbbf24' },
  statusTxt: { ...displayFont('800'), fontSize: 12, color: colors.teal },
  statusTxtOff: { color: '#b45309' },
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
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
    width: '100%',
    flexDirection: 'column',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 8,
    overflow: 'hidden',
    ...shadow.tabBar,
  },
  handleHit: { alignItems: 'center', paddingVertical: 10 },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.placeholder,
    marginBottom: 4,
  },
  list: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  listInner: {
    flexGrow: 1,
    gap: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  heldHint: {
    ...bodyFont('600'),
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 4,
  },
  suggest: {
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    padding: 16,
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#fbbf24',
  },
  suggestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  suggestKicker: { ...displayFont('800'), fontSize: 11, letterSpacing: 0.6, color: '#b45309' },
  suggestTag: { backgroundColor: colors.teal, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  suggestTagTxt: { ...displayFont('800'), fontSize: 11, color: colors.onAccent },
  suggestName: { ...displayFont('800'), fontSize: 18, color: colors.text },
  suggestMeta: { ...bodyFont('600'), fontSize: 13, color: colors.muted },
});
