import { useStaffAuth } from '@/context/StaffAuthContext';
import { errorMessage } from '@/lib/api/http';
import {
  fetchDeliveries,
  fetchPickJobs,
  type DeliveryJob,
  type PickJob,
} from '@/lib/api/ops';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

type BoardValue = {
  jobs: PickJob[];
  deliveries: DeliveryJob[];
  online: boolean;
  setOnline: (v: boolean) => void;
  refreshing: boolean;
  lastError: string | null;
  lastOkAt: number | null;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
};

const Ctx = createContext<BoardValue | null>(null);

function isHidden() {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return document.visibilityState === 'hidden';
  }
  return AppState.currentState !== 'active';
}

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useStaffAuth();
  const [jobs, setJobs] = useState<PickJob[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryJob[]>([]);
  const [online, setOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!staff) {
      setJobs([]);
      setDeliveries([]);
      setLastError(null);
      return;
    }
    if (!opts?.silent) setRefreshing(true);
    try {
      const [p, d] = await Promise.allSettled([
        staff.canPick ? fetchPickJobs() : Promise.resolve({ jobs: [] as PickJob[] }),
        staff.canDeliver ? fetchDeliveries() : Promise.resolve({ deliveries: [] as DeliveryJob[] }),
      ]);
      const errors: string[] = [];
      if (p.status === 'fulfilled') setJobs(p.value.jobs);
      else errors.push(errorMessage(p.reason));
      if (d.status === 'fulfilled') setDeliveries(d.value.deliveries);
      else errors.push(errorMessage(d.reason));
      if (errors.length) setLastError(errors[0] ?? null);
      else {
        setLastError(null);
        setLastOkAt(Date.now());
      }
    } finally {
      if (!opts?.silent) setRefreshing(false);
    }
  }, [staff]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!staff) return;
    const tick = () => {
      if (isHidden()) return;
      void refresh({ silent: true });
    };
    const t = setInterval(tick, 2000);
    const onVis = () => {
      if (!isHidden()) void refresh({ silent: true });
    };
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh({ silent: true });
    });
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }
    return () => {
      clearInterval(t);
      sub.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, [staff, refresh]);

  const value = useMemo(
    () => ({ jobs, deliveries, online, setOnline, refreshing, lastError, lastOkAt, refresh }),
    [jobs, deliveries, online, refreshing, lastError, lastOkAt, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBoard() {
  const v = useContext(Ctx);
  if (!v) throw new Error('BoardProvider missing');
  return v;
}
