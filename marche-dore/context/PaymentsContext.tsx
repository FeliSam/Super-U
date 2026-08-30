import {
  formatBeninPhone,
  isValidBeninPhone,
  maskBeninPhone,
} from '@/lib/beninPhone';
import type { PaymentId } from '@/context/CheckoutPaymentContext';
import type { PaymentMethod } from '@/data/account';
import { apiGetAccountState, apiPatchAccountState, loadAccountJson, saveAccountJson } from '@/lib/accountSync';
import { getAuthToken } from '@/lib/api/http';
import { useAuth } from '@/context/AuthContext';
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
  return [
    { id: 'om', type: 'Orange Money', detail: 'À configurer', icon: 'smartphone', default: false, ready: false },
    { id: 'wave', type: 'MTN MoMo', detail: 'À configurer', icon: 'smartphone', default: false, ready: false },
    { id: 'card', type: 'Carte bancaire', detail: 'À configurer', icon: 'credit-card', default: false, ready: false },
    {
      id: 'cod',
      type: 'Paiement à la livraison',
      detail: 'Espèces ou mobile money',
      icon: 'dollar-sign',
      default: true,
      ready: true,
    },
  ];
}

function looksLikeDemoWallet(list: WalletMethod[]) {
  const om = list.find((m) => m.id === 'om');
  const card = list.find((m) => m.id === 'card');
  const fakeOm = Boolean(om && om.detail.includes('***') && !om.phone);
  const fakeCard = Boolean(card && /4242/.test(card.detail) && !card.cardLast4);
  return fakeOm || fakeCard;
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
  const { session, ready: authReady } = useAuth();
  const accountId = session?.accountId ?? null;
  const [methods, setMethods] = useState<WalletMethod[]>(seedWallet);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const skipSave = useRef(true);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    skipSave.current = true;
    hydrated.current = false;
    (async () => {
      if (!accountId) {
        setMethods(seedWallet());
        hydrated.current = true;
        setReady(true);
        return;
      }
      const local = await loadAccountJson<unknown>(STORAGE_KEY, accountId);
      let list = Array.isArray(local)
        ? local.map(sanitizeMethod).filter((m): m is WalletMethod => Boolean(m))
        : [];
      if (getAuthToken()) {
        const state = await apiGetAccountState();
        if (Array.isArray(state?.payments)) {
          list = state.payments.map(sanitizeMethod).filter((m): m is WalletMethod => Boolean(m));
        }
      }
      if (!active) return;
      setMethods(list.length && !looksLikeDemoWallet(list) ? list : seedWallet());
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
    void saveAccountJson(STORAGE_KEY, accountId, methods);
    apiPatchAccountState({ payments: methods });
  }, [methods, accountId]);

  const setDefault = useCallback((id: string) => {
    setMethods((prev) => prev.map((m) => ({ ...m, default: m.id === id })));
  }, []);

  const saveMobileNumber = useCallback((id: 'om' | 'wave', phone: string) => {
    if (!isValidBeninPhone(phone)) {
      return { ok: false as const, error: 'Numéro béninois invalide (+229 01 00 00 00 00)' };
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
