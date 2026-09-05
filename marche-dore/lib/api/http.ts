import { appStorage } from '@/lib/db/kv';
import { setShopSessionPeek } from '@/lib/sessionPeek';
import { showToast } from '@/lib/toastBus';
import { getApiBaseUrl, loopbackApiHint, ensureReachableApiBase } from '@/lib/api/apiBase';

export {
  getApiBaseUrl,
  loadApiBaseOverride,
  persistApiBaseOverride,
  getSuggestedApiBaseUrl,
  subscribeApiBase,
  isLoopbackApiUrl,
  loopbackApiHint,
  ensureReachableApiBase,
  listApiBaseCandidates,
} from '@/lib/api/apiBase';

export const AUTH_TOKEN_KEY = 'marche-dore.auth.token.v1';

const HEALTH_MS = 2500;
const REQUEST_MS = 8000;

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export async function loadAuthToken() {
  try {
    if (typeof localStorage !== 'undefined') {
      const web = localStorage.getItem(AUTH_TOKEN_KEY);
      if (web) {
        authToken = web;
        void appStorage.setItem(AUTH_TOKEN_KEY, web).catch(() => undefined);
        return web;
      }
    }
  } catch {
    /* ignore */
  }
  const token = await appStorage.getItem(AUTH_TOKEN_KEY);
  authToken = token;
  try {
    if (token && typeof localStorage !== 'undefined') localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  return token;
}

export async function persistAuthToken(token: string | null) {
  authToken = token;
  try {
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
      else localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
  if (token) {
    setShopSessionPeek(true);
    await appStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    await appStorage.removeItem(AUTH_TOKEN_KEY);
  }
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

function unreachableMessage() {
  const api = getApiBaseUrl();
  const tip = loopbackApiHint(api);
  if (tip) return `API injoignable (${api}). ${tip}`;
  return `API injoignable (${api}). Vérifiez npm run dev:api et le Wi‑Fi (même réseau).`;
}

export async function apiAvailable(): Promise<boolean> {
  const base = await ensureReachableApiBase(HEALTH_MS);
  return Boolean(base);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function friendlyError(message: string) {
  const m = message.toLowerCase();
  if (/supabase|postgrest|jwt expired|invalid api key/.test(m)) {
    return 'Erreur de connexion données (Supabase). Réessayez dans un instant.';
  }
  if (/duplicate key|unique constraint|already exists/.test(m)) {
    return 'Cette information est déjà enregistrée.';
  }
  if (/relation .* does not exist|syntax error|postgres|sqlstate/.test(m)) {
    return 'Erreur serveur. Réessayez, ou contactez le support si ça continue.';
  }
  return message;
}

function shouldToastApiError(path: string, method: string | undefined, status: number) {
  if (status === 401 || status === 409) return false;
  const m = (method ?? 'GET').toUpperCase();
  const p = path.split('?')[0] ?? path;
  if (m === 'GET' || m === 'HEAD') {
    if (/\/catalog|\/stores|\/me\/orders|\/comms\/|\/health/.test(p)) return false;
  }
  return true;
}

function toastMutationError(method: string | undefined, err: ApiError, path = '') {
  if (!shouldToastApiError(path, method, err.status)) return;
  showToast({ title: 'Erreur', body: friendlyError(err.message), tone: 'error' });
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('ngrok-skip-browser-warning', '1');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  else if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(AUTH_TOKEN_KEY);
      if (stored) {
        authToken = stored;
        headers.set('Authorization', `Bearer ${stored}`);
      }
    } catch {
      /* ignore */
    }
  }

  let res: Response;
  try {
    res = await withTimeout(`${getApiBaseUrl()}${path}`, { ...init, headers }, REQUEST_MS);
  } catch (e) {
    const err = new ApiError(
      e instanceof Error && /abort|timeout/i.test(e.message)
        ? `API trop lente (${getApiBaseUrl()}). Vérifiez npm run dev:api (port 8787).`
        : unreachableMessage(),
      0,
      null,
    );
    toastMutationError(init.method, err, path);
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
        ? `Réponse invalide (HTTP ${code}). Vérifiez l’API SuperU (port 8787).`
        : unreachableMessage(),
      code,
      text,
    );
    toastMutationError(init.method, err, path);
    throw err;
  }
  if (!res.ok) {
    const message =
      typeof (data as { error?: string }).error === 'string'
        ? (data as { error: string }).error
        : `HTTP ${res.status}`;
    const err = new ApiError(message, res.status, data);
    toastMutationError(init.method, err, path);
    throw err;
  }
  return data;
}
