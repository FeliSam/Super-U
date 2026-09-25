/**
 * Flux temps réel du panel : SSE `GET /admin/stream` (ticket à usage unique via POST /admin/stream-ticket).
 *
 * - Chaque événement invalide les domaines de cache concernés (bumpDomains) → les pages rechargent.
 * - Positions coursiers (`courier_pos`) : gardées en mémoire et poussées aux abonnés (Terrain, future carte).
 * - Reconnexion avec backoff exponentiel + nouveau ticket + `since=<dernier id>` (backfill côté serveur).
 * - Tant que le flux est coupé, cachedApi repasse sur /admin/pulse toutes les 30 s.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { API_URL, getToken } from '@/lib/api';
import { bumpDomains, fetchPulse, setLiveConnected, type CacheDomain } from '@/lib/cachedApi';

export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export type AdminEvent = {
  id: number;
  at: string;
  type: string;
  storeId: string | null;
  entity: string;
  entityId: string | null;
  payload: Record<string, unknown> & {
    pii?: Record<string, unknown>;
    money?: Record<string, unknown>;
  };
  replay?: boolean;
};

export type CourierPos = {
  c: string;
  lng: number;
  lat: number;
  h: number | null;
  s: number | null;
  t: string;
  st: string | null;
};

type StreamState = { status: StreamStatus; lastEventAt: number; lastId: number; attempt: number };

const LAST_ID_KEY = 'marche-admin-stream-last-id';
const WATCHDOG_MS = 45_000;
const OFFLINE_AFTER_ATTEMPTS = 4;
const INVALIDATE_DEBOUNCE_MS = 120;

/** Domaines de cache à recharger selon la famille d'événement (préfixe avant le point). */
const DOMAINS: Record<string, CacheDomain[]> = {
  order: ['orders', 'floor', 'clients'],
  pick: ['orders', 'floor'],
  delivery: ['orders', 'floor'],
  stock: ['catalog'],
  client: ['clients'],
  staff: ['staff', 'floor'],
  rating: ['orders', 'floor'],
  incident: ['orders', 'floor'],
  payment: ['orders'],
  call: [],
  support: [],
  thread: [],
};

let state: StreamState = { status: 'connecting', lastEventAt: 0, lastId: readLastId(), attempt: 0 };
const stateListeners = new Set<() => void>();
const eventListeners = new Set<(ev: AdminEvent) => void>();
const posListeners = new Set<(batch: CourierPos[]) => void>();
const positions = new Map<string, CourierPos>();
const seen = new Set<number>();
let source: EventSource | null = null;
let retryTimer = 0;
let watchdogTimer = 0;
let invalidateTimer = 0;
const pendingDomains = new Set<CacheDomain>();
let running = false;
let everLive = false;

