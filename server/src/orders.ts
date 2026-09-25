import type pg from 'pg';

/**
 * Intégrité des commandes boutique (POST /me/orders, PATCH /me/orders/:id).
 * Le serveur recalcule prix et totaux depuis le catalogue : les montants envoyés par l'app sont ignorés.
 */

export class OrderRequestError extends Error {
  status: 400 | 404 | 409;
  code: string;
  constructor(message: string, status: 400 | 404 | 409, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Frais de livraison : même règle que l'app (1500 F, doublés pour le créneau « urgent »). */
export const DELIVERY_FEE = Math.max(0, Math.round(Number(process.env.ORDER_DELIVERY_FEE ?? 1500)));
const MAX_QTY = 99;
const PAYMENT_STATUSES = new Set(['paid', 'cod_pending', 'pending']);

type ClientLine = { productId?: unknown; qty?: unknown; name?: unknown; unit?: unknown };

export type PricedLine = { productId: string; name: string; unit: string; qty: number; unitPrice: number };

export async function priceOrder(client: pg.PoolClient, order: Record<string, unknown>) {
  const rawLines = Array.isArray(order.lines) ? (order.lines as ClientLine[]) : [];
  const merged = new Map<string, { qty: number; name: string; unit: string }>();
  for (const line of rawLines) {
    const productId = String(line?.productId ?? '').trim();
    if (!productId) continue;
    const qty = Math.floor(Number(line?.qty));
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new OrderRequestError('Quantité invalide dans le panier.', 400, 'invalid_qty');
    }
    const prev = merged.get(productId);
    merged.set(productId, {
      qty: Math.min(MAX_QTY, (prev?.qty ?? 0) + qty),
      name: prev?.name ?? String(line?.name ?? '').trim(),
      unit: prev?.unit ?? String(line?.unit ?? '').trim(),
    });
  }
  if (!merged.size) throw new OrderRequestError('Votre panier est vide.', 400, 'empty_cart');

  const storeId =
    typeof order.storeId === 'string' && order.storeId.trim() ? order.storeId.trim() : 'su-aeroport';
  const store = await client.query<{ id: string; payload: Record<string, unknown> }>(
    'SELECT id, payload FROM stores WHERE id = $1',
    [storeId],
  );
  if (!store.rows[0]) {
    throw new OrderRequestError('Magasin inconnu. Choisissez un Super U puis réessayez.', 400, 'unknown_store');
  }

  const ids = [...merged.keys()];
  const products = await client.query<{ id: string; payload: Record<string, unknown>; active: boolean | null }>(
    `SELECT id, payload, active FROM products WHERE id = ANY($1::text[])`,
    [ids],
  );
  const byId = new Map(products.rows.map((row) => [row.id, row]));
  const lines: PricedLine[] = [];
  for (const [productId, wanted] of merged) {
    const row = byId.get(productId);
    const price = Math.round(Number(row?.payload?.price));
    if (!row || row.active === false || !Number.isFinite(price) || price <= 0) {
      const label = wanted.name || String(row?.payload?.name ?? '') || productId;
      throw new OrderRequestError(
        `Article indisponible : ${label}. Retirez-le du panier puis réessayez.`,
        400,
        'product_unavailable',
      );
    }
    lines.push({
      productId,
      name: String(row.payload.name ?? wanted.name ?? 'Article'),
      unit: wanted.unit || String(row.payload.unit ?? ''),
      qty: wanted.qty,
      unitPrice: price,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);
  const delivery = DELIVERY_FEE * (order.slotId === 'urgent' ? 2 : 1);
  const discount = 0; // codes promo inactifs côté app ; aucune remise acceptée du client
  const total = Math.max(0, subtotal + delivery - discount);
  const clientTotal = Number(order.total);
  const paymentStatus = PAYMENT_STATUSES.has(String(order.paymentStatus))
    ? String(order.paymentStatus)
    : order.paymentId === 'cod'
      ? 'cod_pending'
      : 'pending';

  return {
    payload: {
      ...order,
      lines,
      itemCount,
      subtotal,
      delivery,
      discount,
      total,
      paymentStatus,
      storeId,
      storeName: String(store.rows[0].payload?.name ?? order.storeName ?? storeId),
      status: 'confirmed',
      managedBy: 'shop',
    } as Record<string, unknown>,
    total,
    clientTotalMismatch: Number.isFinite(clientTotal) && clientTotal !== total,
  };
}

/** Statuts depuis lesquels le client peut annuler (même règle que canCancelOrder dans Marché Doré). */
export function isCancellable(row: { status: string; pick_status: string | null; delivery_status: string | null }) {
  return (
    row.status === 'confirmed' &&
    (row.pick_status == null || row.pick_status === 'queued') &&
    (row.delivery_status == null || row.delivery_status === 'unassigned' || row.delivery_status === 'offered')
  );
}

/** Réintègre le stock vendu (mouvements « sale ») d'une commande annulée. Idempotent. */
export async function restockCancelledOrder(client: pg.PoolClient, orderId: string, note: string) {
  const sold = await client.query<{ product_id: string; store_id: string; qty: string }>(
    `SELECT m.product_id, m.store_id, SUM(-m.delta)::text AS qty
     FROM stock_moves m
     WHERE m.ref_type = 'order' AND m.ref_id = $1 AND m.reason = 'sale'
       AND NOT EXISTS (
         SELECT 1 FROM stock_moves c
         WHERE c.ref_type = 'order' AND c.ref_id = m.ref_id AND c.reason = 'cancel'
           AND c.product_id = m.product_id AND c.store_id = m.store_id
       )
     GROUP BY m.product_id, m.store_id`,
    [orderId],
  );
  const restored: { productId: string; storeId: string; qty: number }[] = [];
  for (const row of sold.rows) {
    const qty = Number(row.qty);
    if (!(qty > 0)) continue;
    const updated = await client.query<{ qty_before: string; qty_after: string }>(
      `UPDATE product_stock SET qty = qty + $3, updated_at = NOW()
       WHERE product_id = $1 AND store_id = $2
       RETURNING (qty - $3)::text AS qty_before, qty::text AS qty_after`,
      [row.product_id, row.store_id, qty],
    );
    if (!updated.rows[0]) continue;
    await client.query(
      `INSERT INTO stock_moves (
         id, product_id, store_id, delta, reason, ref_type, ref_id, note, qty_before, qty_after
       ) VALUES ($1, $2, $3, $4, 'cancel', 'order', $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [
        `cancel-${orderId.replace(/[^a-zA-Z0-9-]/g, '')}-${row.product_id}`,
        row.product_id,
        row.store_id,
        qty,
        orderId,
        note,
        updated.rows[0].qty_before,
        updated.rows[0].qty_after,
      ],
    );
    restored.push({ productId: row.product_id, storeId: row.store_id, qty });
  }
  return restored;
}
