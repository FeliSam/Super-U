import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { readSnap, writeSnap, type CacheSnap } from '@/lib/localCache';

export type Pulse = {
  stamp: string;
  catalog: string;
  orders: string;
  floor: string;
  staff: string;
  clients: string;
};

export type CacheDomain = 'catalog' | 'orders' | 'floor' | 'staff' | 'clients' | 'overview';

const LIVE_CHANNEL = 'marche-admin-live';
const LIVE_EVENT = 'admin:changed';
const memory = new Map<string, CacheSnap>();
let pulse: Pulse | null = null;
const pulseListeners = new Set<(force: boolean) => void>();
let pollId = 0;
let started = false;
/** Vrai quand le flux SSE /admin/stream est ouvert : le polling /admin/pulse est alors suspendu. */
let liveConnected = false;
/** Filet de sécurité : pulse toutes les 30 s, uniquement quand le flux temps réel est coupé. */
const FALLBACK_POLL_MS = 30_000;

function domainStamp(p: Pulse, domain: CacheDomain) {
  if (domain === 'overview') return `${p.catalog}|${p.orders}`;
  return p[domain];
}

export async function fetchPulse(force = false): Promise<Pulse> {
  const r = await api<Pulse>('/admin/pulse');
  pulse = {
    stamp: r.stamp,
    catalog: r.catalog ?? r.stamp,
    orders: r.orders ?? r.stamp,
    floor: r.floor ?? r.stamp,
    staff: r.staff ?? r.stamp,
    clients: r.clients ?? r.stamp,
  };
  pulseListeners.forEach((fn) => fn(force));
  return pulse;
}

export function getPulse() {
  return pulse;
}

export function setLiveConnected(value: boolean) {
  liveConnected = value;
}

/**
 * Invalidation ciblée par le flux temps réel : change le tampon des domaines touchés, ce qui fait
 * recharger (une fois, via useCachedResource / useLiveSync) les listes et fiches concernées.
 */
export function bumpDomains(domains: CacheDomain[], tag: string) {
  if (!domains.length) return;
  if (!pulse) {
    void fetchPulse(true).catch(() => undefined);
    return;
  }
  const next: Pulse = { ...pulse };
  for (const d of domains) {
    if (d !== 'overview') next[d] = `live:${tag}:${d}`;
  }
  next.stamp = [next.catalog, next.orders, next.floor, next.staff, next.clients].join('|');
  pulse = next;
  pulseListeners.forEach((fn) => fn(false));
}

export function startAdminCache() {
  if (started) return;
  started = true;

  const tick = () => {
    if (liveConnected) return;
    void fetchPulse().catch(() => undefined);
  };

  const onVis = () => {
    if (document.visibilityState === 'visible') tick();
  };

  window.addEventListener(LIVE_EVENT, () => {
    void fetchPulse(true).catch(() => {
      pulseListeners.forEach((fn) => fn(true));
    });
  });
  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', onVis);

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(LIVE_CHANNEL);
    bc.onmessage = () => tick();
  } catch {
    /* ignore */
  }

  void fetchPulse().catch(() => undefined);
  pollId = window.setInterval(tick, FALLBACK_POLL_MS);

  window.addEventListener('beforeunload', () => {
    window.clearInterval(pollId);
    bc?.close();
  });
}

export function subscribePulse(fn: (force: boolean) => void) {
  pulseListeners.add(fn);
  return () => {
    pulseListeners.delete(fn);
  };
}

async function loadKey<T>(key: string, path: string, stamp: string, force: boolean): Promise<T> {
  const mem = memory.get(key) as CacheSnap<T> | undefined;
  if (!force && mem && mem.stamp === stamp) return mem.payload;

  if (!force) {
    const disk = mem ?? (await readSnap<T>(key));
    if (disk) {
      memory.set(key, disk);
      if (disk.stamp === stamp) return disk.payload;
    }
  }

  const payload = await api<T>(path);
  const snap: CacheSnap<T> = { key, stamp, payload, at: Date.now() };
  memory.set(key, snap);
  void writeSnap(snap);
  return payload;
}

export async function warmAdminCache(keys: { key: string; path: string; domain: CacheDomain }[]) {
  const p = pulse ?? (await fetchPulse().catch(() => null));
  if (!p) return;
  await Promise.all(
    keys.map(async ({ key, path, domain }) => {
      try {
        await loadKey(key, path, domainStamp(p, domain), false);
      } catch {
        /* hors ligne : rester sur le cache */
      }
    }),
  );
}

export function useCachedResource<T>(key: string, path: string, domain: CacheDomain, enabled = true) {
  const [data, setData] = useState<T | null>(() => (memory.get(key)?.payload as T | undefined) ?? null);
  const [busy, setBusy] = useState(!memory.has(key));
  const pathRef = useRef(path);
  pathRef.current = path;
  const stampRef = useRef('');

  useEffect(() => {
    stampRef.current = '';
  }, [key]);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled) return;
      const cached = memory.get(key) as CacheSnap<T> | undefined;
      if (cached) setData(cached.payload);
      else {
        const disk = await readSnap<T>(key);
        if (disk) {
          memory.set(key, disk);
          setData(disk.payload);
          stampRef.current = disk.stamp;
        } else {
          setBusy(true);
        }
      }
      const p = pulse ?? (await fetchPulse().catch(() => null));
      const stamp = p ? domainStamp(p, domain) : stampRef.current || '0';
      if (!force && stampRef.current === stamp && memory.has(key)) {
        setBusy(false);
        return;
      }
      try {
        const payload = await loadKey<T>(key, pathRef.current, stamp, force);
        stampRef.current = stamp;
        setData(payload);
      } catch {
        /* garder le cache affiché */
      } finally {
        setBusy(false);
      }
    },
    [key, domain, enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return subscribePulse((force) => {
      void refresh(force);
    });
  }, [enabled, refresh]);

  return { data, busy, refresh };
}

export function needleOf(q: string) {
  return q.trim().toLowerCase();
}

export function textMatch(needle: string, ...parts: Array<string | number | null | undefined>) {
  if (!needle) return true;
  return parts.some((part) => String(part ?? '').toLowerCase().includes(needle));
}
