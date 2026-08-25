import { SUPER_U_STORES, type SuperUStore } from '@/data/superU';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.preferred-store.v1';
const DEFAULT_STORE_ID = SUPER_U_STORES[0]?.id ?? 'su-aeroport';

type StoresContextValue = {
  ready: boolean;
  stores: SuperUStore[];
  selectedStoreId: string;
  selectedStore: SuperUStore;
  setSelectedStoreId: (id: string) => void;
};

const StoresContext = createContext<StoresContextValue | null>(null);

function resolveStore(id: string | undefined | null): SuperUStore {
  return SUPER_U_STORES.find((s) => s.id === id) ?? SUPER_U_STORES[0];
}

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [selectedStoreId, setSelectedStoreIdState] = useState(DEFAULT_STORE_ID);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const parsed = JSON.parse(raw) as { selectedStoreId?: string };
          if (typeof parsed.selectedStoreId === 'string' && resolveStore(parsed.selectedStoreId)) {
            setSelectedStoreIdState(parsed.selectedStoreId);
          }
        }
      } catch {
        // ignore
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedStoreId })).catch(() => undefined);
  }, [selectedStoreId]);

  const setSelectedStoreId = useCallback((id: string) => {
    if (!SUPER_U_STORES.some((s) => s.id === id)) return;
    setSelectedStoreIdState(id);
  }, []);

  const selectedStore = useMemo(() => resolveStore(selectedStoreId), [selectedStoreId]);

  const value = useMemo(
    () => ({
      ready,
      stores: SUPER_U_STORES,
      selectedStoreId: selectedStore.id,
      selectedStore,
      setSelectedStoreId,
    }),
    [ready, selectedStore, setSelectedStoreId],
  );

  return <StoresContext.Provider value={value}>{children}</StoresContext.Provider>;
}

export function useStores() {
  const ctx = useContext(StoresContext);
  if (!ctx) throw new Error('useStores must be used within StoresProvider');
  return ctx;
}
