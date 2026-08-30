import { loadAuthToken, persistAuthToken, setAuthToken, errorMessage } from '@/lib/api/http';
import { opsLogin, opsMe, type Staff } from '@/lib/api/ops';
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

function withDeadline<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [staff, setStaff] = useState<Staff | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const token = await withDeadline(loadAuthToken(), 1500).catch(() => null);
        if (token) {
          setAuthToken(token);
          try {
            const me = await withDeadline(opsMe(), 2500);
            setStaff(me.staff);
          } catch {
            await persistAuthToken(null);
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
        digits === '0140000001' || digits === '140000001'
          ? 'picker@marchedore.bj'
          : digits === '0140000002' || digits === '140000002'
            ? 'courier@marchedore.bj'
            : identifier.trim();
      const res = await opsLogin(mapped.includes('@') ? mapped.toLowerCase() : identifier.trim(), password);
      await persistAuthToken(res.token);
      setStaff(res.staff);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: errorMessage(e) };
    }
  }, []);

  const signOut = useCallback(async () => {
    await persistAuthToken(null);
    setStaff(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      staff,
      signIn,
      signOut,
      applyStaff: setStaff,
      demoHint: { email: 'picker@marchedore.bj', phone: '01 40 00 00 01', password: 'marche2024' },
    }),
    [ready, staff, signIn, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaffAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StaffAuthProvider missing');
  return v;
}
