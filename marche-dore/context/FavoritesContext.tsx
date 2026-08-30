import { getProduct, getProducts, type Product } from '@/data/catalog';
import { apiGetAccountState, apiPatchAccountState, loadAccountJson, saveAccountJson } from '@/lib/accountSync';
import { getAuthToken } from '@/lib/api/http';
import { useAuth } from '@/context/AuthContext';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type FavoritesContextValue = {
  ids: string[];
  count: number;
  products: Product[];
  ready: boolean;
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => void;
  add: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  refresh: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const STORAGE_KEY = 'marche-dore.favorites.v1';

function sanitizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string' || !id || seen.has(id) || !getProduct(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const accountId = session?.accountId ?? null;
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const skipSave = useRef(true);

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setIds([]);
      return;
    }
    const local = await loadAccountJson<{ ids?: unknown } | unknown>(STORAGE_KEY, uid);
    let list: unknown = [];
    if (Array.isArray(local)) list = local;
    else if (local && typeof local === 'object' && 'ids' in local) list = (local as { ids: unknown }).ids;
    if (getAuthToken()) {
      const state = await apiGetAccountState();
      if (state?.favorites) list = state.favorites;
    }
    setIds(sanitizeIds(list));
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    skipSave.current = true;
    hydrated.current = false;
    (async () => {
      await load(accountId);
      if (!active) return;
      hydrated.current = true;
      setReady(true);
      skipSave.current = false;
    })();
    return () => {
      active = false;
    };
  }, [authReady, accountId, load]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    void saveAccountJson(STORAGE_KEY, accountId, { ids });
    apiPatchAccountState({ favorites: ids });
  }, [ids, accountId]);

  const isFavorite = useCallback((productId: string) => ids.includes(productId), [ids]);

  const add = useCallback((productId: string) => {
    if (!getProduct(productId)) return;
    setIds((prev) => (prev.includes(productId) ? prev : [productId, ...prev]));
  }, []);

  const remove = useCallback((productId: string) => {
    setIds((prev) => prev.filter((id) => id !== productId));
  }, []);

  const toggle = useCallback((productId: string) => {
    if (!getProduct(productId)) return;
    setIds((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [productId, ...prev]));
  }, []);

  const clear = useCallback(() => {
    setIds([]);
  }, []);

  const refresh = useCallback(async () => {
    await load(accountId);
  }, [load, accountId]);

  const products = useMemo(() => getProducts(ids), [ids]);

  const value = useMemo(
    () => ({
      ids,
      count: ids.length,
      products,
      ready,
      isFavorite,
      toggle,
      add,
      remove,
      clear,
      refresh,
    }),
    [ids, products, ready, isFavorite, toggle, add, remove, clear, refresh],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
