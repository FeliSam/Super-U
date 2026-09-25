import { useStaffAuth } from '@/context/StaffAuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Value = {
  ready: boolean;
  welcomeDone: boolean;
  permsDone: boolean;
  completeWelcome: () => Promise<void>;
  completePerms: () => Promise<void>;
};

const Ctx = createContext<Value | null>(null);

function kWelcome(id: string) {
  return `coursego.welcome.${id}`;
}
function kPerms(id: string) {
  return `coursego.perms.${id}`;
}

async function readFlag(key: string) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(key) === '1') return true;
  } catch {
    /* ignore */
  }
  try {
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return false;
  }
}

async function writeFlag(key: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
  await AsyncStorage.setItem(key, '1').catch(() => undefined);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useStaffAuth();
  /** Staff id for which welcome/perms flags are loaded. Gate must wait until this matches. */
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [permsDone, setPermsDone] = useState(false);

  useEffect(() => {
    if (!staff) {
      setLoadedForId(null);
      setWelcomeDone(false);
      setPermsDone(false);
      return;
    }

    const staffId = staff.id;
    let live = true;
    // Block Gate until AsyncStorage resolves — do not inherit "done" from logged-out state.
    setLoadedForId(null);
    setWelcomeDone(false);
    setPermsDone(false);

    const wPeek = typeof localStorage !== 'undefined' && localStorage.getItem(kWelcome(staffId)) === '1';
    const pPeek = typeof localStorage !== 'undefined' && localStorage.getItem(kPerms(staffId)) === '1';
    if (wPeek || pPeek) {
      setWelcomeDone(Boolean(wPeek));
      setPermsDone(Boolean(pPeek));
      setLoadedForId(staffId);
    }

    void (async () => {
      try {
        const [w, p] = await Promise.all([readFlag(kWelcome(staffId)), readFlag(kPerms(staffId))]);
        if (!live) return;
        setWelcomeDone(w);
        setPermsDone(p);
      } finally {
        if (live) setLoadedForId(staffId);
      }
    })();

    return () => {
      live = false;
    };
  }, [staff?.id]);

  const completeWelcome = useCallback(async () => {
    if (staff) await writeFlag(kWelcome(staff.id));
    setWelcomeDone(true);
  }, [staff]);

  const completePerms = useCallback(async () => {
    if (staff) await writeFlag(kPerms(staff.id));
    setPermsDone(true);
  }, [staff]);

  const ready = !staff || loadedForId === staff.id;

  const value = useMemo(
    () => ({ ready, welcomeDone, permsDone, completeWelcome, completePerms }),
    [ready, welcomeDone, permsDone, completeWelcome, completePerms],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboarding() {
  const v = useContext(Ctx);
  if (!v) throw new Error('OnboardingProvider missing');
  return v;
}
