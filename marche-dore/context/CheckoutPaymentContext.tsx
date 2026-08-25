import {
  formatBeninPhone,
  isValidBeninPhone,
  maskBeninPhone,
} from '@/lib/beninPhone';
import { usePayments } from '@/context/PaymentsContext';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type PaymentId = 'om' | 'wave' | 'card' | 'cod';

export type PaymentSetup = {
  methodId: PaymentId;
  label: string;
  detail: string;
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
  const { methodById } = usePayments();

  const setSetup = useCallback((next: PaymentSetup | null) => {
    setSetupState(next);
  }, []);

  const clearSetup = useCallback(() => setSetupState(null), []);

  const isReady = useCallback(
    (methodId: PaymentId) => {
      if (methodId === 'cod') return true;
      if (setup?.methodId === methodId && setup.ready) return true;
      return Boolean(methodById(methodId)?.ready);
    },
    [setup, methodById],
  );

  const detailFor = useCallback(
    (methodId: PaymentId) => {
      if (methodId === 'cod') return 'Espèces au livreur';
      if (setup?.methodId === methodId && setup.ready) return setup.detail;
      const wallet = methodById(methodId);
      if (wallet?.ready) return wallet.detail;
      return null;
    },
    [setup, methodById],
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
  if (isValidBeninPhone(phone)) return maskBeninPhone(phone);
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return maskBeninPhone(formatBeninPhone(phone));
}

export function maskCard(number: string) {
  const digits = number.replace(/\D/g, '');
  const last4 = digits.slice(-4) || '••••';
  return `•••• ${last4}`;
}
