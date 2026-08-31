import { useStaffAuth } from '@/context/StaffAuthContext';
import { useStaffPrefs } from '@/context/StaffPrefsContext';
import { errorMessage } from '@/lib/api/http';
import {
  fetchDeliveries,
  fetchMapStores,
  fetchPickJobs,
  type DeliveryJob,
  type MapStore,
  type PickJob,
  type TourHop,
} from '@/lib/api/ops';
import { pauseBlockedMessage, staffOpenMission } from '@/lib/opsModel';
import { showToast } from '@/lib/toastBus';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

type BoardValue = {
  jobs: PickJob[];
  deliveries: DeliveryJob[];
  tourHop: TourHop | null;
  mapStores: MapStore[];
  online: boolean;
  canPause: boolean;
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
  const { prefs, patchPrefs } = useStaffPrefs();
  const [jobs, setJobs] = useState<PickJob[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryJob[]>([]);
  const [tourHop, setTourHop] = useState<TourHop | null>(null);
  const [mapStores, setMapStores] = useState<MapStore[]>([]);
  const online = prefs.online;
  const openMission = useMemo(
    () => staffOpenMission(staff?.id, jobs, deliveries),
    [staff?.id, jobs, deliveries],
  );
  const canPause = !openMission.pick && !openMission.delivery;
  const setOnline = useCallback(
    (v: boolean) => {
      if (!v && !canPause) {
        showToast({
          title: 'Pause impossible',
          body: pauseBlockedMessage(openMission),
          tone: 'error',
        });
        return;
      }
      patchPrefs({ online: v });
    },
    [canPause, openMission, patchPrefs],
  );
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!staff) {
      setJobs([]);
      setDeliveries([]);
      setTourHop(null);
      setMapStores([]);
      setLastError(null);
      return;
    }
    if (!opts?.silent) setRefreshing(true);
    try {
      const [p, d, s] = await Promise.allSettled([
        staff.canPick ? fetchPickJobs() : Promise.resolve({ jobs: [] as PickJob[] }),
        staff.canDeliver ? fetchDeliveries() : Promise.resolve({ deliveries: [] as DeliveryJob[] }),
        fetchMapStores(),
      ]);
      const errors: string[] = [];
      if (p.status === 'fulfilled') {
        setJobs(p.value.jobs.filter((j) => !j.picker_id || j.picker_id === staff.id));
      } else errors.push(errorMessage(p.reason));
      if (d.status === 'fulfilled') {
        setDeliveries(d.value.deliveries.filter((row) => !row.courier_id || row.courier_id === staff.id));
        setTourHop(d.value.tourHop ?? null);
      } else errors.push(errorMessage(d.reason));
      if (s.status === 'fulfilled') setMapStores(s.value.stores);
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
    () => ({
      jobs,
      deliveries,
      tourHop,
      mapStores,
      online,
      canPause,
      setOnline,
      refreshing,
      lastError,
      lastOkAt,
      refresh,
    }),
    [jobs, deliveries, tourHop, mapStores, online, canPause, setOnline, refreshing, lastError, lastOkAt, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBoard() {
  const v = useContext(Ctx);
  if (!v) throw new Error('BoardProvider missing');
  return v;
}
