import type { LibreMapProps } from '@/components/LibreMap.types';
import { cotonouMap, mapStyles, routeLineGeoJSON, type LngLat } from '@/constants/map';
import { colors } from '@/constants/theme';
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

let workerConfigured = false;
function ensureMapLibreWorker() {
  if (workerConfigured || typeof window === 'undefined') return;
  setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);
  workerConfigured = true;
}

const styleCache = new Map<string, StyleSpecification>();
let warmPromise: Promise<void> | null = null;

function ensureMapLibreCss() {
  if (typeof document === 'undefined' || document.getElementById('maplibre-gl-css')) return;
  const link = document.createElement('link');
  link.id = 'maplibre-gl-css';
  link.rel = 'stylesheet';
  link.href = '/maplibre/maplibre-gl.css';
  document.head.appendChild(link);
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
        const style = (await prefetchJson(styleUrl)) as StyleSpecification | null;
        if (style) styleCache.set(styleUrl, style);
      })(),
    ]);
  })().catch(() => undefined);
  return warmPromise;
}

function validLngLat(c: LngLat | undefined): c is LngLat {
  return !!c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) > 0.2 && Math.abs(c[1]) > 0.2;
}

function resolveStyle(mapStyle: string): string | StyleSpecification {
  return styleCache.get(mapStyle) ?? mapStyle;
}

LogBox.ignoreLogs(['Map cannot fit within canvas']);

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
  const bg =
    marker.kind === 'home' ? colors.coral : marker.kind === 'courier' ? colors.text : colors.teal;
  const glyph = marker.kind === 'store' ? 'M' : marker.kind === 'home' ? 'C' : marker.kind === 'courier' ? '•' : '';
  const label = marker.label
    ? `<span style="background:rgba(17,24,39,0.88);color:#fff;font:600 10px/1.2 system-ui,sans-serif;padding:4px 8px;border-radius:999px;white-space:nowrap">${marker.label}</span>`
    : '';
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateY(-4px)">
    ${label}
    <span style="width:34px;height:34px;border-radius:12px;background:${bg};border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(15,23,42,0.28);color:#fff;font:800 13px/1 system-ui,sans-serif">${glyph}</span>
    <span style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${bg};margin-top:-6px"></span>
  </div>`;
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
  interactive = true,
  showNavigation = true,
}: LibreMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const markerMetaRef = useRef<Map<string, string>>(new Map());
  const [tick, setTick] = useState(0);
  const centerRef = useRef(center);
  centerRef.current = center;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const routeKey = useMemo(() => (route ? JSON.stringify(route) : ''), [route]);
  const markersKey = useMemo(() => JSON.stringify(markers), [markers]);

  useEffect(() => {
    ensurePreconnect();
    ensureMapLibreCss();
    ensureMapLibreWorker();
    void warmLibreMap(mapStyle, centerRef.current, zoomRef.current);

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
          pitchWithRotate: false,
          fadeDuration: 0,
          trackResize: true,
          renderWorldCopies: false,
          pixelRatio,
        });
      } catch {
        return;
      }
      mapRef.current = map;
      if (showNavigation && interactive) {
        map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');
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

    start();
    return () => {
      cancelled = true;
      ro?.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      markerMetaRef.current.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, [mapStyle, interactive, showNavigation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || fitToMarkers) return;
    const cur = map.getCenter();
    const z = map.getZoom();
    const moved =
      Math.abs(cur.lng - center[0]) > 0.00008 ||
      Math.abs(cur.lat - center[1]) > 0.00008 ||
      Math.abs(z - zoom) > 0.05;
    if (!moved) return;
    map.easeTo({ center, zoom, duration: 280, essential: true });
  }, [center[0], center[1], zoom, fitToMarkers, tick]);

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
      const meta = `${marker.kind ?? ''}|${marker.label ?? ''}`;
      const existing = markersRef.current.get(marker.id);
      if (existing && markerMetaRef.current.get(marker.id) === meta) {
        existing.setLngLat(marker.coordinate);
        return;
      }
      existing?.remove();
      const node = document.createElement('div');
      node.innerHTML = pinHtml(marker);
      const el = (node.firstElementChild as HTMLElement) ?? node;
      const m = new Marker({ element: el, anchor: 'bottom' }).setLngLat(marker.coordinate).addTo(map);
      markersRef.current.set(marker.id, m);
      markerMetaRef.current.set(marker.id, meta);
    });

    if (!fitToMarkers) return;
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
        map.fitBounds(b, {
          padding: paddingForMap(map, fitPadding),
          maxZoom: 14.5,
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
  }, [markersKey, markers, fitToMarkers, fitIncludeCourier, routeKey, route, tick, fitPadding]);

  return (
    <View style={[styles.wrap, style]}>
      <div
        ref={hostRef}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'pan-x pan-y' }}
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
