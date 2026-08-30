import { userProfile as seedProfile, type UserProfile } from '@/data/account';
import { apiCompleteOnboarding, apiLogin, apiMe, apiPatchProfile, apiRegister, type ApiUser } from '@/lib/api/auth';
import { apiAvailable, getAuthToken, loadAuthToken, persistAuthToken, setAuthToken } from '@/lib/api/http';
import { formatBeninPhone, isValidBeninPhone, nationalBeninDigits } from '@/lib/beninPhone';
import { appStorage as AsyncStorage } from '@/lib/db/kv';
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
  demoHint: { email: string; password: string };
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

const DEMO_ACCOUNT: AuthAccount = {
  id: 'demo-amina',
  email: 'demo@marchedore.bj',
  phone: seedProfile.phone,
  password: 'marche2024',
  firstName: seedProfile.firstName,
  lastName: seedProfile.lastName,
  createdAt: '2024-03-01T00:00:00.000Z',
};

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
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [accounts, setAccounts] = useState<AuthAccount[]>([DEMO_ACCOUNT]);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [rawAccounts, rawSession] = await Promise.all([
          AsyncStorage.getItem(ACCOUNTS_KEY),
          AsyncStorage.getItem(SESSION_KEY),
          loadAuthToken(),
        ]);
        if (!active) return;

        let nextAccounts = [DEMO_ACCOUNT];
        if (rawAccounts) {
          const parsed = JSON.parse(rawAccounts);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.map(sanitizeAccount).filter(Boolean) as AuthAccount[];
            const hasDemo = cleaned.some((a) => a.id === DEMO_ACCOUNT.id);
            nextAccounts = hasDemo ? cleaned : [DEMO_ACCOUNT, ...cleaned];
          }
        }
        setAccounts(nextAccounts);

        const remoteUser = await apiMe();
        if (!active) return;
        if (remoteUser) {
          setSession(sessionFromApiUser(remoteUser));
        } else if (getAuthToken() && rawSession) {
          try {
            const s = sanitizeSession(JSON.parse(rawSession));
            if (s) setSession(s);
            else setSession(null);
          } catch {
            setSession(null);
          }
        } else {
          await persistAuthToken(null);
          setAuthToken(null);
          setSession(null);
        }
      } catch {
        setAccounts([DEMO_ACCOUNT]);
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
      void AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)).catch(() => {});
      return;
    }
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

      if (await apiAvailable()) {
        const remote = await apiLogin(id, pwd);
        if (remote.ok) {
          await persistAuthToken(remote.token);
          setSession(sessionFromApiUser(remote.user));
          return { ok: true };
        }
        return remote;
      }
      const account = accounts.find((a) => accountMatches(a, id));
      if (!account || account.password !== pwd) {
        return { ok: false, error: 'Identifiants incorrects. Réessayez ou créez un compte.' };
      }
      setSession(sessionFromAccount(account, true));
      return { ok: true };
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

      if (await apiAvailable()) {
        const remote = await apiRegister({ firstName, lastName, email, phone: formatBeninPhone(phone), password });
        if (remote.ok) {
          await persistAuthToken(remote.token);
          setSession(sessionFromApiUser(remote.user));
          return { ok: true };
        }
        return remote;
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
    void persistAuthToken(null);
    void AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
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
      demoHint: { email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password },
      signIn,
      signUp,
      completeOnboarding,
      signOut,
      applyProfile,
      toProfile,
    }),
    [ready, session, signIn, signUp, completeOnboarding, signOut, applyProfile, toProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
