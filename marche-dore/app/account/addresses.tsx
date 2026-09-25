import { LibreMap, warmLibreMap } from '@/components/LibreMap';
import { goBack } from '@/lib/navigation';
import { PressScale } from '@/components/motion';
import { CtaButton, IconCircle, Screen } from '@/components/ui';
import { appLocation } from '@/constants/location';
import { formatBeninPhoneInput } from '@/lib/beninPhone';
import { cotonouMap, mapStyles, type LngLat, type MapMarker } from '@/constants/map';
import { displayFont, mapHud, type AppColors, spacing } from '@/constants/theme';
import { useAddresses } from '@/context/AddressesContext';
import { useProfile } from '@/context/ProfileContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import type { DeliveryAddress } from '@/data/account';
import { SUPER_U_BRAND, SUPER_U_STORES } from '@/data/superU';
import { listSuperUStores, superUStoresToMapMarkers } from '@/lib/api/superU';
import { SHEET_OPEN, SHEET_SPRING } from '@/lib/expandableSheet';
import { getDeviceLocation } from '@/lib/geolocation';
import { softShadow } from '@/lib/shadow';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ScrollView,
} from 'react-native';
import { GestureRoot } from '@/components/GestureRoot';
import { iosKeyboardAccessoryProps } from '@/components/KeyboardDismissBar';
import { Gesture, GestureDetector, RectButton, Swipeable } from 'react-native-gesture-handler';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTION_W = 76;
type PlaceKind = 'home' | 'work' | 'other';

const PLACE_KINDS: {
  id: PlaceKind;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  accent: 'gold' | 'terracotta' | 'green';
}[] = [
  { id: 'home', label: 'Maison', icon: 'home', accent: 'gold' },
  { id: 'work', label: 'Travail', icon: 'briefcase', accent: 'terracotta' },
  { id: 'other', label: 'Autres', icon: 'map-pin', accent: 'green' },
];

const PLACE_LABELS: Record<PlaceKind, string> = {
  home: 'Domicile',
  work: 'Bureau',
  other: 'Autre lieu' };

function addressKind(label: string): MapMarker['kind'] {
  if (/bureau|travail/i.test(label)) return 'store';
  if (/domicile|maison/i.test(label)) return 'home';
  return 'pin';
}

function AddressCardBody({
  address,
  selected,
  onSelect,
}: {
  address: DeliveryAddress;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <View style={styles.cardTop}>
        <View style={styles.labelRow}>
          <View style={styles.pin}>
            <Feather name="map-pin" size={16} color={colors.gold} />
          </View>
          <Text style={styles.label}>{address.label}</Text>
          {address.default ? (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Par défaut</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.radio, selected && styles.radioOn]} />
      </View>
      <Text style={styles.line}>{address.line}</Text>
      <Text style={styles.meta}>{address.city}</Text>
      <Text style={styles.meta}>{address.phone}</Text>
    </Pressable>
  );
}

