/**
 * Carte live des coursiers (Terrain) : MapLibre GL + tuiles vectorielles OpenFreeMap (style « liberty »,
 * le même que CourseGO), repli raster OSM France si le style est injoignable.
 * Positions : GET /admin/couriers/positions au montage, puis flux SSE `courier_pos`.
 *
 * P2 : plein écran (API Fullscreen + repli CSS plein viewport, Échap pour sortir) et actions directement sur la
 * carte : fiche coursier (livraison en cours, réassigner / libérer, appeler, suivre), commandes à pourvoir
 * (repère à l'adresse ou au magasin, « assigner à un coursier »), magasins, filtres, liste, « tout afficher ».
 * Toutes les actions passent par les routes P1b (/admin/orders/:id/…) : mêmes rôles, confirmations et journal.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MlMap, Marker, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Le build ESM de maplibre charge son worker via `./maplibre-gl-worker.mjs` relatif à import.meta.url,
// fichier que Vite ne copie pas : on le fait bundler comme worker et on passe son URL à setWorkerUrl.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Crosshair, List, Maximize2, MessageSquare, Minimize2, Phone, Store, X } from 'lucide-react';
import { api } from '@/lib/api';
import { getCourierPositions, subscribeCourierPositions, type CourierPos } from '@/lib/adminStream';
import { DELIVERY_STATUS, ORDER_ACTION, PICK_STATUS } from '@/lib/orderLabels';
import { ConfirmDialog } from '@/components/ConfirmDialog';

/** Mêmes sources que CourseGO (constants/map.ts + LibreMap.web.tsx). */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const OPENFREEMAP_PLANET_TILES = 'https://tiles.openfreemap.org/planet/current/{z}/{x}/{y}.pbf';
const RASTER_FALLBACK = 'https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
const COTONOU: [number, number] = [2.4178, 6.3604];
const STALE_MS = 120_000;

type Mission = { id?: string | null; orderId: string | null; status: string | null; address?: string | null; customerName: string | null };

export type MapStaff = {
  id: string;
  firstName: string;
  lastName: string;
  presence: string;
  vehicle: string | null;
  phone?: string | null;
  canDeliver?: boolean;
  pick: Mission | null;
  delivery: Mission | null;
};

export type MapQueueRow = {
  kind: string;
  id: string;
  orderId: string;
  status: string;
  storeName: string | null;
  storeId?: string | null;
  address: string | null;
  customerName: string | null;
  itemCount: number;
  createdAt: string;
  dropoff?: { lng: number; lat: number } | null;
};

export type MapStore = { id: string; name: string; lng: number; lat: number };

type MarkerState = 'enroute' | 'assigned' | 'picking' | 'online' | 'paused' | 'offline';
type FilterId = 'delivering' | 'available' | 'paused' | 'offline';

const STATE_LABEL: Record<MarkerState, string> = {
  enroute: 'En livraison',
  assigned: 'Livraison assignée',
  picking: 'En ramassage',
  online: 'Disponible',
  paused: 'En pause',
  offline: 'Hors ligne',
};

const FILTERS: { id: FilterId; label: string; states: MarkerState[] }[] = [
  { id: 'delivering', label: 'En livraison', states: ['enroute', 'assigned', 'picking'] },
  { id: 'available', label: 'Disponible', states: ['online'] },
  { id: 'paused', label: 'Pause', states: ['paused'] },
  { id: 'offline', label: 'Hors ligne', states: ['offline'] },
];

const MANAGER_ROLES = new Set(['admin', 'manager']);
const ORDER_ROLES = new Set(['admin', 'manager', 'magasinier']);

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

