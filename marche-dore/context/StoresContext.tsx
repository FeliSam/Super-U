import { SUPER_U_STORES, type SuperUStore } from '@/data/superU';
import { apiGetAccountState, apiPatchAccountState, loadAccountJson, saveAccountJson } from '@/lib/accountSync';
import { getAuthToken } from '@/lib/api/http';
import { useAuth } from '@/context/AuthContext';
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
  const { session, ready: authReady } = useAuth();
  const accountId = session?.accountId ?? null;
  const [selectedStoreId, setSelectedStoreIdState] = useState(DEFAULT_STORE_ID);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const skipSave = useRef(true);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    skipSave.current = true;
    hydrated.current = false;
    (async () => {
      let next = DEFAULT_STORE_ID;
      if (accountId) {
        const local = await loadAccountJson<{ selectedStoreId?: string }>(STORAGE_KEY, accountId);
        if (typeof local?.selectedStoreId === 'string' && resolveStore(local.selectedStoreId)) {
          next = local.selectedStoreId;
        }
        if (getAuthToken()) {
          const state = await apiGetAccountState();
          const remote = state?.prefs?.preferredStoreId;
          if (typeof remote === 'string' && resolveStore(remote)) next = remote;
        }
      }
      if (!active) return;
      setSelectedStoreIdState(next);
      hydrated.current = true;
      setReady(true);
      skipSave.current = false;
    })();
    return () => {
      active = false;
    };
  }, [authReady, accountId]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    void saveAccountJson(STORAGE_KEY, accountId, { selectedStoreId });
    apiPatchAccountState({ prefs: { preferredStoreId: selectedStoreId } });
  }, [selectedStoreId, accountId]);

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
