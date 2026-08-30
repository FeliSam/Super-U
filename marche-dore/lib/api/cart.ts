import { apiFetch } from '@/lib/api/http';
import type { CartLine } from '@/context/CartContext';

export type RemoteCart = {
  ok: true;
  lines: CartLine[];
  promoCode: string | null;
};

export async function apiGetCart(): Promise<RemoteCart | null> {
  try {
    return await apiFetch<RemoteCart>('/me/cart');
  } catch {
    return null;
  }
}

export async function apiPutCart(lines: CartLine[], promoCode: string | null) {
  await apiFetch('/me/cart', {
    method: 'PUT',
    body: JSON.stringify({ lines, promoCode }),
  });
}
