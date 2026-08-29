import { LibreMap, warmLibreMap } from '@/components/LibreMap';
import { CtaButton, IconCircle, Screen } from '@/components/ui';
import { cotonouMap, mapStyles, type LngLat } from '@/constants/map';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors, useTheme } from '@/context/ThemeContext';
import { useAddresses } from '@/context/AddressesContext';
import { useStores } from '@/context/StoresContext';
import { SUPER_U_BRAND, type SuperUStore } from '@/data/superU';
import { findStoreNearPoint, formatDistanceKm, formatDurationMin } from '@/lib/deliveryRouting';
import { superUStoresToMapMarkers } from '@/lib/api/superU';
import { SHEET_SPRING } from '@/lib/expandableSheet';
import { softShadow } from '@/lib/shadow';
import { useDeliveryEstimate } from '@/lib/useDeliveryEstimate';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WINDOW_H = Dimensions.get('window').height;
const SHEET_MIN = Math.round(WINDOW_H * 0.42);
const SHEET_MAX = Math.round(WINDOW_H * 0.78);
const SHEET_MID = Math.round((SHEET_MIN + SHEET_MAX) / 2);

function StoreCard({
  store,
  selected,
  onSelect }: {
  store: SuperUStore;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const formatLabel = store.format === 'u_express' ? 'U Express' : 'Super U';

  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <View style={styles.cardTop}>
        <View style={[styles.storeBadge, { backgroundColor: SUPER_U_BRAND.red }]}>
          <Text style={styles.storeBadgeText}>U</Text>
        </View>
        <View style={styles.cardText}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{store.name}</Text>
            {selected ? (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultText}>Choisi</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta}>
            {formatLabel} · {store.cityLabel}
          </Text>
          <Text style={styles.line} numberOfLines={2}>
            {store.address}
          </Text>
          {store.hours ? (
            <Text style={styles.hours} numberOfLines={1}>
              {store.hours}
            </Text>
          ) : null}
        </View>
        <View style={[styles.radio, selected && styles.radioOn]} />
      </View>
    </Pressable>
  );
}

