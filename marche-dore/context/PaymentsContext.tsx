import {
  formatBeninPhone,
  isValidBeninPhone,
  maskBeninPhone,
  nationalBeninDigits,
} from '@/lib/beninPhone';
import type { PaymentId } from '@/context/CheckoutPaymentContext';
import { paymentMethods as seedMethods, type PaymentMethod } from '@/data/account';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.payments.v1';

export type WalletMethod = PaymentMethod & {
  /** Numéro national / formaté pour OM & MoMo */
  phone?: string;
  cardLast4?: string;
  ready: boolean;
};

type PaymentsContextValue = {
  ready: boolean;
  methods: WalletMethod[];
  defaultMethod: WalletMethod;
  setDefault: (id: string) => void;
  /** Enregistre un numéro Bénin pour Orange Money / MTN MoMo */
  saveMobileNumber: (id: 'om' | 'wave', phone: string) => { ok: true } | { ok: false; error: string };
  saveCard: (last4: string, brand?: string) => void;
  profileSubtitle: string;
  methodById: (id: PaymentId | string) => WalletMethod | undefined;
};

const PaymentsContext = createContext<PaymentsContextValue | null>(null);

function labelFor(id: string) {
  switch (id) {
    case 'om':
      return 'Orange Money';
    case 'wave':
      return 'MTN MoMo';
    case 'card':
      return 'Carte bancaire';
    case 'cod':
      return 'Paiement à la livraison';
    default:
      return 'Paiement';
  }
}

function seedWallet(): WalletMethod[] {
  return seedMethods.map((m) => ({
    ...m,
    ready: m.id === 'cod' || Boolean(m.detail && !m.detail.includes('***')),
    phone: undefined,
  }));
}

function sanitizeMethod(raw: unknown): WalletMethod | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<WalletMethod>;
  if (typeof m.id !== 'string' || typeof m.type !== 'string') return null;
  return {
    id: m.id,
    type: m.type,
    detail: typeof m.detail === 'string' ? m.detail : '',
    icon: (m.icon as WalletMethod['icon']) || 'smartphone',
    default: Boolean(m.default),
    phone: typeof m.phone === 'string' ? m.phone : undefined,
    cardLast4: typeof m.cardLast4 === 'string' ? m.cardLast4 : undefined,
    ready: Boolean(m.ready) || m.id === 'cod',
  };
}

export function PaymentsProvider({ children }: { children: React.ReactNode }) {
  const [methods, setMethods] = useState<WalletMethod[]>(seedWallet);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const parsed = JSON.parse(raw) as unknown;
          const list = Array.isArray(parsed)
            ? parsed.map(sanitizeMethod).filter((m): m is WalletMethod => Boolean(m))
            : [];
          if (list.length) {
            const hasDefault = list.some((m) => m.default);
            setMethods(
              hasDefault
                ? list
                : list.map((m, i) => ({ ...m, default: i === 0 })),
            );
          }
        }
      } catch {
        // keep seeds
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(methods)).catch(() => undefined);
  }, [methods]);

  const setDefault = useCallback((id: string) => {
    setMethods((prev) => prev.map((m) => ({ ...m, default: m.id === id })));
  }, []);

  const saveMobileNumber = useCallback((id: 'om' | 'wave', phone: string) => {
    if (!isValidBeninPhone(phone)) {
      return { ok: false as const, error: 'Numéro béninois invalide (+229, 8 ou 10 chiffres)' };
    }
    const formatted = formatBeninPhone(phone);
    const masked = maskBeninPhone(phone);
    setMethods((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              phone: formatted,
              detail: masked,
              ready: true,
              type: labelFor(id),
            }
          : m,
      ),
    );
    return { ok: true as const };
  }, []);

  const saveCard = useCallback((last4: string, brand = 'Carte') => {
    const clean = last4.replace(/\D/g, '').slice(-4);
    setMethods((prev) =>
      prev.map((m) =>
        m.id === 'card'
          ? {
              ...m,
              cardLast4: clean,
              detail: `${brand} · **** ${clean || '••••'}`,
              ready: clean.length === 4,
            }
          : m,
      ),
    );
  }, []);

  const defaultMethod = useMemo(() => {
    return methods.find((m) => m.default) ?? methods.find((m) => m.ready) ?? methods[0];
  }, [methods]);

  const profileSubtitle = useMemo(() => {
    const mobiles = methods.filter((m) => (m.id === 'om' || m.id === 'wave') && m.ready);
    if (mobiles.length >= 2) return `${mobiles[0].type} · ${mobiles[1].type}`;
    if (mobiles.length === 1) return `${mobiles[0].type} · ${mobiles[0].detail}`;
    if (defaultMethod?.ready) return `${defaultMethod.type} · ${defaultMethod.detail}`;
    return 'Ajouter un numéro Mobile Money';
  }, [methods, defaultMethod]);

  const methodById = useCallback(
    (id: PaymentId | string) => methods.find((m) => m.id === id),
    [methods],
  );

  const value = useMemo(
    () => ({
      ready,
      methods,
      defaultMethod,
      setDefault,
      saveMobileNumber,
      saveCard,
      profileSubtitle,
      methodById,
    }),
    [
      ready,
      methods,
      defaultMethod,
      setDefault,
      saveMobileNumber,
      saveCard,
      profileSubtitle,
      methodById,
    ],
  );

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
}

export function usePayments() {
  const ctx = useContext(PaymentsContext);
  if (!ctx) throw new Error('usePayments must be used within PaymentsProvider');
  return ctx;
}
