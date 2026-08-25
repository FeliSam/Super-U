import { getProduct, getProducts, type Product } from '@/data/catalog';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { ids?: unknown } | unknown;
        const list = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === 'object' && 'ids' in parsed
            ? (parsed as { ids: unknown }).ids
            : [];
        setIds(sanitizeIds(list));
      } else {
        setIds([]);
      }
    } catch {
      setIds([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await load();
      if (active) {
        hydrated.current = true;
        setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ids })).catch(() => undefined);
  }, [ids]);

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
    await load();
  }, [load]);

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
