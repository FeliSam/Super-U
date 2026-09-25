import type { LibreMapProps } from '@/components/LibreMap.types';
import { cotonouMap, haversineMeters, mapRasterTiles, mapStyles, routeLineGeoJSON, type LngLat } from '@/constants/map';
import { colors, liquidIce } from '@/constants/theme';
import { mapPinHtml } from '@/lib/mapPins';
import { easeOutCubic, headingDeg, lerpHeading, offsetLngLat } from '@/lib/vehicleMotion';
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LogBox, StyleSheet, View } from 'react-native';

/**
 * MapLibre v6 needs an explicit same-origin worker under Metro/Expo web.
 * Files in /public/maplibre must match node_modules/maplibre-gl (see scripts/sync-maplibre.js).
 * A stale worker causes cryptic tile errors (e.g. "codePointAt is not a function").
 */
let workerConfigured = false;
function ensureMapLibreWorker() {
  if (workerConfigured || typeof window === 'undefined') return;
  setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);
  workerConfigured = true;
}

const styleCache = new Map<string, StyleSpecification>();
let warmPromise: Promise<void> | null = null;

/** OpenFreeMap TileJSON `/planet` is often CORS-blocked (AJAXError status 0). Use ZXY directly. */
const OPENFREEMAP_PLANET_TILES = 'https://tiles.openfreemap.org/planet/current/{z}/{x}/{y}.pbf';

function osmRasterFallback(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [mapRasterTiles.voyager],
        tileSize: 256,
        attribution: mapRasterTiles.attribution,
        maxzoom: 20,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  };
}

function inlineOpenFreeMapSources(style: StyleSpecification): StyleSpecification {
  const sources = { ...style.sources };
  for (const [id, src] of Object.entries(sources)) {
    if (!src || typeof src !== 'object') continue;
    const url = 'url' in src && typeof (src as { url?: string }).url === 'string' ? (src as { url: string }).url : '';
    if (!url.includes('tiles.openfreemap.org') || !url.includes('planet')) continue;
    const rest = { ...(src as object) } as Record<string, unknown>;
    delete rest.url;
    sources[id] = {
      ...rest,
      type: 'vector',
      tiles: [OPENFREEMAP_PLANET_TILES],
      minzoom: typeof rest.minzoom === 'number' ? rest.minzoom : 0,
      maxzoom: typeof rest.maxzoom === 'number' ? rest.maxzoom : 14,
    } as StyleSpecification['sources'][string];
  }
  return { ...style, sources };
}

async function loadMapStyle(styleUrl: string): Promise<StyleSpecification> {
  const cached = styleCache.get(styleUrl);
  if (cached) return cached;
  const style = (await prefetchJson(styleUrl)) as StyleSpecification | null;
  if (style) {
    const inlined = inlineOpenFreeMapSources(style);
    styleCache.set(styleUrl, inlined);
    return inlined;
  }
  return osmRasterFallback();
}

function ensureMapLibreCss() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('maplibre-gl-css')) {
    const link = document.createElement('link');
    link.id = 'maplibre-gl-css';
    link.rel = 'stylesheet';
    link.href = '/maplibre/maplibre-gl.css';
    document.head.appendChild(link);
  }
  if (document.getElementById('maplibre-cg-nav')) return;
  const style = document.createElement('style');
  style.id = 'maplibre-cg-nav';
  style.textContent = `
    .maplibregl-ctrl-top-right {
      top: 112px !important;
      right: 12px !important;
    }
    .maplibregl-ctrl-group {
      border: 0 !important;
      border-radius: 16px !important;
      overflow: hidden;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
      background: #fff !important;
    }
    .maplibregl-ctrl-group button {
      width: 42px !important;
      height: 42px !important;
      background: #fff !important;
    }
    .maplibregl-ctrl-group button + button {
      border-top: 1px solid #e5e7eb !important;
    }
    .maplibregl-ctrl-group button:hover {
      background: #f0faf8 !important;
    }
  `;
  document.head.appendChild(style);
}

