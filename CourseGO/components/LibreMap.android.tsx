import { cotonouMap, mapStyles, type LngLat, type MapMarker } from '@/constants/map';
import type { LibreMapProps } from '@/components/LibreMap.types';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function validLngLat(c: LngLat | undefined): c is LngLat {
  return (
    Array.isArray(c) &&
    c.length >= 2 &&
    Number.isFinite(c[0]) &&
    Number.isFinite(c[1]) &&
    Math.abs(c[0]) <= 180 &&
    Math.abs(c[1]) <= 90
  );
}

function resolveStyleUrl(mapStyle: string) {
  if (!mapStyle || mapStyle.startsWith('raster:')) return mapStyles.light;
  if (mapStyle.startsWith('http')) return mapStyle;
  return mapStyles.light;
}

function padToObject(fitPadding: LibreMapProps['fitPadding']) {
  if (typeof fitPadding === 'number') {
    return { top: fitPadding, right: fitPadding, bottom: fitPadding, left: fitPadding };
  }
  return fitPadding ?? { top: 80, right: 40, bottom: 120, left: 40 };
}

/** Android: MapLibre Native. iOS reste sur LibreMap.native (Apple Maps). */
export function LibreMap({
  style,
  mapStyle,
  center,
  zoom = cotonouMap.zoom,
  markers = [],
  route,
  fitToMarkers = false,
  fitIncludeCourier = true,
  fitPadding,
  fitMaxZoom = 16,
  followCamera = false,
  navigationMode = false,
  bearing = 0,
  followResumeTick = 0,
  onFollowBreak,
  interactive = true,
  showNavigation = true,
  onMarkerPress,
}: LibreMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const userMovedRef = useRef(false);
  const mapReadyRef = useRef(false);
  const bearingRef = useRef(bearing);
  const onFollowBreakRef = useRef(onFollowBreak);
  bearingRef.current = bearing;
  onFollowBreakRef.current = onFollowBreak;

  const safeCenter: LngLat = validLngLat(center) ? center : cotonouMap.home;
  const styleUrl = resolveStyleUrl(mapStyle);

  const placed = useMemo(
    () => markers.filter((m): m is MapMarker => validLngLat(m.coordinate)),
    [markers],
  );

  const fitCoords = useMemo(() => {
    const list = fitIncludeCourier
      ? placed
      : placed.filter((m) => m.kind !== 'courier');
    return list.map((m) => m.coordinate);
  }, [placed, fitIncludeCourier]);

  const routeGeo = useMemo(() => {
    const coords = (route ?? []).filter(validLngLat);
    if (coords.length < 2) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: coords },
        },
      ],
    };
  }, [route]);

  const flyTo = useCallback((c: LngLat, z: number, extra?: { bearing?: number; pitch?: number }) => {
    cameraRef.current?.flyTo({
      center: c,
      zoom: z,
      duration: navigationMode ? 800 : 400,
      bearing: extra?.bearing,
      pitch: extra?.pitch,
    });
  }, [navigationMode]);

  useEffect(() => {
    if (followResumeTick > 0) userMovedRef.current = false;
  }, [followResumeTick]);

  // Fit markers
  useEffect(() => {
    if (!mapReadyRef.current || !fitToMarkers || fitCoords.length < 1 || userMovedRef.current) return;
    if (fitCoords.length === 1) {
      flyTo(fitCoords[0], Math.min(fitMaxZoom, zoom ?? cotonouMap.zoom));
      return;
    }
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const [lng, lat] of fitCoords) {
      west = Math.min(west, lng);
      south = Math.min(south, lat);
      east = Math.max(east, lng);
      north = Math.max(north, lat);
    }
    const pad = padToObject(fitPadding);
    cameraRef.current?.fitBounds([west, south, east, north], {
      padding: pad,
      duration: 500,
      zoom: fitMaxZoom,
    });
  }, [fitToMarkers, fitCoords, fitPadding, fitMaxZoom, flyTo, zoom]);

  // Follow / navigation camera
  useEffect(() => {
    if (!mapReadyRef.current || !validLngLat(center) || userMovedRef.current) return;
    if (navigationMode) {
      flyTo(center, Math.max(zoom ?? 17, 16), { bearing: bearingRef.current, pitch: 55 });
      return;
    }
    if (fitToMarkers) return;
    if (followCamera) flyTo(center, zoom ?? cotonouMap.zoom);
  }, [
    center?.[0],
    center?.[1],
    zoom,
    followCamera,
    navigationMode,
    followResumeTick,
    fitToMarkers,
    flyTo,
  ]);

  // Bearing updates in navigation mode
  useEffect(() => {
    if (!mapReadyRef.current || !navigationMode || userMovedRef.current) return;
    if (!validLngLat(center)) return;
    cameraRef.current?.easeTo({
      center,
      zoom: Math.max(zoom ?? 17, 16),
      bearing,
      pitch: 55,
      duration: 300,
    });
  }, [bearing, navigationMode, center?.[0], center?.[1], zoom]);

  return (
    <View style={[styles.wrap, style]}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={styleUrl}
        attribution
        logo={false}
        compass={false}
        touchZoom={interactive}
        dragPan={interactive}
        touchRotate={interactive || navigationMode}
        touchPitch={interactive || navigationMode}
        onDidFinishLoadingMap={() => {
          mapReadyRef.current = true;
        }}
        onRegionWillChange={(e) => {
          if (e?.nativeEvent?.userInteraction) {
            userMovedRef.current = true;
            if (navigationMode) onFollowBreakRef.current?.();
          }
        }}>
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: safeCenter,
            zoom,
            bearing: navigationMode ? bearing : 0,
            pitch: navigationMode ? 55 : 0,
          }}
        />

        {routeGeo ? (
          <GeoJSONSource id="route" data={routeGeo}>
            <Layer
              id="route-line"
              type="line"
              paint={{
                'line-color': '#058d81',
                'line-width': 4,
                'line-opacity': 0.9,
              }}
            />
          </GeoJSONSource>
        ) : null}

        {placed.map((m) => (
          <Marker
            key={m.id}
            id={m.id}
            lngLat={m.coordinate}
            onPress={() => onMarkerPress?.(m.id)}>
            <View style={[styles.pin, { backgroundColor: m.color ?? '#058d81' }]}>
              <Text style={styles.pinText}>
                {m.kind === 'courier' ? '🛵' : m.kind === 'store' ? 'S' : '•'}
              </Text>
            </View>
          </Marker>
        ))}
      </Map>

      {showNavigation && interactive && !navigationMode ? (
        <View style={styles.navStack} pointerEvents="box-none">
          <Pressable style={styles.navBtn} onPress={() => flyTo(safeCenter, Math.min(18, zoom + 1))}>
            <Text style={styles.navBtnTxt}>+</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => flyTo(safeCenter, Math.max(10, zoom - 1))}>
            <Text style={styles.navBtnTxt}>−</Text>
          </Pressable>
          <Pressable
            style={styles.navBtn}
            onPress={() => {
              userMovedRef.current = false;
              flyTo(safeCenter, zoom);
            }}>
            <Text style={styles.navBtnTxt}>◎</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function warmLibreMap() {
  return Promise.resolve();
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: '#e8e4df', flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  navStack: { position: 'absolute', top: 112, right: 12, zIndex: 20, gap: 8 },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnTxt: { fontSize: 18, fontWeight: '700', color: '#14110f' },
});
