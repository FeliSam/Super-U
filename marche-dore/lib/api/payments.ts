import { ApiError, apiFetch } from '@/lib/api/http';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

export type OnlinePaymentStatus = 'pending' | 'paid' | 'failed';

export type OnlinePayment = {
  id: string;
  status: OnlinePaymentStatus;
  checkoutUrl: string | null;
  amount: number;
  method: string;
};

export async function apiCreatePayment(input: {
  amount: number;
  method: 'om' | 'wave' | 'card';
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}): Promise<OnlinePayment> {
  const res = await apiFetch<{ ok: true; payment: OnlinePayment }>('/me/payments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.payment;
}

export async function apiGetPayment(id: string): Promise<OnlinePayment> {
  const res = await apiFetch<{ ok: true; payment: OnlinePayment }>(
    `/me/payments/${encodeURIComponent(id)}`,
  );
  return res.payment;
}

async function openCheckout(url: string, existing?: Window | null) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (existing && !existing.closed) {
      existing.location.href = url;
      return;
    }
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.assign(url);
    }
    return;
  }
  const returnUrl = Linking.createURL('checkout');
  await WebBrowser.openAuthSessionAsync(url, returnUrl);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ouvre FedaPay et attend le statut approved (max ~3 min). */
export async function collectOnlinePayment(input: {
  amount: number;
  method: 'om' | 'wave' | 'card';
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  checkoutWindow?: Window | null;
}): Promise<{ ok: true; payment: OnlinePayment } | { ok: false; error: string }> {
  try {
    const created = await apiCreatePayment(input);
    if (created.checkoutUrl) {
      await openCheckout(created.checkoutUrl, input.checkoutWindow);
    } else {
      input.checkoutWindow?.close();
    }
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      await sleep(2000);
      const current = await apiGetPayment(created.id);
      if (current.status === 'paid') return { ok: true, payment: current };
      if (current.status === 'failed') {
        return { ok: false, error: 'Paiement refusé ou annulé. Réessayez ou changez de moyen.' };
      }
    }
    return { ok: false, error: 'Paiement non confirmé à temps. Vérifiez Orange Money / MoMo / votre banque.' };
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Impossible de lancer le paiement.';
    return { ok: false, error: message };
  }
}
