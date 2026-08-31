import { getProduct, Product } from '@/data/catalog';
import { apiGetCart, apiPutCart } from '@/lib/api/cart';
import { getAuthToken } from '@/lib/api/http';
import { loadAccountJson, saveAccountJson } from '@/lib/accountSync';
import { useAuth } from '@/context/AuthContext';
import { useCatalogVersion } from '@/context/CatalogContext';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type CartLine = {
  productId: string;
  qty: number;
  unitOverride?: string;
};

const STORAGE_KEY = 'marche-dore.cart.v1';

type PersistedCart = {
  lines: CartLine[];
  promoCode: string | null;
};

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  applyPromo: (code: string) => boolean;
  clearPromo: () => void;
  promoCode: string | null;
  promoMessage: string | null;
  count: number;
  subtotal: number;
  listSubtotal: number;
  delivery: number;
  discount: number;
  total: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function sanitizeLines(lines: unknown): CartLine[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((l): l is CartLine => {
      if (!l || typeof l !== 'object') return false;
      const row = l as CartLine;
      return typeof row.productId === 'string' && Boolean(row.productId) && typeof row.qty === 'number' && row.qty > 0;
    })
    .map((l) => ({
      productId: l.productId,
      qty: Math.min(99, Math.floor(l.qty)),
      ...(l.unitOverride ? { unitOverride: l.unitOverride } : {}),
    }));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const catalogVersion = useCatalogVersion();
  const accountId = session?.accountId ?? null;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const skipNextPut = useRef(false);
  const skipSave = useRef(true);
  const linesRef = useRef(lines);
  const promoRef = useRef(promoCode);
  linesRef.current = lines;
  promoRef.current = promoCode;

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    skipSave.current = true;
    hydrated.current = false;
    (async () => {
      if (!accountId) {
        setLines([]);
        setPromoCode(null);
        hydrated.current = true;
        setReady(true);
        return;
      }
      const local = await loadAccountJson<PersistedCart>(STORAGE_KEY, accountId);
      let nextLines = local ? sanitizeLines(local.lines) : [];
      let nextPromo: string | null = local?.promoCode ?? null;
      let remoteOk = false;
      if (getAuthToken()) {
        const remote = await apiGetCart();
        if (remote && active) {
          remoteOk = true;
          nextLines = sanitizeLines(remote.lines);
          nextPromo = remote.promoCode ?? nextPromo;
        }
      }
      if (!active) return;
      skipNextPut.current = true;
      setLines(nextLines);
      setPromoCode(nextPromo);
      hydrated.current = true;
      setReady(true);
      skipSave.current = false;
      if (getAuthToken() && !remoteOk && nextLines.length) {
        void apiPutCart(nextLines, nextPromo).catch(() => undefined);
      }
    })();
    return () => {
      active = false;
    };
  }, [authReady, accountId]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    void saveAccountJson(STORAGE_KEY, accountId, { lines, promoCode } satisfies PersistedCart);
  }, [lines, promoCode, accountId]);

  useEffect(() => {
    if (!hydrated.current || !session || !getAuthToken()) return;
    if (skipNextPut.current) {
      skipNextPut.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void apiPutCart(lines, promoCode).catch(() => undefined);
    }, 450);
    return () => clearTimeout(timer);
  }, [lines, promoCode, session?.accountId]);

  const add = useCallback((productId: string, qty = 1) => {
    if (!productId) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) => (l.productId === productId ? { ...l, qty: l.qty + qty } : l));
      }
      return [...prev, { productId, qty }];
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0 ? prev.filter((l) => l.productId !== productId) : prev.map((l) => (l.productId === productId ? { ...l, qty } : l)),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setPromoCode(null);
    setPromoMessage(null);
  }, []);

  const applyPromo = useCallback((_code: string) => {
    setPromoMessage('Les codes promo ne sont pas actifs.');
    return false;
  }, []);

  const clearPromo = useCallback(() => {
    setPromoCode(null);
    setPromoMessage(null);
  }, []);

  const count = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines]);
  const subtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const p = getProduct(l.productId);
        return sum + (p ? p.price * l.qty : 0);
      }, 0),
    [lines, catalogVersion],
  );
  const listSubtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const p = getProduct(l.productId);
        if (!p) return sum;
        return sum + (p.oldPrice ?? p.price) * l.qty;
      }, 0),
    [lines, catalogVersion],
  );
  const delivery = useMemo(() => (lines.length ? 1500 : 0), [lines.length]);
  const discount = 0;
  const total = useMemo(() => Math.max(0, subtotal + delivery - discount), [subtotal, delivery, discount]);

  const value = useMemo(
    () => ({
      lines,
      ready,
      add,
      setQty,
      remove,
      clear,
      applyPromo,
      clearPromo,
      promoCode,
      promoMessage,
      count,
      subtotal,
      listSubtotal,
      delivery,
      discount,
      total,
    }),
    [
      lines,
      ready,
      add,
      setQty,
      remove,
      clear,
      applyPromo,
      clearPromo,
      promoCode,
      promoMessage,
      count,
      subtotal,
      listSubtotal,
      delivery,
      discount,
      total,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function useProductQty(productId: string) {
  const { lines, add, setQty } = useCart();
  const qty = lines.find((l) => l.productId === productId)?.qty ?? 0;
  return {
    qty,
    increment: () => add(productId, 1),
    decrement: () => setQty(productId, qty - 1),
  };
}

export function lineProduct(line: CartLine): Product | undefined {
  return getProduct(line.productId);
}

export function lineTotal(line: CartLine): number {
  const p = getProduct(line.productId);
  return p ? p.price * line.qty : 0;
}

export function lineListTotal(line: CartLine): number {
  const p = getProduct(line.productId);
  if (!p) return 0;
  return (p.oldPrice ?? p.price) * line.qty;
}
