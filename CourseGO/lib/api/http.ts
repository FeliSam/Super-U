import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { showToast } from '@/lib/toastBus';

export const AUTH_TOKEN_KEY = 'coursego.ops.token.v1';
export const STAFF_CACHE_KEY = 'coursego.ops.staff.v1';
const REQUEST_MS = 12000;
let authToken: string | null = null;

function webGet(key: string) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function webSet(key: string, value: string | null) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function persistAuthToken(token: string | null) {
  authToken = token;
  webSet(AUTH_TOKEN_KEY, token);
  try {
    if (token) await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    else await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* session still in memory + localStorage */
  }
}

export async function loadAuthToken() {
  const fromWeb = webGet(AUTH_TOKEN_KEY);
  if (fromWeb) {
    authToken = fromWeb;
    void AsyncStorage.setItem(AUTH_TOKEN_KEY, fromWeb).catch(() => undefined);
    return fromWeb;
  }
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    authToken = token;
    if (token) webSet(AUTH_TOKEN_KEY, token);
    return token;
  } catch {
    return authToken;
  }
}

function lanHost(): string | null {
  if (typeof window !== 'undefined') {
    const host = window.location?.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  }
  if (Platform.OS === 'web') return null;
  try {
    const hostUri = Constants.expoConfig?.hostUri ?? Constants.linkingUri ?? '';
    const host = hostUri.replace(/^[a-z]+:\/\//i, '').split(':')[0]?.split('/')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  } catch {
    /* ignore */
  }
  return null;
}

function configuredApiUrl() {
  return (process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '').replace('localhost', '127.0.0.1');
}

export function getApiBaseUrl(): string {
  const configured = configuredApiUrl();
  const host = lanHost();
  if (host) return configured.replace(/localhost|127\.0\.0\.1/g, host);
  return configured;
}

async function withTimeout(input: RequestInfo, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as Error).message === 'string') {
    const m = (e as Error).message;
    if (/abort|timeout/i.test(m)) {
      return `API trop lente (${configuredApiUrl()}). Vérifiez npm run dev:api (port 8787).`;
    }
    if (/fetch|network|failed/i.test(m)) {
      return `API injoignable (${configuredApiUrl()}). À la racine SuperU : npm run dev:api`;
    }
    return m;
  }
  return `API injoignable (${configuredApiUrl()}). À la racine SuperU : npm run dev:api`;
}

function friendlyError(message: string) {
  const m = message.toLowerCase();
  if (/supabase|postgrest|jwt expired|invalid api key/.test(m)) {
    return 'Erreur de connexion données (Supabase). Réessayez dans un instant.';
  }
  if (/duplicate key|unique constraint|already exists/.test(m)) {
    return 'Cette information est déjà enregistrée.';
  }
  if (/econnrefused|enotfound|network|failed to fetch|api injoignable/.test(m)) {
    return message;
  }
  if (/relation .* does not exist|syntax error|postgres|sqlstate/.test(m)) {
    return 'Erreur serveur. Réessayez, ou contactez le support si ça continue.';
  }
  return message;
}

function shouldToastApiError(path: string, method: string | undefined, status: number) {
  if (status === 401) return false;
  const m = (method ?? 'GET').toUpperCase();
  const p = path.split('?')[0] ?? path;
  if (m === 'GET' || m === 'HEAD') {
    if (
      /\/ops\/(pick-jobs|deliveries|notifications|map-stores|history|earnings|me)|\/comms\/(inbox|live|ringing|threads)|\/catalog|\/stores|\/health|\/me\/orders/.test(
        p,
      )
    ) {
      return false;
    }
  }
  return true;
}

function toastApiFailure(path: string, method: string | undefined, err: ApiError) {
  if (!shouldToastApiError(path, method, err.status)) return;
  showToast({ title: 'Erreur', body: friendlyError(err.message), tone: 'error' });
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  else {
    const stored = webGet(AUTH_TOKEN_KEY);
    if (stored) {
      authToken = stored;
      headers.set('Authorization', `Bearer ${stored}`);
    }
  }
  let res: Response;
  try {
    res = await withTimeout(`${getApiBaseUrl()}${path}`, { ...init, headers }, REQUEST_MS);
  } catch (e) {
    const err = new ApiError(errorMessage(e), 0);
    toastApiFailure(path, init.method, err);
    throw err;
  }
  const text = await res.text();
  let data: T & { error?: string };
  try {
    data = (text ? JSON.parse(text) : {}) as T & { error?: string };
  } catch {
    const code = res.status || 0;
    const err = new ApiError(
      code
        ? `Réponse API invalide (HTTP ${code}). Vérifiez que l’API SuperU tourne sur le port 8787.`
        : 'API injoignable. À la racine SuperU : npm run dev:api',
      code,
    );
    toastApiFailure(path, init.method, err);
    throw err;
  }
  if (!res.ok) {
    const err = new ApiError(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`, res.status);
    toastApiFailure(path, init.method, err);
    throw err;
  }
  return data;
}
