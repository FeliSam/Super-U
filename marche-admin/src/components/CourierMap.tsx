/**
 * Carte live des coursiers (Terrain) : MapLibre GL + tuiles vectorielles OpenFreeMap (style « liberty »,
 * le même que CourseGO), repli raster OSM France si le style est injoignable.
 * Positions : GET /admin/couriers/positions au montage, puis flux SSE `courier_pos`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MlMap, Marker, Popup, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Le build ESM de maplibre charge son worker via `./maplibre-gl-worker.mjs` relatif à import.meta.url,
// fichier que Vite ne copie pas : on le fait bundler comme worker et on passe son URL à setWorkerUrl.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { api } from '@/lib/api';
import { getCourierPositions, subscribeCourierPositions, type CourierPos } from '@/lib/adminStream';
import { DELIVERY_STATUS, PICK_STATUS } from '@/lib/orderLabels';

/** Mêmes sources que CourseGO (constants/map.ts + LibreMap.web.tsx). */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const OPENFREEMAP_PLANET_TILES = 'https://tiles.openfreemap.org/planet/current/{z}/{x}/{y}.pbf';
const RASTER_FALLBACK = 'https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
const COTONOU: [number, number] = [2.4178, 6.3604];
const STALE_MS = 120_000;

export type MapStaff = {
  id: string;
  firstName: string;
  lastName: string;
  presence: string;
  vehicle: string | null;
  pick: { orderId: string | null; status: string | null; customerName: string | null } | null;
  delivery: { orderId: string | null; status: string | null; address: string | null; customerName: string | null } | null;
};

type MarkerState = 'enroute' | 'assigned' | 'picking' | 'online' | 'paused' | 'offline';

const STATE_LABEL: Record<MarkerState, string> = {
  enroute: 'En livraison',
  assigned: 'Livraison assignée',
  picking: 'En ramassage',
  online: 'Disponible',
  paused: 'En pause',
  offline: 'Hors ligne',
};

