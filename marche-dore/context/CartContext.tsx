import { getProduct, Product } from '@/data/catalog';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type CartLine = {
  productId: string;
  qty: number;
  unitOverride?: string;
};

const PROMO_CODES: Record<string, number> = {
  FRAIS20: 2000,
  MARCHE10: 1500,
  SUPERU: 1000,
};

type CartContextValue = {
  lines: CartLine[];
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
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

const INITIAL: CartLine[] = [
  { productId: 'mangues', qty: 2, unitOverride: '2 kg' },
  { productId: 'plantains', qty: 1, unitOverride: '1 régime' },
  { productId: 'lait', qty: 3 },
  { productId: 'poulet-fermier', qty: 1 },
];

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(INITIAL);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  const add = useCallback((productId: string, qty = 1) => {
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
      add,
      setQty,
      remove,
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
      add,
      setQty,
      remove,
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