/** Swipe native (Gesture Handler) — même pattern que le panier. */
function SwipeAddressCard({
  address,
  selected,
  canDelete,
  onSelect,
  onSetDefault,
  onEdit,
  onDelete,
}: {
  address: DeliveryAddress;
  selected: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const swipeRef = useRef<Swipeable>(null);

  const runAndClose = useCallback(
    (action: () => void) => {
      swipeRef.current?.close();
      requestAnimationFrame(action);
    },
    [],
  );

  const renderRightActions = useCallback(
    () => (
      <View style={styles.rightActions}>
        <RectButton
          style={[styles.swipeAction, styles.swipeEdit]}
          onPress={() => runAndClose(onEdit)}
          accessibilityLabel="Modifier l’adresse">
          <Feather name="edit-3" size={18} color={colors.onAccent} />
          <Text style={styles.swipeActionText}>Éditer</Text>
        </RectButton>
        {canDelete ? (
          <RectButton
            style={[styles.swipeAction, styles.swipeDelete]}
            onPress={() => runAndClose(onDelete)}
            accessibilityLabel="Supprimer l’adresse">
            <Feather name="trash-2" size={18} color={colors.onAccent} />
            <Text style={styles.swipeActionText}>Suppr.</Text>
          </RectButton>
        ) : null}
      </View>
    ),
    [canDelete, colors.onAccent, onDelete, onEdit, runAndClose, styles],
  );

  const renderLeftActions = useCallback(
    () => (
      <RectButton
        style={[styles.swipeAction, styles.swipeDefault, { width: ACTION_W }]}
        onPress={() => runAndClose(onSetDefault)}
        accessibilityLabel="Définir par défaut">
        <Feather name="star" size={18} color={colors.onAccent} />
        <Text style={styles.swipeActionText}>Défaut</Text>
      </RectButton>
    ),
    [colors.onAccent, onSetDefault, runAndClose, styles],
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.swipeWrap}>
        <AddressCardBody address={address} selected={selected} onSelect={onSelect} />
        <View style={styles.webActions}>
          <Pressable style={[styles.webChip, styles.swipeDefault]} onPress={onSetDefault}>
            <Text style={styles.swipeActionText}>Défaut</Text>
          </Pressable>
          <Pressable style={[styles.webChip, styles.swipeEdit]} onPress={onEdit}>
            <Text style={styles.swipeActionText}>Éditer</Text>
          </Pressable>
          {canDelete ? (
            <Pressable style={[styles.webChip, styles.swipeDelete]} onPress={onDelete}>
              <Text style={styles.swipeActionText}>Suppr.</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.swipeWrap}>
      <Swipeable
        ref={swipeRef}
        friction={2}
        leftThreshold={40}
        rightThreshold={40}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        childrenContainerStyle={styles.swipeChild}>
        <AddressCardBody address={address} selected={selected} onSelect={onSelect} />
      </Swipeable>
    </View>
  );
}

async function reverseGeocode(coord: LngLat): Promise<string | null> {
  try {
    const [lng, lat] = coord;
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'fr' } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: { road?: string; suburb?: string; neighbourhood?: string; city?: string };
    };
    const road = data.address?.road;
    const area = data.address?.suburb || data.address?.neighbourhood;
    if (road && area) return `${road}, ${area}`;
    if (road) return road;
    return data.display_name?.split(',').slice(0, 2).join(',').trim() ?? null;
  } catch {
    return null;
  }
}

