import type { LibreMapProps } from '@/components/LibreMap.types';
import { cotonouMap, routeLineGeoJSON, mapStyles, type LngLat } from '@/constants/map';
import { useColors } from '@/context/ThemeContext';
import {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * MapLibre v6 needs an explicit worker URL under Metro/Expo web —
 * without it the canvas mounts but vector tiles never load.
 * Files are copied to /public/maplibre (same-origin).
 */
let workerConfigured = false;
function ensureMapLibreWorker() {
  if (workerConfigured || typeof window === 'undefined') return;
  setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);
  workerConfigured = true;
}

const MAPLIBRE_CSS = '/maplibre/maplibre-gl.css';
const styleCache = new Map<string, StyleSpecification>();
let warmPromise: Promise<void> | null = null;

function ensureMapLibreCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('maplibre-gl-css')) return;
  const link = document.createElement('link');
  link.id = 'maplibre-gl-css';
  link.rel = 'stylesheet';
  link.href = MAPLIBRE_CSS;
  document.head.appendChild(link);
}

function ensurePreconnect() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('maplibre-preconnect')) return;
  const link = document.createElement('link');
  link.id = 'maplibre-preconnect';
  link.rel = 'preconnect';
  link.href = 'https://tiles.openfreemap.org';
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

function long2tile(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function lat2tile(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
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

async function prefetchBytes(url: string) {
  try {
    await fetch(url, { credentials: 'omit', mode: 'cors' });
  } catch {
    /* ignore */
  }
}

/**
 * Prefetch CSS, worker, style JSON, sprites and nearby Cotonou tiles
 * so the address picker map paints almost instantly on open.
 */
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

    // Parallel: worker modules + style document
    await Promise.all([
      prefetchBytes(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`),
      prefetchBytes(`${window.location.origin}/maplibre/maplibre-gl-shared.mjs`),
      (async () => {
        const cached = styleCache.get(styleUrl);
        if (cached) return;
        const style = (await prefetchJson(styleUrl)) as StyleSpecification | null;
        if (style) styleCache.set(styleUrl, style);
      })(),
    ]);

    const style = styleCache.get(styleUrl);
    if (!style) return;

    const jobs: Promise<unknown>[] = [];

    // Sprites (2x first — retina screens)
    if (typeof style.sprite === 'string') {
      const sprite = style.sprite;
      jobs.push(prefetchBytes(`${sprite}@2x.json`), prefetchBytes(`${sprite}@2x.png`));
      jobs.push(prefetchBytes(`${sprite}.json`), prefetchBytes(`${sprite}.png`));
    }

    // TileJSON + a ring of tiles around Cotonou at current zoom (±1)
    const z = Math.round(zoom);
    const cx = long2tile(center[0], z);
    const cy = lat2tile(center[1], z);

    const enqueueTiles = (tpl: string) => {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const url = tpl
            .replace('{z}', String(z))
            .replace('{x}', String(cx + dx))
            .replace('{y}', String(cy + dy));
          jobs.push(prefetchBytes(url));
        }
      }
    };

    for (const source of Object.values(style.sources ?? {})) {
      if (!source || typeof source !== 'object') continue;
      const src = source as { type?: string; url?: string; tiles?: string[] };
      if (src.url) {
        jobs.push(
          (async () => {
            const tj = (await prefetchJson(src.url!)) as { tiles?: string[] } | null;
            const tpl = tj?.tiles?.[0];
            if (!tpl) return;
            const tileJobs: Promise<unknown>[] = [];
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                const url = tpl
                  .replace('{z}', String(z))
                  .replace('{x}', String(cx + dx))
                  .replace('{y}', String(cy + dy));
                tileJobs.push(prefetchBytes(url));
              }
            }
            await Promise.all(tileJobs);
          })(),
        );
      }
      if (src.tiles?.[0]) enqueueTiles(src.tiles[0]);
    }

    await Promise.all(jobs);
  })().catch(() => {
    /* warmup is best-effort */
  });

  return warmPromise;
}

function resolveStyle(mapStyle: string): string | StyleSpecification {
  return styleCache.get(mapStyle) ?? mapStyle;
}

function markerHtml(marker: NonNullable<LibreMapProps['markers']>[number]) {
  const bg = marker.color ?? '#e2931d';
  if (marker.kind === 'superu') {
    const label = marker.label
      ? `<span style="background:rgba(20,17,15,0.88);color:#fff;font:700 10px/1.2 system-ui,sans-serif;padding:4px 9px;border-radius:999px;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.2px">${marker.label}</span>`
      : '';
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px;transform:translateY(-6px);cursor:pointer">
        ${label}
        <span style="
          width:40px;height:40px;border-radius:14px;
          background:linear-gradient(145deg,${bg} 0%,#9a0a10 100%);
          border:2.5px solid #ffffff;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 8px 20px rgba(227,6,19,0.45), inset 0 1px 0 rgba(255,255,255,0.25);
          color:#ffffff;
          font:900 20px/1 'Georgia','Times New Roman',serif;
          letter-spacing:-1px;
          text-shadow:0 1px 0 rgba(0,0,0,0.25);
        ">U</span>
        <span style="
          width:0;height:0;
          border-left:7px solid transparent;border-right:7px solid transparent;
          border-top:9px solid ${bg};
          margin-top:-7px;
          filter:drop-shadow(0 2px 2px rgba(0,0,0,0.2));
        "></span>
      </div>
    `;
  }

  const icon =
    marker.kind === 'store'
      ? '🛍️'
      : marker.kind === 'home'
        ? '🏠'
        : marker.kind === 'courier'
          ? '🛵'
          : '📍';
  const label = marker.label
    ? `<span style="background:rgba(20,17,15,0.82);color:#fff;font:600 10px/1.2 system-ui,sans-serif;padding:4px 8px;border-radius:999px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">${marker.label}</span>`
    : '';
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateY(-4px)">
      ${label}
      <span style="width:34px;height:34px;border-radius:12px;background:${bg};border:2px solid rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,0.28);font-size:14px;line-height:1">${icon}</span>
    </div>
  `;
}

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
  onReady,
  onError,
  onPressMap,
  onPressMarker,
}: LibreMapProps) {
  const colors = useColors();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const markerMetaRef = useRef<Map<string, string>>(new Map());
  const readySent = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onPressMapRef = useRef(onPressMap);
  onPressMapRef.current = onPressMap;
  const onPressMarkerRef = useRef(onPressMarker);
  onPressMarkerRef.current = onPressMarker;
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
    readySent.current = false;

    const signalReady = () => {
      if (readySent.current) return;
      readySent.current = true;
      onReadyRef.current?.();
    };

    const signalError = (message?: string) => {
      onErrorRef.current?.(message || 'Impossible de charger la carte');
    };

    const start = () => {
      if (cancelled || mapRef.current) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 2 || h < 2) {
        if (tries++ < 40) requestAnimationFrame(start);
        return;
      }

      const pixelRatio =
        typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;

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
          maxTileCacheSize: 200,
          refreshExpiredTiles: false,
          trackResize: true,
          renderWorldCopies: false,
          pixelRatio,
          // Skip expensive antialiasing on first paint
          antialias: false,
        });
      } catch {
        signalError('Impossible de charger la carte');
        return;
      }
      mapRef.current = map;
      if (showNavigation) {
        map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');
        const top = navigationOffset?.top ?? 10;
        const right = navigationOffset?.right ?? 10;
        const cssId = 'md-maplibre-nav-offset';
        let css = document.getElementById(cssId) as HTMLStyleElement | null;
        if (!css) {
          css = document.createElement('style');
          css.id = cssId;
          document.head.appendChild(css);
        }
        css.textContent = `
          .maplibregl-ctrl-top-right {
            top: ${top}px !important;
            right: ${right}px !important;
          }
          .maplibregl-ctrl-group {
            border: none !important;
            border-radius: 14px !important;
            overflow: hidden;
            box-shadow: 0 8px 22px rgba(20,17,15,0.22);
            background: rgba(255,255,255,0.94) !important;
          }
          .maplibregl-ctrl-group button {
            width: 40px !important;
            height: 40px !important;
          }
          .maplibregl-ctrl-group button + button {
            border-top: 1px solid rgba(20,17,15,0.08) !important;
          }
          .maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon,
          .maplibregl-ctrl button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon {
            background-size: 18px 18px;
          }
        `;
      }

      const bumpSize = () => {
        map?.resize();
      };

      // Paint as soon as style is applied (tiles may still stream in).
      map.once('styledata', () => {
        bumpSize();
        signalReady();
      });
      map.on('load', () => {
        bumpSize();
        signalReady();
      });
      map.on('error', (e) => {
        if (readySent.current) return;
        const msg =
          (e as { error?: { message?: string } })?.error?.message ||
          'Impossible de charger la carte';
        if (/fetch|network|style|cors|failed/i.test(msg)) {
          signalError(msg);
        }
      });
      const failTimer = window.setTimeout(() => {
        if (!readySent.current && !cancelled) {
          signalError('La carte met trop de temps à charger');
        }
      }, 14000);
      map.once('load', () => window.clearTimeout(failTimer));
      map.once('styledata', () => window.clearTimeout(failTimer));
      map.on('click', (e) => {
        onPressMapRef.current?.([e.lngLat.lng, e.lngLat.lat]);
      });

      requestAnimationFrame(bumpSize);
      setTimeout(bumpSize, 50);
      setTimeout(bumpSize, 180);

      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => bumpSize());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recreate on style / interactivity only
  }, [mapStyle, interactive, showNavigation, navigationOffset?.top, navigationOffset?.right]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const cur = map.getCenter();
    const z = map.getZoom();
    const moved =
      Math.abs(cur.lng - center[0]) > 0.00008 ||
      Math.abs(cur.lat - center[1]) > 0.00008 ||
      Math.abs(z - zoom) > 0.05;
    if (!moved) return;
    // Suivi livreur : ease court ; sinon jump immédiat (adresse / overview).
    if (Math.abs(z - zoom) > 0.4) {
      map.jumpTo({ center, zoom });
    } else {
      map.easeTo({ center, zoom, duration: 280, essential: true });
    }
    map.resize();
  }, [center[0], center[1], zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyRoute = () => {
      const sourceId = 'md-route';
      const layerId = 'md-route-line';
      if (!route || route.length < 2) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        return;
      }
      const data = routeLineGeoJSON(route);
      const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
      } else {
        map.addSource(sourceId, { type: 'geojson', data });
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': colors.gold,
            'line-width': 4,
            'line-opacity': 0.85,
            'line-dasharray': [1.2, 1.4],
          },
        });
      }
    };

    if (map.isStyleLoaded()) applyRoute();
    else map.once('load', applyRoute);
  }, [routeKey, colors.gold, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextIds = new Set(markers.map((m) => m.id));
    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        markerMetaRef.current.delete(id);
      }
    });

    markers.forEach((marker) => {
      const meta = `${marker.kind ?? ''}|${marker.label ?? ''}|${marker.color ?? ''}`;
      const existing = markersRef.current.get(marker.id);
      if (existing && markerMetaRef.current.get(marker.id) === meta) {
        existing.setLngLat(marker.coordinate);
        return;
      }
      existing?.remove();
      const node = document.createElement('div');
      node.innerHTML = markerHtml(marker);
      const el = (node.firstElementChild as HTMLElement) ?? node;
      el.style.cursor = 'pointer';
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onPressMarkerRef.current?.(marker.id, marker.coordinate);
      });
      const m = new Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat(marker.coordinate)
        .addTo(map);
      markersRef.current.set(marker.id, m);
      markerMetaRef.current.set(marker.id, meta);
    });
  }, [markersKey, markers]);

  return (
    <View style={[styles.wrap, style]}>
      <div
        ref={hostRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
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
