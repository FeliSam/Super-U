import type { LibreMapProps } from '@/components/LibreMap.types';
import { cotonouMap, haversineMeters, mapRasterTiles, type LngLat, type MapMarker } from '@/constants/map';
import { colors, iceSurface } from '@/constants/theme';
import { easeOutCubic, headingDeg, lerpHeading, offsetLngLat } from '@/lib/vehicleMotion';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, type Camera, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function validLngLat(c: LngLat | undefined): c is LngLat {
  return Boolean(c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) > 0.01);
}

function zoomToDelta(zoom: number): number {
  return Math.max(0.0012, 180 / Math.pow(2, Math.max(1, zoom)));
}

function deltaToZoom(latitudeDelta: number): number {
  return Math.log2(180 / Math.max(0.0004, latitudeDelta));
}

function toRegion(center: LngLat, zoom: number): Region {
  const latitudeDelta = zoomToDelta(zoom);
  return {
    latitude: center[1],
    longitude: center[0],
    latitudeDelta,
    longitudeDelta: latitudeDelta * 0.72,
  };
}

function padOf(
  fitPadding?: LibreMapProps['fitPadding'],
): { top: number; right: number; bottom: number; left: number } {
  if (typeof fitPadding === 'number') {
    return { top: fitPadding, right: fitPadding, bottom: fitPadding, left: fitPadding };
  }
  return {
    top: fitPadding?.top ?? 80,
    right: fitPadding?.right ?? 40,
    bottom: fitPadding?.bottom ?? 180,
    left: fitPadding?.left ?? 40,
  };
}

/** Tracé restant depuis la position livreur (suivi dynamique). */
function remainingRouteLatLng(route: LngLat[], from: LngLat): { latitude: number; longitude: number }[] {
  if (route.length < 2) {
    return route.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  }

  // Projection sur le segment le plus proche (évite une grande ligne droite livreur → nœud).
  let bestI = 0;
  let bestT = 0;
  let bestD = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((from[0] - a[0]) * dx + (from[1] - a[1]) * dy) / len2)) : 0;
    const proj: LngLat = [a[0] + dx * t, a[1] + dy * t];
    const d = haversineMeters(from, proj);
    if (d < bestD) {
      bestD = d;
      bestI = i;
      bestT = t;
    }
  }

  const onSeg: LngLat =
    bestT > 0.02
      ? [
          route[bestI][0] + (route[bestI + 1][0] - route[bestI][0]) * bestT,
          route[bestI][1] + (route[bestI + 1][1] - route[bestI][1]) * bestT,
        ]
      : route[bestI];

  let startIdx = bestT > 0.85 ? bestI + 1 : bestI;
  while (startIdx < route.length - 1 && haversineMeters(from, route[startIdx]) < 14) startIdx += 1;

  const pts: LngLat[] = [];
  // Si on est près du tracé (< 80 m), démarrer sur la route ; sinon raccorder depuis le livreur.
  if (bestD > 80) pts.push(from);
  if (bestD <= 80 || bestT > 0.02) {
    if (!pts.length || haversineMeters(pts[0], onSeg) > 2) pts.push(onSeg);
  }
  for (let i = startIdx + (bestT > 0.02 ? 1 : 0); i < route.length; i++) {
    const p = route[i];
    const prev = pts[pts.length - 1];
    if (prev && haversineMeters(prev, p) < 1.5) continue;
    pts.push(p);
  }
  if (pts.length < 2) {
    return [
      { latitude: from[1], longitude: from[0] },
      { latitude: route[route.length - 1][1], longitude: route[route.length - 1][0] },
    ];
  }
  return pts.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

function pinColors(marker: MapMarker) {
  if (marker.kind === 'home') return colors.coral;
  if (marker.kind === 'courier') return '#111827';
  if (marker.kind === 'store') return '#e30613';
  return colors.teal;
}

function pinGlyph(marker: MapMarker) {
  if (marker.kind === 'courier') return '🛵';
  if (marker.kind === 'store') return 'SU';
  if (marker.kind === 'home') return '⌂';
  return '•';
}

