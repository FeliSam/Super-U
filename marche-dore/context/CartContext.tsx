import { getProduct, Product } from '@/data/catalog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type CartLine = {
  productId: string;
  qty: number;
  unitOverride?: string;
};

const STORAGE_KEY = 'marche-dore.cart.v1';

const PROMO_CODES: Record<string, number> = {
  FRAIS20: 2000,
  MARCHE10: 1500,
  SUPERU: 1000,
};

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
      return typeof row.productId === 'string' && typeof row.qty === 'number' && row.qty > 0 && Boolean(getProduct(row.productId));
    })
    .map((l) => ({
      productId: l.productId,
      qty: Math.min(99, Math.floor(l.qty)),
      ...(l.unitOverride ? { unitOverride: l.unitOverride } : {}),
    }));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const parsed = JSON.parse(raw) as PersistedCart;
          setLines(sanitizeLines(parsed.lines));
          setPromoCode(parsed.promoCode && PROMO_CODES[parsed.promoCode] ? parsed.promoCode : null);
        }
      } catch {
        // ignore corrupt storage
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
    const payload: PersistedCart = { lines, promoCode };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => undefined);
  }, [lines, promoCode]);

  const add = useCallback((productId: string, qty = 1) => {
    if (!getProduct(productId)) return;
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

  const applyPromo = useCallback((code: string) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setPromoMessage('Saisissez un code promo');
      return false;
    }
    const amount = PROMO_CODES[normalized];
    if (!amount) {
      setPromoMessage('Code promo invalide');
      setPromoCode(null);
      return false;
    }
    setPromoCode(normalized);
    setPromoMessage(null);
    return true;
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
    [lines],
  );
  const listSubtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const p = getProduct(l.productId);
        if (!p) return sum;
        return sum + (p.oldPrice ?? p.price) * l.qty;
      }, 0),
    [lines],
  );
  const delivery = useMemo(() => (lines.length ? 1500 : 0), [lines.length]);
  const discount = useMemo(() => {
    const promoDiscount = promoCode ? PROMO_CODES[promoCode] : 0;
    const autoDiscount = !promoCode && subtotal >= 10000 ? 2000 : 0;
    return promoDiscount || autoDiscount;
  }, [promoCode, subtotal]);
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
    increment: () => {
      if (qty === 0) add(productId);
      else setQty(productId, qty + 1);
    },
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
