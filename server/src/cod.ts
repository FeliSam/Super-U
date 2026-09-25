/**
 * Paiement à la livraison (COD, `paymentId = 'cod'`) : la quasi-totalité des commandes aujourd'hui.
 *
 * - Commande passée : `payment_status = 'cod_pending'` (non payée, espèces à encaisser).
 * - Livraison confirmée (code client à 4 chiffres, ou clôture « livrée » par le siège) :
 *   → `paid_cash` + ligne ops.order_audit (`cash-collected`) + événement ops.events `payment.cash_collected`.
 *   Le trigger orders émet aussi `order.payment` sur le flux admin.
 * - Échec / annulation : la commande reste (ou redevient) `cod_pending` (rien n'a été encaissé).
 *
 * `payment_status` est dérivé de `payload.paymentStatus` par le trigger orders_before_sync : on écrit donc
 * dans le payload. Les fonctions acceptent un client de transaction ou le pool.
 */
import type pg from 'pg';

type Db = Pick<pg.ClientBase, 'query'>;

export type CodActor = { staffId?: string | null; name?: string | null; role?: string | null; kind?: 'staff' | 'system' };

/** Statuts « non payé » d'une commande COD avant encaissement ('paid' = ancien état déclaré par l'app, jamais vérifié). */
const COD_UNSETTLED = ['cod_pending', 'pending', 'paid'];
const REFUNDED = ['refunded', 'partially_refunded'];

async function journal(db: Db, orderId: string, actor: CodActor, action: string, before: unknown, after: unknown, reason: string, amount: number | null) {
  await db.query(
    `INSERT INTO ops.order_audit (order_id, actor_staff_id, actor_name, actor_role, action, before, after, reason)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
    [orderId, actor.staffId ?? null, actor.name ?? 'Système', actor.role ?? null, action, JSON.stringify(before), JSON.stringify(after), reason],
  );
  await db.query(
    `INSERT INTO ops.events (order_id, actor_kind, actor_id, event_type, payload)
     VALUES ($1, $2, $3, $4, jsonb_build_object('amount', $5::int, 'by', $6::text, 'reason', $7::text))`,
    [orderId, actor.staffId ? 'staff' : 'system', actor.staffId ?? null, action === 'cash-collected' ? 'payment.cash_collected' : 'payment.cash_reverted', amount, actor.name ?? null, reason],
  );
}

/**
 * Livraison confirmée : une commande COD non encore réglée passe à `paid_cash`.
 * Retourne le montant encaissé (ou null si rien à faire : pas COD, déjà réglée, remboursée…).
 */
export async function settleCodOnDelivered(db: Db, orderId: string, actor: CodActor, reason = 'Livraison confirmée par le code client'): Promise<number | null> {
  const r = await db.query<{ total: number; before: string | null }>(
    `WITH cur AS (SELECT id, payment_status AS before FROM orders WHERE id = $1 FOR UPDATE)
     UPDATE orders o
     SET payload = o.payload || jsonb_build_object(
           'paymentStatus', 'paid_cash',
           'cashCollectedAt', to_jsonb(NOW()),
           'cashCollectedBy', $3::text)
     FROM cur
     WHERE o.id = cur.id
       AND o.payment_id = 'cod'
       AND COALESCE(o.payment_status, 'cod_pending') = ANY($2::text[])
     RETURNING o.total, cur.before`,
    [orderId, COD_UNSETTLED, actor.name ?? null],
  );
  const row = r.rows[0];
  if (!row) return null;
  const amount = Number(row.total) || 0;
  await journal(db, orderId, actor, 'cash-collected', { paymentStatus: row.before ?? 'cod_pending' }, { paymentStatus: 'paid_cash', amount }, reason, amount);
  return amount;
}

/**
 * Échec ou annulation : une commande COD reste / redevient `cod_pending` (non payée).
 * Ne touche pas aux commandes remboursées. Retourne true si le statut a changé.
 */
export async function keepCodUnpaid(db: Db, orderId: string, actor: CodActor, reason: string | null): Promise<boolean> {
  const r = await db.query<{ before: string | null }>(
    `WITH cur AS (SELECT id, payment_status AS before FROM orders WHERE id = $1 FOR UPDATE)
     UPDATE orders o
     SET payload = (o.payload - 'cashCollectedAt' - 'cashCollectedBy') || jsonb_build_object('paymentStatus', 'cod_pending')
     FROM cur
     WHERE o.id = cur.id
       AND o.payment_id = 'cod'
       AND o.payment_status IS DISTINCT FROM 'cod_pending'
       AND NOT (COALESCE(o.payment_status, '') = ANY($2::text[]))
     RETURNING cur.before`,
    [orderId, REFUNDED],
  );
  const row = r.rows[0];
  if (!row) return false;
  // Journal seulement si de l'argent avait été compté comme encaissé (sinon simple normalisation).
  if (row.before === 'paid_cash') {
    await journal(db, orderId, actor, 'cash-reverted', { paymentStatus: 'paid_cash' }, { paymentStatus: 'cod_pending' }, reason || 'Commande non livrée', null);
  }
  return true;
}

/** Libellé client / admin d'un statut de paiement (aucun « payé » sans encaissement ou paiement confirmé). */
export function isSettledPaymentStatus(status: string | null | undefined) {
  return status === 'paid' || status === 'paid_cash' || status === 'partially_refunded';
}
