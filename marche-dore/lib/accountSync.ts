import { apiFetch, getAuthToken } from '@/lib/api/http';
import { appStorage } from '@/lib/db/kv';

export type AccountPrefs = {
  theme?: 'light' | 'dark' | 'system';
  pushEnabled?: boolean;
  smsEnabled?: boolean;
  emailEnabled?: boolean;
  promoEnabled?: boolean;
  interests?: string[];
  alertsOn?: boolean;
  preferredStoreId?: string;
  searchRecents?: string[];
  homeActiveChipId?: string;
};

export type AccountState = {
  birthDate?: string;
  photoUri?: string;
  favorites?: string[];
  addresses?: { list?: unknown[]; selectedId?: string };
  payments?: unknown[];
  notifications?: unknown[];
  reviews?: { userReviews?: unknown; courierReviews?: unknown };
  chat?: { threads?: unknown; meta?: unknown };
  prefs?: AccountPrefs;
  loyaltyBonusPts?: number;
  redeemedRewardIds?: string[];
};

export function accountKey(base: string, accountId: string | null | undefined) {
  return `${base}:${accountId || 'signed-out'}`;
}

export async function loadAccountJson<T>(base: string, accountId: string | null | undefined): Promise<T | null> {
  if (!accountId) return null;
  try {
    const raw = await appStorage.getItem(accountKey(base, accountId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveAccountJson(base: string, accountId: string | null | undefined, value: unknown) {
  if (!accountId) return;
  await appStorage.setItem(accountKey(base, accountId), JSON.stringify(value));
}

export async function apiGetAccountState(): Promise<AccountState | null> {
  if (!getAuthToken()) return null;
  try {
    const res = await apiFetch<{ ok: true; state: AccountState }>('/me/state');
    return res.state && typeof res.state === 'object' ? res.state : {};
  } catch {
    return null;
  }
}

const patchTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function apiPatchAccountState(partial: Partial<AccountState>) {
  if (!getAuthToken()) return;
  const key = Object.keys(partial).sort().join(',');
  const prev = patchTimers.get(key);
  if (prev) clearTimeout(prev);
  patchTimers.set(
    key,
    setTimeout(() => {
      patchTimers.delete(key);
      void apiFetch('/me/state', {
        method: 'PATCH',
        body: JSON.stringify(partial),
      }).catch(() => undefined);
    }, 400),
  );
}