function readLastId() {
  try {
    const n = Number(sessionStorage.getItem(LAST_ID_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function setState(patch: Partial<StreamState>) {
  state = { ...state, ...patch };
  setLiveConnected(state.status === 'live');
  stateListeners.forEach((fn) => fn());
}

function rememberId(id: number) {
  if (id > state.lastId) {
    state = { ...state, lastId: id };
    try {
      sessionStorage.setItem(LAST_ID_KEY, String(id));
    } catch {
      /* ignore */
    }
  }
}

function scheduleInvalidate(domains: CacheDomain[], tag: string) {
  domains.forEach((d) => pendingDomains.add(d));
  if (invalidateTimer) return;
  invalidateTimer = window.setTimeout(() => {
    invalidateTimer = 0;
    const list = [...pendingDomains];
    pendingDomains.clear();
    bumpDomains(list, tag);
  }, INVALIDATE_DEBOUNCE_MS);
}

function kickWatchdog() {
  window.clearTimeout(watchdogTimer);
  watchdogTimer = window.setTimeout(() => {
    // Plus rien reçu (pas même le ping 15 s) : connexion morte côté réseau.
    closeSource();
    scheduleRetry();
  }, WATCHDOG_MS);
}

function closeSource() {
  window.clearTimeout(watchdogTimer);
  if (source) {
    source.close();
    source = null;
  }
}

function handleEvent(ev: AdminEvent) {
  if (seen.has(ev.id)) return;
  seen.add(ev.id);
  if (seen.size > 3000) {
    const keep = [...seen].slice(-1500);
    seen.clear();
    keep.forEach((id) => seen.add(id));
  }
  rememberId(ev.id);
  state = { ...state, lastEventAt: Date.now() };
  stateListeners.forEach((fn) => fn());
  const family = ev.type.split('.')[0] ?? '';
  scheduleInvalidate(DOMAINS[family] ?? [], String(ev.id));
  eventListeners.forEach((fn) => {
    try {
      fn(ev);
    } catch {
      /* ignore */
    }
  });
}

class StreamAuthError extends Error {}

async function getTicket() {
  const token = getToken();
  if (!token) throw new StreamAuthError('no token');
  const res = await fetch(`${API_URL}/admin/stream-ticket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '1' },
  });
  if (res.status === 401 || res.status === 403) throw new StreamAuthError(`HTTP ${res.status}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { ticket?: string };
  if (!data.ticket) throw new Error('ticket manquant');
  return data.ticket;
}

async function open() {
  if (!running) return;
  window.clearTimeout(retryTimer);
  closeSource();
  if (state.status !== 'offline') setState({ status: everLive ? 'reconnecting' : 'connecting' });
  let ticket: string;
  try {
    ticket = await getTicket();
  } catch (error) {
    if (error instanceof StreamAuthError) {
      // Session expirée / révoquée : inutile d'insister, la prochaine requête API renverra au login.
      setState({ status: 'offline' });
      return;
    }
    scheduleRetry();
    return;
  }
  if (!running) return;
  const since = state.lastId ? `&since=${state.lastId}` : '';
  const es = new EventSource(`${API_URL}/admin/stream?ticket=${encodeURIComponent(ticket)}${since}`);
  source = es;
  kickWatchdog();

  es.addEventListener('hello', () => {
    const wasLive = everLive;
    everLive = true;
    setState({ status: 'live', attempt: 0 });
    kickWatchdog();
    // Reconnexion : on resynchronise les tampons une fois (le backfill couvre le détail).
    if (wasLive) void fetchPulse().catch(() => undefined);
  });
  es.addEventListener('admin', (m) => {
    kickWatchdog();
    try {
      handleEvent(JSON.parse((m as MessageEvent<string>).data) as AdminEvent);
    } catch {
      /* ignore */
    }
  });
  es.addEventListener('courier_pos', (m) => {
    kickWatchdog();
    try {
      const batch = JSON.parse((m as MessageEvent<string>).data) as CourierPos[];
      batch.forEach((p) => positions.set(p.c, p));
      posListeners.forEach((fn) => fn(batch));
    } catch {
      /* ignore */
    }
  });
  es.addEventListener('ping', () => kickWatchdog());
  es.addEventListener('reset', () => {
    kickWatchdog();
    // Trop d'événements manqués (ou purgés) : tout recharger.
    bumpDomains(['catalog', 'orders', 'floor', 'staff', 'clients'], `reset-${Date.now()}`);
  });
  es.addEventListener('bye', () => {
    closeSource();
    void open();
  });
  es.onerror = () => {
    // Le ticket est à usage unique : on ne laisse pas EventSource se reconnecter seul.
    if (source !== es) return;
    closeSource();
    scheduleRetry();
  };
}

function scheduleRetry() {
  if (!running) return;
  window.clearTimeout(retryTimer);
  const attempt = state.attempt + 1;
  const base = Math.min(30_000, 1_000 * 2 ** Math.min(attempt - 1, 5));
  const delay = Math.round(base * (0.8 + Math.random() * 0.4));
  const offline = attempt >= OFFLINE_AFTER_ATTEMPTS || (typeof navigator !== 'undefined' && navigator.onLine === false);
  setState({ status: offline ? 'offline' : 'reconnecting', attempt });
  retryTimer = window.setTimeout(() => void open(), delay);
}

function onOnline() {
  if (running && state.status !== 'live') void open();
}

function onVisible() {
  if (document.visibilityState === 'visible' && running && state.status !== 'live') void open();
}

export function startAdminStream() {
  if (running) return;
  running = true;
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  void open();
}

export function stopAdminStream() {
  running = false;
  window.clearTimeout(retryTimer);
  window.clearTimeout(invalidateTimer);
  closeSource();
  window.removeEventListener('online', onOnline);
  document.removeEventListener('visibilitychange', onVisible);
  everLive = false;
  setState({ status: 'connecting', attempt: 0 });
  setLiveConnected(false);
}

export function subscribeAdminEvents(fn: (ev: AdminEvent) => void) {
  eventListeners.add(fn);
  return () => {
    eventListeners.delete(fn);
  };
}

export function subscribeCourierPositions(fn: (batch: CourierPos[]) => void) {
  posListeners.add(fn);
  return () => {
    posListeners.delete(fn);
  };
}

export function getCourierPositions() {
  return positions;
}

function subscribeState(fn: () => void) {
  stateListeners.add(fn);
  return () => {
    stateListeners.delete(fn);
  };
}

/** État du flux (Live / Reconnexion… / Hors ligne) pour l'en-tête du panel. */
export function useAdminStream() {
  return useSyncExternalStore(subscribeState, () => state);
}

/**
 * Recharge une page quand un événement du flux correspond à l'un des préfixes (ex. 'support.', 'call.'),
 * avec un anti-rebond ; tant que le flux n'est pas « live », repli sur un rafraîchissement toutes les 30 s.
 */
export function useStreamReload(prefixes: string[], reload: () => void, enabled = true) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const { status } = useAdminStream();
  const key = prefixes.join('|');
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const list = key.split('|');
    const unsub = subscribeAdminEvents((ev) => {
      if (!list.some((p) => ev.type.startsWith(p))) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => reloadRef.current(), 250);
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [key, enabled]);
  useEffect(() => {
    if (!enabled || status === 'live') return;
    const id = window.setInterval(() => reloadRef.current(), 30_000);
    return () => window.clearInterval(id);
  }, [status, enabled]);
}
