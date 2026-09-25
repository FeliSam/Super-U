import { userProfile as seedProfile, type UserProfile } from '@/data/account';
import { apiCompleteOnboarding, apiLogin, apiMe, apiPatchProfile, apiRegister, type ApiUser } from '@/lib/api/auth';
import { apiAvailable, getAuthToken, loadAuthToken, loadApiBaseOverride, persistAuthToken, setAuthToken, ensureReachableApiBase } from '@/lib/api/http';
import { formatBeninPhone, isValidBeninPhone, nationalBeninDigits } from '@/lib/beninPhone';
import { appStorage as AsyncStorage } from '@/lib/db/kv';
import { peekShopHasSession, peekShopSessionRaw, setShopSessionPeek, writeShopSessionRaw } from '@/lib/sessionPeek';
import { DEV_OPEN_HOME, logDev, logDevError, makeDevDemoSession } from '@/lib/devBoot';
import { showToast } from '@/lib/toastBus';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const SESSION_KEY = 'marche-dore.auth.session.v1';
const ACCOUNTS_KEY = 'marche-dore.auth.accounts.v1';

export type AuthAccount = {
  id: string;
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

export type AuthSession = {
  accountId: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  onboardingDone: boolean;
  birthDate?: string;
  createdAt?: string;
};

type AuthResult = { ok: true } | { ok: false; error: string };

type AuthContextValue = {
  ready: boolean;
  session: AuthSession | null;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  /** Session sans API (comptes locaux / cache). */
  offline: boolean;
  /** Compte démo local (builds de dev uniquement, jamais affiché à l'écran). */
  demoHint: { email: string; password: string } | null;
  signIn: (identifier: string, password: string) => Promise<AuthResult>;
  signUp: (input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<AuthResult>;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
  applyProfile: (patch: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    birthDate?: string;
  }) => Promise<void>;
  toProfile: () => UserProfile | null;
};

const DEMO_ACCOUNT_ID = 'demo-amina';
/** Compte démo hors-ligne : builds de dev uniquement (retiré du bundle de prod via __DEV__). */
const DEV_DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEV_DEMO_PASSWORD || '';
const DEMO_ACCOUNT: AuthAccount | null =
  __DEV__ && DEV_DEMO_PASSWORD
    ? {
        id: DEMO_ACCOUNT_ID,
        email: 'demo@marchedore.bj',
        phone: seedProfile.phone,
        password: DEV_DEMO_PASSWORD,
        firstName: seedProfile.firstName,
        lastName: seedProfile.lastName,
        createdAt: '2024-03-01T00:00:00.000Z',
      }
    : null;
const SEED_ACCOUNTS: AuthAccount[] = DEMO_ACCOUNT ? [DEMO_ACCOUNT] : [];

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function accountMatches(account: AuthAccount, identifier: string) {
  const id = identifier.trim();
  if (!id) return false;
  if (id.includes('@')) return account.email === normalizeEmail(id);
  const needle = nationalBeninDigits(id);
  const hay = nationalBeninDigits(account.phone);
  return Boolean(needle && hay && needle === hay);
}

function sanitizeAccount(raw: unknown): AuthAccount | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<AuthAccount>;
  if (
    typeof a.id !== 'string' ||
    typeof a.email !== 'string' ||
    typeof a.phone !== 'string' ||
    typeof a.password !== 'string' ||
    typeof a.firstName !== 'string' ||
    typeof a.lastName !== 'string'
  ) {
    return null;
  }
  return {
    id: a.id,
    email: normalizeEmail(a.email),
    phone: a.phone,
    password: a.password,
    firstName: a.firstName.trim(),
    lastName: a.lastName.trim(),
    createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
  };
}

function sanitizeSession(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<AuthSession>;
  if (
    typeof s.accountId !== 'string' ||
    typeof s.email !== 'string' ||
    typeof s.firstName !== 'string' ||
    typeof s.lastName !== 'string'
  ) {
    return null;
  }
  return {
    accountId: s.accountId,
    email: normalizeEmail(s.email),
    phone: typeof s.phone === 'string' ? s.phone : '',
    firstName: s.firstName.trim(),
    lastName: s.lastName.trim(),
    onboardingDone: Boolean(s.onboardingDone),
    birthDate: typeof s.birthDate === 'string' ? s.birthDate : '',
    createdAt: typeof s.createdAt === 'string' ? s.createdAt : undefined,
  };
}

function sessionFromAccount(account: AuthAccount, onboardingDone: boolean): AuthSession {
  return {
    accountId: account.id,
    email: account.email,
    phone: account.phone,
    firstName: account.firstName,
    lastName: account.lastName,
    onboardingDone,
    birthDate: '',
    createdAt: account.createdAt,
  };
}