export default function StoresScreen() {
  const { scheme } = useTheme();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { stores, selectedStoreId, selectedStore, setSelectedStoreId } = useStores();
  const { defaultAddress } = useAddresses();

  const [draftId, setDraftId] = useState(selectedStoreId);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapCenter, setMapCenter] = useState<LngLat>([...selectedStore.coordinate]);

  const sheetH = useSharedValue(SHEET_MIN);
  const dragStartH = useSharedValue(SHEET_MIN);

  const draftStore = useMemo(
    () => stores.find((s) => s.id === draftId) ?? selectedStore,
    [stores, draftId, selectedStore],
  );
  const draftEstimate = useDeliveryEstimate(draftStore.coordinate, defaultAddress.coordinate);

  const orderedStores = useMemo(() => {
    const selected = stores.find((s) => s.id === draftId);
    const rest = stores.filter((s) => s.id !== draftId);
    return selected ? [selected, ...rest] : stores;
  }, [stores, draftId]);

  useEffect(() => {
    setDraftId(selectedStoreId);
    setMapCenter([...selectedStore.coordinate]);
  }, [selectedStoreId, selectedStore.coordinate]);

  useEffect(() => {
    void warmLibreMap(
      scheme === 'dark' ? mapStyles.dark : mapStyles.light,
      selectedStore.coordinate,
      12.2,
    );
  }, [scheme, selectedStore.coordinate]);

  const selectStore = useCallback((store: SuperUStore) => {
    setDraftId(store.id);
    setMapCenter([...store.coordinate]);
  }, []);

  const onPressMarker = useCallback(
    (markerId: string) => {
      const store = stores.find((s) => s.id === markerId);
      if (store) selectStore(store);
    },
    [stores, selectStore],
  );

  const onPressMap = useCallback(
    (coord: LngLat) => {
      const hit = findStoreNearPoint(coord, 1100);
      if (hit) selectStore(hit.store);
    },
    [selectStore],
  );

  const markers = useMemo(() => {
    return superUStoresToMapMarkers(stores, SUPER_U_BRAND.red).map((m) =>
      m.id === draftId
        ? { ...m, color: colors.gold, label: `${m.label} · choisi` }
        : m,
    );
  }, [stores, draftId, colors.gold]);

  const sheetPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .onStart(() => {
          dragStartH.value = sheetH.value;
        })
        .onUpdate((e) => {
          const next = dragStartH.value - e.translationY;
          sheetH.value = Math.min(SHEET_MAX, Math.max(SHEET_MIN, next));
        })
        .onEnd((e) => {
          const projected = sheetH.value - e.velocityY * 0.12;
          const target =
            projected > SHEET_MID || (sheetH.value > SHEET_MID && e.velocityY < -400)
              ? SHEET_MAX
              : SHEET_MIN;
          sheetH.value = withSpring(target, { ...SHEET_SPRING, velocity: -e.velocityY });
        }),
    [dragStartH, sheetH],
  );

  const sheetAnimStyle = useAnimatedStyle(() => ({
    height: sheetH.value }));

  const save = () => {
    setSelectedStoreId(draftId);
    router.back();
  };

  return (
    <Screen>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.mapLayer}>
          <LibreMap
            style={StyleSheet.absoluteFill}
            mapStyle={scheme === 'dark' ? mapStyles.dark : mapStyles.light}
            center={mapCenter}
            zoom={12.4}
            markers={markers}
            interactive
            showNavigation
            navigationOffset={{
              top: Math.max(10, insets.top + 6) + 54 + 52,
              right: 12 }}
            onReady={() => {
              setMapError(false);
              setMapReady(true);
            }}
            onError={() => {
              setMapError(true);
              setMapReady(true);
            }}
            onPressMap={onPressMap}
            onPressMarker={onPressMarker}
          />
          {mapError ? (
            <View style={styles.mapLoading}>
              <Feather name="wifi-off" size={22} color={colors.muted} />
              <Text style={styles.mapLoadingText}>Carte indisponible pour le moment</Text>
              <Text style={styles.mapErrorHint}>Vérifiez votre connexion, puis réessayez.</Text>
            </View>
          ) : !mapReady ? (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.mapLoadingText}>Chargement de la carte…</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.topBar, { paddingTop: Math.max(10, insets.top + 6) }]}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <View style={styles.titlePill}>
            <Text style={styles.titlePillMain}>Magasin Super U</Text>
            <Text style={styles.titlePillSub}>Touchez un pin U sur la carte</Text>
          </View>
          <IconCircle name="map-pin" onPress={() => router.push('/account/addresses')} />
        </View>

        <View
          style={[
            styles.segmentWrap,
            { top: Math.max(10, insets.top + 6) + 54 },
          ]}>
          <Pressable style={styles.segment} onPress={() => router.replace('/account/addresses')}>
            <Text style={styles.segmentText}>Adresse</Text>
          </Pressable>
          <View style={[styles.segment, styles.segmentOn]}>
            <Text style={[styles.segmentText, styles.segmentTextOn]}>Supermarché</Text>
          </View>
        </View>

        <GestureDetector gesture={sheetPan}>
          <Animated.View
            style={[
              styles.sheet,
              sheetAnimStyle,
              softShadow({ y: -8, blur: 24, opacity: 0.12 }),
              { paddingBottom: Math.max(14, insets.bottom + 8), backgroundColor: colors.bg },
            ]}>
            <View style={styles.sheetHandle}>
              <View style={[styles.sheetHandleBar, { backgroundColor: colors.grabber }]} />
            </View>
            <Text style={[styles.sheetEyebrow, { color: colors.muted }]}>
              Préparation & départ livreur
            </Text>
            <Text style={styles.sheetTitle}>Choisissez votre Super U</Text>
            <Text style={styles.sheetSub}>
              Liste ou carte · le magasin sélectionné prépare votre commande.
            </Text>

            <Animated.ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              bounces
              nestedScrollEnabled>
              {orderedStores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  selected={store.id === draftId}
                  onSelect={() => selectStore(store)}
                />
              ))}
            </Animated.ScrollView>

            <View style={styles.footer}>
              <Text style={styles.footerHint} numberOfLines={2}>
                {draftEstimate.loading
                  ? `${draftStore.name} · calcul du trajet…`
                  : draftEstimate.unavailable
                    ? `${draftStore.name} · ${draftStore.cityLabel}`
                    : draftEstimate.approximated
                      ? `${draftStore.name} → ${defaultAddress.label} · approx. ${formatDistanceKm(draftEstimate.distanceMeters)} · ~${formatDurationMin(draftEstimate.durationSeconds)}`
                      : `${draftStore.name} → ${defaultAddress.label} · ${formatDistanceKm(draftEstimate.distanceMeters)} · ~${formatDurationMin(draftEstimate.durationSeconds)}`}
              </Text>
              <CtaButton label="Enregistrer ce magasin" onPress={save} />
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    mapLayer: { ...StyleSheet.absoluteFillObject },
    mapLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.5)',
      gap: 10 },
    mapLoadingText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    mapErrorHint: { color: colors.placeholder, fontSize: 12, textAlign: 'center', paddingHorizontal: 24 },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      gap: 10,
      zIndex: 5 },
    titlePill: {
      flex: 1,
      backgroundColor: colors.white,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      opacity: 0.96,
      ...Platform.select({
        web: { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
        default: {} }) },
    titlePillMain: { color: colors.text, fontSize: 14, fontWeight: '800' },
    titlePillSub: { color: colors.muted, fontSize: 11, marginTop: 1, fontWeight: '600' },
    segmentWrap: {
      position: 'absolute',
      left: 14,
      right: 14,
      flexDirection: 'row',
      backgroundColor: colors.white,
      opacity: 0.96,
      borderRadius: 14,
      padding: 4,
      gap: 4,
      zIndex: 5,
      ...Platform.select({
        web: { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
        default: {} }) },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 11 },
    segmentOn: { backgroundColor: colors.cream },
    segmentText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
    segmentTextOn: { color: colors.text },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      overflow: 'hidden',
      zIndex: 6 },
    sheetHandle: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
    sheetHandleBar: { width: 40, height: 4, borderRadius: 999 },
    sheetEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      paddingHorizontal: 20,
      marginBottom: 4 },
    sheetTitle: {
      ...displayFont('700'),
      color: colors.text,
      fontSize: 20,
      paddingHorizontal: 20 },
    sheetSub: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 20,
      marginTop: 4,
      marginBottom: 10,
      fontWeight: '500' },
    sheetScroll: { flex: 1 },
    sheetContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },
    card: {
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14 },
    cardSelected: {
      backgroundColor: colors.selectSoft },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    storeBadge: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center' },
    storeBadgeText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '900',
      fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
    cardText: { flex: 1, gap: 2 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    label: { color: colors.text, fontSize: 15, fontWeight: '800' },
    defaultBadge: {
      backgroundColor: colors.gold,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3 },
    defaultText: { color: colors.onAccent, fontSize: 10, fontWeight: '800' },
    meta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    line: { color: colors.text, fontSize: 13, fontWeight: '500', marginTop: 2 },
    hours: { color: colors.placeholder, fontSize: 11, fontWeight: '500', marginTop: 2 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.cream,
      marginTop: 8 },
    radioOn: {
      backgroundColor: colors.gold },
    footer: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },
    footerHint: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' } });
}