function NativePin({
  marker,
  coordinate,
  heading,
  onPress,
}: {
  marker: MapMarker;
  coordinate: LngLat;
  heading?: number;
  onPress?: () => void;
}) {
  const bg = pinColors(marker);
  const highlight = Boolean(marker.highlight);
  const badge = Number(marker.badge ?? 0);
  const rot =
    marker.kind === 'courier' && Number.isFinite(heading ?? marker.heading)
      ? Number(heading ?? marker.heading)
      : 0;
  const showChip = Boolean(marker.label) && (highlight || marker.kind === 'courier' || badge > 0);
  const chipText = marker.label
    ? `${highlight ? '★ ' : ''}${marker.label}${badge > 0 ? ` · ${badge}` : ''}`
    : '';
  const [track, setTrack] = useState(true);
  useEffect(() => {
    setTrack(true);
    const t = setTimeout(() => setTrack(marker.kind === 'courier'), 400);
    return () => clearTimeout(t);
  }, [marker.id, marker.kind, coordinate[0], coordinate[1], chipText, Math.round(rot / 12)]);

  return (
    <Marker
      coordinate={{ latitude: coordinate[1], longitude: coordinate[0] }}
      title={marker.label}
      onPress={onPress}
      tracksViewChanges={track}
      anchor={{ x: 0.5, y: 1 }}
      flat={marker.kind === 'courier'}>
      <View style={styles.pinRoot} collapsable={false}>
        {showChip ? (
          <View style={[styles.pinChip, highlight && styles.pinChipHi]} collapsable={false}>
            <Text style={styles.pinChipTxt} numberOfLines={1}>
              {chipText}
            </Text>
          </View>
        ) : (
          <View style={styles.pinChipSpacer} collapsable={false} />
        )}
        <View style={styles.pinBody} collapsable={false}>
          <View
            style={[
              styles.pinDot,
              { backgroundColor: bg },
              highlight && styles.pinDotHi,
              marker.kind === 'courier' ? { transform: [{ rotate: `${rot}deg` }] } : null,
            ]}
            collapsable={false}>
            <Text style={styles.pinGlyph}>{pinGlyph(marker)}</Text>
            {badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{badge > 9 ? '9+' : badge}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.pinTip, { borderTopColor: bg }]} collapsable={false} />
        </View>
      </View>
    </Marker>
  );
}

type AnimPos = { id: string; at: LngLat; heading: number };

/**
 * Carte native : polyligne MapKit/Google intégrée (comme MapLibre web),
 * pas de SVG collé par-dessus. iOS = Apple Maps (polyline native) ;
 * Android = tuiles OSM + polyline (zIndex OK).
 */
