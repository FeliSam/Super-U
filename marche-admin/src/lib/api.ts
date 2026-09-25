const TOKEN_KEY = 'marche-admin-token';
const LIVE_CHANNEL = 'marche-admin-live';
const LIVE_EVENT = 'admin:changed';

function resolveApiUrl() {
  const env = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  if (env) return env;
  if (import.meta.env.DEV) return '';
  if (typeof window !== 'undefined') {
    // Servi par l'API elle-même (https://api.moxtapp.ru/panel/) : même origine, pas de CORS.
    const base = import.meta.env.BASE_URL || '/';
    if (base !== '/' && window.location.pathname.startsWith(base.replace(/\/$/, ''))) return '';
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${window.location.protocol}//${host}:8787`;
    }
  }
  return 'http://127.0.0.1:8787';
}

export const API_URL = resolveApiUrl();

export function mediaUrl(path: string) {
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function notifyAdminChanged() {
  window.dispatchEvent(new Event(LIVE_EVENT));
  try {
    const bc = new BroadcastChannel(LIVE_CHANNEL);
    bc.postMessage(Date.now());
    bc.close();
  } catch {
    /* ignore */
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  headers.set('ngrok-skip-browser-warning', '1');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      API_URL
        ? `Connexion à l’API impossible (${API_URL}). Vérifiez que le serveur tourne.`
        : 'Connexion à l’API impossible. Vérifiez votre connexion puis réessayez.',
    );
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; ok?: boolean };
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') notifyAdminChanged();
  return data;
}

export function formatFcfa(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} F`;
}
