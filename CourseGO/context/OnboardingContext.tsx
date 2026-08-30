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
  const [ready, setReady] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(true);
  const [permsDone, setPermsDone] = useState(true);

  useEffect(() => {
    if (!staff) {
      setWelcomeDone(true);
      setPermsDone(true);
      setReady(true);
      return;
    }
    let live = true;
    setReady(false);
    void (async () => {
      try {
        const [w, p] = await Promise.all([readFlag(kWelcome(staff.id)), readFlag(kPerms(staff.id))]);
        if (!live) return;
        setWelcomeDone(w);
        setPermsDone(p);
      } finally {
        if (live) setReady(true);
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
