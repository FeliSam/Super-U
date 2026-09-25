import { getProducts, type Product } from '@/data/catalog';
import {
  apiGetAccountState,
  apiPatchAccountState,
  loadAccountJson,
  saveAccountJson,
  subscribeAccountPull,
} from '@/lib/accountSync';
import { getAuthToken } from '@/lib/api/http';
import { useAuth } from '@/context/AuthContext';
import { useCatalogVersion } from '@/context/CatalogContext';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
const idsRef = { current: new Set<string>() };
const listeners = new Map<string, Set<(liked: boolean) => void>>();
let toggleFavoriteId = (productId: string) => {
  void productId;
};

function emit(id: string, liked: boolean) {
  listeners.get(id)?.forEach((fn) => fn(liked));
}

function replaceIds(next: string[]) {
  idsRef.current = new Set(next);
}

function sanitizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const catalogVersion = useCatalogVersion();
  const accountId = session?.accountId ?? null;
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const skipSave = useRef(true);

  const applyIds = useCallback((next: string[]) => {
    const clean = sanitizeIds(next);
    const prev = idsRef.current;
    replaceIds(clean);
    for (const id of prev) {
      if (!idsRef.current.has(id)) emit(id, false);
    }
    for (const id of idsRef.current) {
      if (!prev.has(id)) emit(id, true);
    }
    setIds(clean);
  }, []);

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      applyIds([]);
      return;
    }
    const local = await loadAccountJson<{ ids?: unknown } | unknown>(STORAGE_KEY, uid);
    let list: unknown = [];
    if (Array.isArray(local)) list = local;
    else if (local && typeof local === 'object' && 'ids' in local) list = (local as { ids: unknown }).ids;
    applyIds(sanitizeIds(list));
    if (getAuthToken()) {
      const state = await apiGetAccountState();
      if (state?.favorites) applyIds(sanitizeIds(state.favorites));
    }
  }, [applyIds]);

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
    if (!authReady || !accountId || !getAuthToken()) return;
    return subscribeAccountPull(async () => {
      if (!hydrated.current) return;
      const state = await apiGetAccountState();
      if (!state?.favorites) return;
      const next = sanitizeIds(state.favorites);
      const prev = idsRef.current;
      if (next.length === prev.size && next.every((id) => prev.has(id))) return;
      skipSave.current = true;
      applyIds(next);
      skipSave.current = false;
      void saveAccountJson(STORAGE_KEY, accountId, { ids: next });
    });
  }, [authReady, accountId, applyIds]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    void saveAccountJson(STORAGE_KEY, accountId, { ids });
    apiPatchAccountState({ favorites: ids });
  }, [ids, accountId]);

  const isFavorite = useCallback((productId: string) => idsRef.current.has(productId), []);

  const add = useCallback((productId: string) => {
    if (!productId || idsRef.current.has(productId)) return;
    idsRef.current.add(productId);
    emit(productId, true);
    setIds(Array.from(idsRef.current));
  }, []);

  const remove = useCallback((productId: string) => {
    if (!productId || !idsRef.current.has(productId)) return;
    idsRef.current.delete(productId);
    emit(productId, false);
    setIds(Array.from(idsRef.current));
  }, []);

  const toggle = useCallback((productId: string) => {
    if (!productId) return;
    if (idsRef.current.has(productId)) {
      idsRef.current.delete(productId);
      emit(productId, false);
    } else {
      idsRef.current.add(productId);
      emit(productId, true);
    }
    setIds(Array.from(idsRef.current));
  }, []);
  toggleFavoriteId = toggle;

  const clear = useCallback(() => {
    const prev = Array.from(idsRef.current);
    idsRef.current.clear();
    prev.forEach((id) => emit(id, false));
    setIds([]);
  }, []);

  const refresh = useCallback(async () => {
    await load(accountId);
  }, [load, accountId]);

  const products = useMemo(() => getProducts(ids), [ids, catalogVersion]);

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

/** Like local : n’invalide pas toute la grille. */
export function useFavoriteId(productId: string) {
  const [liked, setLiked] = useState(() => idsRef.current.has(productId));

  useEffect(() => {
    setLiked(idsRef.current.has(productId));
    let bucket = listeners.get(productId);
    if (!bucket) {
      bucket = new Set();
      listeners.set(productId, bucket);
    }
    bucket.add(setLiked);
    return () => {
      bucket!.delete(setLiked);
    };
  }, [productId]);

  const onToggle = useCallback(() => {
    toggleFavoriteId(productId);
  }, [productId]);

  return { liked, toggle: onToggle };
}
