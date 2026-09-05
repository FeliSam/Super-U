import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const API_BASE_OVERRIDE_KEY = 'coursego.apiBase.v1';

let memoryOverride: string | null = null;
const listeners = new Set<() => void>();

function normalizeBase(url: string) {
  return url.trim().replace(/\/$/, '').replace('localhost', '127.0.0.1');
}

function isLoopbackHost(host: string) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function isPrivateLanHost(host: string) {
  if (isLoopbackHost(host)) return true;
  return (
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/** HTTPS public (ngrok / Cloudflare tunnel / prod) — pas une IP LAN. */
export function isPublicApiUrl(url: string) {
  try {
    const u = new URL(url.includes('://') ? url : `http://${url}`);
    return u.protocol === 'https:' && !isPrivateLanHost(u.hostname);
  } catch {
    return /^https:\/\//i.test(url);
  }
}

export function isLoopbackApiUrl(url: string) {
  try {
    const u = new URL(url.includes('://') ? url : `http://${url}`);
    return isLoopbackHost(u.hostname);
  } catch {
    return /127\.0\.0\.1|localhost/i.test(url);
  }
}

function isPrivateLanApiUrl(url: string) {
  try {
    const u = new URL(url.includes('://') ? url : `http://${url}`);
    return isPrivateLanHost(u.hostname);
  } catch {
    return false;
  }
}

function extractHost(raw: string): string | null {
  const cleaned = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const host = cleaned.split('/')[0]?.split('?')[0]?.split(':')[0]?.trim();
  if (!host || isLoopbackHost(host)) return null;
  if (host.endsWith('.exp.direct') || host.includes('exp.host')) return null;
  return host;
}

/** IP / hostname du packager Expo (téléphone → PC), jamais 127.0.0.1. */
export function discoverLanHost(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const h = window.location?.hostname;
    if (h && !isLoopbackHost(h)) return h;
  }

  const c = Constants as unknown as {
    expoConfig?: { hostUri?: string; extra?: { lanHost?: string } };
    linkingUri?: string;
    expoGoConfig?: { debuggerHost?: string };
    manifest?: { debuggerHost?: string; hostUri?: string };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
  };

  const baked = c.expoConfig?.extra?.lanHost;
  if (baked && !isLoopbackHost(baked)) return baked;

  const candidates = [
    c.expoGoConfig?.debuggerHost,
    c.manifest2?.extra?.expoGo?.debuggerHost,
    c.manifest?.debuggerHost,
    c.manifest?.hostUri,
    c.expoConfig?.hostUri,
    c.linkingUri,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const host = extractHost(String(raw));
    if (host) return host;
  }
  return null;
}

function configuredFromEnv(): string {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  const fromExtra = typeof extra?.apiUrl === 'string' ? extra.apiUrl.trim() : '';
  const fromEnv = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  return normalizeBase(fromExtra || fromEnv || 'http://127.0.0.1:8787');
}

export function getApiBaseUrl(): string {
  const configured = configuredFromEnv();

  // Build / tunnel HTTPS : ignore une ancienne IP LAN sauvée dans ApiHostEditor
  if (memoryOverride) {
    if (!(isPublicApiUrl(configured) && isPrivateLanApiUrl(memoryOverride))) {
      return memoryOverride;
    }
  }

  if (!isLoopbackApiUrl(configured)) return configured;

  const lan = discoverLanHost();
  if (lan) return configured.replace(/localhost|127\.0\.0\.1/g, lan);

  // Expo Go : passer par le packager (CourseGO metro proxy /ops, /comms, …)
  if (Constants.appOwnership === 'expo') {
    const c = Constants as unknown as { expoGoConfig?: { debuggerHost?: string }; expoConfig?: { hostUri?: string } };
    const packager = c.expoGoConfig?.debuggerHost || c.expoConfig?.hostUri;
    if (packager && !isLoopbackHost(packager.split(':')[0] || '')) {
      return `http://${packager.replace(/\/$/, '')}`;
    }
  }

  return configured;
}

export function getSuggestedApiBaseUrl(): string {
  const configured = configuredFromEnv();
  if (isPublicApiUrl(configured)) return configured;
  const lan = discoverLanHost() || (Constants.expoConfig?.extra as { lanHost?: string } | undefined)?.lanHost;
  if (lan) return `http://${lan}:8787`;
  return configured;
}

/** Candidates: override → env/tunnel → LAN → Metro proxy → packager. */
export function listApiBaseCandidates(): string[] {
  const out: string[] = [];
  const add = (u: string | null | undefined) => {
    if (!u) return;
    const n = normalizeBase(u);
    if (n && !out.includes(n)) out.push(n);
  };

  const configured = configuredFromEnv();
  add(memoryOverride);
  add(configured);
  add(getSuggestedApiBaseUrl());

  if (!isPublicApiUrl(configured)) {
    const lan = discoverLanHost();
    if (lan) {
      add(`http://${lan}:8787`);
      add(`http://${lan}:8082`);
      add(`http://${lan}:8081`);
    }
  }

  add(getApiBaseUrl());

  if (Constants.appOwnership === 'expo' && !isPublicApiUrl(configured)) {
    const c = Constants as unknown as { expoGoConfig?: { debuggerHost?: string }; expoConfig?: { hostUri?: string } };
    const packager = c.expoGoConfig?.debuggerHost || c.expoConfig?.hostUri;
    if (packager) add(`http://${packager.replace(/\/$/, '')}`);
  }

  if (Platform.OS === 'web') {
    add('http://127.0.0.1:8787');
    add('http://localhost:8787');
  }

  return out;
}

async function probeHealth(base: string, ms: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'ngrok-skip-browser-warning': '1' },
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return body?.ok === true || res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Essaie plusieurs bases API ; mémorise la première qui répond. */
export async function ensureReachableApiBase(timeoutMs = 1800): Promise<string | null> {
  const current = getApiBaseUrl();
  if (await probeHealth(current, timeoutMs)) return current;

  // Build tunnel : ne pas basculer vers une IP LAN si l’API publique est configurée
  const configured = configuredFromEnv();
  if (isPublicApiUrl(configured)) {
    if (await probeHealth(configured, timeoutMs)) {
      memoryOverride = null;
      emit();
      return configured;
    }
    return null;
  }

  for (const base of listApiBaseCandidates()) {
    if (base === current) continue;
    if (await probeHealth(base, timeoutMs)) {
      memoryOverride = base;
      emit();
      return base;
    }
  }
  return null;
}

export function subscribeApiBase(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function setApiBaseOverride(url: string | null) {
  memoryOverride = url ? normalizeBase(url) : null;
  emit();
}

export async function loadApiBaseOverride(): Promise<string | null> {
  try {
    if (typeof localStorage !== 'undefined') {
      const web = localStorage.getItem(API_BASE_OVERRIDE_KEY);
      if (web) {
        memoryOverride = normalizeBase(web);
        void AsyncStorage.setItem(API_BASE_OVERRIDE_KEY, memoryOverride).catch(() => undefined);
        emit();
        return memoryOverride;
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const stored = await AsyncStorage.getItem(API_BASE_OVERRIDE_KEY);
    if (stored) {
      memoryOverride = normalizeBase(stored);
      emit();
      return memoryOverride;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function persistApiBaseOverride(url: string | null): Promise<string> {
  const next = url ? normalizeBase(url) : null;
  memoryOverride = next;
  try {
    if (typeof localStorage !== 'undefined') {
      if (next) localStorage.setItem(API_BASE_OVERRIDE_KEY, next);
      else localStorage.removeItem(API_BASE_OVERRIDE_KEY);
    }
  } catch {
    /* ignore */
  }
  try {
    if (next) await AsyncStorage.setItem(API_BASE_OVERRIDE_KEY, next);
    else await AsyncStorage.removeItem(API_BASE_OVERRIDE_KEY);
  } catch {
    /* ignore */
  }
  emit();
  return getApiBaseUrl();
}

export function loopbackApiHint(url: string = getApiBaseUrl()): string | null {
  if (Platform.OS === 'web') return null;
  if (!isLoopbackApiUrl(url)) return null;
  const tip = getSuggestedApiBaseUrl();
  return `Sur téléphone, 127.0.0.1 = cet appareil. Utilisez l’IP du PC, ex. ${tip}`;
}
