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

/**
 * Android: MapLibre Native (OpenFreeMap).
 * iOS reste sur LibreMap.native.tsx (Apple Maps).
 */
export function LibreMap({
  style,
  mapStyle,
  center,
  zoom = cotonouMap.zoom,
  markers = [],
  route,
  interactive = true,
  showNavigation = true,
  navigationOffset,
  followCamera = false,
  onReady,
  onError,
  onPressMap,
  onPressMarker,
}: LibreMapProps) {
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const userMovedRef = useRef(false);
  const safeCenter: LngLat = validLngLat(center) ? center : cotonouMap.home;
  const styleUrl = resolveStyleUrl(mapStyle);

  const placed = useMemo(
    () => markers.filter((m): m is MapMarker => validLngLat(m.coordinate)),
    [markers],
  );

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

  const flyTo = useCallback((c: LngLat, z: number) => {
    cameraRef.current?.flyTo({ center: c, zoom: z, duration: 400 });
  }, []);

  useEffect(() => {
    if (!followCamera || !validLngLat(center) || userMovedRef.current) return;
    flyTo(center, zoom);
  }, [center?.[0], center?.[1], zoom, followCamera, flyTo]);

  const navTop = navigationOffset?.top ?? 112;
  const navRight = navigationOffset?.right ?? 12;

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
        touchRotate={interactive}
        touchPitch={false}
        onDidFinishLoadingMap={() => onReady?.()}
        onDidFailLoadingMap={() => onError?.('Carte MapLibre indisponible')}
        onPress={(e) => {
          const ll = e?.nativeEvent?.lngLat;
          if (Array.isArray(ll) && ll.length >= 2) onPressMap?.([ll[0], ll[1]]);
        }}
        onRegionWillChange={(e) => {
          if (e?.nativeEvent?.userInteraction) userMovedRef.current = true;
        }}>
        <Camera ref={cameraRef} initialViewState={{ center: safeCenter, zoom }} />

        {routeGeo ? (
          <GeoJSONSource id="route" data={routeGeo}>
            <Layer
              id="route-line"
              type="line"
              paint={{
                'line-color': '#e2931d',
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
            onPress={() => onPressMarker?.(m.id, m.coordinate)}>
            <View style={[styles.pin, { backgroundColor: m.color ?? '#e2931d' }]}>
              <Text style={styles.pinText}>{m.kind === 'superu' ? 'U' : '•'}</Text>
            </View>
          </Marker>
        ))}
      </Map>

      {showNavigation && interactive ? (
        <View style={[styles.navStack, { top: navTop, right: navRight }]} pointerEvents="box-none">
          <Pressable
            style={styles.navBtn}
            onPress={() => flyTo(safeCenter, Math.min(18, (zoom ?? cotonouMap.zoom) + 1))}>
            <Text style={styles.navBtnTxt}>+</Text>
          </Pressable>
          <Pressable
            style={styles.navBtn}
            onPress={() => flyTo(safeCenter, Math.max(10, (zoom ?? cotonouMap.zoom) - 1))}>
            <Text style={styles.navBtnTxt}>−</Text>
          </Pressable>
          <Pressable
            style={styles.navBtn}
            onPress={() => {
              userMovedRef.current = false;
              flyTo(safeCenter, zoom ?? cotonouMap.zoom);
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
  navStack: { position: 'absolute', zIndex: 20, gap: 8 },
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
