/**
 * Temps réel mobile (P2) : un seul flux par appareil, qui dit « quelque chose a changé » (jamais de donnée
 * personnelle). Les écrans relisent ensuite leurs données par les routes habituelles.
 *
 * Transport : SSE (`/me/stream-ticket` puis `/me/stream?ticket=`), avec EventSource sur le web
 * et un XMLHttpRequest lu au fil de l'eau sur iOS / Android. Si le SSE échoue deux fois de suite (proxy, réseau
 * mobile qui coupe), bascule en long-poll `/me/events?since=&wait=25`, puis retente le SSE plus tard.
 * Le flux s'arrête en arrière-plan et reprend au retour (avec un signal `live.resync` pour tout relire).
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { useEffect, useState } from 'react';
import { getApiBaseUrl, getAuthToken } from '@/lib/api/http';

const getBase = () => getApiBaseUrl().replace(/\/$/, '');
const getToken = () => getAuthToken();

export type LiveSignal = {
  id: number;
  type: string;
  at?: string | number;
  orderId?: string;
  threadId?: string;
  callId?: string;
  status?: string;
};
export type LivePos = LiveSignal & { lng: number; lat: number };
type Listener = (s: LiveSignal) => void;
type PosListener = (p: LivePos) => void;

const PREFIX = '/me';
const LONG_POLL_WAIT_S = 25;
const SSE_RETRY_AFTER_FALLBACK_MS = 5 * 60_000;
const HELLO_TIMEOUT_MS = 12_000;

const listeners = new Set<Listener>();
const posListeners = new Set<PosListener>();
const statusListeners = new Set<(connected: boolean) => void>();

let wanted = false;
let foreground = AppState.currentState === 'active' || AppState.currentState == null;
let connected = false;
let lastId = 0;
let gen = 0;
let sseFailures = 0;
let fallbackUntil = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let closeCurrent: (() => void) | null = null;
let inflightAbort: (() => void) | null = null;
let appStateSub: { remove: () => void } | null = null;
let hadConnection = false;

function setConnected(v: boolean) {
  if (connected === v) return;
  connected = v;
  for (const fn of Array.from(statusListeners)) fn(v);
}

function emit(s: LiveSignal) {
  for (const fn of Array.from(listeners)) {
    try {
      fn(s);
    } catch {
      /* écouteur défaillant ignoré */
    }
  }
}

function onSignal(s: LiveSignal) {
  if (!s || typeof s.type !== 'string') return;
  if (typeof s.id === 'number' && s.id > 0) {
    if (s.id <= lastId) return; // déjà vu (reprise SSE / long-poll)
    lastId = s.id;
  }
  emit(s);
}

function onPos(p: LivePos) {
  if (!p || !Number.isFinite(p.lng) || !Number.isFinite(p.lat)) return;
  for (const fn of Array.from(posListeners)) {
    try {
      fn(p);
    } catch {
      /* ignore */
    }
  }
}

/** Connexion (re)établie : les écrans relisent tout, des signaux ont pu être manqués. */
function onOpen() {
  sseFailures = 0;
  const first = !hadConnection;
  hadConnection = true;
  setConnected(true);
  if (!first) emit({ id: 0, type: 'live.resync' });
}

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function closeTransport() {
  const c = closeCurrent;
  const a = inflightAbort;
  closeCurrent = null;
  inflightAbort = null;
  c?.();
  a?.();
}

function scheduleReconnect(ms: number) {
  clearRetry();
  if (!wanted || !foreground) return;
  retryTimer = setTimeout(() => connect(), ms);
}

