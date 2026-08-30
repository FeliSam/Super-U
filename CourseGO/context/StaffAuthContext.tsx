import { loadAuthToken, persistAuthToken, setAuthToken, errorMessage, STAFF_CACHE_KEY, ApiError } from '@/lib/api/http';
import { opsLogin, opsMe, type Staff } from '@/lib/api/ops';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AuthValue = {
  ready: boolean;
  staff: Staff | null;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
  applyStaff: (staff: Staff) => void;
  demoHint: { email: string; phone: string; password: string };
};

const Ctx = createContext<AuthValue | null>(null);

function cacheStaff(staff: Staff | null) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (staff) localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(staff));
      else localStorage.removeItem(STAFF_CACHE_KEY);
    }
  } catch {
    /* ignore */
  }
  if (staff) void AsyncStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(staff)).catch(() => undefined);
  else void AsyncStorage.removeItem(STAFF_CACHE_KEY).catch(() => undefined);
}

async function readCachedStaff(): Promise<Staff | null> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STAFF_CACHE_KEY);
      if (raw) return JSON.parse(raw) as Staff;
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = await AsyncStorage.getItem(STAFF_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Staff) : null;
  } catch {
    return null;
  }
}

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [staff, setStaff] = useState<Staff | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const token = await loadAuthToken();
        if (!token) {
          setStaff(null);
          return;
        }
        setAuthToken(token);
        const cached = await readCachedStaff();
        if (cached) setStaff(cached);
        try {
          const me = await opsMe();
          setStaff(me.staff);
          cacheStaff(me.staff);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            await persistAuthToken(null);
            cacheStaff(null);
            setStaff(null);
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    try {
      const digits = identifier.replace(/\D/g, '').replace(/^229/, '');
      const mapped =
        digits === '0140000002' || digits === '140000002'
          ? 'courier@marchedore.bj'
          : identifier.trim();
      const res = await opsLogin(mapped.includes('@') ? mapped.toLowerCase() : identifier.trim(), password);
      await persistAuthToken(res.token);
      cacheStaff(res.staff);
      setStaff(res.staff);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: errorMessage(e) };
    }
  }, []);

  const signOut = useCallback(async () => {
    await persistAuthToken(null);
    cacheStaff(null);
    setStaff(null);
  }, []);

  const applyStaff = useCallback((next: Staff) => {
    setStaff(next);
    cacheStaff(next);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      staff,
      signIn,
      signOut,
      applyStaff,
      demoHint: { email: 'courier@marchedore.bj', phone: '01 40 00 00 02', password: 'marche2024' },
    }),
    [ready, staff, signIn, signOut, applyStaff],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaffAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StaffAuthProvider missing');
  return v;
}
