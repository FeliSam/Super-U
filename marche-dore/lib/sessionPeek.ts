import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SESSION_KEY = 'marche-dore.auth.session.v1';
const TOKEN_KEY = 'marche-dore.auth.token.v1';

let cachedHas: boolean | null = null;
let hydratePromise: Promise<void> | null = null;

function webGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Sync peek for route bootstrap + AuthGate (évite flash login). */
export function peekShopSessionRaw(): string | null {
  if (Platform.OS === 'web') return webGet(SESSION_KEY);
  return null;
}

export function peekShopHasSession(): boolean {
  if (cachedHas != null) return cachedHas;
  if (Platform.OS === 'web') {
    cachedHas = Boolean(peekShopSessionRaw() || webGet(TOKEN_KEY));
    return cachedHas;
  }
  return false;
}

export function setShopSessionPeek(has: boolean) {
  cachedHas = has;
}

export function writeShopSessionRaw(value: string | null) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (value) localStorage.setItem(SESSION_KEY, value);
      else localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* private mode */
  }
  cachedHas = Boolean(value);
}

/** Lit AsyncStorage tôt pour skip login sur iOS/Android. */
export function hydrateShopSessionPeek(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        if (Platform.OS === 'web') {
          cachedHas = Boolean(peekShopSessionRaw() || webGet(TOKEN_KEY));
          return;
        }
        const [session, token] = await Promise.all([
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(TOKEN_KEY),
        ]);
        cachedHas = Boolean(session || token);
      } catch {
        cachedHas = false;
      }
    })();
  }
  return hydratePromise;
}

void hydrateShopSessionPeek();
