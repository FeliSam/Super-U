const TOKEN_KEY = 'marche-admin-token';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; ok?: boolean };
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export function formatFcfa(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} F`;
}