function ensurePreconnect() {
  if (typeof document === 'undefined' || document.getElementById('maplibre-preconnect')) return;
  const link = document.createElement('link');
  link.id = 'maplibre-preconnect';
  link.rel = 'preconnect';
  link.href = 'https://tiles.openfreemap.org';
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

async function prefetchBytes(url: string) {
  try {
    await fetch(url, { credentials: 'omit', mode: 'cors' });
  } catch {
    /* ignore */
  }
}

async function prefetchJson(url: string) {
  try {
    const res = await fetch(url, { credentials: 'omit', mode: 'cors' });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

export function warmLibreMap(
  styleUrl: string = mapStyles.light,
  center: LngLat = cotonouMap.home,
  zoom = 14.5,
): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    ensurePreconnect();
    ensureMapLibreCss();
    ensureMapLibreWorker();
    await Promise.all([
      prefetchBytes(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`),
      prefetchBytes(`${window.location.origin}/maplibre/maplibre-gl-shared.mjs`),
      (async () => {
        if (styleCache.has(styleUrl)) return;
        await loadMapStyle(styleUrl);
      })(),
    ]);
  })().catch(() => undefined);
  return warmPromise;
}

function validLngLat(c: LngLat | undefined): c is LngLat {
  return !!c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) > 0.2 && Math.abs(c[1]) > 0.2;
}

function resolveStyle(mapStyle: string): StyleSpecification {
  return styleCache.get(mapStyle) ?? osmRasterFallback();
}

LogBox.ignoreLogs(['Map cannot fit within canvas', 'AJAXError', 'tiles.openfreemap.org']);

function paddingForMap(
  map: MapLibreMap,
  requested?: LibreMapProps['fitPadding'],
): number | { top: number; bottom: number; left: number; right: number } {
  const h = map.getContainer().clientHeight || 0;
  const w = map.getContainer().clientWidth || 0;
  const maxV = Math.max(4, Math.floor(h * 0.22));
  const maxH = Math.max(4, Math.floor(w * 0.18));
  if (!requested || typeof requested === 'number') {
    const n = Math.min(typeof requested === 'number' ? requested : 16, maxV, maxH);
    return n;
  }
  return {
    top: Math.min(requested.top, maxV),
    bottom: Math.min(requested.bottom, maxV),
    left: Math.min(requested.left, maxH),
    right: Math.min(requested.right, maxH),
  };
}

function pinHtml(marker: NonNullable<LibreMapProps['markers']>[number]) {
  return mapPinHtml(marker, { coral: colors.coral, teal: colors.teal, text: colors.text });
}

export function LibreMap({
  style,
  mapStyle,
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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const markerMetaRef = useRef<Map<string, string>>(new Map());
  const markerAnimRef = useRef<Map<string, number>>(new Map());
  const markerPosRef = useRef<Map<string, LngLat>>(new Map());
  const userMovedRef = useRef(false);
  const navGestureResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fittedRef = useRef(false);
  const fitSigRef = useRef('');
  const onMarkerPressRef = useRef(onMarkerPress);
  onMarkerPressRef.current = onMarkerPress;
  const [tick, setTick] = useState(0);
  const centerRef = useRef(center);
  centerRef.current = center;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onFollowBreakRef = useRef(onFollowBreak);
  onFollowBreakRef.current = onFollowBreak;
  const navigationModeRef = useRef(navigationMode);
  navigationModeRef.current = navigationMode;
  const bearingRef = useRef(bearing);
  bearingRef.current = bearing;
  const followCamRef = useRef<{ lng: number; lat: number; bearing: number; pitch: number; zoom: number; primed: boolean } | null>(null);

  const routeKey = useMemo(() => (route ? JSON.stringify(route) : ''), [route]);
  const markersKey = useMemo(() => JSON.stringify(markers), [markers]);

  useEffect(() => {
    ensurePreconnect();
    ensureMapLibreCss();
    ensureMapLibreWorker();
    const el = hostRef.current;
    if (!el) return;

    let cancelled = false;
    let map: MapLibreMap | null = null;
    let ro: ResizeObserver | null = null;
    let tries = 0;

    const start = () => {
      if (cancelled || mapRef.current) return;
      if (el.clientWidth < 2 || el.clientHeight < 2) {
        if (tries++ < 40) requestAnimationFrame(start);
        return;
      }
      const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
      try {
        map = new MapLibreMap({
          container: el,
          style: resolveStyle(mapStyle),
          center: centerRef.current,
          zoom: zoomRef.current,
          attributionControl: { compact: true },
          interactive,
          dragRotate: false,
          pitchWithRotate: true,
          fadeDuration: 0,
          trackResize: true,
          renderWorldCopies: false,
          pixelRatio,
        });
      } catch {
        return;
      }
      mapRef.current = map;
      userMovedRef.current = false;
      fittedRef.current = false;
      const resumeNavFollow = () => {
        if (navGestureResumeRef.current) clearTimeout(navGestureResumeRef.current);
        navGestureResumeRef.current = setTimeout(() => {
          if (!navigationModeRef.current) return;
          userMovedRef.current = false;
          if (followCamRef.current) followCamRef.current.primed = false;
        }, 420);
      };
      const markUserMoved = () => {
        if (navigationModeRef.current) {
          userMovedRef.current = true;
          resumeNavFollow();
          return;
        }
        userMovedRef.current = true;
        onFollowBreakRef.current?.();
      };
      map.on('dragstart', markUserMoved);
      map.on('rotatestart', markUserMoved);
      map.on('dragend', () => {
        if (navigationModeRef.current) resumeNavFollow();
      });
      map.on('zoomend', () => {
        if (navigationModeRef.current) resumeNavFollow();
      });
      map.on('zoomstart', (e) => {
        if (e.originalEvent) markUserMoved();
      });
      if (showNavigation && interactive) {
        map.addControl(new NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
        const cssId = 'cg-maplibre-nav-ice';
        let css = document.getElementById(cssId) as HTMLStyleElement | null;
        if (!css) {
          css = document.createElement('style');
          css.id = cssId;
          document.head.appendChild(css);
        }
        css.textContent = `
          .maplibregl-ctrl-group {
            background: ${liquidIce.backgroundColor} !important;
            border: 1px solid ${liquidIce.borderColor} !important;
            backdrop-filter: ${liquidIce.webFilter};
            -webkit-backdrop-filter: ${liquidIce.webFilter};
            box-shadow: ${liquidIce.webShadow};
            border-radius: 14px !important;
            overflow: hidden;
          }
          .maplibregl-ctrl-group button {
            width: 42px !important;
            height: 42px !important;
            background: transparent !important;
          }
          .maplibregl-ctrl-group button:hover {
            background: rgba(255,255,255,0.35) !important;
          }
          .maplibregl-ctrl-group button + button {
            border-top: 1px solid ${liquidIce.borderColor} !important;
          }
        `;
      }
      const bump = () => map?.resize();
      map.once('load', () => {
        bump();
        setTick((n) => n + 1);
      });
      map.once('styledata', bump);
      requestAnimationFrame(bump);
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(bump);
        ro.observe(el);
      }
    };

    void loadMapStyle(mapStyle).finally(() => {
      if (!cancelled) start();
    });
    return () => {
      cancelled = true;
      if (navGestureResumeRef.current) clearTimeout(navGestureResumeRef.current);
      ro?.disconnect();
      markerAnimRef.current.forEach((id) => cancelAnimationFrame(id));
      markerAnimRef.current.clear();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      markerMetaRef.current.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, [mapStyle, interactive, showNavigation]);

  useEffect(() => {
    userMovedRef.current = false;
    followCamRef.current = null;
  }, [followResumeTick, navigationMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (navigationMode) {
      map.dragRotate.disable();
      try {
        map.touchPitch.disable();
      } catch {
        /* older maplibre */
      }
      map.easeTo({
        pitch: 58,
        zoom: Math.max(zoomRef.current, 16.7),
        duration: 900,
        essential: true,
        padding: { top: 48, bottom: 280, left: 36, right: 36 },
        easing: (t) => 1 - (1 - t) ** 3,
      });
    } else {
      map.dragRotate.disable();
      followCamRef.current = null;
      map.easeTo({ pitch: 0, bearing: 0, duration: 520, essential: true, easing: (t) => 1 - (1 - t) ** 3 });
    }
  }, [navigationMode, tick]);

  useEffect(() => {
    if (!navigationMode) return;
    let live = true;
    let raf = 0;
    const tickFollow = () => {
      if (!live) return;
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded() || userMovedRef.current) {
        raf = requestAnimationFrame(tickFollow);
        return;
      }
      const pos = centerRef.current;
      const heading = bearingRef.current;
      const look = offsetLngLat(pos, heading, 70);
      const wantZoom = Math.max(zoomRef.current, 16.7);
      const wantPitch = 58;
      let cam = followCamRef.current;
      if (!cam) {
        const c = map.getCenter();
        cam = {
          lng: c.lng,
          lat: c.lat,
          bearing: map.getBearing(),
          pitch: map.getPitch(),
          zoom: map.getZoom(),
          primed: false,
        };
        followCamRef.current = cam;
      }
      const k = cam.primed ? 0.045 : 0.13;
      const kb = cam.primed ? 0.038 : 0.1;
      cam.lng += (look[0] - cam.lng) * k;
      cam.lat += (look[1] - cam.lat) * k;
      cam.bearing = lerpHeading(cam.bearing, heading, kb);
      cam.pitch += (wantPitch - cam.pitch) * (cam.primed ? 0.06 : 0.14);
      cam.zoom += (wantZoom - cam.zoom) * (cam.primed ? 0.05 : 0.12);
      const close =
        Math.abs(cam.lng - look[0]) < 0.00004 &&
        Math.abs(cam.lat - look[1]) < 0.00004 &&
        Math.abs(((cam.bearing - heading + 540) % 360) - 180) < 3;
      if (close) cam.primed = true;
      map.jumpTo({
        center: [cam.lng, cam.lat],
        bearing: cam.bearing,
        pitch: cam.pitch,
        zoom: cam.zoom,
      });
      raf = requestAnimationFrame(tickFollow);
    };
    raf = requestAnimationFrame(tickFollow);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [navigationMode, tick, followResumeTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || fitToMarkers) return;
    if (!followCamera || navigationMode) return;
    if (userMovedRef.current) return;
    if (typeof map.isMoving === 'function' && map.isMoving()) return;
    const cur = map.getCenter();
    const z = map.getZoom();
    const moved =
      Math.abs(cur.lng - center[0]) > 0.00008 ||
      Math.abs(cur.lat - center[1]) > 0.00008 ||
      Math.abs(z - zoom) > 0.12;
    if (!moved) return;
    map.easeTo({
      center,
      zoom,
      duration: 860,
      essential: true,
      easing: (t) => 1 - (1 - t) ** 3,
    });
  }, [center[0], center[1], zoom, fitToMarkers, followCamera, navigationMode, followResumeTick, tick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyRoute = () => {
      const sourceId = 'cg-route';
      const layerId = 'cg-route-line';
      if (!route || route.length < 2) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        return;
      }
      const data = routeLineGeoJSON(route);
      const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (existing) existing.setData(data);
      else {
        map.addSource(sourceId, { type: 'geojson', data });
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': colors.teal, 'line-width': 5, 'line-opacity': 0.9 },
        });
      }
    };
    if (map.isStyleLoaded()) applyRoute();
    else map.once('load', applyRoute);
  }, [routeKey, route, tick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const placed = markers.filter((m) => validLngLat(m.coordinate));
    const nextIds = new Set(placed.map((m) => m.id));
    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        markerMetaRef.current.delete(id);
      }
    });
    placed.forEach((marker) => {
      const meta = `${marker.kind ?? ''}|${marker.vehicle ?? ''}|${marker.badge ?? 0}|${marker.highlight ? 1 : 0}`;
      const existing = markersRef.current.get(marker.id);
      if (existing && markerMetaRef.current.get(marker.id) === meta) {
        const labelNode = existing.getElement().querySelector('span');
        if (labelNode && marker.label && labelNode.textContent !== marker.label) {
          labelNode.textContent = marker.label;
        }
        const live = existing.getLngLat();
        const prev: LngLat = [live.lng, live.lat];
        const next = marker.coordinate;
        const jump = haversineMeters(prev, next);
        const prevAnim = markerAnimRef.current.get(marker.id);
        if (prevAnim) cancelAnimationFrame(prevAnim);
        if (jump < 0.6 || jump > 4000) {
          existing.setLngLat(next);
          markerPosRef.current.set(marker.id, next);
          return;
        }
        const start = performance.now();
        const slow = navigationModeRef.current;
        const dur = Math.min(slow ? 780 : 280, Math.max(70, jump * (slow ? 14 : 6)));
        const step = (now: number) => {
          const t = easeOutCubic((now - start) / dur);
          const at: LngLat = [prev[0] + (next[0] - prev[0]) * t, prev[1] + (next[1] - prev[1]) * t];
          existing.setLngLat(at);
          markerPosRef.current.set(marker.id, at);
          const inner = existing.getElement().querySelector('[data-kind="courier"] span') as HTMLElement | null
            ?? existing.getElement().querySelector('span:last-of-type') as HTMLElement | null;
          if (inner && marker.kind === 'courier' && !navigationModeRef.current) {
            inner.style.transform = `rotate(${headingDeg(prev, next)}deg)`;
          }
          if (t < 1) markerAnimRef.current.set(marker.id, requestAnimationFrame(step));
          else {
            markerPosRef.current.set(marker.id, next);
            markerAnimRef.current.delete(marker.id);
          }
        };
        markerAnimRef.current.set(marker.id, requestAnimationFrame(step));
        return;
      }
      existing?.remove();
      const node = document.createElement('div');
      node.innerHTML = pinHtml(marker);
      const el = (node.firstElementChild as HTMLElement) ?? node;
      const m = new Marker({ element: el, anchor: 'bottom' }).setLngLat(marker.coordinate).addTo(map);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onMarkerPressRef.current?.(marker.id);
      });
      markersRef.current.set(marker.id, m);
      markerMetaRef.current.set(marker.id, meta);
      markerPosRef.current.set(marker.id, marker.coordinate);
    });

    if (!fitToMarkers) return;
    const sig = placed
      .filter((m) => m.kind !== 'courier')
      .map((m) => m.id)
      .sort()
      .join('|');
    if (sig !== fitSigRef.current) {
      fitSigRef.current = sig;
      if (!userMovedRef.current) fittedRef.current = false;
    }
    if (userMovedRef.current || fittedRef.current) return;
    const fitPts: LngLat[] = [
      ...placed.filter((m) => fitIncludeCourier || m.kind !== 'courier').map((m) => m.coordinate),
      ...(route ? route.filter(validLngLat) : []),
    ];
    const pts = fitPts.length ? fitPts : placed.map((m) => m.coordinate);
    if (!pts.length) return;
    const b = new LngLatBounds(pts[0], pts[0]);
    pts.forEach((p) => b.extend(p));
    const apply = () => {
      try {
        fittedRef.current = true;
        map.fitBounds(b, {
          padding: paddingForMap(map, fitPadding),
          maxZoom: fitMaxZoom,
          duration: 400,
        });
      } catch {
        try {
          map.jumpTo({ center: pts[0], zoom: 13 });
        } catch {
          /* ignore */
        }
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [markersKey, markers, fitToMarkers, fitIncludeCourier, routeKey, route, tick, fitPadding, fitMaxZoom]);

  return (
    <View style={[styles.wrap, style]}>
      <div
        ref={hostRef}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#d9e2ec',
    position: 'relative',
    flex: 1,
    minHeight: 120,
  },
});
