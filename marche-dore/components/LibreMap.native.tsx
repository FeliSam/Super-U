import type { LibreMapProps } from '@/components/LibreMap.types';
import { cotonouMap, type LngLat, type MapMarker } from '@/constants/map';
import { useColors } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

type MapsMod = typeof import('react-native-maps');

let mapsCache: MapsMod | null | undefined;

function loadMaps(): MapsMod | null {
  if (mapsCache !== undefined) return mapsCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mapsCache = require('react-native-maps') as MapsMod;
  } catch {
    mapsCache = null;
  }
  return mapsCache;
}

function validLngLat(c: LngLat | undefined): c is LngLat {
  return Boolean(c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) > 0.01);
}

function zoomToDelta(zoom: number): number {
  return Math.max(0.0012, 180 / Math.pow(2, Math.max(1, zoom)));
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
      <View style={pinStyles.wrap} pointerEvents="none">
        {label ? (
          <View style={pinStyles.label}>
            <Text style={pinStyles.labelText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : null}
        <View style={[pinStyles.superU, { backgroundColor: color }]}>
          <Text style={pinStyles.superULetter}>U</Text>
        </View>
        <View style={[pinStyles.superUTip, { borderTopColor: color }]} />
      </View>
    );
  }

  const icon =
    kind === 'store' ? 'shopping-bag' : kind === 'home' ? 'home' : kind === 'courier' ? 'truck' : 'map-pin';
  return (
    <View style={pinStyles.wrap} pointerEvents="none">
      {label ? (
        <View style={pinStyles.label}>
          <Text style={pinStyles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
      <View style={[pinStyles.dot, { backgroundColor: color }]}>
        <Feather name={icon as 'map-pin'} size={14} color="#ffffff" />
      </View>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  label: {
    maxWidth: 120,
    backgroundColor: 'rgba(20,17,15,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  superUTip: {
    width: 0,
    height: 0,
    marginTop: -6,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

export function warmLibreMap(_styleUrl?: string, _center?: unknown, _zoom?: number) {
  return Promise.resolve();
}

function MapFallback({
  markers,
  colors,
}: {
  markers: MapMarker[];
  colors: { gold: string; text: string; muted: string };
}) {
  return (
    <View style={styles.fallback}>
      <Text style={[styles.fallbackTitle, { color: colors.text }]}>Carte</Text>
      <Text style={[styles.fallbackHint, { color: colors.muted }]}>
        Aperçu des points (carte native indisponible ici).
      </Text>
      {markers.slice(0, 6).map((m) => (
        <Text key={m.id} style={[styles.fallbackRow, { color: colors.text }]}>
          · {m.label || m.kind || m.id}
        </Text>
      ))}
    </View>
  );
}

/** Native: react-native-maps (Expo Go). MapLibre RN nécessite un build custom. */
export function LibreMap({
  style,
  mapStyle: _mapStyle,
  center,
  zoom = cotonouMap.zoom,
  markers = [],
  route,
  interactive = true,
  followCamera = false,
  onReady,
  onPressMap,
  onPressMarker,
}: LibreMapProps) {
  const colors = useColors();
  const mapRef = useRef<{ animateToRegion?: (r: object, d?: number) => void } | null>(null);
  const userMovedRef = useRef(false);
  const [maps] = useState(() => loadMaps());
  const osmTiles = Platform.OS === 'android';

  const placed = useMemo(
    () => markers.filter((m): m is MapMarker => validLngLat(m.coordinate)),
    [markers],
  );
  const routeCoords = useMemo(() => {
    const pts = (route ?? []).filter(validLngLat);
    return pts.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  }, [route]);

  const initialRegion = useMemo(() => toRegion(center, zoom), []);

  useEffect(() => {
    if (!followCamera || userMovedRef.current || !maps) return;
    if (!validLngLat(center)) return;
    mapRef.current?.animateToRegion?.(toRegion(center, zoom), 420);
  }, [center[0], center[1], zoom, followCamera, maps]);

  useEffect(() => {
    if (maps) onReady?.();
  }, [maps, onReady]);

  if (!maps) {
    return (
      <View style={[styles.wrap, style]}>
        <MapFallback markers={placed} colors={colors} />
      </View>
    );
  }

  const MapView = maps.default;
  const { Marker, Polyline, UrlTile } = maps;
  if (typeof MapView !== 'function') {
    return (
      <View style={[styles.wrap, style]}>
        <MapFallback markers={placed} colors={colors} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={mapRef as never}
        style={styles.map}
        initialRegion={initialRegion}
        mapType={osmTiles ? 'none' : 'standard'}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={false}
        showsCompass={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onMapReady={() => onReady?.()}
        onPanDrag={() => {
          userMovedRef.current = true;
        }}
        onPress={(e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          onPressMap?.([longitude, latitude]);
        }}>
        {osmTiles && UrlTile ? (
          <UrlTile
            urlTemplate="https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
            maximumZ={20}
            flipY={false}
            zIndex={-1}
          />
        ) : null}

        {routeCoords.length >= 2 && Polyline ? (
          <Polyline
            coordinates={routeCoords}
            strokeColor={colors.gold}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
            geodesic={false}
          />
        ) : null}

        {Marker
          ? placed.map((m) => (
              <Marker
                key={m.id}
                coordinate={{ latitude: m.coordinate[1], longitude: m.coordinate[0] }}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={false}
                onPress={() => onPressMarker?.(m.id, m.coordinate)}>
                <Pin color={m.color ?? colors.gold} kind={m.kind} label={m.label} />
              </Marker>
            ))
          : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#1a1714', flex: 1 },
  map: { flex: 1 },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
    backgroundColor: '#f3efe8',
  },
  fallbackTitle: { fontSize: 18, fontWeight: '700' },
  fallbackHint: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  fallbackRow: { fontSize: 13 },
});
