import type { Order } from '@/context/OrdersContext';

/** Produits déjà livrés (achat vérifié) — seuls ceux-là peuvent recevoir un avis. */
export function purchasedProductIds(orders: Order[]): Set<string> {
  const ids = new Set<string>();
  for (const order of orders) {
    if (order.status !== 'delivered') continue;
    for (const line of order.lines) {
      if (line.productId) ids.add(line.productId);
    }
  }
  return ids;
}

export function hasPurchasedProduct(orders: Order[], productId: string): boolean {
  return purchasedProductIds(orders).has(productId);
}