async function authFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const token = getToken();
  if (!token) throw Object.assign(new Error('no-token'), { status: 401 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 12_000);
  const cancel = () => controller.abort();
  inflightAbort = cancel;
  try {
    const res = await fetch(`${getBase()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '1', ...(init.headers as object) },
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(String((data as { error?: string }).error ?? res.status)), { status: res.status });
    return data as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
    if (inflightAbort === cancel) inflightAbort = null;
  }
}

// ------------------------------------------------------------------ SSE

type SseHandlers = { onEvent: (event: string, data: string, id?: string) => void; onFail: () => void };

/** Découpe un flux text/event-stream (bloc par bloc, séparés par une ligne vide). */
function makeParser(h: SseHandlers['onEvent']) {
  let buf = '';
  return (chunk: string) => {
    buf += chunk;
    let m: RegExpExecArray | null;
    while ((m = /\r?\n\r?\n/.exec(buf))) {
      const block = buf.slice(0, m.index);
      buf = buf.slice(m.index + m[0].length);
      let event = 'message';
      let id: string | undefined;
      const data: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (!line || line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
        else if (field === 'id') id = value;
      }
      h(event, data.join('\n'), id);
    }
  };
}

function openSse(url: string, handlers: SseHandlers): () => void {
  if (Platform.OS === 'web' && typeof EventSource !== 'undefined') {
    const es = new EventSource(url);
    for (const ev of ['hello', 'signal', 'pos', 'ping', 'bye']) {
      es.addEventListener(ev, (e) => handlers.onEvent(ev, String((e as MessageEvent).data ?? ''), (e as MessageEvent).lastEventId));
    }
    es.onerror = () => {
      es.close();
      handlers.onFail();
    };
    return () => es.close();
  }
  // iOS / Android : XHR lu au fil de l'eau (RN émet onprogress avec le texte partiel).
  const xhr = new XMLHttpRequest();
  let seen = 0;
  let done = false;
  const parse = makeParser(handlers.onEvent);
  const feed = () => {
    const text = xhr.responseText ?? '';
    if (text.length > seen) {
      parse(text.slice(seen));
      seen = text.length;
    }
  };
  xhr.open('GET', url);
  xhr.setRequestHeader('Accept', 'text/event-stream');
  xhr.setRequestHeader('Cache-Control', 'no-cache');
  xhr.onprogress = feed;
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 3) feed();
    if (xhr.readyState === 4 && !done) {
      feed();
      done = true;
      handlers.onFail();
    }
  };
  xhr.onerror = () => {
    if (done) return;
    done = true;
    handlers.onFail();
  };
  xhr.send();
  return () => {
    done = true;
    try {
      xhr.abort();
    } catch {
      /* ignore */
    }
  };
}

async function connectSse(myGen: number) {
  const t = await authFetch(`${PREFIX}/stream-ticket`, { method: 'POST' });
  if (myGen !== gen) return;
  if (!lastId && Number.isFinite(Number(t.lastId))) lastId = Number(t.lastId);
  const heartbeat = Math.max(2_000, Number(t.heartbeatMs) || 20_000);
  const since = lastId ? `&since=${lastId}` : '';
  let alive: ReturnType<typeof setTimeout> | null = null;
  let helloSeen = false;
  let failed = false;
  const arm = (ms: number) => {
    if (alive) clearTimeout(alive);
    alive = setTimeout(() => fail(), ms);
  };
  const fail = () => {
    if (failed || myGen !== gen) return;
    failed = true;
    if (alive) clearTimeout(alive);
    closeTransport();
    setConnected(false);
    if (!helloSeen) sseFailures += 1;
    if (sseFailures >= 2) {
      fallbackUntil = Date.now() + SSE_RETRY_AFTER_FALLBACK_MS;
      scheduleReconnect(200);
    } else scheduleReconnect(helloSeen ? 1_000 : 3_000);
  };
  const close = openSse(`${getBase()}${PREFIX}/stream?ticket=${encodeURIComponent(String(t.ticket))}${since}`, {
    onEvent: (event, data) => {
      if (myGen !== gen) return;
      arm(heartbeat * 3);
      let json: unknown = null;
      try {
        json = data ? JSON.parse(data) : null;
      } catch {
        json = null;
      }
      if (event === 'hello') {
        helloSeen = true;
        onOpen();
      } else if (event === 'signal') onSignal(json as LiveSignal);
      else if (event === 'pos') onPos(json as LivePos);
      else if (event === 'bye') fail();
    },
    onFail: fail,
  });
  closeCurrent = () => {
    if (alive) clearTimeout(alive);
    close();
  };
  arm(HELLO_TIMEOUT_MS);
}

// ------------------------------------------------------------------ long-poll

async function runLongPoll(myGen: number) {
  let errors = 0;
  while (wanted && foreground && myGen === gen) {
    if (Date.now() > fallbackUntil) {
      // Retente le SSE de temps en temps (réseau revenu, autre Wi-Fi…).
      sseFailures = 0;
      scheduleReconnect(0);
      return;
    }
    try {
      if (!lastId) {
        const first = await authFetch(`${PREFIX}/events`, { timeoutMs: 12_000 });
        lastId = Number(first.lastId) || 0;
      }
      const res = await authFetch(`${PREFIX}/events?since=${lastId}&wait=${LONG_POLL_WAIT_S}`, {
        timeoutMs: (LONG_POLL_WAIT_S + 10) * 1000,
      });
      if (myGen !== gen) return;
      errors = 0;
      if (!connected) onOpen();
      if (res.reset) {
        lastId = Number(res.lastId) || lastId;
        emit({ id: 0, type: 'live.resync' });
      }
      for (const s of (res.events as LiveSignal[]) ?? []) onSignal(s);
      const next = Number(res.lastId);
      if (Number.isFinite(next) && next > lastId) lastId = next;
    } catch (e) {
      if (myGen !== gen) return;
      setConnected(false);
      if ((e as { status?: number }).status === 401) {
        scheduleReconnect(30_000);
        return;
      }
      errors += 1;
      await new Promise((r) => setTimeout(r, Math.min(30_000, 2_000 * errors)));
    }
  }
}

function connect() {
  clearRetry();
  closeTransport();
  const myGen = ++gen;
  if (!wanted || !foreground || !getToken()) {
    setConnected(false);
    return;
  }
  if (Date.now() < fallbackUntil) {
    void runLongPoll(myGen);
    return;
  }
  void connectSse(myGen).catch((e) => {
    if (myGen !== gen) return;
    setConnected(false);
    const status = (e as { status?: number }).status;
    if (status === 401) return scheduleReconnect(30_000);
    sseFailures += 1;
    if (sseFailures >= 2) fallbackUntil = Date.now() + SSE_RETRY_AFTER_FALLBACK_MS;
    scheduleReconnect(status === 404 ? 60_000 : 3_000);
  });
}

function onAppState(s: AppStateStatus) {
  const next = s === 'active';
  if (next === foreground) return;
  foreground = next;
  if (next) connect();
  else {
    gen++;
    clearRetry();
    closeTransport();
    setConnected(false);
  }
}

/** Démarre (ou relance après changement de compte) le flux de l'appareil. Idempotent. */
export function startLive() {
  if (!appStateSub) appStateSub = AppState.addEventListener('change', onAppState);
  if (wanted) {
    if (!connected && !retryTimer && !closeCurrent && !inflightAbort) connect();
    return;
  }
  wanted = true;
  connect();
}

/** Arrête le flux (déconnexion). */
export function stopLive() {
  wanted = false;
  gen++;
  clearRetry();
  closeTransport();
  setConnected(false);
  lastId = 0;
  hadConnection = false;
  sseFailures = 0;
  fallbackUntil = 0;
}

/** Relance proprement (nouveau jeton, nouvelle adresse d'API). */
export function restartLive() {
  stopLive();
  startLive();
}

export function subscribeLive(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function subscribeLivePos(fn: PosListener): () => void {
  posListeners.add(fn);
  return () => {
    posListeners.delete(fn);
  };
}

export function isLiveConnected() {
  return connected;
}

export function subscribeLiveStatus(fn: (connected: boolean) => void): () => void {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}

/** `true` tant que le flux temps réel est ouvert (les écrans peuvent alors espacer leurs relectures). */
export function useLiveConnected() {
  const [v, setV] = useState(connected);
  useEffect(() => {
    setV(connected);
    return subscribeLiveStatus(setV);
  }, []);
  return v;
}

/** Types de signaux qui concernent une commande / une préparation / une livraison. */
export function isOrderSignal(s: LiveSignal) {
  return /^(order|pick|delivery|incident|payment)\./.test(s.type) || s.type === 'live.resync';
}
export function isThreadSignal(s: LiveSignal) {
  return s.type.startsWith('thread.') || s.type.startsWith('support.') || s.type === 'live.resync';
}
export function isCallSignal(s: LiveSignal) {
  return s.type.startsWith('call.') || s.type === 'live.resync';
}