export function LibreMap({
  style,
  mapStyle: _mapStyle,
  center,
  zoom = cotonouMap.zoom,
  markers = [],
  route,
  fitToMarkers = false,
  fitIncludeCourier = false,
  fitPadding,
  fitMaxZoom = 14.5,
  followCamera = false,
  navigationMode = false,
  bearing = 0,
  followResumeTick = 0,
  onFollowBreak,
  interactive = true,
  showNavigation = true,
  onMarkerPress,
}: LibreMapProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const userMovedRef = useRef(false);
  const fittedSig = useRef('');
  const navResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef = useRef(zoom);
  const centerRef = useRef(center);
  const bearingRef = useRef(bearing);
  const followCamRef = useRef<{
    lat: number;
    lng: number;
    heading: number;
    pitch: number;
    zoom: number;
    primed: boolean;
  } | null>(null);
  const animRef = useRef<Map<string, { from: LngLat; to: LngLat; start: number; dur: number; heading: number }>>(
    new Map(),
  );
  const displayRef = useRef<Map<string, LngLat>>(new Map());
  const rafAnim = useRef(0);
  const onFollowBreakRef = useRef(onFollowBreak);
  onFollowBreakRef.current = onFollowBreak;
  zoomRef.current = zoom;
  centerRef.current = center;
  bearingRef.current = bearing;

  const [displayMarkers, setDisplayMarkers] = useState<AnimPos[]>([]);
  const [mapReady, setMapReady] = useState(false);

  /** Android : tuiles OSM. iOS : Apple Maps pour que la polyline soit un vrai overlay carte. */
  const osmTiles = Platform.OS === 'android';

  const placed = useMemo(() => markers.filter((m) => validLngLat(m.coordinate)), [markers]);
  const routeLngLat = useMemo(() => (route ?? []).filter(validLngLat), [route]);
  const liveRouteCoords = useMemo(() => {
    if (routeLngLat.length < 2) return [] as { latitude: number; longitude: number }[];
    // Suivi dynamique : tronçon restant depuis le livreur.
    if (followCamera || navigationMode) {
      return remainingRouteLatLng(routeLngLat, center);
    }
    return routeLngLat.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  }, [routeLngLat, center[0], center[1], followCamera, navigationMode]);

  const fitCoords = useMemo(() => {
    const pts = placed
      .filter((m) => fitIncludeCourier || m.kind !== 'courier')
      .map((m) => ({ latitude: m.coordinate[1], longitude: m.coordinate[0] }));
    if (liveRouteCoords.length >= 2) pts.push(...liveRouteCoords);
    return pts;
  }, [placed, fitIncludeCourier, liveRouteCoords]);

  const initialRegion = useMemo(() => toRegion(center, zoom), []);

  const markUserMoved = useCallback(() => {
    if (navigationMode) {
      userMovedRef.current = true;
      if (navResumeRef.current) clearTimeout(navResumeRef.current);
      navResumeRef.current = setTimeout(() => {
        userMovedRef.current = false;
        if (followCamRef.current) followCamRef.current.primed = false;
      }, 420);
      return;
    }
    if (!userMovedRef.current) {
      userMovedRef.current = true;
      onFollowBreakRef.current?.();
    }
  }, [navigationMode]);

  useEffect(() => {
    userMovedRef.current = false;
    followCamRef.current = null;
  }, [followResumeTick, navigationMode]);

  useEffect(() => {
    return () => {
      if (navResumeRef.current) clearTimeout(navResumeRef.current);
      if (rafAnim.current) cancelAnimationFrame(rafAnim.current);
    };
  }, []);

  // Smooth marker motion.
  useEffect(() => {
    const nextIds = new Set(placed.map((m) => m.id));
    displayRef.current.forEach((_, id) => {
      if (!nextIds.has(id)) {
        displayRef.current.delete(id);
        animRef.current.delete(id);
      }
    });

    placed.forEach((m) => {
      const prev = displayRef.current.get(m.id);
      const next = m.coordinate;
      if (!prev) {
        displayRef.current.set(m.id, next);
        return;
      }
      const jump = haversineMeters(prev, next);
      if (jump < 0.6 || jump > 4000) {
        displayRef.current.set(m.id, next);
        animRef.current.delete(m.id);
        return;
      }
      const slow = navigationMode;
      const dur = Math.min(slow ? 780 : 280, Math.max(70, jump * (slow ? 14 : 6)));
      animRef.current.set(m.id, {
        from: prev,
        to: next,
        start: performance.now(),
        dur,
        heading:
          m.kind === 'courier' && !navigationMode
            ? headingDeg(prev, next)
            : Number.isFinite(m.heading)
              ? Number(m.heading)
              : 0,
      });
    });

    const tick = (now: number) => {
      let live = false;
      const out: AnimPos[] = [];
      for (const m of placed) {
        const anim = animRef.current.get(m.id);
        if (anim) {
          const t = easeOutCubic((now - anim.start) / anim.dur);
          const at: LngLat = [
            anim.from[0] + (anim.to[0] - anim.from[0]) * t,
            anim.from[1] + (anim.to[1] - anim.from[1]) * t,
          ];
          displayRef.current.set(m.id, at);
          out.push({ id: m.id, at, heading: anim.heading });
          if (t < 1) live = true;
          else {
            displayRef.current.set(m.id, anim.to);
            animRef.current.delete(m.id);
          }
        } else {
          const at = displayRef.current.get(m.id) ?? m.coordinate;
          out.push({
            id: m.id,
            at,
            heading: Number.isFinite(m.heading) ? Number(m.heading) : 0,
          });
        }
      }
      setDisplayMarkers(out);
      if (live) rafAnim.current = requestAnimationFrame(tick);
      else rafAnim.current = 0;
    };

    if (rafAnim.current) cancelAnimationFrame(rafAnim.current);
    rafAnim.current = requestAnimationFrame(tick);
  }, [placed, navigationMode]);

  // Fit bounds.
  useEffect(() => {
    if (!mapReady || !fitToMarkers || fitCoords.length < 1 || userMovedRef.current) return;
    const sig = fitCoords
      .map((c) => `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`)
      .join('|');
    if (sig === fittedSig.current) return;
    fittedSig.current = sig;
    const pad = padOf(fitPadding);
    const t = setTimeout(() => {
      if (fitCoords.length === 1) {
        const only = fitCoords[0];
        mapRef.current?.animateToRegion(
          toRegion([only.longitude, only.latitude], Math.min(fitMaxZoom, 14)),
          420,
        );
        return;
      }
      mapRef.current?.fitToCoordinates(fitCoords, {
        edgePadding: pad,
        animated: true,
      });
      setTimeout(() => {
        void (async () => {
          try {
            const cam = (await mapRef.current?.getCamera()) as Camera | undefined;
            if (cam && typeof cam.zoom === 'number' && cam.zoom > fitMaxZoom) {
              mapRef.current?.animateCamera({ ...cam, zoom: fitMaxZoom }, { duration: 180 });
            }
          } catch {
            /* ignore */
          }
        })();
      }, 480);
    }, 260);
    return () => clearTimeout(t);
  }, [mapReady, fitToMarkers, fitCoords, fitPadding, fitMaxZoom]);

  // Navigation pitch.
  useEffect(() => {
    if (!mapReady) return;
    if (navigationMode) {
      mapRef.current?.animateCamera(
        {
          center: { latitude: center[1], longitude: center[0] },
          heading: bearing,
          pitch: 58,
          zoom: Math.max(zoom, 16.7),
        },
        { duration: 900 },
      );
    } else {
      followCamRef.current = null;
      mapRef.current?.animateCamera(
        {
          center: { latitude: center[1], longitude: center[0] },
          heading: 0,
          pitch: 0,
          zoom,
        },
        { duration: 520 },
      );
    }
  }, [navigationMode, mapReady]);

  // Navigation follow loop.
  useEffect(() => {
    if (!mapReady || !navigationMode) return;
    let live = true;
    let raf = 0;
    const loop = () => {
      if (!live) return;
      if (userMovedRef.current) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const pos = centerRef.current;
      const heading = bearingRef.current;
      const look = offsetLngLat(pos, heading, 70);
      const wantZoom = Math.max(zoomRef.current, 16.7);
      const wantPitch = 58;
      let cam = followCamRef.current;
      if (!cam) {
        cam = {
          lng: look[0],
          lat: look[1],
          heading,
          pitch: wantPitch,
          zoom: wantZoom,
          primed: false,
        };
        followCamRef.current = cam;
      }
      const k = cam.primed ? 0.045 : 0.13;
      const kb = cam.primed ? 0.038 : 0.1;
      cam.lng += (look[0] - cam.lng) * k;
      cam.lat += (look[1] - cam.lat) * k;
      cam.heading = lerpHeading(cam.heading, heading, kb);
      cam.pitch += (wantPitch - cam.pitch) * (cam.primed ? 0.06 : 0.14);
      cam.zoom += (wantZoom - cam.zoom) * (cam.primed ? 0.05 : 0.12);
      const close =
        Math.abs(cam.lng - look[0]) < 0.00004 &&
        Math.abs(cam.lat - look[1]) < 0.00004 &&
        Math.abs(((cam.heading - heading + 540) % 360) - 180) < 3;
      if (close) cam.primed = true;
      mapRef.current?.setCamera({
        center: { latitude: cam.lat, longitude: cam.lng },
        heading: cam.heading,
        pitch: cam.pitch,
        zoom: cam.zoom,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [mapReady, navigationMode, followResumeTick]);

  // Follow camera (non-nav).
  useEffect(() => {
    if (!mapReady || fitToMarkers || !followCamera || navigationMode) return;
    if (userMovedRef.current) return;
    mapRef.current?.animateToRegion(toRegion(center, zoom), 860);
  }, [mapReady, center[0], center[1], zoom, fitToMarkers, followCamera, navigationMode, followResumeTick]);

  const zoomBy = useCallback(
    async (delta: number) => {
      markUserMoved();
      const map = mapRef.current;
      if (!map) return;
      try {
        const cam = (await map.getCamera()) as Camera;
        if (typeof cam.zoom === 'number' && Number.isFinite(cam.zoom)) {
          map.animateCamera({ ...cam, zoom: Math.min(20, Math.max(3, cam.zoom + delta)) }, { duration: 220 });
          return;
        }
      } catch {
        /* fall through */
      }
      const nextZoom = Math.min(20, Math.max(3, zoomRef.current + delta));
      zoomRef.current = nextZoom;
      map.animateToRegion(toRegion(centerRef.current, nextZoom), 220);
    },
    [markUserMoved],
  );

  const recenter = useCallback(() => {
    userMovedRef.current = false;
    followCamRef.current = null;
    fittedSig.current = '';
    if (navigationMode) {
      mapRef.current?.animateCamera(
        {
          center: { latitude: centerRef.current[1], longitude: centerRef.current[0] },
          heading: bearingRef.current,
          pitch: 58,
          zoom: Math.max(zoomRef.current, 16.7),
        },
        { duration: 520 },
      );
      return;
    }
    mapRef.current?.animateToRegion(toRegion(centerRef.current, zoomRef.current), 520);
  }, [navigationMode]);

  const markerById = useMemo(() => new Map(placed.map((m) => [m.id, m])), [placed]);

  return (
    <View style={[styles.host, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        mapType={osmTiles ? 'none' : 'mutedStandard'}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive || navigationMode}
        showsCompass={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsBuildings
        showsTraffic={false}
        toolbarEnabled={false}
        onMapReady={() => setMapReady(true)}
        onPanDrag={markUserMoved}
        onRegionChangeComplete={(r) => {
          if (r?.latitudeDelta) zoomRef.current = deltaToZoom(r.latitudeDelta);
        }}>
        {osmTiles ? (
          <UrlTile
            urlTemplate={mapRasterTiles.voyager}
            maximumZ={20}
            flipY={false}
            zIndex={-1}
          />
        ) : null}

        {/* Polyligne native = couche carte (suit pitch / bearing), comme MapLibre web. */}
        {liveRouteCoords.length >= 2 ? (
          <>
            <Polyline
              key={`route-halo-${liveRouteCoords.length}`}
              coordinates={liveRouteCoords}
              strokeColor="rgba(5,141,129,0.32)"
              strokeWidth={10}
              lineCap="round"
              lineJoin="round"
              geodesic={false}
              zIndex={1}
              tappable={false}
            />
            <Polyline
              key={`route-line-${liveRouteCoords.length}`}
              coordinates={liveRouteCoords}
              strokeColor={colors.teal}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              geodesic={false}
              zIndex={2}
              tappable={false}
            />
          </>
        ) : null}

        {(displayMarkers.length
          ? displayMarkers
          : placed.map((m) => ({
              id: m.id,
              at: m.coordinate,
              heading: Number(m.heading) || 0,
            }))
        ).map((dm) => {
          const m = markerById.get(dm.id);
          if (!m) return null;
          return (
            <NativePin
              key={m.id}
              marker={m}
              coordinate={dm.at}
              heading={dm.heading}
              onPress={onMarkerPress ? () => onMarkerPress(m.id) : undefined}
            />
          );
        })}
      </MapView>

      {showNavigation && interactive ? (
        <View
          style={[styles.navStack, { top: Math.max(112, insets.top + 72) }]}
          pointerEvents="box-none">
          <View style={[styles.navGroup, iceSurface()]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom avant"
              onPress={() => void zoomBy(1)}
              style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}>
              <Feather name="plus" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.navSep} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom arrière"
              onPress={() => void zoomBy(-1)}
              style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}>
              <Feather name="minus" size={20} color={colors.text} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recentrer sur ma position"
            onPress={recenter}
            style={({ pressed }) => [styles.locateBtn, iceSurface(), pressed && styles.navBtnPressed]}>
            <Feather name="navigation" size={18} color={colors.teal} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 120, overflow: 'hidden', backgroundColor: '#d9e2ec' },
  navStack: {
    position: 'absolute',
    right: 12,
    zIndex: 20,
    gap: 10,
    alignItems: 'stretch',
  },
  navGroup: {
    borderRadius: 14,
    overflow: 'hidden',
    width: 44,
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
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  locateBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinRoot: {
    width: 110,
    height: 65,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pinChipSpacer: { height: 22, width: 1 },
  pinChip: {
    maxWidth: 105,
    height: 22,
    marginBottom: 3,
    backgroundColor: 'rgba(17,24,39,0.9)',
    borderRadius: 11,
    paddingHorizontal: 7,
    justifyContent: 'center',
  },
  pinChipHi: { backgroundColor: colors.teal },
  pinChipTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pinBody: { alignItems: 'center' },
  pinDot: {
    width: 35,
    height: 35,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  pinDotHi: { borderWidth: 2.5, borderColor: '#fbbf24' },
  pinTip: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  pinGlyph: { color: '#fff', fontSize: 14, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -7,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
