import { MapLoadingOverlay } from '@/components/MapLoadingOverlay';
import type { LibreMapProps } from '@/components/LibreMap.types';
import { cotonouMap, mapRasterTiles, type LngLat, type MapMarker } from '@/constants/map';
import { useColors } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';

function validLngLat(c: LngLat | undefined): c is LngLat {
  return Boolean(c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) > 0.01);
}

function zoomToDelta(zoom: number): number {
  return Math.max(0.0012, 180 / Math.pow(2, Math.max(1, zoom)));
}

function deltaToZoom(latitudeDelta: number): number {
  return Math.log2(180 / Math.max(0.0004, latitudeDelta));
}

function toRegion(center: LngLat, zoom: number) {
  const latitudeDelta = zoomToDelta(zoom);
  return {
    latitude: center[1],
    longitude: center[0],
    latitudeDelta,
    longitudeDelta: latitudeDelta * 0.72,
  };
}

function Pin({
  color,
  kind,
  label,
}: {
  color: string;
  kind?: string;
  label?: string;
}) {
  if (kind === 'superu') {
    return (
      <View style={pinStyles.root} pointerEvents="none" collapsable={false}>
        {label ? (
          <View style={pinStyles.label} collapsable={false}>
            <Text style={pinStyles.labelText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : (
          <View style={pinStyles.labelSpacer} collapsable={false} />
        )}
        <View style={[pinStyles.superU, { backgroundColor: color }]} collapsable={false}>
          <Text style={pinStyles.superULetter}>U</Text>
        </View>
        <View style={[pinStyles.tip, { borderTopColor: color }]} collapsable={false} />
      </View>
    );
  }

  const icon =
    kind === 'store' ? 'shopping-bag' : kind === 'home' ? 'home' : kind === 'courier' ? 'truck' : 'map-pin';
  return (
    <View style={pinStyles.root} pointerEvents="none" collapsable={false}>
      {label ? (
        <View style={pinStyles.label} collapsable={false}>
          <Text style={pinStyles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : (
        <View style={pinStyles.labelSpacer} collapsable={false} />
      )}
      <View style={[pinStyles.dot, { backgroundColor: color }]} collapsable={false}>
        <Feather name={icon as 'map-pin'} size={14} color="#ffffff" />
      </View>
      <View style={[pinStyles.tip, { borderTopColor: color }]} collapsable={false} />
    </View>
  );
}

const pinStyles = StyleSheet.create({
  /** Hauteur fixe : l’ancre (0.5, 1) pointe bien la pointe du pin sur Apple Maps. */
  root: {
    width: 120,
    height: 68,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  labelSpacer: { height: 22, width: 1 },
  label: {
    maxWidth: 112,
    height: 22,
    marginBottom: 3,
    backgroundColor: 'rgba(20,17,15,0.85)',
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRadius: 999,
  },
  labelText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  tip: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  superU: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#ffffff',
  },
  superULetter: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    letterSpacing: -1,
  },
});

export function warmLibreMap(_styleUrl?: string, _center?: unknown, _zoom?: number) {
  return Promise.resolve();
}

/**
 * Même stratégie que CourseGO :
 * - iOS : Apple Maps (`mutedStandard`) — fiable dans Expo Go
 * - Android : tuiles OSM FR (`mapType=none` + UrlTile)
 * Web → LibreMap.web.tsx (MapLibre)
 */
export function LibreMap({
  style,
  mapStyle: _mapStyle,
  center,
  zoom = cotonouMap.zoom,
  markers = [],
  route,
  interactive = true,
  showNavigation = true,
  navigationOffset,
  followCamera = false,
  onReady,
  onError: _onError,
  onPressMap,
  onPressMarker,
}: LibreMapProps) {
  const colors = useColors();
  const mapRef = useRef<MapView | null>(null);
  const userMovedRef = useRef(false);
  const zoomRef = useRef(zoom);
  const [mapReady, setMapReady] = useState(false);
  const readyFallbackRef = useRef(false);

  /** iOS TestFlight: onMapReady sometimes never fires → white overlay forever. Force ready. */
  useEffect(() => {
    const t = setTimeout(() => {
      if (readyFallbackRef.current) return;
      readyFallbackRef.current = true;
      setMapReady(true);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  const [tracksPins, setTracksPins] = useState(true);
  const [regionZoom, setRegionZoom] = useState(zoom);

  zoomRef.current = zoom;

  /** Comme CourseGO : OSM seulement sur Android. */
  const osmTiles = Platform.OS === 'android';

  const placed = useMemo(
    () => markers.filter((m): m is MapMarker => validLngLat(m.coordinate)),
    [markers],
  );
  const routeCoords = useMemo(() => {
    const pts = (route ?? []).filter(validLngLat);
    return pts.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  }, [route]);

  const safeCenter: LngLat = validLngLat(center) ? center : cotonouMap.home;
  const initialRegion = useMemo(() => toRegion(safeCenter, zoom), []);

  const animateTo = useCallback((c: LngLat, z: number, ms = 420) => {
    mapRef.current?.animateToRegion(toRegion(c, z), ms);
  }, []);

  /** Nouveau centre parent (sélection d’adresse) → reprendre le suivi. */
  const prevCenterRef = useRef<LngLat | null>(null);
  useEffect(() => {
    if (!validLngLat(center)) return;
    const prev = prevCenterRef.current;
    const jumped =
      !prev ||
      Math.abs(prev[0] - center[0]) > 0.00008 ||
      Math.abs(prev[1] - center[1]) > 0.00008;
    prevCenterRef.current = center;
    if (jumped) userMovedRef.current = false;
  }, [center?.[0], center?.[1]]);

  /** Première frame : caler sur le centre courant (adresses hydratées après mount). */
  useEffect(() => {
    if (!mapReady || !validLngLat(center)) return;
    animateTo(center, zoom, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snap once when MapView is ready
  }, [mapReady]);

  /** Suivi caméra tant que l’utilisateur n’a pas glissé la carte. */
  useEffect(() => {
    if (!mapReady || !followCamera || !validLngLat(center)) return;
    if (userMovedRef.current) return;
    animateTo(center, zoom, 420);
  }, [center?.[0], center?.[1], zoom, followCamera, mapReady, animateTo]);

  useEffect(() => {
    if (mapReady) onReady?.();
  }, [mapReady, onReady]);

  useEffect(() => {
    if (!mapReady || !tracksPins) return;
    const t = setTimeout(() => setTracksPins(false), 900);
    return () => clearTimeout(t);
  }, [mapReady, tracksPins, placed.length]);

  const zoomBy = useCallback((delta: number) => {
    const next = Math.max(3, Math.min(18, (zoomRef.current || regionZoom) + delta));
    zoomRef.current = next;
    setRegionZoom(next);
    userMovedRef.current = false;
    if (validLngLat(center)) animateTo(center, next, 220);
  }, [animateTo, center, regionZoom]);

  const recenter = useCallback(() => {
    userMovedRef.current = false;
    if (validLngLat(center)) animateTo(center, zoomRef.current || zoom, 320);
  }, [animateTo, center, zoom]);

  const navTop = navigationOffset?.top ?? 112;
  const navRight = navigationOffset?.right ?? 12;

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        mapType={osmTiles ? 'none' : 'mutedStandard'}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={false}
        showsCompass={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsBuildings={!osmTiles}
        showsTraffic={false}
        toolbarEnabled={false}
        loadingEnabled
        moveOnMarkerPress={false}
        onMapReady={() => {
          readyFallbackRef.current = true;
          setMapReady(true);
        }}
        onRegionChangeComplete={(region) => {
          setRegionZoom(deltaToZoom(region.latitudeDelta));
          zoomRef.current = deltaToZoom(region.latitudeDelta);
        }}
        onPanDrag={() => {
          userMovedRef.current = true;
        }}
        onPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          onPressMap?.([longitude, latitude]);
        }}>
        {osmTiles ? (
          <UrlTile
            urlTemplate={mapRasterTiles.voyager}
            maximumZ={20}
            flipY={false}
            zIndex={-1}
          />
        ) : null}

        {routeCoords.length >= 2 ? (
          <>
            <Polyline
              coordinates={routeCoords}
              strokeColor="rgba(226, 147, 29, 0.32)"
              strokeWidth={10}
              lineCap="round"
              lineJoin="round"
              geodesic={false}
              zIndex={1}
              tappable={false}
            />
            <Polyline
              coordinates={routeCoords}
              strokeColor={colors.gold}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              geodesic={false}
              zIndex={2}
              tappable={false}
            />
          </>
        ) : null}

        {placed.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.coordinate[1], longitude: m.coordinate[0] }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={tracksPins}
            onPress={() => onPressMarker?.(m.id, m.coordinate)}>
            <Pin color={m.color ?? colors.gold} kind={m.kind} label={m.label} />
          </Marker>
        ))}
      </MapView>

      {showNavigation && interactive ? (
        <View style={[styles.navStack, { top: navTop, right: navRight }]} pointerEvents="box-none">
          <View style={styles.navGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom avant"
              onPress={() => zoomBy(1)}
              style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}>
              <Feather name="plus" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.navSep} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom arrière"
              onPress={() => zoomBy(-1)}
              style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}>
              <Feather name="minus" size={20} color={colors.text} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recentrer"
            onPress={recenter}
            style={({ pressed }) => [styles.locateBtn, pressed && styles.navBtnPressed]}>
            <Feather name="navigation" size={18} color={colors.gold} />
          </Pressable>
        </View>
      ) : null}

      <MapLoadingOverlay
        visible={!mapReady}
        title="Chargement de la carte"
        subtitle="Préparation de votre zone de livraison…"
        maxVisibleMs={2200}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#f3efe8',
    flex: 1,
    minHeight: 0,
  },
  map: { ...StyleSheet.absoluteFillObject },
  navStack: {
    position: 'absolute',
    zIndex: 20,
    gap: 10,
    alignItems: 'stretch',
  },
  navGroup: {
    borderRadius: 14,
    overflow: 'hidden',
    width: 44,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPressed: { opacity: 0.72 },
  navSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(20,17,15,0.12)',
  },
  locateBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
});