function markerState(s: MapStaff | undefined): MarkerState {
  if (!s) return 'offline';
  const del = s.delivery?.status ?? '';
  if (['picked_up', 'en_route', 'arrived'].includes(del)) return 'enroute';
  if (['assigned', 'at_store'].includes(del)) return 'assigned';
  if (s.pick) return 'picking';
  if (s.presence === 'online') return 'online';
  if (s.presence === 'paused') return 'paused';
  return 'offline';
}

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `il y a ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  return `il y a ${Math.round(m / 60)} h`;
}

async function loadStyle(): Promise<StyleSpecification> {
  try {
    const res = await fetch(STYLE_URL);
    if (!res.ok) throw new Error(String(res.status));
    const style = (await res.json()) as StyleSpecification;
    const sources = { ...style.sources };
    for (const [id, src] of Object.entries(sources)) {
      const url = (src as { url?: string }).url;
      if (typeof url === 'string' && url.includes('tiles.openfreemap.org') && url.includes('planet')) {
        const rest = { ...(src as Record<string, unknown>) };
        delete rest.url;
        sources[id] = { ...rest, type: 'vector', tiles: [OPENFREEMAP_PLANET_TILES], minzoom: 0, maxzoom: 14 } as StyleSpecification['sources'][string];
      }
    }
    return { ...style, sources };
  } catch {
    return {
      version: 8,
      sources: { osm: { type: 'raster', tiles: [RASTER_FALLBACK], tileSize: 256, attribution: '© OpenStreetMap', maxzoom: 19 } },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    };
  }
}

export function CourierMap({ staff, onOpenOrder }: { staff: MapStaff[]; onOpenOrder: (orderId: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLDivElement; popup: Popup }>());
  const fitted = useRef(false);
  const [positions, setPositions] = useState<Map<string, CourierPos>>(() => new Map(getCourierPositions()));
  const [ready, setReady] = useState(false);
  const [mapOn, setMapOn] = useState(false);
  const [mapErr, setMapErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const openRef = useRef(onOpenOrder);
  openRef.current = onOpenOrder;

  const byId = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  // Positions initiales + flux live
  useEffect(() => {
    let alive = true;
    api<{ positions: CourierPos[] }>('/admin/couriers/positions')
      .then((r) => {
        if (!alive) return;
        setPositions((prev) => {
          const next = new Map(prev);
          for (const p of r.positions) {
            const cur = next.get(p.c);
            if (!cur || Date.parse(cur.t) < Date.parse(p.t)) next.set(p.c, p);
          }
          return next;
        });
      })
      .catch(() => undefined);
    const unsub = subscribeCourierPositions((batch) =>
      setPositions((prev) => {
        const next = new Map(prev);
        batch.forEach((p) => next.set(p.c, p));
        return next;
      }),
    );
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      alive = false;
      unsub();
      window.clearInterval(tick);
    };
  }, []);

  // Carte (chargée à la demande : maplibre-gl est volumineux)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [lib, style] = await Promise.all([import('maplibre-gl'), loadStyle()]);
        if (cancelled || !box.current) return;
        libRef.current = lib;
        lib.setWorkerUrl(maplibreWorkerUrl);
        const map = new lib.Map({ container: box.current, style, center: COTONOU, zoom: 12.3, attributionControl: { compact: true } });
        map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
        mapRef.current = map;
        setMapOn(true); // les marqueurs (DOM) n'attendent pas les tuiles
        map.on('load', () => !cancelled && setReady(true));
        map.on('error', (e) => console.warn('[carte]', e?.error?.message ?? e));
      } catch (e) {
        if (!cancelled) setMapErr((e as Error).message || 'Carte indisponible');
      }
    })();
    const current = markers.current;
    return () => {
      cancelled = true;
      current.forEach((m) => m.marker.remove());
      current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Marqueurs
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !mapOn) return;
    const seen = new Set<string>();
    for (const p of positions.values()) {
      if (!Number.isFinite(p.lng) || !Number.isFinite(p.lat)) continue;
      const s = byId.get(p.c);
      if (!s) continue; // pas dans le périmètre du lecteur (magasin) ou pas coursier
      seen.add(p.c);
      const state = markerState(s);
      const age = now - Date.parse(p.t);
      const stale = !Number.isFinite(age) || age > STALE_MS;
      let m = markers.current.get(p.c);
      if (!m) {
        const el = document.createElement('div');
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        const popup = new lib.Popup({ offset: 16, closeButton: true, maxWidth: '280px' });
        const marker = new lib.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
        m = { marker, el, popup };
        markers.current.set(p.c, m);
      }
      m.marker.setLngLat([p.lng, p.lat]);
      m.el.className = `cmap-marker s-${state}${stale ? ' stale' : ''}`;
      m.el.dataset.courier = p.c;
      m.el.textContent = `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase();
      m.el.title = `${s.firstName} ${s.lastName} · ${STATE_LABEL[state]}${stale ? ' · position ancienne' : ''}`;
      // Contenu de la bulle (mis à jour à chaque rendu)
      const root = document.createElement('div');
      root.className = 'cmap-pop';
      const h = document.createElement('strong');
      h.textContent = `${s.firstName} ${s.lastName}`;
      const st = document.createElement('span');
      st.className = `cmap-pop-state s-${state}`;
      st.textContent = STATE_LABEL[state];
      const seenLine = document.createElement('small');
      seenLine.textContent = `Position ${Number.isFinite(age) ? ago(age) : 'inconnue'}${stale ? ' (ancienne)' : ''}${p.s ? ` · ${Math.round(p.s * 3.6)} km/h` : ''}${s.vehicle ? ` · ${s.vehicle}` : ''}`;
      root.append(h, st, seenLine);
      const mission = s.delivery?.orderId ? s.delivery : s.pick?.orderId ? s.pick : null;
      if (mission?.orderId) {
        const d = document.createElement('div');
        d.className = 'cmap-pop-mission';
        const label = s.delivery?.orderId
          ? `Livraison · ${DELIVERY_STATUS[s.delivery.status ?? ''] ?? s.delivery.status}`
          : `Ramassage · ${PICK_STATUS[s.pick?.status ?? ''] ?? s.pick?.status}`;
        const t = document.createElement('span');
        t.textContent = label;
        const who = document.createElement('small');
        who.textContent = [mission.customerName, s.delivery?.address].filter(Boolean).join(' → ');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn sm gold';
        btn.textContent = `Ouvrir ${mission.orderId}`;
        const oid = mission.orderId;
        btn.onclick = () => openRef.current(oid);
        d.append(t, who, btn);
        root.append(d);
      } else {
        const none = document.createElement('small');
        none.textContent = 'Aucune livraison en cours.';
        root.append(none);
      }
      m.popup.setDOMContent(root);
    }
    for (const [id, m] of markers.current) {
      if (!seen.has(id)) {
        m.marker.remove();
        markers.current.delete(id);
      }
    }
    if (!fitted.current && seen.size) {
      fitted.current = true;
      const pts = [...seen].map((id) => positions.get(id)!).filter(Boolean);
      if (pts.length === 1) map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 13.5 });
      else {
        const b = new lib.LngLatBounds();
        pts.forEach((p) => b.extend([p.lng, p.lat]));
        map.fitBounds(b, { padding: 60, maxZoom: 14.5, duration: 0 });
      }
    }
  }, [positions, byId, mapOn, now]);

  const counts = useMemo(() => {
    let live = 0;
    let stale = 0;
    for (const p of positions.values()) {
      if (!byId.has(p.c)) continue;
      if (now - Date.parse(p.t) > STALE_MS) stale += 1;
      else live += 1;
    }
    return { live, stale };
  }, [positions, byId, now]);

  return (
    <div className="card cmap-card">
      <div className="dash-card-head">
        <h3>Carte des coursiers</h3>
        <small>
          {counts.live} position(s) live · {counts.stale} ancienne(s) (&gt; 2 min)
        </small>
      </div>
      <div className="cmap" ref={box} data-ready={ready ? '1' : '0'}>
        {mapErr ? <p className="err" style={{ padding: 16 }}>{mapErr}</p> : null}
      </div>
      <div className="cmap-legend">
        {(Object.keys(STATE_LABEL) as MarkerState[]).map((k) => (
          <span key={k}>
            <i className={`cmap-dot s-${k}`} aria-hidden /> {STATE_LABEL[k]}
          </span>
        ))}
        <span>
          <i className="cmap-dot s-online stale" aria-hidden /> Position &gt; 2 min
        </span>
      </div>
    </div>
  );
}