function km(m: number | null | undefined) {
  if (m == null || !Number.isFinite(m)) return '';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Distance à vol d'oiseau (m). */
function haversine(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
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

type Candidate = {
  id: string;
  name: string;
  vehicle: string | null;
  presence: string;
  load: number;
  busyReason: string | null;
  distanceM: number | null;
};

type DialogKind = 'reassign-courier' | 'release-courier' | 'reassign-picker';
type Dialog = { kind: DialogKind; orderId: string; label: string };

const DIALOG_COPY: Record<DialogKind, { title: string; confirm: string; help: string }> = {
  'reassign-courier': {
    title: 'Assigner la livraison à un coursier',
    confirm: 'Assigner',
    help: 'Ajoute la livraison à la tournée du coursier choisi (max 3 colis, tournée non démarrée). Les coursiers en ligne les plus proches du magasin sont en tête.',
  },
  'release-courier': { title: 'Libérer le coursier ?', confirm: 'Libérer', help: 'La livraison retourne dans la file « à pourvoir ». Le coursier est notifié.' },
  'reassign-picker': { title: 'Assigner le ramassage', confirm: 'Assigner', help: 'Le ramasseur choisi est notifié.' },
};

type Selected = { type: 'courier'; id: string } | { type: 'order'; id: string } | { type: 'store'; id: string } | null;

export function CourierMap({
  staff,
  queue = [],
  stores = [],
  role,
  piiMasked = false,
  onOpenOrder,
  onChanged,
}: {
  staff: MapStaff[];
  queue?: MapQueueRow[];
  stores?: MapStore[];
  role?: string | null;
  piiMasked?: boolean;
  onOpenOrder: (orderId: string) => void;
  onChanged?: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLDivElement }>());
  const orderMarkers = useRef(new Map<string, { marker: Marker; el: HTMLDivElement }>());
  const storeMarkers = useRef(new Map<string, { marker: Marker; el: HTMLDivElement }>());
  const fitted = useRef(false);
  const [positions, setPositions] = useState<Map<string, CourierPos>>(() => new Map(getCourierPositions()));
  const [ready, setReady] = useState(false);
  const [mapOn, setMapOn] = useState(false);
  const [mapErr, setMapErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [full, setFull] = useState<'off' | 'native' | 'css'>('off');
  const [selected, setSelected] = useState<Selected>(null);
  const [follow, setFollow] = useState<string | null>(null);
  const [filters, setFilters] = useState<Set<FilterId>>(() => new Set(FILTERS.map((f) => f.id)));
  const [listOpen, setListOpen] = useState(false);
  const [allowed, setAllowed] = useState<{ orderId: string; actions: string[] } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [pick, setPick] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogErr, setDialogErr] = useState('');
  const [flash, setFlash] = useState('');
  const selectRef = useRef<(s: Selected) => void>(() => undefined);
  selectRef.current = setSelected;

  const byId = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const visibleStates = useMemo(() => new Set(FILTERS.filter((f) => filters.has(f.id)).flatMap((f) => f.states)), [filters]);
  const canCourierActions = MANAGER_ROLES.has(role ?? '');
  const canPickActions = ORDER_ROLES.has(role ?? '');

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
        // Un glisser manuel arrête le suivi caméra.
        map.on('dragstart', () => setFollow(null));
      } catch (e) {
        if (!cancelled) setMapErr((e as Error).message || 'Carte indisponible');
      }
    })();
    const all = [markers.current, orderMarkers.current, storeMarkers.current];
    return () => {
      cancelled = true;
      all.forEach((set) => {
        set.forEach((m) => m.marker.remove());
        set.clear();
      });
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Plein écran : API Fullscreen si possible, sinon repli CSS (position fixe sur tout le viewport).
  const enterFull = useCallback(async () => {
    const el = wrap.current;
    if (!el) return;
    try {
      if (el.requestFullscreen && document.fullscreenEnabled) {
        await el.requestFullscreen({ navigationUI: 'hide' });
        setFull('native');
        return;
      }
    } catch {
      /* refusé (iframe, navigateur) : repli CSS */
    }
    setFull('css');
  }, []);
  const exitFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setFull('off');
  }, []);
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFull((f) => (f === 'native' ? 'off' : f));
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => {
    if (full !== 'css') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dialog) setFull('off');
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('cmap-lock');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('cmap-lock');
    };
  }, [full, dialog]);
  useEffect(() => {
    const t = window.setTimeout(() => mapRef.current?.resize(), 60);
    return () => window.clearTimeout(t);
  }, [full, selected, listOpen]);

  // Marqueurs coursiers
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !mapOn) return;
    const seen = new Set<string>();
    for (const p of positions.values()) {
      if (!Number.isFinite(p.lng) || !Number.isFinite(p.lat)) continue;
      const s = byId.get(p.c);
      if (!s) continue; // pas dans le périmètre du lecteur (magasin) ou pas coursier
      const state = markerState(s);
      if (!visibleStates.has(state)) continue;
      seen.add(p.c);
      const age = now - Date.parse(p.t);
      const stale = !Number.isFinite(age) || age > STALE_MS;
      let m = markers.current.get(p.c);
      if (!m) {
        const el = document.createElement('div');
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        const id = p.c;
        const open = (e: Event) => {
          e.stopPropagation();
          selectRef.current({ type: 'courier', id });
        };
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && open(e));
        const marker = new lib.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        m = { marker, el };
        markers.current.set(p.c, m);
      }
      m.marker.setLngLat([p.lng, p.lat]);
      const isSel = selected?.type === 'courier' && selected.id === p.c;
      m.el.className = `cmap-marker s-${state}${stale ? ' stale' : ''}${isSel ? ' sel' : ''}${follow === p.c ? ' follow' : ''}`;
      m.el.dataset.courier = p.c;
      m.el.textContent = `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase();
      m.el.title = `${s.firstName} ${s.lastName} · ${STATE_LABEL[state]}${stale ? ' · position ancienne' : ''}`;
      m.el.setAttribute('aria-label', m.el.title);
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
  }, [positions, byId, mapOn, now, visibleStates, selected, follow]);

  // Commandes à pourvoir : à l'adresse de livraison (si connue et visible pour le rôle), sinon au magasin.
  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const orderPoint = useCallback(
    (q: MapQueueRow, index: number): [number, number] | null => {
      if (q.dropoff) return [q.dropoff.lng, q.dropoff.lat];
      const st = q.storeId ? storeById.get(q.storeId) : null;
      if (!st) return null;
      // Petit décalage en éventail autour du magasin pour ne pas empiler les repères.
      const angle = (index * 137.5 * Math.PI) / 180;
      const r = 0.0012 + 0.0003 * (index % 4);
      return [st.lng + Math.cos(angle) * r, st.lat + Math.sin(angle) * r];
    },
    [storeById],
  );
  // Un seul repère par commande : une commande neuve attend souvent à la fois un ramasseur et un coursier.
  const queuePoints = useMemo(() => {
    const byOrder = new Map<string, { q: MapQueueRow; pick: boolean; deliver: boolean }>();
    for (const q of queue) {
      const g = byOrder.get(q.orderId) ?? { q, pick: false, deliver: false };
      if (q.kind === 'pick') g.pick = true;
      else g.deliver = true;
      if (q.dropoff && !g.q.dropoff) g.q = q;
      byOrder.set(q.orderId, g);
    }
    return [...byOrder.values()].map((g, i) => ({ ...g, key: `order:${g.q.orderId}`, pt: orderPoint(g.q, i) }));
  }, [queue, orderPoint]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !mapOn) return;
    const seen = new Set<string>();
    for (const { q, pt, key, pick, deliver } of queuePoints) {
      if (!pt) continue;
      seen.add(key);
      let m = orderMarkers.current.get(key);
      if (!m) {
        const el = document.createElement('div');
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        const open = (e: Event) => {
          e.stopPropagation();
          selectRef.current({ type: 'order', id: key });
        };
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && open(e));
        const marker = new lib.Marker({ element: el, anchor: 'bottom' }).setLngLat(pt).addTo(map);
        m = { marker, el };
        orderMarkers.current.set(key, m);
      }
      m.marker.setLngLat(pt);
      const isSel = selected?.type === 'order' && selected.id === key;
      m.el.className = `cmap-order k-${pick ? 'pick' : 'deliver'}${pick && deliver ? ' k-both' : ''}${q.dropoff ? '' : ' at-store'}${isSel ? ' sel' : ''}`;
      m.el.dataset.order = q.orderId;
      m.el.textContent = pick && deliver ? 'R+L' : pick ? 'R' : 'L';
      m.el.title = `${pick && deliver ? 'Ramassage + livraison' : pick ? 'Ramassage' : 'Livraison'} à pourvoir · ${q.orderId}`;
      m.el.setAttribute('aria-label', m.el.title);
    }
    for (const [key, m] of orderMarkers.current) {
      if (!seen.has(key)) {
        m.marker.remove();
        orderMarkers.current.delete(key);
      }
    }
  }, [queuePoints, mapOn, selected]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !mapOn) return;
    const seen = new Set<string>();
    for (const st of stores) {
      seen.add(st.id);
      let m = storeMarkers.current.get(st.id);
      if (!m) {
        const el = document.createElement('div');
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        const id = st.id;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          selectRef.current({ type: 'store', id });
        });
        el.innerHTML =
          '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9M4 9h16v11H4zM9 20v-6h6v6"/></svg>';
        const marker = new lib.Marker({ element: el }).setLngLat([st.lng, st.lat]).addTo(map);
        m = { marker, el };
        storeMarkers.current.set(st.id, m);
      }
      m.marker.setLngLat([st.lng, st.lat]);
      m.el.className = `cmap-store${selected?.type === 'store' && selected.id === st.id ? ' sel' : ''}`;
      m.el.dataset.store = st.id;
      m.el.title = st.name;
      m.el.setAttribute('aria-label', st.name);
    }
    for (const [id, m] of storeMarkers.current) {
      if (!seen.has(id)) {
        m.marker.remove();
        storeMarkers.current.delete(id);
      }
    }
  }, [stores, mapOn, selected]);

  // Suivi caméra d'un coursier
  useEffect(() => {
    if (!follow) return;
    const p = positions.get(follow);
    const map = mapRef.current;
    if (!p || !map) return;
    map.easeTo({ center: [p.lng, p.lat], duration: 600, zoom: Math.max(map.getZoom(), 14) });
  }, [follow, positions]);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    setFollow(null);
    const b = new lib.LngLatBounds();
    let n = 0;
    for (const p of positions.values()) {
      const s = byId.get(p.c);
      if (!s || !visibleStates.has(markerState(s)) || !Number.isFinite(p.lng)) continue;
      b.extend([p.lng, p.lat]);
      n++;
    }
    for (const { pt } of queuePoints) if (pt) (b.extend(pt), n++);
    for (const st of stores) (b.extend([st.lng, st.lat]), n++);
    if (!n) return;
    map.fitBounds(b, { padding: { top: 70, bottom: 50, left: listOpen ? 300 : 50, right: selected ? 360 : 50 }, maxZoom: 15, duration: 500 });
  }, [positions, byId, visibleStates, queuePoints, stores, listOpen, selected]);

  const flyTo = (lngLat: [number, number]) => {
    mapRef.current?.flyTo({ center: lngLat, zoom: Math.max(mapRef.current.getZoom(), 14.5), duration: 700 });
  };

  // Sélection → actions permises par le serveur (rôle + état) pour la commande concernée.
  const selCourier = selected?.type === 'courier' ? byId.get(selected.id) ?? null : null;
  const selPin = selected?.type === 'order' ? queuePoints.find((x) => x.key === selected.id) ?? null : null;
  const selOrder = selPin?.q ?? null;
  const selStore = selected?.type === 'store' ? storeById.get(selected.id) ?? null : null;
  const focusOrderId = selCourier?.delivery?.orderId ?? selOrder?.orderId ?? null;

  const loadAllowed = useCallback(() => {
    if (!focusOrderId || !canPickActions) {
      setAllowed(null);
      return;
    }
    api<{ actions: string[] }>(`/admin/orders/${encodeURIComponent(focusOrderId)}/ops`)
      .then((r) => setAllowed({ orderId: focusOrderId, actions: r.actions }))
      .catch(() => setAllowed({ orderId: focusOrderId, actions: [] }));
  }, [focusOrderId, canPickActions]);
  useEffect(loadAllowed, [loadAllowed]);
  const can = (action: string) => allowed?.orderId === focusOrderId && Boolean(allowed?.actions.includes(action));

  const openDialog = (kind: DialogKind, orderId: string, label: string) => {
    setDialog({ kind, orderId, label });
    setPick('');
    setReason('');
    setDialogErr('');
    setCands(null);
    if (kind !== 'release-courier') {
      api<{ staff: Candidate[] }>(`/admin/orders/${encodeURIComponent(orderId)}/candidates?kind=${kind === 'reassign-picker' ? 'picker' : 'courier'}`)
        .then((r) => setCands(r.staff))
        .catch((e: Error) => setDialogErr(e.message));
    }
  };

  // Tri : disponibles d'abord, en ligne avant pause / hors ligne, puis distance au magasin.
  const sortedCands = useMemo(() => {
    const rank = (p: string) => (p === 'online' ? 0 : p === 'paused' ? 1 : 2);
    return [...(cands ?? [])].sort(
      (a, b) =>
        Number(Boolean(a.busyReason)) - Number(Boolean(b.busyReason)) ||
        rank(a.presence) - rank(b.presence) ||
        (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, 'fr'),
    );
  }, [cands]);

  const submit = async () => {
    if (!dialog) return;
    const path =
      dialog.kind === 'release-courier'
        ? { url: 'release', body: { target: 'courier' } }
        : { url: dialog.kind, body: { staffId: pick } };
    setBusy(true);
    setDialogErr('');
    try {
      await api(`/admin/orders/${encodeURIComponent(dialog.orderId)}/${path.url}`, {
        method: 'POST',
        body: JSON.stringify({ ...path.body, reason: reason.trim() || undefined }),
      });
      const who = sortedCands.find((c) => c.id === pick)?.name;
      setFlash(`${ORDER_ACTION[dialog.kind] ?? dialog.kind}${who ? ` : ${who}` : ''} ✓ (${dialog.orderId})`);
      window.setTimeout(() => setFlash(''), 6000);
      setDialog(null);
      onChanged?.();
      loadAllowed();
    } catch (e) {
      setDialogErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

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

  const listed = useMemo(
    () =>
      staff
        .filter((s) => visibleStates.has(markerState(s)))
        .sort((a, b) => FILTERS.findIndex((f) => f.states.includes(markerState(a))) - FILTERS.findIndex((f) => f.states.includes(markerState(b))) || a.firstName.localeCompare(b.firstName, 'fr')),
    [staff, visibleStates],
  );

  const selPos = selCourier ? positions.get(selCourier.id) : undefined;
  const selState = selCourier ? markerState(selCourier) : null;
  const selAge = selPos ? now - Date.parse(selPos.t) : NaN;
  const selOrderPt = selPin?.pt ?? null;
  const nearest = useMemo(() => {
    // Coursiers en ligne les plus proches du repère de la commande sélectionnée (indicatif, avant le choix).
    if (!selOrderPt) return [];
    return staff
      .filter((s) => s.presence === 'online' && s.canDeliver !== false)
      .map((s) => ({ s, p: positions.get(s.id) }))
      .filter((x) => x.p && Number.isFinite(x.p.lng))
      .map((x) => ({ s: x.s, d: haversine(selOrderPt, [x.p!.lng, x.p!.lat]) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
  }, [selOrderPt, staff, positions]);

  const copy = dialog ? DIALOG_COPY[dialog.kind] : null;
  const needsPick = dialog?.kind === 'reassign-courier' || dialog?.kind === 'reassign-picker';

  return (
    <div className={`card cmap-card${full !== 'off' ? ' cmap-full' : ''}${full === 'css' ? ' cmap-full-css' : ''}`} ref={wrap} data-full={full}>
      <div className="dash-card-head">
        <h3>Carte des coursiers</h3>
        <small>
          {counts.live} position(s) live · {counts.stale} ancienne(s) (&gt; 2 min) · {queue.length} à pourvoir
        </small>
      </div>
      <div className="cmap-stage">
        <div className="cmap" ref={box} data-ready={ready ? '1' : '0'}>
          {mapErr ? <p className="err" style={{ padding: 16 }}>{mapErr}</p> : null}
        </div>

        <div className="cmap-controls" role="toolbar" aria-label="Contrôles de la carte">
          <button type="button" className={`cmap-ctl${listOpen ? ' on' : ''}`} onClick={() => setListOpen((v) => !v)} aria-pressed={listOpen} title="Liste des coursiers">
            <List size={16} /> <span>Liste</span>
          </button>
          <div className="cmap-filters" role="group" aria-label="Filtrer par statut">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`cmap-chip f-${f.id}${filters.has(f.id) ? ' on' : ''}`}
                aria-pressed={filters.has(f.id)}
                onClick={() =>
                  setFilters((prev) => {
                    const next = new Set(prev);
                    if (next.has(f.id)) next.delete(f.id);
                    else next.add(f.id);
                    return next;
                  })
                }
              >
                <i aria-hidden /> {f.label}
              </button>
            ))}
          </div>
          <button type="button" className="cmap-ctl" onClick={fitAll} title="Tout afficher" data-ctl="fit">
            <Crosshair size={16} /> <span>Tout afficher</span>
          </button>
          <button
            type="button"
            className="cmap-ctl"
            onClick={() => (full === 'off' ? void enterFull() : exitFull())}
            title={full === 'off' ? 'Plein écran' : 'Quitter le plein écran (Échap)'}
            data-ctl="fullscreen"
            aria-pressed={full !== 'off'}
          >
            {full === 'off' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            <span>{full === 'off' ? 'Plein écran' : 'Quitter'}</span>
          </button>
        </div>

        {flash ? <div className="cmap-flash" role="status">{flash}</div> : null}

        {listOpen ? (
          <aside className="cmap-list" aria-label="Coursiers">
            <div className="cmap-list-head">
              <strong>Coursiers ({listed.length})</strong>
              <button type="button" className="icon-btn" onClick={() => setListOpen(false)} aria-label="Fermer la liste">
                <X size={15} />
              </button>
            </div>
            <ul>
              {listed.map((s) => {
                const st = markerState(s);
                const p = positions.get(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={selected?.type === 'courier' && selected.id === s.id ? 'on' : ''}
                      onClick={() => {
                        setSelected({ type: 'courier', id: s.id });
                        if (p) flyTo([p.lng, p.lat]);
                      }}
                    >
                      <i className={`cmap-dot s-${st}`} aria-hidden />
                      <span>
                        {s.firstName} {s.lastName}
                        <small>
                          {STATE_LABEL[st]}
                          {s.delivery?.orderId ? ` · ${s.delivery.orderId}` : ''}
                          {!p ? ' · pas de position' : ''}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
              {!listed.length ? <li className="cmap-list-empty">Aucun coursier pour ces filtres.</li> : null}
            </ul>
          </aside>
        ) : null}

        {selCourier || selOrder || selStore ? (
          <aside className="cmap-sheet" aria-label="Détails">
            <button type="button" className="icon-btn cmap-sheet-close" onClick={() => setSelected(null)} aria-label="Fermer">
              <X size={16} />
            </button>

            {selCourier && selState ? (
              <div className="cmap-sheet-body" data-sheet="courier">
                <strong className="cmap-sheet-title">
                  {selCourier.firstName} {selCourier.lastName}
                </strong>
                <span className={`cmap-pop-state s-${selState}`}>{STATE_LABEL[selState]}</span>
                <small>
                  Position {Number.isFinite(selAge) ? ago(selAge) : 'inconnue'}
                  {Number.isFinite(selAge) && selAge > STALE_MS ? ' (ancienne)' : ''}
                  {selPos?.s ? ` · ${Math.round(selPos.s * 3.6)} km/h` : ''}
                  {selCourier.vehicle ? ` · ${selCourier.vehicle}` : ''}
                </small>

                {selCourier.delivery?.orderId ? (
                  <div className="cmap-sheet-mission">
                    <span>
                      Livraison · {DELIVERY_STATUS[selCourier.delivery.status ?? ''] ?? selCourier.delivery.status}
                    </span>
                    <small>{[selCourier.delivery.customerName, selCourier.delivery.address].filter(Boolean).join(' → ') || '—'}</small>
                    <button type="button" className="btn sm ghost" onClick={() => onOpenOrder(selCourier.delivery!.orderId!)}>
                      Ouvrir la commande {selCourier.delivery.orderId}
                    </button>
                    {canCourierActions ? (
                      <div className="cmap-sheet-actions">
                        {can('reassign-courier') ? (
                          <button type="button" className="btn sm gold" data-action="reassign-courier" onClick={() => openDialog('reassign-courier', selCourier.delivery!.orderId!, `${selCourier.firstName} ${selCourier.lastName}`)}>
                            Réassigner à un autre coursier
                          </button>
                        ) : null}
                        {can('release-courier') ? (
                          <button type="button" className="btn sm ghost" data-action="release-courier" onClick={() => openDialog('release-courier', selCourier.delivery!.orderId!, `${selCourier.firstName} ${selCourier.lastName}`)}>
                            Libérer la livraison
                          </button>
                        ) : null}
                        {allowed?.orderId === focusOrderId && !can('reassign-courier') && !can('release-courier') ? (
                          <small>Tournée démarrée : réassignation impossible (voir la fiche commande).</small>
                        ) : null}
                      </div>
                    ) : (
                      <small className="cmap-readonly">Réassignation réservée aux managers.</small>
                    )}
                  </div>
                ) : selCourier.pick?.orderId ? (
                  <div className="cmap-sheet-mission">
                    <span>Ramassage · {PICK_STATUS[selCourier.pick.status ?? ''] ?? selCourier.pick.status}</span>
                    <button type="button" className="btn sm ghost" onClick={() => onOpenOrder(selCourier.pick!.orderId!)}>
                      Ouvrir la commande {selCourier.pick.orderId}
                    </button>
                  </div>
                ) : (
                  <small>Aucune livraison en cours.</small>
                )}

                <div className="cmap-sheet-row">
                  {selCourier.phone ? (
                    <a className="btn sm ghost" href={`tel:${selCourier.phone.replace(/\s+/g, '')}`} data-action="call">
                      <Phone size={14} /> Appeler
                    </a>
                  ) : null}
                  <button type="button" className="btn sm ghost" disabled title="Pas encore de fil de discussion staff ↔ siège : utilisez l’appel.">
                    <MessageSquare size={14} /> Message
                  </button>
                  <label className="cmap-follow">
                    <input
                      type="checkbox"
                      checked={follow === selCourier.id}
                      disabled={!selPos}
                      onChange={(e) => setFollow(e.target.checked ? selCourier.id : null)}
                      data-action="follow"
                    />
                    Suivre
                  </label>
                </div>
              </div>
            ) : null}

            {selOrder ? (
              <div className="cmap-sheet-body" data-sheet="order">
                <strong className="cmap-sheet-title">
                  {selPin?.pick && selPin?.deliver ? 'Ramassage + livraison à pourvoir' : selPin?.pick ? 'Ramassage à pourvoir' : 'Livraison à pourvoir'}
                </strong>
                <small>
                  {selOrder.orderId} · {selOrder.itemCount} article(s) · {selOrder.storeName ?? '—'}
                </small>
                <small>
                  {[selOrder.customerName, selOrder.address].filter(Boolean).join(' → ') || '—'}
                  {!selOrder.dropoff ? ' · repère au magasin' : ''}
                </small>
                <button type="button" className="btn sm ghost" onClick={() => onOpenOrder(selOrder.orderId)}>
                  Ouvrir la commande
                </button>
                {selPin?.deliver ? (
                  canCourierActions ? (
                    can('reassign-courier') ? (
                      <button type="button" className="btn sm gold" data-action="assign-courier" onClick={() => openDialog('reassign-courier', selOrder.orderId, selOrder.orderId)}>
                        Assigner à un coursier
                      </button>
                    ) : allowed?.orderId === focusOrderId ? (
                      <small>Assignation impossible dans l’état actuel.</small>
                    ) : null
                  ) : (
                    <small className="cmap-readonly">Assignation coursier réservée aux managers.</small>
                  )
                ) : null}
                {selPin?.pick && canPickActions && can('reassign-picker') ? (
                  <button type="button" className="btn sm gold" data-action="assign-picker" onClick={() => openDialog('reassign-picker', selOrder.orderId, selOrder.orderId)}>
                    Assigner un ramasseur
                  </button>
                ) : null}
                {nearest.length ? (
                  <div className="cmap-near">
                    <small>Coursiers en ligne les plus proches :</small>
                    {nearest.map(({ s, d }) => (
                      <button key={s.id} type="button" className="cmap-near-row" onClick={() => setSelected({ type: 'courier', id: s.id })}>
                        {s.firstName} {s.lastName.charAt(0)}. <span>{km(d)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {selStore ? (
              <div className="cmap-sheet-body" data-sheet="store">
                <strong className="cmap-sheet-title">
                  <Store size={15} /> {selStore.name}
                </strong>
                <small>
                  {queue.filter((q) => q.storeId === selStore.id).length} commande(s) à pourvoir ·{' '}
                  {staff.filter((s) => s.presence === 'online').length} coursier(s) en ligne
                </small>
              </div>
            ) : null}
            {piiMasked ? <small className="cmap-readonly">Données client masquées pour votre rôle.</small> : null}
          </aside>
        ) : null}

        <ConfirmDialog
          open={Boolean(dialog)}
          title={copy?.title ?? ''}
          confirmLabel={copy?.confirm ?? 'Confirmer'}
          busy={busy}
          disabled={needsPick && !pick}
          error={dialogErr}
          onConfirm={() => void submit()}
          onClose={() => setDialog(null)}
        >
          <p className="modal-help">
            {copy?.help} {dialog ? <strong>Commande {dialog.orderId}.</strong> : null}
          </p>
          {needsPick ? (
            <div className="staff-pick" role="listbox" aria-label="Choisir un collaborateur">
              {!cands ? <small>Chargement…</small> : null}
              {sortedCands.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={pick === c.id}
                  className={`staff-opt${pick === c.id ? ' on' : ''}`}
                  disabled={Boolean(c.busyReason)}
                  onClick={() => setPick(c.id)}
                  data-candidate={c.id}
                >
                  <i className={`presence-dot p-${c.presence}`} aria-hidden />
                  <span>
                    {c.name}
                    <small>
                      {c.presence === 'online' ? 'En ligne' : c.presence === 'paused' ? 'En pause' : 'Hors ligne'}
                      {c.vehicle ? ` · ${c.vehicle}` : ''}
                      {c.busyReason ? ` · ${c.busyReason}` : ''}
                    </small>
                  </span>
                  <span className="staff-opt-load">
                    {c.distanceM != null ? `${km(c.distanceM)} · ` : ''}
                    {c.load} en cours
                  </span>
                </button>
              ))}
              {cands && !cands.length ? <small>Aucun collaborateur éligible pour ce magasin.</small> : null}
            </div>
          ) : null}
          <label className="field">
            Motif (facultatif, visible dans l’historique)
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </label>
        </ConfirmDialog>
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
        <span>
          <i className="cmap-legend-order" aria-hidden /> Commande à pourvoir
        </span>
        <span>
          <i className="cmap-legend-store" aria-hidden /> Magasin
        </span>
      </div>
    </div>
  );
}
