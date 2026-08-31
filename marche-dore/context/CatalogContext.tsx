import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { useStores } from '@/context/StoresContext';
import { syncCatalogCache } from '@/lib/catalogSync';
import { getLocalDb } from '@/lib/db/client';
import { hydrateCatalogFromDb } from '@/lib/db/hydrateCatalog';

type CatalogContextValue = {
  version: number;
  syncing: boolean;
  lastSyncAt: string | null;
  resync: (options?: { full?: boolean }) => Promise<boolean>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { selectedStoreId, ready: storesReady } = useStores();
  const [version, setVersion] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const generation = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const lastOkAt = useRef(0);
  const retryMs = useRef(15_000);
  const storeRef = useRef(selectedStoreId);
  storeRef.current = selectedStoreId;

  const publish = useCallback(() => setVersion((value) => value + 1), []);

  const resync = useCallback(
    async (options?: { full?: boolean; force?: boolean }) => {
      if (!storesReady) return false;
      if (inflight.current) return inflight.current;
      if (!options?.full && !options?.force && Date.now() - lastOkAt.current < 20_000) {
        return true;
      }
      const storeId = storeRef.current;
      const run = generation.current;
      const job = (async () => {
        setSyncing(true);
        try {
          const db = await getLocalDb();
          if (run !== generation.current || storeId !== storeRef.current) return false;
          const result = await syncCatalogCache({
            db,
            storeId,
            forceFull: options?.full,
            onChange: publish,
            isCurrent: () =>
              run === generation.current && storeId === storeRef.current,
          });
          if (!result.ok) return false;
          retryMs.current = 15_000;
          lastOkAt.current = Date.now();
          setLastSyncAt(new Date().toISOString());
          return true;
        } catch {
          return false;
        } finally {
          if (run === generation.current) setSyncing(false);
          inflight.current = null;
        }
      })();
      inflight.current = job;
      return job;
    },
    [publish, storesReady],
  );

  useEffect(() => {
    if (!storesReady) return;
    const run = ++generation.current;
    let active = true;

    const scheduleRetry = () => {
      if (!active) return;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(async () => {
        if (!active || run !== generation.current) return;
        const ok = await resync();
        if (!ok) {
          retryMs.current = Math.min(retryMs.current * 2, 120_000);
          scheduleRetry();
        }
      }, retryMs.current);
    };

    void (async () => {
      const db = await getLocalDb();
      if (!active || run !== generation.current) return;
      if (db) {
        await hydrateCatalogFromDb(db, selectedStoreId).catch(() => undefined);
        if (!active || run !== generation.current) return;
        publish();
      }
      const ok = await resync();
      if (!ok) scheduleRetry();
    })();

    return () => {
      active = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
    };
  }, [selectedStoreId, storesReady, publish, resync]);

  useEffect(() => {
    if (!storesReady) return;
    const tick = () => {
      void resync({ force: true });
    };
    pollTimer.current = setInterval(tick, 90_000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [storesReady, resync, selectedStoreId]);

  useEffect(() => {
    const refresh = () => {
      if (storesReady) void resync({ force: true });
    };
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', refresh);
    }
    return () => {
      appState.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', refresh);
      }
    };
  }, [resync, storesReady]);

  const value = useMemo(
    () => ({ version, syncing, lastSyncAt, resync }),
    [version, syncing, lastSyncAt, resync],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalog must be used within CatalogProvider');
  return context;
}

export function useCatalogVersion() {
  return useCatalog().version;
}
