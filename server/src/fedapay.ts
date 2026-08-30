const SANDBOX = 'https://sandbox-api.fedapay.com/v1';
const LIVE = 'https://api.fedapay.com/v1';

export function fedapayConfigured() {
  return Boolean(process.env.FEDAPAY_SECRET_KEY?.trim());
}

function baseUrl() {
  return process.env.FEDAPAY_ENV === 'live' ? LIVE : SANDBOX;
}

function unwrapTx(data: Record<string, unknown>) {
  const nested =
    data['v1/transaction'] ?? data.transaction ?? data;
  return (nested && typeof nested === 'object' ? nested : data) as Record<string, unknown>;
}

async function fedapayFetch(path: string, init: RequestInit = {}) {
  const key = process.env.FEDAPAY_SECRET_KEY?.trim();
  if (!key) throw new Error('FEDAPAY_SECRET_KEY manquante');
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const msg =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      `FedaPay HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function createFedapayCheckout(input: {
  amount: number;
  description: string;
  callbackUrl: string;
  customer: {
    firstname: string;
    lastname: string;
    email: string;
    phone?: string;
  };
}) {
  const amount = Math.max(1, Math.round(input.amount));
  const national = (input.customer.phone ?? '').replace(/\D/g, '').replace(/^229/, '');
  const phone = national.length === 10 ? national : national.slice(-8);
  const body: Record<string, unknown> = {
    description: input.description,
    amount,
    currency: { iso: 'XOF' },
    callback_url: input.callbackUrl,
    customer: {
      firstname: input.customer.firstname || 'Client',
      lastname: input.customer.lastname || 'Marché Doré',
      email: input.customer.email || 'client@marchedore.bj',
      ...(phone.length === 8 || phone.length === 10
        ? { phone_number: { number: Number(phone), country: 'bj' } }
        : {}),
    },
  };
  const created = unwrapTx(await fedapayFetch('/transactions', { method: 'POST', body: JSON.stringify(body) }));
  const id = String(created.id ?? '');
  if (!id) throw new Error('Transaction FedaPay invalide');
  const tokenRes = await fedapayFetch(`/transactions/${encodeURIComponent(id)}/token`, { method: 'POST' });
  const url = typeof tokenRes.url === 'string' ? tokenRes.url : '';
  if (!url) throw new Error('Lien de paiement FedaPay introuvable');
  return {
    providerId: id,
    checkoutUrl: url,
    status: String(created.status ?? 'pending'),
  };
}

export async function getFedapayTransaction(providerId: string) {
  const tx = unwrapTx(await fedapayFetch(`/transactions/${encodeURIComponent(providerId)}`));
  return {
    providerId: String(tx.id ?? providerId),
    status: String(tx.status ?? 'pending').toLowerCase(),
    amount: Number(tx.amount) || 0,
  };
}

export function mapFedapayStatus(status: string) {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'transferred') return 'paid';
  if (s === 'canceled' || s === 'cancelled' || s === 'declined' || s === 'failed') return 'failed';
  return 'pending';
}