export default function AddressesScreen() {
  const { scheme } = useTheme();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { addresses, selectedId, setSelectedId, setDefault, addAddress, updateAddress, removeAddress } =
    useAddresses();
  const { profile } = useProfile();
  const { setup } = useLocalSearchParams<{ setup?: string }>();
  const setupMode = setup === '1';

  /** Peek serré : en-tête + 1 carte + footer + home indicator (évite le vide blanc à min). */
  const sheetMin = useMemo(() => {
    const safe = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);
    const peek = 268 + safe;
    return Math.min(Math.round(windowHeight * 0.4), Math.max(peek, Math.round(windowHeight * 0.3)));
  }, [windowHeight, insets.bottom]);
  const sheetMax = useMemo(() => Math.round(windowHeight * 0.82), [windowHeight]);
  const sheetMid = useMemo(() => Math.round((sheetMin + sheetMax) / 2), [sheetMin, sheetMax]);
  const formScrollRef = useRef<ScrollView>(null);
  const [kbInset, setKbInset] = useState(0);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedId) ?? addresses[0],
    [addresses, selectedId],
  );

  const orderedAddresses = useMemo(() => {
    const selected = addresses.find((a) => a.id === selectedId);
    const rest = addresses.filter((a) => a.id !== selectedId);
    return selected ? [selected, ...rest] : addresses;
  }, [addresses, selectedId]);

  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mapError, setMapError] = useState(false);
  const [mapCenter, setMapCenter] = useState<LngLat>([
    ...(selectedAddress?.coordinate ?? cotonouMap.home),
  ]);
  const [mapZoom, setMapZoom] = useState(13.8);
  const [pin, setPin] = useState<LngLat>([...cotonouMap.home]);
  const [placeKind, setPlaceKind] = useState<PlaceKind>('home');
  const [label, setLabel] = useState(PLACE_LABELS.home);
  const [line, setLine] = useState('');
  const [phone, setPhone] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [locateLoading, setLocateLoading] = useState(false);
  const [superUMarkers, setSuperUMarkers] = useState<MapMarker[]>(() =>
    superUStoresToMapMarkers(SUPER_U_STORES, SUPER_U_BRAND.red),
  );

  const sheetH = useSharedValue(sheetMin);
  const dragStartH = useSharedValue(sheetMin);
  const minH = useSharedValue(sheetMin);
  const maxH = useSharedValue(sheetMax);
  const midH = useSharedValue(sheetMid);
  const editing = mode === 'edit';

  useEffect(() => {
    if (!editing) {
      setKbInset(0);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates: { height: number } }) => {
      const h = Math.max(0, e.endCoordinates.height);
      // iOS : remonter le sheet au-dessus du clavier. Android (resize) : rester collé bas.
      setKbInset(Platform.OS === 'ios' ? h : 0);
      const room = Math.max(
        sheetMin,
        Math.min(sheetMax, windowHeight - (Platform.OS === 'ios' ? h : 0) - Math.max(insets.top, 12) - 8),
      );
      sheetH.value = withTiming(room, SHEET_OPEN);
    };
    const onHide = () => {
      setKbInset(0);
      if (mode === 'edit') sheetH.value = withTiming(sheetMax, SHEET_OPEN);
    };
    const show = Keyboard.addListener(showEvt, onShow);
    const hide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      show.remove();
      hide.remove();
    };
  }, [editing, mode, sheetH, sheetMax, sheetMin, windowHeight, insets.top]);

  const revealFormField = useCallback(() => {
    sheetH.value = withTiming(
      Math.max(sheetMin, Math.min(sheetMax, windowHeight - kbInset - Math.max(insets.top, 12) - 8)),
      SHEET_OPEN,
    );
  }, [sheetH, sheetMax, sheetMin, windowHeight, kbInset, insets.top]);

  useEffect(() => {
    minH.value = sheetMin;
    maxH.value = sheetMax;
    midH.value = sheetMid;
    const h = sheetH.value;
    if (h < sheetMin) sheetH.value = sheetMin;
    else if (h > sheetMax) sheetH.value = sheetMax;
  }, [sheetMin, sheetMax, sheetMid, minH, maxH, midH, sheetH]);

  useEffect(() => {
    void warmLibreMap(
      scheme === 'dark' ? mapStyles.dark : mapStyles.light,
      selectedAddress?.coordinate ?? cotonouMap.home,
      13.6,
    );
  }, [scheme, selectedAddress?.coordinate]);

  useEffect(() => {
    void listSuperUStores().then((res) => {
      if (res.ok) setSuperUMarkers(superUStoresToMapMarkers(res.stores, SUPER_U_BRAND.red));
    });
  }, []);

  useEffect(() => {
    if (editing || !selectedAddress?.coordinate) return;
    setMapCenter([...selectedAddress.coordinate]);
    setMapZoom(13.8);
  }, [selectedAddress?.id, selectedAddress?.coordinate, editing]);

  const placeAccent = useCallback(
    (accent: (typeof PLACE_KINDS)[number]['accent']) =>
      accent === 'gold' ? colors.gold : accent === 'terracotta' ? colors.terracotta : colors.green,
    [colors.gold, colors.green, colors.terracotta],
  );

  const selectPlaceKind = (kind: PlaceKind) => {
    setPlaceKind(kind);
    setLabel(PLACE_LABELS[kind]);
  };

  const applyCoordinate = useCallback(async (coord: LngLat, reverse = true) => {
    setPin(coord);
    setMapCenter(coord);
    setMapZoom(15.4);
    if (!reverse) return;
    setGeoLoading(true);
    const guessed = await reverseGeocode(coord);
    if (guessed) setLine(guessed);
    setGeoLoading(false);
  }, []);

  const selectAddress = useCallback(
    (address: DeliveryAddress) => {
      if (editing) return;
      setSelectedId(address.id);
      if (address.coordinate) {
        setMapCenter([...address.coordinate]);
        setMapZoom(14.4);
      }
    },
    [setSelectedId, editing],
  );

  const openAdd = () => {
    setEditingId(null);
    const start = (selectedAddress?.coordinate ?? cotonouMap.home) as LngLat;
    setPin([...start]);
    setMapCenter([...start]);
    setMapZoom(15.2);
    setPlaceKind('home');
    setLabel(PLACE_LABELS.home);
    setLine('');
    setPhone(formatBeninPhoneInput(profile.phone || ''));
    sheetH.value = withTiming(sheetMax, SHEET_OPEN);
    setMode('edit');
  };

  useEffect(() => {
    if (!setupMode || addresses.length > 0) return;
    openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupMode, addresses.length]);

  const openEdit = (address: DeliveryAddress) => {
    setEditingId(address.id);
    const coord = (address.coordinate ?? cotonouMap.home) as LngLat;
    setPin([...coord]);
    setMapCenter([...coord]);
    setMapZoom(15.2);
    const kind: PlaceKind =
      /bureau|travail/i.test(address.label)
        ? 'work'
        : /domicile|maison/i.test(address.label)
          ? 'home'
          : 'other';
    setPlaceKind(kind);
    setLabel(address.label);
    setLine(address.line);
    setPhone(formatBeninPhoneInput(address.phone));
    sheetH.value = withTiming(sheetMax, SHEET_OPEN);
    setMode('edit');
  };

  const closeEdit = () => {
    if (setupMode && !addresses.length) return;
    setMode('list');
    setEditingId(null);
    sheetH.value = withTiming(sheetMin, SHEET_OPEN);
    if (selectedAddress?.coordinate) {
      setMapCenter([...selectedAddress.coordinate]);
      setMapZoom(13.8);
    }
  };

  const confirmDelete = (address: DeliveryAddress) => {
    if (addresses.length <= 1) {
      Alert.alert('Impossible', 'Conservez au moins une adresse de livraison.');
      return;
    }
    Alert.alert('Supprimer cette adresse ?', `${address.label} · ${address.line}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          if (!removeAddress(address.id)) {
            Alert.alert('Impossible', 'Conservez au moins une adresse de livraison.');
          }
        } },
    ]);
  };

  const locateMe = useCallback(async () => {
    setLocateLoading(true);
    try {
      const loc = await getDeviceLocation();
      await applyCoordinate(loc.coordinate, true);
    } catch {
      Alert.alert(
        'Localisation',
        'Impossible d’obtenir votre position. Autorisez la géolocalisation, ou placez le pin sur la carte.',
      );
    } finally {
      setLocateLoading(false);
    }
  }, [applyCoordinate]);

  const sheetPan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY([-8, 8])
        .onStart(() => {
          dragStartH.value = sheetH.value;
        })
        .onUpdate((e) => {
          const next = dragStartH.value - e.translationY;
          sheetH.value = Math.min(maxH.value, Math.max(minH.value, next));
        })
        .onEnd((e) => {
          const projected = sheetH.value - e.velocityY * 0.12;
          const target =
            projected > midH.value || (sheetH.value > midH.value && e.velocityY < -400)
              ? maxH.value
              : minH.value;
          sheetH.value = withSpring(target, { ...SHEET_SPRING, velocity: -e.velocityY });
        }),
    [dragStartH, sheetH, minH, maxH, midH],
  );

  const sheetAnim = useAnimatedStyle(() => ({ height: sheetH.value }));

  const saveAddress = () => {
    const street = line.trim();
    if (!street) {
      Alert.alert('Adresse', 'Placez le pin sur la carte ou saisissez votre rue.');
      return;
    }
    const payload = {
      label: label.trim() || PLACE_LABELS[placeKind],
      line: street,
      city: `${appLocation.city}, ${appLocation.country}`,
      phone: phone.trim() || profile.phone,
      coordinate: [...pin] as LngLat,
      makeDefault: true };
    if (editingId) {
      updateAddress(editingId, payload);
      setSelectedId(editingId);
    } else {
      const created = addAddress(payload);
      setSelectedId(created.id);
    }
    if (setupMode && !editingId) {
      router.replace('/account/stores?setup=1');
      return;
    }
    setMapCenter([...pin]);
    setMapZoom(14.2);
    setMode('list');
    setEditingId(null);
    sheetH.value = withTiming(sheetMin, SHEET_OPEN);
  };

  const saveDefault = () => {
    if (selectedId) setDefault(selectedId);
    if (setup === '1') {
      router.replace('/account/stores?setup=1');
      return;
    }
    goBack();
  };

  const mapMarkers = useMemo(() => {
    if (editing) {
      return [
        ...superUMarkers,
        {
          id: 'pick',
          coordinate: pin,
          kind: (placeKind === 'work' ? 'store' : placeKind === 'home' ? 'home' : 'pin') as MapMarker['kind'],
          label: label.trim() || PLACE_LABELS[placeKind],
          color: placeAccent(PLACE_KINDS.find((p) => p.id === placeKind)?.accent ?? 'gold') },
      ];
    }
    const addressMarkers: MapMarker[] = addresses.map((a) => ({
      id: a.id,
      coordinate: (a.coordinate ?? cotonouMap.home) as LngLat,
      kind: addressKind(a.label),
      label: a.id === selectedId ? `${a.label} · choisi` : a.label,
      color: a.id === selectedId ? colors.gold : colors.terracotta }));
    return [...superUMarkers, ...addressMarkers];
  }, [
    editing,
    pin,
    placeKind,
    label,
    placeAccent,
    superUMarkers,
    addresses,
    selectedId,
    colors.gold,
    colors.terracotta,
  ]);

  const mapStyleUrl =
    Platform.OS === 'web'
      ? mapStyles.raster
      : scheme === 'dark'
        ? mapStyles.dark
        : mapStyles.light;

  return (
    <Screen>
      <GestureRoot style={styles.root}>
        <View style={styles.mapLayer}>
          {/* Web: MapLibre · iOS: Apple Maps (comme CourseGO) · Android: OSM */}
          <LibreMap
            style={StyleSheet.absoluteFillObject}
            mapStyle={mapStyleUrl}
            center={mapCenter}
            zoom={mapZoom}
            markers={mapMarkers}
            interactive
            followCamera
            showNavigation
            navigationOffset={{
              top: editing
                ? Math.max(10, insets.top + 6) + 58
                : Math.max(10, insets.top + 6) + 54 + 52,
              right: 12,
            }}
            onReady={() => setMapError(false)}
            onPressMap={editing ? (coord) => void applyCoordinate(coord, true) : undefined}
            onPressMarker={(id) => {
              if (editing) return;
              const addr = addresses.find((a) => a.id === id);
              if (addr) selectAddress(addr);
            }}
          />
          {mapError ? (
            <View style={styles.mapLoading} pointerEvents="none">
              <Feather name="wifi-off" size={22} color={colors.muted} />
              <Text style={styles.mapLoadingText}>Carte indisponible pour le moment</Text>
              <Text style={styles.mapErrorHint}>Vérifiez votre connexion, puis réessayez.</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.topBar, { paddingTop: Math.max(10, insets.top + 6) }]}>
          <IconCircle
            variant="onPhoto"
            color={mapHud.ink}
            name={editing ? 'x' : 'chevron-left'}
            onPress={
              editing
                ? closeEdit
                : !addresses.length
                  ? () => undefined
                  : setupMode
                    ? () => undefined
                    : () => goBack()
            }
          />
          <View style={styles.titlePill}>
            <Text style={styles.titlePillMain} numberOfLines={1}>
              {editing
                ? editingId
                  ? label.trim() || 'Modifier l’adresse'
                  : label.trim() || 'Nouvelle adresse'
                : setupMode && !addresses.length
                  ? 'Choisir une adresse'
                  : 'Adresses de livraison'}
            </Text>
            <Text style={styles.titlePillSub} numberOfLines={1}>
              {editing
                ? geoLoading
                  ? 'Recherche de l’adresse…'
                  : 'Touchez la carte pour placer le pin'
                : setupMode && !addresses.length
                  ? 'Indispensable pour la livraison'
                  : 'Touchez un pin ou glissez une carte'}
            </Text>
          </View>
          {editing ? (
            <Pressable
              style={styles.locateFab}
              onPress={locateMe}
              disabled={locateLoading}
              accessibilityLabel="Ma position exacte">
              {locateLoading ? (
                <ActivityIndicator size="small" color="#e2931d" />
              ) : (
                <Feather name="navigation" size={18} color="#e2931d" />
              )}
            </Pressable>
          ) : (
            <IconCircle variant="onPhoto" color={mapHud.ink} name="plus" onPress={openAdd} />
          )}
        </View>

        {!editing ? (
          <View style={[styles.segmentWrap, { top: Math.max(10, insets.top + 6) + 54 }]}>
            <View style={[styles.segment, styles.segmentOn]}>
              <Text style={[styles.segmentText, styles.segmentTextOn]}>Adresse</Text>
            </View>
            <Pressable
              style={styles.segment}
              onPress={() =>
                router.replace(setupMode ? '/account/stores?setup=1' : '/account/stores')
              }>
              <Text style={styles.segmentText}>Supermarché</Text>
            </Pressable>
          </View>
        ) : null}

        <Reanimated.View
          style={[
            styles.sheet,
            sheetAnim,
            softShadow({ y: -8, blur: 24, opacity: 0.12 }),
            {
              bottom: kbInset,
              paddingBottom: Math.max(10, insets.bottom),
              backgroundColor: colors.bg,
            },
          ]}>
          <GestureDetector gesture={sheetPan}>
            <View style={styles.sheetHandle}>
              <View style={[styles.sheetHandleBar, { backgroundColor: colors.grabber }]} />
            </View>
          </GestureDetector>

            {editing ? (
              <>
                <Text style={[styles.sheetEyebrow, { color: colors.muted }]}>
                  Détails de livraison
                </Text>
                <Text style={styles.sheetTitle}>
                  {editingId ? 'Modifier l’adresse' : setupMode ? 'Où vous livrer ?' : 'Nouvelle adresse'}
                </Text>
                <Text style={styles.sheetSub}>
                  {setupMode && !editingId
                    ? 'Placez le pin sur la carte, puis validez. Aucune adresse n’est préremplie.'
                    : 'Placez le pin sur la carte, puis validez — l’adresse sera sélectionnée.'}
                </Text>

                <Reanimated.ScrollView
                  ref={formScrollRef}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={styles.sheetScroll}
                  contentContainerStyle={styles.form}
                  bounces>
                  <View style={styles.placeRow}>
                    {PLACE_KINDS.map((place) => {
                      const active = placeKind === place.id;
                      const accent = placeAccent(place.accent);
                      return (
                        <PressScale
                          key={place.id}
                          style={[
                            styles.placeChip,
                            { backgroundColor: active ? accent : colors.white },
                          ]}
                          onPress={() => selectPlaceKind(place.id)}
                          scaleTo={0.96}>
                          <View
                            style={[
                              styles.placeIcon,
                              {
                                backgroundColor: active ? 'rgba(255,255,255,0.22)' : colors.cream },
                            ]}>
                            <Feather
                              name={place.icon}
                              size={18}
                              color={active ? colors.onAccent : accent}
                            />
                          </View>
                          <Text
                            style={[
                              styles.placeLabel,
                              { color: active ? colors.onAccent : colors.text },
                            ]}>
                            {place.label}
                          </Text>
                        </PressScale>
                      );
                    })}
                  </View>

                  <Pressable
                    style={[styles.locateRow, { backgroundColor: colors.white }]}
                    onPress={locateMe}
                    disabled={locateLoading}>
                    {locateLoading ? (
                      <ActivityIndicator size="small" color={colors.gold} />
                    ) : (
                      <Feather name="crosshair" size={16} color={colors.gold} />
                    )}
                    <Text style={[styles.locateRowText, { color: colors.text }]}>
                      Utiliser ma position exacte
                    </Text>
                  </Pressable>

                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Libellé</Text>
                  <TextInput
                    value={label}
                    onChangeText={setLabel}
                    onFocus={revealFormField}
                    placeholder="Domicile, Bureau…"
                    placeholderTextColor={colors.placeholder}
                    {...iosKeyboardAccessoryProps()}
                    style={[styles.input, { backgroundColor: colors.white, color: colors.text }]}
                  />
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Adresse</Text>
                  <TextInput
                    value={line}
                    onChangeText={setLine}
                    onFocus={revealFormField}
                    placeholder="Rue, quartier…"
                    placeholderTextColor={colors.placeholder}
                    {...iosKeyboardAccessoryProps()}
                    style={[styles.input, { backgroundColor: colors.white, color: colors.text }]}
                  />
                  {geoLoading ? (
                    <Text style={[styles.fieldLabel, { color: colors.gold }]}>
                      Mise à jour depuis la carte…
                    </Text>
                  ) : null}
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Téléphone</Text>
                  <TextInput
                    value={phone}
                    onChangeText={(t) => setPhone(formatBeninPhoneInput(t))}
                    onFocus={revealFormField}
                    placeholder="+229 01 00 00 00 00"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="phone-pad"
                    {...iosKeyboardAccessoryProps()}
                    style={[styles.input, { backgroundColor: colors.white, color: colors.text }]}
                  />
                </Reanimated.ScrollView>

                <View style={styles.footer}>
                  <CtaButton
                    label={
                      editingId
                        ? 'Enregistrer et sélectionner'
                        : setupMode
                          ? 'Enregistrer mon adresse'
                          : 'Ajouter et sélectionner'
                    }
                    onPress={saveAddress}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.sheetEyebrow, { color: colors.muted }]}>Livraison chez vous</Text>
                <Text style={styles.sheetTitle}>Choisissez l’adresse</Text>
                <Text style={styles.sheetSub}>
                  Liste ou carte · le livreur se rendra à ces coordonnées.
                </Text>

                <Reanimated.ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.sheetScroll}
                  contentContainerStyle={styles.sheetContent}
                  bounces
                  nestedScrollEnabled>
                  {orderedAddresses.length === 0 ? (
                    <View style={styles.emptyHint}>
                      <Feather name="map-pin" size={22} color={colors.gold} />
                      <Text style={styles.emptyTitle}>Aucune adresse pour l’instant</Text>
                      <Text style={styles.emptySub}>Ajoutez le lieu où le livreur doit se rendre.</Text>
                    </View>
                  ) : null}
                  {orderedAddresses.map((address) => (
                    <SwipeAddressCard
                      key={address.id}
                      address={address}
                      selected={selectedId === address.id}
                      canDelete={addresses.length > 1}
                      onSelect={() => selectAddress(address)}
                      onSetDefault={() => {
                        setDefault(address.id);
                        selectAddress(address);
                      }}
                      onEdit={() => openEdit(address)}
                      onDelete={() => confirmDelete(address)}
                    />
                  ))}

                  <Pressable style={styles.addCard} onPress={openAdd}>
                    <Feather name="plus" size={18} color={colors.gold} />
                    <Text style={styles.addText}>Ajouter une nouvelle adresse</Text>
                  </Pressable>
                </Reanimated.ScrollView>

                <View style={styles.footer}>
                  <Text style={styles.footerHint} numberOfLines={1}>
                    {selectedAddress
                      ? `${selectedAddress.label} · ${selectedAddress.line}`
                      : 'Aucune adresse'}
                  </Text>
                  <CtaButton
                    label={
                      selectedAddress
                        ? setup === '1'
                          ? 'Choisir mon Super U'
                          : 'Continuer'
                        : 'Ajouter une adresse'
                    }
                    onPress={selectedAddress ? saveDefault : openAdd}
                  />
                </View>
              </>
            )}
          </Reanimated.View>
      </GestureRoot>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  const hudGlass =
    Platform.OS === 'web'
      ? {
          backdropFilter: mapHud.webFilter,
          WebkitBackdropFilter: mapHud.webFilter,
          boxShadow: mapHud.webShadow,
        }
      : {};
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, position: 'relative' },
    mapLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
      backgroundColor: '#dfe6e9',
    },
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
      backgroundColor: mapHud.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: mapHud.border,
      ...hudGlass,
    },
    titlePillMain: { color: mapHud.ink, fontSize: 14, fontWeight: '800' },
    titlePillSub: { color: mapHud.muted, fontSize: 11, marginTop: 1, fontWeight: '600' },
    locateFab: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        web: { boxShadow: '0 4px 14px rgba(28,22,19,0.12)' },
        default: {
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3 } }) },
    segmentWrap: {
      position: 'absolute',
      left: 14,
      right: 14,
      flexDirection: 'row',
      backgroundColor: mapHud.surface,
      borderRadius: 14,
      padding: 4,
      gap: 4,
      zIndex: 5,
      borderWidth: 1,
      borderColor: mapHud.border,
      ...hudGlass,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 11 },
    segmentOn: { backgroundColor: '#f4e6c8' },
    segmentText: { color: mapHud.muted, fontSize: 13, fontWeight: '700' },
    segmentTextOn: { color: mapHud.ink },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      overflow: 'hidden',
      zIndex: 6,
      justifyContent: 'flex-start',
    },
    sheetHandle: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
    sheetHandleBar: { width: 40, height: 4, borderRadius: 999 },
    sheetEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      paddingHorizontal: 14,
      marginBottom: 4 },
    sheetTitle: {
      ...displayFont('700'),
      color: colors.text,
      fontSize: 20,
      paddingHorizontal: 14 },
    sheetSub: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 14,
      marginTop: 4,
      marginBottom: 8,
      fontWeight: '500' },
    sheetScroll: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
    sheetContent: { paddingHorizontal: 14, gap: 8, paddingBottom: 8, flexGrow: 0 },
    emptyHint: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 18,
      paddingHorizontal: 12,
    },
    emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
    emptySub: { color: colors.muted, fontSize: 13, textAlign: 'center', fontWeight: '500' },
    swipeWrap: {
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: colors.bg,
    },
    swipeChild: {
      backgroundColor: colors.bg,
    },
    rightActions: {
      flexDirection: 'row',
      width: ACTION_W * 2,
    },
    swipeAction: {
      width: ACTION_W,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      alignSelf: 'stretch',
    },
    swipeDefault: { backgroundColor: colors.gold },
    swipeEdit: { backgroundColor: colors.terracotta },
    swipeDelete: { backgroundColor: '#8b2e22' },
    swipeActionText: { color: colors.onAccent, fontSize: 11, fontWeight: '800' },
    webActions: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingBottom: 10,
      backgroundColor: colors.white,
    },
    webChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14,
      gap: 2,
    },
    cardSelected: { backgroundColor: colors.selectSoft },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    pin: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center' },
    label: { color: colors.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
    defaultBadge: {
      backgroundColor: colors.gold,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999 },
    defaultText: { color: colors.onAccent, fontSize: 10, fontWeight: '800' },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.cream },
    radioOn: { backgroundColor: colors.gold },
    line: { color: colors.text, fontSize: 13, fontWeight: '500' },
    meta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    addCard: {
      backgroundColor: colors.cream,
      borderRadius: 18,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8 },
    addText: { color: colors.gold, fontSize: 15, fontWeight: '700' },
    footer: { paddingHorizontal: spacing.screenMd, gap: 8, paddingTop: 4 },
    footerHint: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
    form: { paddingHorizontal: spacing.screenMd, gap: 10, paddingBottom: 12 },
    placeRow: { flexDirection: 'row', gap: 8 },
    placeChip: {
      flex: 1,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 8 },
    placeIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center' },
    placeLabel: { fontSize: 12, fontWeight: '700' },
    locateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12 },
    locateRowText: { fontSize: 14, fontWeight: '700' },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      paddingHorizontal: 14,
      marginTop: 6,
    },
    input: {
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      fontWeight: '600' } });
}
