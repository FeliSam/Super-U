import { LibreMap, warmLibreMap } from '@/components/LibreMap';
import { PressScale } from '@/components/motion';
import { CtaButton, IconCircle, Screen } from '@/components/ui';
import { appLocation } from '@/constants/location';
import { cotonouMap, mapStyles, type LngLat, type MapMarker } from '@/constants/map';
import { displayFont, type AppColors } from '@/constants/theme';
import { useAddresses } from '@/context/AddressesContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import type { DeliveryAddress } from '@/data/account';
import { SUPER_U_BRAND } from '@/data/superU';
import { listSuperUStores, superUStoresToMapMarkers } from '@/lib/api/superU';
import { getDeviceLocation } from '@/lib/geolocation';
import { softShadow } from '@/lib/shadow';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WINDOW_H = Dimensions.get('window').height;
const SHEET_MIN = Math.round(WINDOW_H * 0.42);
const SHEET_MAX = Math.round(WINDOW_H * 0.82);
const SHEET_MID = Math.round((SHEET_MIN + SHEET_MAX) / 2);
const SWIPE_LEFT = -152;
const SWIPE_RIGHT = 88;
const SWIPE_OVER = 28;
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

function SwipeAddressCard({
  address,
  selected,
  canDelete,
  onSelect,
  onSetDefault,
  onEdit,
  onDelete }: {
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
  const translateX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);

  const snapTo = (toValue: number) => {
    offset.current = toValue;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 68 }).start();
  };

  const close = () => snapTo(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.25,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateX.stopAnimation((v) => {
          offset.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        const raw = offset.current + g.dx;
        let next = raw;
        if (raw < SWIPE_LEFT) next = SWIPE_LEFT - (SWIPE_LEFT - raw) * 0.35;
        else if (raw > SWIPE_RIGHT) next = SWIPE_RIGHT + (raw - SWIPE_RIGHT) * 0.35;
        translateX.setValue(
          Math.max(SWIPE_LEFT - SWIPE_OVER, Math.min(SWIPE_RIGHT + SWIPE_OVER, next)),
        );
      },
      onPanResponderRelease: (_, g) => {
        const projected = offset.current + g.dx + g.vx * 36;
        if (projected <= SWIPE_LEFT / 2 || g.vx < -0.4) {
          snapTo(SWIPE_LEFT);
          return;
        }
        if (projected >= SWIPE_RIGHT / 2 || g.vx > 0.4) {
          snapTo(SWIPE_RIGHT);
          return;
        }
        snapTo(0);
      } }),
  ).current;

  const runAndClose = (action: () => void) => {
    close();
    requestAnimationFrame(action);
  };

  return (
    <View style={styles.swipeWrap}>
      <View style={styles.swipeRails} pointerEvents="box-none">
        <View style={styles.rightRail}>
          <Pressable
            style={[styles.swipeAction, styles.swipeDefault]}
            onPress={() => runAndClose(onSetDefault)}
            accessibilityLabel="Définir par défaut">
            <Feather name="star" size={18} color={colors.onAccent} />
            <Text style={styles.swipeActionText}>Défaut</Text>
          </Pressable>
        </View>
        <View style={styles.leftRail}>
          <Pressable
            style={[styles.swipeAction, styles.swipeEdit]}
            onPress={() => runAndClose(onEdit)}
            accessibilityLabel="Modifier l’adresse">
            <Feather name="edit-3" size={18} color={colors.onAccent} />
            <Text style={styles.swipeActionText}>Éditer</Text>
          </Pressable>
          {canDelete ? (
            <Pressable
              style={[styles.swipeAction, styles.swipeDelete]}
              onPress={() => runAndClose(onDelete)}
              accessibilityLabel="Supprimer l’adresse">
              <Feather name="trash-2" size={18} color={colors.onAccent} />
              <Text style={styles.swipeActionText}>Suppr.</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Animated.View
        style={[styles.swipeFront, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}>
        <Pressable
          style={[styles.card, selected && styles.cardSelected]}
          onPress={() => {
            if (offset.current !== 0) {
              close();
              return;
            }
            onSelect();
          }}>
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
      </Animated.View>
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
  const { addresses, selectedId, setSelectedId, setDefault, addAddress, updateAddress, removeAddress } =
    useAddresses();

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
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapCenter, setMapCenter] = useState<LngLat>([
    ...(selectedAddress?.coordinate ?? cotonouMap.home),
  ]);
  const [mapZoom, setMapZoom] = useState(13.8);
  const [pin, setPin] = useState<LngLat>([...cotonouMap.home]);
  const [placeKind, setPlaceKind] = useState<PlaceKind>('home');
  const [label, setLabel] = useState(PLACE_LABELS.home);
  const [line, setLine] = useState(appLocation.defaultLine);
  const [phone, setPhone] = useState(appLocation.phone);
  const [geoLoading, setGeoLoading] = useState(false);
  const [locateLoading, setLocateLoading] = useState(false);
  const [superUMarkers, setSuperUMarkers] = useState<MapMarker[]>([]);

  const sheetH = useSharedValue(SHEET_MIN);
  const dragStartH = useSharedValue(SHEET_MIN);
  const editing = mode === 'edit';

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
    setLine(appLocation.defaultLine);
    setPhone(appLocation.phone);
    sheetH.value = withSpring(SHEET_MAX, { damping: 22, stiffness: 220, mass: 0.9 });
    setMode('edit');
  };

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
    setPhone(address.phone);
    sheetH.value = withSpring(SHEET_MAX, { damping: 22, stiffness: 220, mass: 0.9 });
    setMode('edit');
  };

  const closeEdit = () => {
    setMode('list');
    setEditingId(null);
    sheetH.value = withSpring(SHEET_MIN, { damping: 22, stiffness: 220, mass: 0.9 });
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
          sheetH.value = withSpring(target, { damping: 22, stiffness: 220, mass: 0.9 });
        }),
    [dragStartH, sheetH],
  );

  const sheetAnim = useAnimatedStyle(() => ({ height: sheetH.value }));

  const saveAddress = () => {
    const payload = {
      label: label.trim() || PLACE_LABELS[placeKind],
      line: line.trim() || appLocation.defaultLine,
      city: `${appLocation.city}, ${appLocation.country}`,
      phone: phone.trim() || appLocation.phone,
      coordinate: [...pin] as LngLat,
      makeDefault: true };
    if (editingId) {
      updateAddress(editingId, payload);
      setSelectedId(editingId);
    } else {
      const created = addAddress(payload);
      setSelectedId(created.id);
    }
    setMapCenter([...pin]);
    setMapZoom(14.2);
    setMode('list');
    setEditingId(null);
    sheetH.value = withSpring(SHEET_MIN, { damping: 22, stiffness: 220, mass: 0.9 });
  };

  const saveDefault = () => {
    setDefault(selectedId);
    router.back();
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

  const mapStyleUrl = scheme === 'dark' ? mapStyles.dark : mapStyles.light;

  return (
    <Screen>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.mapLayer}>
          <LibreMap
            style={StyleSheet.absoluteFill}
            mapStyle={mapStyleUrl}
            center={mapCenter}
            zoom={mapZoom}
            markers={mapMarkers}
            interactive
            showNavigation
            navigationOffset={{
              top: editing
                ? Math.max(10, insets.top + 6) + 58
                : Math.max(10, insets.top + 6) + 54 + 52,
              right: 12 }}
            onReady={() => {
              setMapError(false);
              setMapReady(true);
            }}
            onError={() => {
              setMapError(true);
              setMapReady(true);
            }}
            onPressMap={editing ? (coord) => void applyCoordinate(coord, true) : undefined}
            onPressMarker={(id) => {
              if (editing) return;
              const addr = addresses.find((a) => a.id === id);
              if (addr) selectAddress(addr);
            }}
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
          <IconCircle
            name={editing ? 'x' : 'chevron-left'}
            onPress={editing ? closeEdit : () => router.back()}
          />
          <View style={styles.titlePill}>
            <Text style={styles.titlePillMain} numberOfLines={1}>
              {editing
                ? editingId
                  ? label.trim() || 'Modifier l’adresse'
                  : label.trim() || 'Nouvelle adresse'
                : 'Adresses de livraison'}
            </Text>
            <Text style={styles.titlePillSub} numberOfLines={1}>
              {editing
                ? geoLoading
                  ? 'Recherche de l’adresse…'
                  : 'Touchez la carte pour placer le pin'
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
            <IconCircle name="plus" onPress={openAdd} />
          )}
        </View>

        {!editing ? (
          <View style={[styles.segmentWrap, { top: Math.max(10, insets.top + 6) + 54 }]}>
            <View style={[styles.segment, styles.segmentOn]}>
              <Text style={[styles.segmentText, styles.segmentTextOn]}>Adresse</Text>
            </View>
            <Pressable style={styles.segment} onPress={() => router.replace('/account/stores')}>
              <Text style={styles.segmentText}>Supermarché</Text>
            </Pressable>
          </View>
        ) : null}

        <GestureDetector gesture={sheetPan}>
          <Reanimated.View
            style={[
              styles.sheet,
              sheetAnim,
              softShadow({ y: -8, blur: 24, opacity: 0.12 }),
              { paddingBottom: Math.max(14, insets.bottom + 8), backgroundColor: colors.bg },
            ]}>
            <View style={styles.sheetHandle}>
              <View style={[styles.sheetHandleBar, { backgroundColor: colors.border }]} />
            </View>

            {editing ? (
              <>
                <Text style={[styles.sheetEyebrow, { color: colors.muted }]}>
                  Détails de livraison
                </Text>
                <Text style={styles.sheetTitle}>
                  {editingId ? 'Modifier l’adresse' : 'Nouvelle adresse'}
                </Text>
                <Text style={styles.sheetSub}>
                  Placez le pin sur la carte, puis validez — l’adresse sera sélectionnée.
                </Text>

                <Reanimated.ScrollView
                  keyboardShouldPersistTaps="handled"
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
                    placeholder="Domicile, Bureau…"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, { backgroundColor: colors.white, color: colors.text }]}
                  />
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Adresse</Text>
                  <TextInput
                    value={line}
                    onChangeText={setLine}
                    placeholder="Rue, quartier…"
                    placeholderTextColor={colors.placeholder}
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
                    onChangeText={setPhone}
                    placeholder={appLocation.phone}
                    placeholderTextColor={colors.placeholder}
                    keyboardType="phone-pad"
                    style={[styles.input, { backgroundColor: colors.white, color: colors.text }]}
                  />
                </Reanimated.ScrollView>

                <View style={styles.footer}>
                  <CtaButton
                    label={editingId ? 'Enregistrer et sélectionner' : 'Ajouter et sélectionner'}
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
                  <CtaButton label="Enregistrer l'adresse par défaut" onPress={saveDefault} />
                </View>
              </>
            )}
          </Reanimated.View>
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
    swipeWrap: {
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: colors.bg },
    swipeRails: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      justifyContent: 'space-between' },
    rightRail: {
      width: SWIPE_RIGHT,
      alignSelf: 'stretch',
      justifyContent: 'center',
      paddingLeft: 2 },
    leftRail: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      width: Math.abs(SWIPE_LEFT),
      justifyContent: 'flex-end',
      gap: 2,
      paddingRight: 2 },
    swipeAction: {
      flex: 1,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minWidth: 72 },
    swipeDefault: { backgroundColor: colors.gold },
    swipeEdit: { backgroundColor: colors.terracotta },
    swipeDelete: { backgroundColor: '#8b2e22' },
    swipeActionText: { color: colors.onAccent, fontSize: 11, fontWeight: '800' },
    swipeFront: { width: '100%' },
    card: {
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14,
      gap: 2 },
    cardSelected: { backgroundColor: colors.selectSoft },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4 },
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
    footer: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },
    footerHint: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
    form: { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },
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
    fieldLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
    input: {
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      fontWeight: '600' } });
}
