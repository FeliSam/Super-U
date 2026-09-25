import { loadAuthToken, persistAuthToken, setAuthToken, errorMessage, STAFF_CACHE_KEY, ApiError, getApiBaseUrl, loadApiBaseOverride, ensureReachableApiBase } from '@/lib/api/http';
import { opsLogin, opsMe, type Staff } from '@/lib/api/ops';
import {
  isLocalOfflineToken,
  localOfflineTokenFor,
  matchLocalStaff,
} from '@/lib/localAuth';
import { setStaffSessionPeek } from '@/lib/sessionPeek';
import { showToast } from '@/lib/toastBus';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AuthValue = {
  ready: boolean;
  staff: Staff | null;
  /** true = session locale (API down). */
  offline: boolean;
  sessionNotice: string | null;
  clearSessionNotice: () => void;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
  applyStaff: (staff: Staff) => void;
  demoHint: { email: string; phone: string; password: string };
};

const Ctx = createContext<AuthValue | null>(null);

function cacheStaff(staff: Staff | null) {
  setStaffSessionPeek(Boolean(staff));
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

async function markOnboardingDone(staffId: string) {
  const keys = [`coursego.welcome.${staffId}`, `coursego.perms.${staffId}`];
  for (const key of keys) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    await AsyncStorage.setItem(key, '1').catch(() => undefined);
  }
}

function explainBootFailure(e: unknown): string {
  const api = getApiBaseUrl();
  if (e instanceof ApiError) {
    if (e.status === 401) {
      return `Session expirée ou rejetée par l’API (${api}). Reconnectez-vous.`;
    }
    if (e.status === 0) {
      return `API injoignable (${api}). Mode local possible avec le compte démo.`;
    }
    return `${e.message} (${api})`;
  }
  return `${errorMessage(e)} (${api})`;
}

function isNetworkish(e: unknown) {
  if (e instanceof ApiError) return e.status === 0 || e.status >= 500;
  return true;
}

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  try {
    if (typeof localStorage !== 'undefined') {
      const t = localStorage.getItem('coursego.ops.token.v1');
      if (t) setAuthToken(t);
    }
  } catch {
    /* ignore */
  }
  const [staff, setStaff] = useState<Staff | null>(() => {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(STAFF_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Staff) : null;
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(() => staff != null);
  const [offline, setOffline] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  useEffect(() => {
    void (async () => {
      try {
        await loadApiBaseOverride();
        await ensureReachableApiBase(1600);
        const token = await loadAuthToken();
        const cached = await readCachedStaff();

        if (isLocalOfflineToken(token) && cached) {
          setAuthToken(token);
          setStaff(cached);
          setOffline(true);
          setSessionNotice('Mode local — API SuperU indisponible.');
          return;
        }

        if (!token) {
          setStaff(null);
          setOffline(false);
          return;
        }

        setAuthToken(token);
        if (cached) setStaff(cached);
        try {
          const me = await opsMe();
          setStaff(me.staff);
          cacheStaff(me.staff);
          setOffline(false);
          setSessionNotice(null);
        } catch (e) {
          const msg = explainBootFailure(e);
          if (e instanceof ApiError && e.status === 401) {
            await persistAuthToken(null);
            cacheStaff(null);
            setStaff(null);
            setOffline(false);
            setSessionNotice(msg);
            showToast({ title: 'Déconnecté', body: msg, tone: 'error', durationMs: 8000 });
            return;
          }
          if (cached) {
            setStaff(cached);
            setOffline(true);
            setSessionNotice(msg);
            showToast({
              title: 'Mode local',
              body: 'API indisponible — session conservée hors-ligne.',
              tone: 'info',
              durationMs: 6000,
            });
          } else {
            setSessionNotice(msg);
            showToast({ title: 'Connexion impossible', body: msg, tone: 'error', durationMs: 8000 });
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const enterLocal = useCallback(async (local: Staff) => {
    const token = localOfflineTokenFor(local.id);
    await persistAuthToken(token);
    await markOnboardingDone(local.id);
    cacheStaff(local);
    setStaff(local);
    setOffline(true);
    setSessionNotice('Mode local — données démo, API coupée.');
    showToast({
      title: 'Mode local',
      body: 'Serveur indisponible. Connexion démo hors-ligne.',
      tone: 'info',
      durationMs: 5500,
    });
  }, []);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const digits = identifier.replace(/\D/g, '').replace(/^229/, '');
      const mapped =
        digits === '0140000002' || digits === '140000002'
          ? 'courier@marchedore.bj'
          : digits === '0140000001' || digits === '140000001'
            ? 'picker@marchedore.bj'
            : identifier.trim();
      const loginId = mapped.includes('@') ? mapped.toLowerCase() : identifier.trim();

      try {
        const res = await opsLogin(loginId, password);
        await persistAuthToken(res.token);
        cacheStaff(res.staff);
        setStaff(res.staff);
        setOffline(false);
        setSessionNotice(null);
        return { ok: true as const };
      } catch (e) {
        const local = matchLocalStaff(loginId, password) || matchLocalStaff(identifier, password);
        if (local && isNetworkish(e)) {
          await enterLocal(local);
          return { ok: true as const };
        }
        if (e instanceof ApiError && e.status === 401) {
          // Même hors-ligne : mauvais mdp → encore tenter le compte démo exact
          if (local) {
            await enterLocal(local);
            return { ok: true as const };
          }
          return { ok: false as const, error: 'Identifiants incorrects.' };
        }
        // 403 : compte en attente de validation / désactivé ; 429 : trop de tentatives.
        // Le message du serveur est déjà clair : on l'affiche tel quel, sans suggestion « compte démo ».
        if (e instanceof ApiError && (e.status === 403 || e.status === 429)) {
          return { ok: false as const, error: e.message };
        }
        if (local) {
          await enterLocal(local);
          return { ok: true as const };
        }
        return {
          ok: false as const,
          error: `${errorMessage(e)} — ou compte démo courier@ / marche2024 en local.`,
        };
      }
    },
    [enterLocal],
  );

  const signOut = useCallback(async () => {
    await persistAuthToken(null);
    cacheStaff(null);
    setStaff(null);
    setOffline(false);
    setSessionNotice(null);
  }, []);

  const applyStaff = useCallback((next: Staff) => {
    setStaff(next);
    cacheStaff(next);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      staff,
      offline,
      sessionNotice,
      clearSessionNotice,
      signIn,
      signOut,
      applyStaff,
      demoHint: { email: 'courier@marchedore.bj', phone: '01 40 00 00 02', password: 'marche2024' },
    }),
    [ready, staff, offline, sessionNotice, clearSessionNotice, signIn, signOut, applyStaff],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaffAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StaffAuthProvider missing');
  return v;
}
