import { userProfile as seedProfile, type UserProfile } from '@/data/account';
import { formatBeninPhone, isValidBeninPhone, nationalBeninDigits } from '@/lib/beninPhone';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

        if (rawSession) {
          const s = sanitizeSession(JSON.parse(rawSession));
          if (s && nextAccounts.some((a) => a.id === s.accountId)) {
            setSession(s);
          }
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
    void (async () => {
      try {
        if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
        else await AsyncStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
    })();
  }, [session]);

  const signIn = useCallback(
    async (identifier: string, password: string): Promise<AuthResult> => {
      const id = identifier.trim();
      const pwd = password;
      if (!id || !pwd) {
        return { ok: false, error: 'Indiquez votre e-mail (ou téléphone) et votre mot de passe.' };
      }
      if (pwd.length < 6) return { ok: false, error: 'Mot de passe trop court (6 caractères min.).' };

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
        return { ok: false, error: 'Numéro béninois invalide (+229…).' };
      }
      if (password.length < 6) {
        return { ok: false, error: 'Choisissez un mot de passe d’au moins 6 caractères.' };
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
  }, []);

  const signOut = useCallback(async () => {
    setSession(null);
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const toProfile = useCallback((): UserProfile | null => {
    if (!session) return null;
    return {
      firstName: session.firstName,
      lastName: session.lastName,
      email: session.email,
      phone: session.phone || seedProfile.phone,
      birthDate: seedProfile.birthDate,
    };
  }, [session]);

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
      toProfile,
    }),
    [ready, session, signIn, signUp, completeOnboarding, signOut, toProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