function sessionFromApiUser(user: ApiUser): AuthSession {
  return {
    accountId: user.id,
    email: normalizeEmail(user.email),
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    onboardingDone: user.onboardingDone,
    birthDate: user.birthDate ?? '',
    createdAt: user.createdAt ? String(user.createdAt) : undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => {
    if (DEV_OPEN_HOME) {
      const demo = makeDevDemoSession();
      writeShopSessionRaw(JSON.stringify(demo));
      return demo;
    }
    const raw = peekShopSessionRaw();
    if (!raw) return null;
    try {
      return sanitizeSession(JSON.parse(raw));
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(() => DEV_OPEN_HOME || session != null || peekShopHasSession());
  const [accounts, setAccounts] = useState<AuthAccount[]>(SEED_ACCOUNTS);
  const [offline, setOffline] = useState(Boolean(DEV_OPEN_HOME));
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadApiBaseOverride();
        try {
          await ensureReachableApiBase(1200);
        } catch {
          /* offline */
        }
        const [rawAccounts, rawSession] = await Promise.all([
          AsyncStorage.getItem(ACCOUNTS_KEY),
          AsyncStorage.getItem(SESSION_KEY),
          loadAuthToken(),
        ]);
        if (!active) return;

        let nextAccounts = SEED_ACCOUNTS;
        if (rawAccounts) {
          const parsed = JSON.parse(rawAccounts);
          if (Array.isArray(parsed)) {
            // Anciennes installations : le compte démo persisté est ignoré hors dev.
            const cleaned = (parsed.map(sanitizeAccount).filter(Boolean) as AuthAccount[]).filter(
              (a) => DEMO_ACCOUNT || a.id !== DEMO_ACCOUNT_ID,
            );
            const hasDemo = cleaned.some((a) => a.id === DEMO_ACCOUNT_ID);
            nextAccounts = DEMO_ACCOUNT && !hasDemo ? [DEMO_ACCOUNT, ...cleaned] : cleaned;
          }
        }
        setAccounts(nextAccounts);

        let localSession: AuthSession | null = null;
        if (rawSession) {
          try {
            localSession = sanitizeSession(JSON.parse(rawSession));
          } catch {
            localSession = null;
          }
        }

        if (localSession) {
          const next =
            DEV_OPEN_HOME && !localSession.onboardingDone
              ? { ...localSession, onboardingDone: true }
              : localSession;
          setSession(next);
          writeShopSessionRaw(JSON.stringify(next));
          if (getAuthToken()) {
            try {
              const remoteUser = await apiMe();
              if (!active) return;
              if (remoteUser) {
                const remote = sessionFromApiUser(remoteUser);
                setSession(DEV_OPEN_HOME ? { ...remote, onboardingDone: true } : remote);
                setOffline(false);
              } else {
                setOffline(true);
              }
            } catch (e) {
              logDevError('auth.apiMe', e);
              if (active) setOffline(true);
            }
          } else {
            setOffline(true);
          }
        } else if (getAuthToken()) {
          try {
            const remoteUser = await apiMe();
            if (!active) return;
            if (remoteUser) {
              const remote = sessionFromApiUser(remoteUser);
              setSession(DEV_OPEN_HOME ? { ...remote, onboardingDone: true } : remote);
              setOffline(false);
            } else if (DEV_OPEN_HOME) {
              setSession(makeDevDemoSession());
              setOffline(true);
            } else {
              setSession(null);
              writeShopSessionRaw(null);
            }
          } catch (e) {
            logDevError('auth.apiMe.token', e);
            if (!active) return;
            if (DEV_OPEN_HOME) {
              setSession(makeDevDemoSession());
              setOffline(true);
            } else {
              setSession(null);
              writeShopSessionRaw(null);
            }
          }
        } else if (DEV_OPEN_HOME) {
          const demo = makeDevDemoSession();
          setSession(demo);
          setOffline(true);
          writeShopSessionRaw(JSON.stringify(demo));
          logDev('auth: ouverture directe accueil (session démo)');
        } else {
          setSession(null);
          writeShopSessionRaw(null);
        }
      } catch (e) {
        logDevError('auth.hydrate', e);
        setAccounts(SEED_ACCOUNTS);
        if (DEV_OPEN_HOME) {
          setSession(makeDevDemoSession());
          setOffline(true);
        }
      } finally {
        if (active) {
          hydrated.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    void AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)).catch(() => {});
  }, [accounts]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (session) {
      const raw = JSON.stringify(session);
      writeShopSessionRaw(raw);
      void AsyncStorage.setItem(SESSION_KEY, raw).catch(() => {});
      return;
    }
    writeShopSessionRaw(null);
    void AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  }, [session]);

  const signIn = useCallback(
    async (identifier: string, password: string): Promise<AuthResult> => {
      const id = identifier.trim();
      const pwd = password;
      if (!id || !pwd) {
        return { ok: false, error: 'Indiquez votre e-mail (ou téléphone) et votre mot de passe.' };
      }
      if (pwd.length < 6) return { ok: false, error: 'Mot de passe trop court (6 caractères min.).' };

      const signInLocal = (): AuthResult => {
        const account = accounts.find((a) => accountMatches(a, id));
        if (!account || account.password !== pwd) {
          return { ok: false, error: 'Identifiants incorrects. Réessayez ou créez un compte.' };
        }
        setSession(sessionFromAccount(account, true));
        setOffline(true);
        void persistAuthToken(null);
        showToast({
          title: 'Mode local',
          body: 'API indisponible — connexion hors-ligne.',
          tone: 'info',
          durationMs: 5000,
        });
        return { ok: true };
      };

      try {
        if (await apiAvailable()) {
          const remote = await apiLogin(id, pwd);
          if (remote.ok) {
            await persistAuthToken(remote.token);
            setSession(sessionFromApiUser(remote.user));
            setOffline(false);
            return { ok: true };
          }
          return remote;
        }
      } catch {
        /* réseau → local */
      }
      return signInLocal();
    },
    [accounts],
  );

  const signUp = useCallback(
    async (input: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      password: string;
    }): Promise<AuthResult> => {
      const firstName = input.firstName.trim();
      const lastName = input.lastName.trim();
      const email = normalizeEmail(input.email);
      const phone = input.phone.trim();
      const password = input.password;

      if (!firstName || !lastName) return { ok: false, error: 'Ajoutez votre prénom et votre nom.' };
      if (!email.includes('@') || email.length < 5) {
        return { ok: false, error: 'Entrez une adresse e-mail valide.' };
      }
      if (!isValidBeninPhone(phone)) {
        return { ok: false, error: 'Numéro béninois invalide (+229 01 00 00 00 00).' };
      }
      if (password.length < 6) {
        return { ok: false, error: 'Choisissez un mot de passe d’au moins 6 caractères.' };
      }

      try {
        if (await apiAvailable()) {
          const remote = await apiRegister({ firstName, lastName, email, phone: formatBeninPhone(phone), password });
          if (remote.ok) {
            await persistAuthToken(remote.token);
            setSession(sessionFromApiUser(remote.user));
            setOffline(false);
            return { ok: true };
          }
          return remote;
        }
      } catch {
        /* API down → local */
      }
      if (accounts.some((a) => a.email === email)) {
        return { ok: false, error: 'Un compte existe déjà avec cet e-mail.' };
      }
      const phoneKey = nationalBeninDigits(phone);
      if (accounts.some((a) => nationalBeninDigits(a.phone) === phoneKey)) {
        return { ok: false, error: 'Un compte existe déjà avec ce numéro.' };
      }

      const account: AuthAccount = {
        id: `u-${Date.now().toString(36)}`,
        email,
        phone: formatBeninPhone(phone),
        password,
        firstName,
        lastName,
        createdAt: new Date().toISOString(),
      };

      setAccounts((prev) => [...prev, account]);
      setSession(sessionFromAccount(account, false));
      setOffline(true);
      showToast({
        title: 'Mode local',
        body: 'Compte créé hors-ligne (API indisponible).',
        tone: 'info',
        durationMs: 5000,
      });
      return { ok: true };
    },
    [accounts],
  );

  const completeOnboarding = useCallback(async () => {
    setSession((prev) => (prev ? { ...prev, onboardingDone: true } : prev));
    try {
      await apiCompleteOnboarding();
    } catch {
      /* local session still marked done */
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setSession(null);
    setOffline(false);
    writeShopSessionRaw(null);
    setShopSessionPeek(false);
    await persistAuthToken(null);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      /* ignore */
    }
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
  }, []);

  const toProfile = useCallback((): UserProfile | null => {
    if (!session) return null;
    return {
      firstName: session.firstName,
      lastName: session.lastName,
      email: session.email,
      phone: session.phone || seedProfile.phone,
      birthDate: session.birthDate || '',
      photoUri: '',
    };
  }, [session]);

  const applyProfile = useCallback(async (patch: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    birthDate?: string;
  }) => {
    const remote = await apiPatchProfile(patch);
    setSession((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        firstName: remote?.firstName ?? patch.firstName ?? prev.firstName,
        lastName: remote?.lastName ?? patch.lastName ?? prev.lastName,
        email: remote?.email ?? patch.email ?? prev.email,
        phone: remote?.phone ?? patch.phone ?? prev.phone,
        birthDate: remote?.birthDate ?? patch.birthDate ?? prev.birthDate,
      };
      if (
        next.firstName === prev.firstName &&
        next.lastName === prev.lastName &&
        next.email === prev.email &&
        next.phone === prev.phone &&
        next.birthDate === prev.birthDate
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      isAuthenticated: Boolean(session),
      needsOnboarding: Boolean(session && !session.onboardingDone),
      offline,
      demoHint: DEMO_ACCOUNT ? { email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password } : null,
      signIn,
      signUp,
      completeOnboarding,
      signOut,
      applyProfile,
      toProfile,
    }),
    [ready, session, offline, signIn, signUp, completeOnboarding, signOut, applyProfile, toProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
