import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const AUTH_TOKEN_KEY = 'coursego.ops.token.v1';
const REQUEST_MS = 12000;
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function persistAuthToken(token: string | null) {
  authToken = token;
  try {
    if (token) await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    else await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* web private mode / storage quota — session still works in memory */
  }
}

export async function loadAuthToken() {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    authToken = token;
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
  // Sur le web, Metro (8082) relaie /ops /comms /catalog vers SuperU :8787.
  // Ça évite le blocage du navigateur (IPv6, aperçu Cursor, réseau privé).
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return '';
  }
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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  let res: Response;
  try {
    res = await withTimeout(`${getApiBaseUrl()}${path}`, { ...init, headers }, REQUEST_MS);
  } catch (e) {
    throw new ApiError(errorMessage(e), 0);
  }
  const text = await res.text();
  let data: T & { error?: string };
  try {
    data = (text ? JSON.parse(text) : {}) as T & { error?: string };
  } catch {
    throw new ApiError(`Réponse API invalide (HTTP ${res.status})`, res.status);
  }
  if (!res.ok) {
    throw new ApiError(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`, res.status);
  }
  return data;
}
