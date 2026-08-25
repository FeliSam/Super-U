import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type PaymentId = 'om' | 'wave' | 'card' | 'cod';

export type PaymentSetup = {
  methodId: PaymentId;
  /** Display label e.g. Orange Money */
  label: string;
  /** Masked detail shown in checkout */
  detail: string;
  /** Raw fields kept in memory for the session (demo — not persisted) */
  phone?: string;
  cardLast4?: string;
  cardBrand?: string;
  ready: boolean;
};

type CheckoutPaymentContextValue = {
  setup: PaymentSetup | null;
  setSetup: (setup: PaymentSetup | null) => void;
  clearSetup: () => void;
  isReady: (methodId: PaymentId) => boolean;
  detailFor: (methodId: PaymentId) => string | null;
};

const CheckoutPaymentContext = createContext<CheckoutPaymentContextValue | null>(null);

export function CheckoutPaymentProvider({ children }: { children: React.ReactNode }) {
  const [setup, setSetupState] = useState<PaymentSetup | null>(null);

  const setSetup = useCallback((next: PaymentSetup | null) => {
    setSetupState(next);
  }, []);

  const clearSetup = useCallback(() => setSetupState(null), []);

  const isReady = useCallback(
    (methodId: PaymentId) => {
      if (methodId === 'cod') return true;
      return Boolean(setup?.methodId === methodId && setup.ready);
    },
    [setup],
  );

  const detailFor = useCallback(
    (methodId: PaymentId) => {
      if (methodId === 'cod') return 'Espèces au livreur';
      if (setup?.methodId === methodId && setup.ready) return setup.detail;
      return null;
    },
    [setup],
  );

  const value = useMemo(
    () => ({ setup, setSetup, clearSetup, isReady, detailFor }),
    [setup, setSetup, clearSetup, isReady, detailFor],
  );

  return <CheckoutPaymentContext.Provider value={value}>{children}</CheckoutPaymentContext.Provider>;
}

export function useCheckoutPayment() {
  const ctx = useContext(CheckoutPaymentContext);
  if (!ctx) throw new Error('useCheckoutPayment must be used within CheckoutPaymentProvider');
  return ctx;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  const last = digits.slice(-2);
  const mid = digits.slice(-4, -2);
  return `97 *** ${mid} ${last}`.replace(/^97/, digits.startsWith('229') ? '97' : digits.slice(0, 2) || '97');
}

export function maskCard(number: string) {
  const digits = number.replace(/\D/g, '');
  const last4 = digits.slice(-4) || '••••';
  return `•••• ${last4}`;
}
