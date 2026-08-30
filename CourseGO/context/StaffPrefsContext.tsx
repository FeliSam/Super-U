import { useStaffAuth } from '@/context/StaffAuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type StaffPrefs = {
  online: boolean;
  notifJobs: boolean;
  notifChat: boolean;
  notifCalls: boolean;
  shareLocation: boolean;
  sound: boolean;
};

export const DEFAULT_PREFS: StaffPrefs = {
  online: true,
  notifJobs: true,
  notifChat: true,
  notifCalls: true,
  shareLocation: true,
  sound: true,
};

type Value = {
  ready: boolean;
  prefs: StaffPrefs;
  patchPrefs: (next: Partial<StaffPrefs>) => void;
};

const Ctx = createContext<Value | null>(null);

function prefsKey(staffId: string) {
  return `coursego.prefs.v1.${staffId}`;
}

async function readJson(key: string): Promise<StaffPrefs | null> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return null;
}

function writeJson(key: string, value: StaffPrefs) {
  const raw = JSON.stringify(value);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, raw);
  } catch {
    /* ignore */
  }
  void AsyncStorage.setItem(key, raw).catch(() => undefined);
}

export function StaffPrefsProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useStaffAuth();
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<StaffPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (!staff) {
      setPrefs(DEFAULT_PREFS);
      setReady(true);
      return;
    }
    let live = true;
    setReady(false);
    void readJson(prefsKey(staff.id)).then((stored) => {
      if (!live) return;
      if (stored) setPrefs(stored);
      else setPrefs(DEFAULT_PREFS);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [staff?.id]);

  const patchPrefs = useCallback(
    (next: Partial<StaffPrefs>) => {
      setPrefs((prev) => {
        const merged = { ...prev, ...next };
        if (staff) writeJson(prefsKey(staff.id), merged);
        return merged;
      });
    },
    [staff],
  );

  const value = useMemo(() => ({ ready, prefs, patchPrefs }), [ready, prefs, patchPrefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaffPrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StaffPrefsProvider missing');
  return v;
}
