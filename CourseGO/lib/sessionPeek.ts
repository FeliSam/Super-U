import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'coursego.ops.token.v1';
const STAFF_KEY = 'coursego.ops.staff.v1';

let cachedHas: boolean | null = null;
let hydratePromise: Promise<void> | null = null;

function webHas(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem(TOKEN_KEY) || localStorage.getItem(STAFF_KEY));
  } catch {
    return false;
  }
}

export function peekStaffHasSession(): boolean {
  if (cachedHas != null) return cachedHas;
  if (Platform.OS === 'web') {
    cachedHas = webHas();
    return cachedHas;
  }
  return false;
}

export function setStaffSessionPeek(has: boolean) {
  cachedHas = has;
}

export function hydrateStaffSessionPeek(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        if (Platform.OS === 'web') {
          cachedHas = webHas();
          return;
        }
        const [token, staff] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(STAFF_KEY),
        ]);
        cachedHas = Boolean(token || staff);
      } catch {
        cachedHas = false;
      }
    })();
  }
  return hydratePromise;
}

void hydrateStaffSessionPeek();
