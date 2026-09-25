import { useStaffAuth } from '@/context/StaffAuthContext';
import { useStaffPrefs } from '@/context/StaffPrefsContext';
import { errorMessage } from '@/lib/api/http';
import {
  fetchDeliveries,
  fetchMapStores,
  fetchPickJobs,
  postPresence,
  type DeliveryJob,
  type MapStore,
  type PickJob,
  type TourHop,
} from '@/lib/api/ops';
import { pauseBlockedMessage, staffOpenMission } from '@/lib/opsModel';
import { subscribeLastDrop } from '@/lib/tourRoute';
import { isOrderSignal, restartLive, stopLive, subscribeLive, useLiveConnected } from '@/lib/live';
import { showToast } from '@/lib/toastBus';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  const { prefs, patchPrefs, ready } = useStaffPrefs();
  const staffIdRef = useRef<string | null>(null);
  staffIdRef.current = staff?.id ?? null;
  const liveOn = useLiveConnected();
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
      void postPresence(v).catch(() => undefined);
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
        staff.canDeliver
          ? fetchDeliveries()
          : Promise.resolve({ deliveries: [] as DeliveryJob[], tourHop: null as TourHop | null }),
        fetchMapStores(),
      ]);
      const errors: string[] = [];
      if (p.status === 'fulfilled') {
        setJobs(p.value.jobs.filter((j) => !j.picker_id || j.picker_id === staff.id));
      } else errors.push(errorMessage(p.reason));
      if (d.status === 'fulfilled') {
        const rows = d.value.deliveries.filter((row) => !row.courier_id || row.courier_id === staff.id);
        setDeliveries(rows);
        const serverHop = d.value.tourHop ?? null;
        setTourHop((prev: TourHop | null) => {
          if (serverHop) return serverHop;
          const stillOut = rows.some(
            (row) =>
              row.courier_id === staff.id &&
              ['assigned', 'at_store', 'picked_up', 'en_route', 'arrived'].includes(String(row.delivery_status)),
          );
          return stillOut ? prev : null;
        });
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
    if (!staff || !ready) return;
    void postPresence(online).catch(() => undefined);
    const t = setInterval(() => {
      if (isHidden()) return;
      void postPresence(online).catch(() => undefined);
    }, 12000);
    return () => clearInterval(t);
  }, [staff, ready, online]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeLastDrop((hop, courierId) => {
      if (!hop || (staffIdRef.current && courierId !== staffIdRef.current)) return;
      setTourHop({
        lng: hop.from[0],
        lat: hop.from[1],
        storeId: hop.storeId,
        label: hop.label,
      });
    });
  }, []);

  // Temps réel : un flux par appareil (signal « ta file / ta mission a changé ») → relecture immédiate.
  useEffect(() => {
    if (!staff?.id) {
      stopLive();
      return;
    }
    restartLive();
  }, [staff?.id]);

  useEffect(() => {
    if (!staff) return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeLive((s) => {
      if (!isOrderSignal(s)) return;
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        void refresh({ silent: true });
      }, 250);
    });
    return () => {
      unsub();
      if (pending) clearTimeout(pending);
    };
  }, [staff, refresh]);

  useEffect(() => {
    if (!staff) return;
    const tick = () => {
      if (isHidden()) return;
      void refresh({ silent: true });
    };
    // Flux ouvert : simple filet de sécurité toutes les 15 s ; sinon relecture rapide comme avant.
    const t = setInterval(tick, liveOn ? 15_000 : 1200);
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
  }, [staff, refresh, liveOn]);

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
