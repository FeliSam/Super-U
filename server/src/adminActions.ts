/**
 * Phase P1b : actions back-office sur les commandes + support, appels, paiements, carte coursiers.
 *
 * Chaque action commande :
 *  - tourne dans UNE transaction (verrou sur la commande, ses jobs ops) ;
 *  - écrit une ligne ops.order_audit (qui, action, avant, après, motif) → trigger → journal temps réel
 *    `order.audit` (+ les événements pick.* / delivery.* / order.* déjà émis par les triggers P1a) ;
 *  - ajoute un ops.events (frise existante de la fiche commande) ;
 *  - notifie le client (user_notifications + push Expo) et le personnel concerné, après COMMIT.
 *
 * Rôles : admin / manager partout ; magasinier limité au ramassage de son magasin
 * (rassemblée, réassigner / libérer le ramasseur). Remboursement : admin / manager.
 */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { Context, Hono } from 'hono';
import { pool, query } from './db.ts';
import { STAFF_SESSION_ALIVE_SQL, touchStaffSession } from './sessions.ts';
import { restockCancelledOrder } from './orders.ts';
import { notifyCustomer, notifyOrderUser, notifyStaff } from './ops.ts';
import { pushToUser } from './push.ts';
import { fedapayConfigured } from './fedapay.ts';

type Staff = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  store_id: string | null;
};

const ORDER_ROLES = new Set(['admin', 'manager', 'magasinier']);
const MANAGER_ROLES = new Set(['admin', 'manager']);
const SUPPORT_ROLES = new Set(['admin', 'manager', 'support']);
const CALL_ROLES = new Set(['admin', 'manager', 'support', 'magasinier']);
const BACKOFFICE_ROLES = new Set(['admin', 'manager', 'magasinier', 'recruteur', 'support']);
const PII_ROLES = new Set(['admin', 'manager', 'magasinier']);

const ACTIVE_PICK = ['assigned', 'picking'];
const HELD_DELIVERY = ['assigned', 'at_store'];
const STARTED_DELIVERY = ['picked_up', 'en_route', 'arrived'];
const OPEN_DELIVERY = [...HELD_DELIVERY, ...STARTED_DELIVERY];
const MAX_ACTIVE_DELIVERIES = 3;
const PRESENCE_SQL = `CASE
  WHEN s.last_seen_at IS NULL OR s.last_seen_at < NOW() - INTERVAL '45 seconds' THEN 'offline'
  WHEN s.duty_status = 'paused' THEN 'paused'
  ELSE 'online' END`;

export type OrderAction =
  | 'packed'
  | 'delivered'
  | 'failed'
  | 'redispatch'
  | 'cancel'
  | 'reassign-picker'
  | 'reassign-courier'
  | 'release-picker'
  | 'release-courier'
  | 'refund';

const ACTION_ROLES: Record<OrderAction, Set<string>> = {
  packed: ORDER_ROLES,
  'reassign-picker': ORDER_ROLES,
  'release-picker': ORDER_ROLES,
  delivered: MANAGER_ROLES,
  failed: MANAGER_ROLES,
  redispatch: MANAGER_ROLES,
  cancel: MANAGER_ROLES,
  'reassign-courier': MANAGER_ROLES,
  'release-courier': MANAGER_ROLES,
  refund: MANAGER_ROLES,
};

class ActionError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 = 409,
    public code = 'invalid_transition',
  ) {
    super(message);
  }
}

// ------------------------------------------------------------------ auth

function bearer(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

async function staffFromToken(token: string | undefined) {
  if (!token) return null;
  const r = await query<Staff>(
    `SELECT s.id, s.first_name, s.last_name, s.role, s.store_id
     FROM ops.staff_sessions sess
     JOIN ops.staff s ON s.id = sess.staff_id
     WHERE sess.token = $1 AND s.is_active = TRUE AND ${STAFF_SESSION_ALIVE_SQL}`,
    [token],
  );
  if (r.rows[0]) touchStaffSession(token);
  return r.rows[0] ?? null;
}

type Ctx = { req: { header: (n: string) => string | undefined }; json: (b: unknown, s?: number) => Response };

async function gate(c: Ctx, roles: Set<string>) {
  const staff = await staffFromToken(bearer(c.req.header('Authorization')));
  if (!staff) return { staff: null, error: c.json({ ok: false, error: 'Session staff requise.' }, 401) };
  if (!roles.has(staff.role)) {
    return { staff: null, error: c.json({ ok: false, code: 'forbidden_role', error: 'Action non autorisée pour votre rôle.' }, 403) };
  }
  return { staff, error: null };
}

/** Même règle que scopedStore() (admin.ts) : l'admin voit tout, les autres leur magasin. */
function scopeOf(staff: Staff) {
  return staff.role === 'admin' ? null : staff.store_id;
}

const staffName = (s: { first_name: string | null; last_name: string | null }) =>
  `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Équipe';

/** Nom client : complet pour les rôles qui voient les PII, « Prénom N. » pour le support. */
function customerLabel(role: string, first: string | null, last: string | null) {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (PII_ROLES.has(role)) return `${f} ${l}`.trim() || 'Client';
  return `${f}${l ? ` ${l.charAt(0).toUpperCase()}.` : ''}`.trim() || 'Client';
}

// ------------------------------------------------------------------ état commande

type OrderState = {
  id: string;
  user_id: string;
  store_id: string | null;
  status: string;
  payment_id: string | null;
  payment_status: string | null;
  payment_ref: string | null;
  total: number;
  payload: Record<string, unknown>;
  pick_id: string | null;
  pick_status: string | null;
  picker_id: string | null;
  del_id: string | null;
  del_status: string | null;
  courier_id: string | null;
  course_id: string | null;
};

async function lockOrder(client: pg.PoolClient, orderId: string, staff: Staff) {
  const r = await client.query<OrderState>(
    `SELECT o.id, o.user_id, o.store_id, o.status, o.payment_id, o.payment_status,
            o.payload->>'paymentRef' AS payment_ref, COALESCE(o.total, 0)::int AS total, o.payload,
            pj.id AS pick_id, pj.status AS pick_status, pj.picker_id,
            d.id AS del_id, d.status AS del_status, d.courier_id, d.course_id
     FROM orders o
     LEFT JOIN ops.pick_jobs pj ON pj.order_id = o.id
     LEFT JOIN ops.deliveries d ON d.order_id = o.id
     WHERE o.id = $1
     FOR UPDATE OF o`,
    [orderId],
  );
  const row = r.rows[0];
  const scope = scopeOf(staff);
  if (!row || (scope && row.store_id !== scope)) throw new ActionError('Commande introuvable.', 404, 'not_found');
  // Verrouille aussi les jobs (les apps CourseGO écrivent dessus).
  await client.query(`SELECT 1 FROM ops.pick_jobs WHERE order_id = $1 FOR UPDATE`, [orderId]);
  await client.query(`SELECT 1 FROM ops.deliveries WHERE order_id = $1 FOR UPDATE`, [orderId]);
  return row;
}

function snapshot(o: OrderState) {
  return {
    status: o.status,
    pickStatus: o.pick_status,
    pickerId: o.picker_id,
    deliveryStatus: o.del_status,
    courierId: o.courier_id,
    paymentStatus: o.payment_status,
  };
}

type PaymentSummary = { paidAmount: number; refunded: number; paymentId: string | null; channel: string | null };

async function paymentSummary(db: pg.PoolClient | typeof pool, o: Pick<OrderState, 'id' | 'payment_id' | 'status' | 'del_status' | 'total'>) {
  const pays = await db.query<{ id: string; amount: number; method: string; provider_id: string | null }>(
    `SELECT id, amount, method, provider_id FROM payments
     WHERE order_id = $1 AND status IN ('paid', 'partially_refunded', 'refunded')
     ORDER BY created_at DESC`,
    [o.id],
  );
  const refunded = await db.query<{ n: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS n FROM public.refunds WHERE order_id = $1 AND status <> 'failed'`,
    [o.id],
  );
  let paidAmount = pays.rows.reduce((a, p) => a + Number(p.amount), 0);
  let channel: string | null = pays.rows[0] ? `fedapay:${pays.rows[0].method}` : null;
  // Paiement à la livraison : l'argent est encaissé une fois la commande livrée.
  if (!paidAmount && o.payment_id === 'cod' && o.del_status === 'delivered') {
    paidAmount = Number(o.total) || 0;
    channel = 'cash';
  }
  return { paidAmount, refunded: Number(refunded.rows[0]?.n ?? 0), paymentId: pays.rows[0]?.id ?? null, channel } as PaymentSummary;
}

/** Actions possibles selon l'état de la commande (sans tenir compte du rôle). */
function stateActions(o: Pick<OrderState, 'status' | 'pick_status' | 'del_status' | 'picker_id' | 'courier_id'>, pay?: PaymentSummary) {
  const out: OrderAction[] = [];
  const closed = o.status === 'cancelled' || o.del_status === 'delivered' || o.del_status === 'cancelled';
  if (!closed) {
    if (o.pick_status && ACTIVE_PICK.includes(o.pick_status)) out.push('packed', 'release-picker');
    if (o.pick_status && ['queued', ...ACTIVE_PICK].includes(o.pick_status)) out.push('reassign-picker');
    if (o.del_status && STARTED_DELIVERY.includes(o.del_status)) out.push('delivered');
    if (o.del_status && OPEN_DELIVERY.includes(o.del_status)) out.push('failed');
    if (o.del_status === 'failed') out.push('redispatch');
    if (o.del_status && ['unassigned', 'offered', ...HELD_DELIVERY].includes(o.del_status)) out.push('reassign-courier');
    if (o.del_status && HELD_DELIVERY.includes(o.del_status)) out.push('release-courier');
    if (!(o.del_status && STARTED_DELIVERY.includes(o.del_status))) out.push('cancel');
  }
  if (pay && pay.paidAmount - pay.refunded > 0) out.push('refund');
  return out;
}

function assertAllowed(action: OrderAction, o: OrderState, staff: Staff, pay?: PaymentSummary) {
  if (!ACTION_ROLES[action].has(staff.role)) {
    throw new ActionError('Action non autorisée pour votre rôle.', 403, 'forbidden_role');
  }
  const possible = stateActions(o, pay);
  if (!possible.includes(action)) {
    throw new ActionError(
      `Action « ${action} » impossible : commande ${o.status}, ramassage ${o.pick_status ?? '—'}, livraison ${o.del_status ?? '—'}.`,
      409,
      'invalid_transition',
    );
  }
}

/** Resynchronise le payload (statut boutique, noms) depuis les jobs ops, dans la transaction. */
async function syncPayload(client: pg.PoolClient, orderId: string, extra: Record<string, unknown> = {}) {
  const r = await client.query<{
    shop: string;
    pick: string | null;
    del: string | null;
    packed_at: Date | null;
    picker_id: string | null;
    courier_id: string | null;
    picker_name: string | null;
    courier_name: string | null;
    courier_phone: string | null;
  }>(
    `SELECT public.map_ops_to_shop_status(pj.status, d.status) AS shop,
            pj.status AS pick, d.status AS del, pj.packed_at, pj.picker_id, d.courier_id,
            NULLIF(trim(concat_ws(' ', pk.first_name, pk.last_name)), '') AS picker_name,
            NULLIF(trim(concat_ws(' ', cr.first_name, cr.last_name)), '') AS courier_name,
            cr.phone AS courier_phone
     FROM ops.pick_jobs pj
     JOIN ops.deliveries d ON d.order_id = pj.order_id
     LEFT JOIN ops.staff pk ON pk.id = pj.picker_id
     LEFT JOIN ops.staff cr ON cr.id = d.courier_id
     WHERE pj.order_id = $1`,
    [orderId],
  );
  const j = r.rows[0];
  const patch: Record<string, unknown> = {
    managedBy: 'ops',
    ...(j
      ? {
          status: j.shop,
          pickStatus: j.pick,
          deliveryStatus: j.del,
          packedAt: j.packed_at ? new Date(j.packed_at).toISOString() : null,
          sameHandler: Boolean(j.picker_id && j.courier_id && j.picker_id === j.courier_id),
          pickerName: j.picker_name,
          courierName: j.courier_name,
          courierPhone: j.courier_phone,
          courierId: j.courier_id,
        }
      : {}),
    ...extra,
  };
  await client.query(
    `UPDATE orders SET payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb, managed_by = 'ops' WHERE id = $1`,
    [orderId, JSON.stringify(patch)],
  );
}

async function reloadState(client: pg.PoolClient, orderId: string) {
  const r = await client.query<OrderState>(
    `SELECT o.id, o.user_id, o.store_id, o.status, o.payment_id, o.payment_status,
            o.payload->>'paymentRef' AS payment_ref, COALESCE(o.total, 0)::int AS total, o.payload,
            pj.id AS pick_id, pj.status AS pick_status, pj.picker_id,
            d.id AS del_id, d.status AS del_status, d.courier_id, d.course_id
     FROM orders o
     LEFT JOIN ops.pick_jobs pj ON pj.order_id = o.id
     LEFT JOIN ops.deliveries d ON d.order_id = o.id
     WHERE o.id = $1`,
    [orderId],
  );
  return r.rows[0];
}

async function writeAudit(
  client: pg.PoolClient,
  staff: Staff,
  orderId: string,
  action: string,
  before: unknown,
  after: unknown,
  reason: string | null,
) {
  const r = await client.query<{ id: string; created_at: Date }>(
    `INSERT INTO ops.order_audit (order_id, actor_staff_id, actor_name, actor_role, action, before, after, reason)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
     RETURNING id::text, created_at`,
    [orderId, staff.id, staffName(staff), staff.role, action, JSON.stringify(before ?? null), JSON.stringify(after ?? null), reason],
  );
  await client.query(
    `INSERT INTO ops.events (order_id, actor_kind, actor_id, event_type, payload)
     VALUES ($1, 'staff', $2, $3, $4::jsonb)`,
    [orderId, staff.id, `admin.${action}`, JSON.stringify({ auditId: r.rows[0].id, reason })],
  );
  return r.rows[0];
}

async function completeCourseIfDone(client: pg.PoolClient, courseId: string | null) {
  if (!courseId) return;
  await client.query(
    `UPDATE ops.courses SET status = 'completed', ended_at = NOW()
     WHERE id = $1 AND status IN ('open', 'in_progress')
       AND NOT EXISTS (
         SELECT 1 FROM ops.deliveries WHERE course_id = $1 AND status NOT IN ('delivered', 'failed', 'cancelled')
       )`,
    [courseId],
  );
}

type Candidate = { id: string; first_name: string; last_name: string; phone: string; store_id: string | null; can_pick: boolean; can_deliver: boolean };

async function loadCandidate(client: pg.PoolClient, staffId: string, storeId: string | null, kind: 'pick' | 'deliver') {
  const r = await client.query<Candidate>(
    `SELECT s.id, s.first_name, s.last_name, s.phone, s.store_id, s.can_pick, s.can_deliver
     FROM ops.staff s
     WHERE s.id = $1 AND s.is_active = TRUE
       AND COALESCE(s.onboard_status, 'active') = 'active'
       AND ($2::text IS NULL OR s.store_id = $2 OR EXISTS (
         SELECT 1 FROM ops.staff_store_affiliations a WHERE a.staff_id = s.id AND a.store_id = $2))
     FOR UPDATE OF s`,
    [staffId, storeId],
  );
  const s = r.rows[0];
  if (!s) throw new ActionError('Collaborateur introuvable, inactif ou rattaché à un autre magasin.', 400, 'bad_staff');
  if (kind === 'pick' && !s.can_pick) throw new ActionError('Ce collaborateur n’est pas habilité au ramassage.', 400, 'bad_staff');
  if (kind === 'deliver' && !s.can_deliver) throw new ActionError('Ce collaborateur n’est pas habilité à la livraison.', 400, 'bad_staff');
  return s;
}

// ------------------------------------------------------------------ exécution d'une action

type ActionInput = { reason: string | null; staffId?: string; amount?: number; target?: string };
type AfterCommit = () => Promise<void>;

async function runAction(orderId: string, action: OrderAction, staff: Staff, input: ActionInput) {
  const client = await pool.connect();
  const later: AfterCommit[] = [];
  let result: Record<string, unknown> = {};
  try {
    await client.query('BEGIN');
    const o = await lockOrder(client, orderId, staff);
    const pay = action === 'refund' ? await paymentSummary(client, o) : undefined;
    assertAllowed(action, o, staff, pay);
    const before = snapshot(o);
    const reason = input.reason;
    const orderLabel = orderId.replace(/^#/, '');

    switch (action) {
      case 'packed': {
        await client.query(
          `UPDATE ops.pick_jobs SET status = 'packed', packed_at = NOW(), updated_at = NOW() WHERE order_id = $1`,
          [orderId],
        );
        await syncPayload(client, orderId);
        later.push(() => notifyOrderUser(orderId, 'pick.packed'));
        break;
      }
      case 'delivered': {
        await client.query(
          `UPDATE ops.deliveries SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE order_id = $1`,
          [orderId],
        );
        await completeCourseIfDone(client, o.course_id);
        await syncPayload(client, orderId, { deliveredBy: 'admin' });
        later.push(() => notifyOrderUser(orderId, 'delivery.delivered'));
        break;
      }
      case 'failed': {
        await client.query(
          `UPDATE ops.deliveries SET status = 'failed', failed_reason = $2, failed_reason_code = 'other', updated_at = NOW()
           WHERE order_id = $1`,
          [orderId, reason],
        );
        await completeCourseIfDone(client, o.course_id);
        await syncPayload(client, orderId);
        later.push(() => notifyOrderUser(orderId, 'delivery.failed'));
        if (o.courier_id) {
          const cid = o.courier_id;
          later.push(() =>
            notifyStaff({ staffId: cid, kind: 'incident', title: 'Livraison clôturée par le siège', body: `${orderLabel} : ${reason}`, orderId, href: '/(tabs)/history' }),
          );
        }
        break;
      }
      case 'redispatch': {
        await client.query(
          `UPDATE ops.deliveries
           SET status = 'unassigned', courier_id = NULL, course_id = NULL, assigned_at = NULL, at_store_at = NULL,
               picked_up_at = NULL, en_route_at = NULL, failed_reason = NULL, failed_reason_code = NULL, updated_at = NOW()
           WHERE order_id = $1`,
          [orderId],
        );
        await syncPayload(client, orderId, { courierName: null, courierPhone: null, courierId: null });
        break;
      }
      case 'cancel': {
        await client.query(
          `UPDATE ops.pick_jobs SET status = 'cancelled', updated_at = NOW() WHERE order_id = $1 AND status <> 'cancelled'`,
          [orderId],
        );
        await client.query(
          `UPDATE ops.deliveries SET status = 'cancelled', updated_at = NOW() WHERE order_id = $1 AND status <> 'cancelled'`,
          [orderId],
        );
        await completeCourseIfDone(client, o.course_id);
        await syncPayload(client, orderId, { status: 'cancelled', cancelledBy: 'staff', cancelReason: reason, cancelledAt: new Date().toISOString() });
        const restored = await restockCancelledOrder(client, orderId, `Annulation back-office ${orderId} : ${reason}`);
        result.restocked = restored;
        later.push(() =>
          notifyCustomer({
            userId: o.user_id,
            id: `order-${orderId}-admin-cancelled`,
            title: 'Commande annulée',
            body: `Votre commande ${orderLabel} a été annulée par Super U. Contactez l’assistance dans l’app pour toute question.`,
            orderId,
            href: `/order/${encodeURIComponent(orderId)}`,
            icon: 'x-circle',
          }),
        );
        for (const sid of new Set([o.picker_id, o.courier_id].filter(Boolean) as string[])) {
          later.push(() => notifyStaff({ staffId: sid, kind: 'job', title: 'Commande annulée', body: `${orderLabel} a été annulée par le siège.`, orderId, href: '/(tabs)/missions' }));
        }
        break;
      }
      case 'reassign-picker': {
        const target = await loadCandidate(client, String(input.staffId ?? ''), o.store_id, 'pick');
        if (target.id === o.picker_id) throw new ActionError('Ce ramasseur a déjà la commande.', 409, 'same_staff');
        const busy = await client.query(
          `SELECT 1 FROM ops.pick_jobs WHERE picker_id = $1 AND status IN ('assigned', 'picking') AND order_id <> $2 LIMIT 1`,
          [target.id, orderId],
        );
        if (busy.rowCount) throw new ActionError(`${staffName(target)} ramasse déjà une autre commande (un colis à la fois).`, 409, 'staff_busy');
        await client.query(
          `UPDATE ops.pick_jobs
           SET picker_id = $2, status = CASE WHEN status = 'queued' THEN 'assigned' ELSE status END,
               assigned_at = NOW(), updated_at = NOW()
           WHERE order_id = $1`,
          [orderId, target.id],
        );
        await syncPayload(client, orderId);
        later.push(() => notifyStaff({ staffId: target.id, kind: 'job', title: 'Ramassage attribué par le siège', body: `${orderLabel} vous a été attribuée.`, orderId, href: `/job/${encodeURIComponent(o.pick_id ?? '')}` }));
        if (o.picker_id) {
          const prev = o.picker_id;
          later.push(() => notifyStaff({ staffId: prev, kind: 'job', title: 'Ramassage réattribué', body: `${orderLabel} a été confiée à un autre ramasseur.`, orderId, href: '/(tabs)/missions' }));
        } else later.push(() => notifyOrderUser(orderId, 'pick.claimed'));
        result.staffId = target.id;
        break;
      }
      case 'release-picker': {
        await client.query(
          `UPDATE ops.pick_jobs SET status = 'queued', picker_id = NULL, assigned_at = NULL, updated_at = NOW() WHERE order_id = $1`,
          [orderId],
        );
        await syncPayload(client, orderId, { pickerName: null });
        if (o.picker_id) {
          const prev = o.picker_id;
          later.push(() => notifyStaff({ staffId: prev, kind: 'job', title: 'Ramassage retiré', body: `${orderLabel} a été remise dans la file par le siège.`, orderId, href: '/(tabs)/missions' }));
        }
        break;
      }
      case 'reassign-courier': {
        const target = await loadCandidate(client, String(input.staffId ?? ''), o.store_id, 'deliver');
        if (target.id === o.courier_id) throw new ActionError('Ce coursier a déjà la livraison.', 409, 'same_staff');
        const load = await client.query<{ held: string; started: string }>(
          `SELECT COUNT(*) FILTER (WHERE status IN ('assigned', 'at_store', 'picked_up', 'en_route', 'arrived'))::text AS held,
                  COUNT(*) FILTER (WHERE status IN ('picked_up', 'en_route', 'arrived'))::text AS started
           FROM ops.deliveries WHERE courier_id = $1 AND order_id <> $2`,
          [target.id, orderId],
        );
        if (Number(load.rows[0]?.started ?? 0) > 0) {
          throw new ActionError(`${staffName(target)} a déjà démarré sa tournée.`, 409, 'staff_busy');
        }
        if (Number(load.rows[0]?.held ?? 0) >= MAX_ACTIVE_DELIVERIES) {
          throw new ActionError(`${staffName(target)} a déjà ${MAX_ACTIVE_DELIVERIES} colis.`, 409, 'staff_busy');
        }
        const course = await client.query<{ id: string }>(
          `SELECT id FROM ops.courses WHERE courier_id = $1 AND status IN ('open', 'in_progress') ORDER BY started_at DESC LIMIT 1`,
          [target.id],
        );
        let courseId = course.rows[0]?.id;
        if (!courseId) {
          courseId = `course-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
          await client.query(`INSERT INTO ops.courses (id, courier_id, store_id, status) VALUES ($1, $2, $3, 'in_progress')`, [
            courseId,
            target.id,
            o.store_id ?? target.store_id,
          ]);
        }
        await client.query(
          `UPDATE ops.deliveries
           SET status = 'assigned', courier_id = $2, course_id = $3, assigned_at = NOW(), at_store_at = NULL, updated_at = NOW()
           WHERE order_id = $1`,
          [orderId, target.id, courseId],
        );
        if (o.course_id && o.course_id !== courseId) await completeCourseIfDone(client, o.course_id);
        await syncPayload(client, orderId);
        later.push(() => notifyStaff({ staffId: target.id, kind: 'job', title: 'Livraison attribuée par le siège', body: `${orderLabel} a été ajoutée à votre tournée.`, orderId, href: '/(tabs)/missions' }));
        later.push(() => notifyOrderUser(orderId, 'delivery.claimed'));
        if (o.courier_id) {
          const prev = o.courier_id;
          later.push(() => notifyStaff({ staffId: prev, kind: 'job', title: 'Livraison réattribuée', body: `${orderLabel} a été confiée à un autre coursier.`, orderId, href: '/(tabs)/missions' }));
        }
        result.staffId = target.id;
        break;
      }
      case 'release-courier': {
        await client.query(
          `UPDATE ops.deliveries
           SET status = 'unassigned', courier_id = NULL, course_id = NULL, assigned_at = NULL, at_store_at = NULL, updated_at = NOW()
           WHERE order_id = $1`,
          [orderId],
        );
        await completeCourseIfDone(client, o.course_id);
        await syncPayload(client, orderId, { courierName: null, courierPhone: null, courierId: null });
        if (o.courier_id) {
          const prev = o.courier_id;
          later.push(() => notifyStaff({ staffId: prev, kind: 'job', title: 'Livraison retirée', body: `${orderLabel} a été retirée de votre tournée par le siège.`, orderId, href: '/(tabs)/missions' }));
        }
        break;
      }
      case 'refund': {
        const remaining = pay!.paidAmount - pay!.refunded;
        const amount = input.amount == null ? remaining : Math.round(input.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
          throw new ActionError(`Montant invalide : entre 1 et ${remaining} F.`, 400, 'bad_amount');
        }
        // FedaPay n'expose pas d'API de remboursement (dashboard marchand uniquement, MTN MoMo) :
        // le remboursement est ENREGISTRÉ ici et doit être exécuté à la main.
        const refundId = `rf-${randomUUID()}`;
        await client.query(
          `INSERT INTO public.refunds (id, order_id, payment_id, amount, method, channel, status, reason, actor_staff_id, actor_name)
           VALUES ($1, $2, $3, $4, 'manual', $5, 'recorded', $6, $7, $8)`,
          [refundId, orderId, pay!.paymentId, amount, pay!.channel, reason, staff.id, staffName(staff)],
        );
        const full = pay!.refunded + amount >= pay!.paidAmount;
        const newStatus = full ? 'refunded' : 'partially_refunded';
        if (pay!.paymentId) {
          await client.query(`UPDATE payments SET status = $2, updated_at = NOW() WHERE id = $1`, [pay!.paymentId, newStatus]);
        }
        await client.query(
          `UPDATE orders SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('paymentStatus', $2::text, 'refundedAmount', $3::int)
           WHERE id = $1`,
          [orderId, newStatus, pay!.refunded + amount],
        );
        result = {
          ...result,
          refund: {
            id: refundId,
            amount,
            method: 'manual',
            channel: pay!.channel,
            manual: true,
            note: pay!.channel === 'cash'
              ? 'Remboursement manuel (espèces) : à remettre au client.'
              : `Remboursement manuel : à effectuer dans le tableau de bord FedaPay (MTN Mobile Money)${fedapayConfigured() ? '' : ' — FedaPay non configuré sur cette API'}.`,
          },
        };
        later.push(() =>
          notifyCustomer({
            userId: o.user_id,
            id: `order-${orderId}-refund-${refundId}`,
            title: 'Remboursement enregistré',
            body: `Un remboursement de ${amount.toLocaleString('fr-FR')} F a été enregistré pour la commande ${orderLabel}. Il vous sera versé sous peu.`,
            orderId,
            href: `/order/${encodeURIComponent(orderId)}`,
            icon: 'wallet',
          }),
        );
        break;
      }
    }

    const fresh = await reloadState(client, orderId);
    const after: Record<string, unknown> = { ...snapshot(fresh) };
    if (action === 'refund') after.amount = (result.refund as { amount: number }).amount;
    if (result.staffId) after.assignedStaffId = result.staffId;
    const audit = await writeAudit(client, staff, orderId, action, before, after, reason);
    await client.query('COMMIT');
    for (const fn of later) await fn().catch((e) => console.warn(`[admin-actions] notification ${action} ${orderId} :`, (e as Error).message));
    return { ok: true, action, orderId, auditId: audit.id, before, after, ...result };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const REASON_REQUIRED = new Set<OrderAction>(['cancel', 'failed', 'refund', 'redispatch']);

function parseReason(body: Record<string, unknown> | null, action: OrderAction) {
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (REASON_REQUIRED.has(action) && reason.length < 3) {
    throw new ActionError('Indiquez un motif (3 caractères minimum).', 400, 'reason_required');
  }
  return reason || null;
}

// ------------------------------------------------------------------ routes

export function registerAdminActionRoutes(app: Hono) {
  const handle = (resolve: (body: Record<string, unknown> | null) => { action: OrderAction; input: Omit<ActionInput, 'reason'> }) =>
    async (c: Context) => {
      const g = await gate(c, ORDER_ROLES);
      if (g.error) return g.error;
      const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      try {
        const { action, input } = resolve(body);
        // Rôle d'abord (403), puis validation du corps (400), puis état de la commande (409).
        if (!ACTION_ROLES[action].has(g.staff!.role)) throw new ActionError('Action non autorisée pour votre rôle.', 403, 'forbidden_role');
        const reason = parseReason(body, action);
        return c.json(await runAction(c.req.param('id') ?? '', action, g.staff!, { ...input, reason }));
      } catch (error) {
        if (error instanceof ActionError) return c.json({ ok: false, code: error.code, error: error.message }, error.status);
        throw error;
      }
    };

  const STATUS_ACTIONS: Record<string, OrderAction> = { packed: 'packed', delivered: 'delivered', failed: 'failed', redispatch: 'redispatch' };
  app.post(
    '/admin/orders/:id/status',
    handle((body) => {
      const action = STATUS_ACTIONS[String(body?.status ?? '')];
      if (!action) throw new ActionError('Statut invalide (packed, delivered, failed, redispatch).', 400, 'bad_status');
      return { action, input: {} };
    }),
  );
  app.post('/admin/orders/:id/cancel', handle(() => ({ action: 'cancel', input: {} })));
  app.post('/admin/orders/:id/reassign-picker', handle((b) => ({ action: 'reassign-picker', input: { staffId: String(b?.staffId ?? '') } })));
  app.post('/admin/orders/:id/reassign-courier', handle((b) => ({ action: 'reassign-courier', input: { staffId: String(b?.staffId ?? '') } })));
  app.post(
    '/admin/orders/:id/release',
    handle((b) => {
      const target = String(b?.target ?? '');
      if (target !== 'picker' && target !== 'courier') throw new ActionError('Précisez target = picker ou courier.', 400, 'bad_target');
      return { action: target === 'picker' ? 'release-picker' : 'release-courier', input: {} };
    }),
  );
  app.post(
    '/admin/orders/:id/refund',
    handle((b) => ({ action: 'refund', input: { amount: b?.amount == null || b?.amount === '' ? undefined : Number(b.amount) } })),
  );

  /** Actions possibles, audit, paiements, remboursements d'une commande (fiche OrderDetail). */
  app.get('/admin/orders/:id/ops', async (c) => {
    const g = await gate(c, ORDER_ROLES);
    if (g.error) return g.error;
    const staff = g.staff!;
    const id = c.req.param('id');
    const scope = scopeOf(staff);
    const client = await pool.connect();
    try {
      const r = await client.query<OrderState & { picker_name: string | null; courier_name: string | null }>(
        `SELECT o.id, o.user_id, o.store_id, o.status, o.payment_id, o.payment_status,
                o.payload->>'paymentRef' AS payment_ref, COALESCE(o.total, 0)::int AS total, o.payload,
                pj.id AS pick_id, pj.status AS pick_status, pj.picker_id,
                d.id AS del_id, d.status AS del_status, d.courier_id, d.course_id
         FROM orders o
         LEFT JOIN ops.pick_jobs pj ON pj.order_id = o.id
         LEFT JOIN ops.deliveries d ON d.order_id = o.id
         WHERE o.id = $1 AND ($2::text IS NULL OR o.store_id = $2)`,
        [id, scope],
      );
      const o = r.rows[0];
      if (!o) return c.json({ ok: false, error: 'Commande introuvable.' }, 404);
      const showMoney = MANAGER_ROLES.has(staff.role);
      const pay = await paymentSummary(client, o);
      const actions = stateActions(o, pay).filter((a) => ACTION_ROLES[a].has(staff.role));
      const audit = await client.query(
        `SELECT id::text, action, actor_name AS "actorName", actor_role AS "actorRole", before, after, reason, created_at AS "createdAt"
         FROM ops.order_audit WHERE order_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100`,
        [id],
      );
      const payments = await client.query(
        `SELECT id, provider_id AS "providerId", amount, method, status, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM payments WHERE order_id = $1 OR id = $2 ORDER BY created_at DESC`,
        [id, o.payment_ref ?? ''],
      );
      const refunds = await client.query(
        `SELECT id, amount, method, channel, status, reason, actor_name AS "actorName", created_at AS "createdAt"
         FROM public.refunds WHERE order_id = $1 ORDER BY created_at DESC`,
        [id],
      );
      const clientClaimedPaid = String(o.payload?.clientPaymentStatus ?? '') === 'paid' || (o.payment_status === 'paid' && !payments.rows.some((p: { status: string }) => p.status === 'paid'));
      const stripAmount = (row: Record<string, unknown>) => {
        if (showMoney) return row;
        const after = row.after && typeof row.after === 'object' ? { ...(row.after as Record<string, unknown>) } : row.after;
        if (after && typeof after === 'object') delete (after as Record<string, unknown>).amount;
        return { ...row, after };
      };
      return c.json({
        ok: true,
        showMoney,
        actions,
        state: {
          status: o.status,
          pickStatus: o.pick_status,
          deliveryStatus: o.del_status,
          pickerId: o.picker_id,
          courierId: o.courier_id,
          paymentId: o.payment_id,
          paymentStatus: o.payment_status,
          paymentRef: o.payment_ref,
          paymentUnverified: clientClaimedPaid,
          skipRef: Boolean(o.payment_ref && o.payment_ref.startsWith('skip-')),
        },
        money: showMoney ? { paid: pay.paidAmount, refunded: pay.refunded, refundable: Math.max(0, pay.paidAmount - pay.refunded), channel: pay.channel } : null,
        audit: audit.rows.map(stripAmount),
        payments: showMoney ? payments.rows : payments.rows.map((p: Record<string, unknown>) => ({ ...p, amount: null })),
        refunds: showMoney ? refunds.rows : refunds.rows.map((p: Record<string, unknown>) => ({ ...p, amount: null })),
        fedapayRefundApi: false,
      });
    } finally {
      client.release();
    }
  });

  /** Personnel proposable pour une réassignation : en ligne d'abord, puis charge croissante. */
  app.get('/admin/orders/:id/candidates', async (c) => {
    const g = await gate(c, ORDER_ROLES);
    if (g.error) return g.error;
    const staff = g.staff!;
    const kind = c.req.query('kind') === 'courier' ? 'courier' : 'picker';
    const scope = scopeOf(staff);
    const ord = await query<{ store_id: string | null }>(
      `SELECT store_id FROM orders WHERE id = $1 AND ($2::text IS NULL OR store_id = $2)`,
      [c.req.param('id'), scope],
    );
    if (!ord.rows[0]) return c.json({ ok: false, error: 'Commande introuvable.' }, 404);
    const storeId = ord.rows[0].store_id;
    const rows = await query<{
      id: string;
      first_name: string;
      last_name: string;
      role: string;
      store_id: string | null;
      vehicle: string | null;
      presence: string;
      last_seen_at: Date | null;
      active_picks: number;
      held: number;
      started: number;
    }>(
      `SELECT s.id, s.first_name, s.last_name, s.role, s.store_id, s.vehicle, ${PRESENCE_SQL} AS presence, s.last_seen_at,
              (SELECT COUNT(*)::int FROM ops.pick_jobs pj WHERE pj.picker_id = s.id AND pj.status IN ('assigned', 'picking')) AS active_picks,
              (SELECT COUNT(*)::int FROM ops.deliveries d WHERE d.courier_id = s.id AND d.status IN ('assigned', 'at_store', 'picked_up', 'en_route', 'arrived')) AS held,
              (SELECT COUNT(*)::int FROM ops.deliveries d WHERE d.courier_id = s.id AND d.status IN ('picked_up', 'en_route', 'arrived')) AS started
       FROM ops.staff s
       WHERE s.is_active = TRUE AND COALESCE(s.onboard_status, 'active') = 'active'
         AND ${kind === 'picker' ? 's.can_pick' : 's.can_deliver'} = TRUE
         AND ($1::text IS NULL OR s.store_id = $1 OR EXISTS (
           SELECT 1 FROM ops.staff_store_affiliations a WHERE a.staff_id = s.id AND a.store_id = $1))
       ORDER BY CASE ${PRESENCE_SQL} WHEN 'online' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
                s.last_seen_at DESC NULLS LAST, s.first_name
       LIMIT 100`,
      [storeId],
    );
    return c.json({
      ok: true,
      kind,
      staff: rows.rows.map((s) => {
        const busyReason =
          kind === 'picker'
            ? s.active_picks > 0
              ? 'Ramasse déjà une commande'
              : null
            : s.started > 0
              ? 'Tournée démarrée'
              : s.held >= MAX_ACTIVE_DELIVERIES
                ? `${MAX_ACTIVE_DELIVERIES} colis déjà`
                : null;
        return {
          id: s.id,
          name: staffName(s),
          role: s.role,
          storeId: s.store_id,
          vehicle: s.vehicle,
          presence: s.presence,
          lastSeenAt: s.last_seen_at,
          load: kind === 'picker' ? s.active_picks : s.held,
          busyReason,
        };
      }),
    });
  });

  /** Dernières positions GPS connues (carte Terrain) ; le flux SSE courier_pos prend ensuite le relais. */
  app.get('/admin/couriers/positions', async (c) => {
    const g = await gate(c, BACKOFFICE_ROLES);
    if (g.error) return g.error;
    const scope = scopeOf(g.staff!);
    const rows = await query<{ c: string; lng: number; lat: number; h: number | null; s: number | null; t: Date; st: string | null }>(
      `SELECT l.courier_id AS c, l.lng, l.lat, l.heading AS h, l.speed_mps AS s, l.updated_at AS t, st.store_id AS st
       FROM ops.courier_locations l
       JOIN ops.staff st ON st.id = l.courier_id
       WHERE st.is_active = TRUE AND l.updated_at > NOW() - INTERVAL '12 hours'
         AND ($1::text IS NULL OR st.store_id = $1)`,
      [scope],
    );
    return c.json({ ok: true, positions: rows.rows });
  });

  // ---------------------------------------------------------------- support

  app.get('/admin/support/threads', async (c) => {
    const g = await gate(c, SUPPORT_ROLES);
    if (g.error) return g.error;
    const staff = g.staff!;
    const rows = await query<{
      id: string;
      user_id: string | null;
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
      updated_at: Date;
      disabled_at: Date | null;
      last_body: string | null;
      last_kind: string | null;
      last_at: Date | null;
      last_sender_kind: string | null;
      unread: number;
      total: number;
      staff_members: number;
    }>(
      `WITH team AS (
         SELECT m.thread_id, MAX(m.last_read_at) AS read_at, COUNT(*)::int AS n
         FROM comms.thread_members m WHERE m.actor_kind = 'staff' GROUP BY m.thread_id
       ), last_staff AS (
         SELECT thread_id, MAX(created_at) AS at FROM comms.messages WHERE sender_kind = 'staff' GROUP BY thread_id
       )
       SELECT t.id, cm.user_id, u.first_name, u.last_name, u.phone, t.updated_at, t.disabled_at,
              lm.body AS last_body, lm.kind AS last_kind, lm.created_at AS last_at, lm.sender_kind AS last_sender_kind,
              (SELECT COUNT(*)::int FROM comms.messages m
                WHERE m.thread_id = t.id AND m.sender_kind = 'customer' AND m.kind IN ('text', 'image')
                  AND m.created_at > GREATEST(COALESCE(team.read_at, 'epoch'), COALESCE(ls.at, 'epoch'))) AS unread,
              (SELECT COUNT(*)::int FROM comms.messages m WHERE m.thread_id = t.id) AS total,
              COALESCE(team.n, 0) AS staff_members
       FROM comms.threads t
       LEFT JOIN comms.thread_members cm ON cm.thread_id = t.id AND cm.actor_kind = 'customer'
       LEFT JOIN users u ON u.id = cm.user_id
       LEFT JOIN team ON team.thread_id = t.id
       LEFT JOIN last_staff ls ON ls.thread_id = t.id
       LEFT JOIN LATERAL (
         SELECT body, kind, created_at, sender_kind FROM comms.messages
         WHERE thread_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1
       ) lm ON TRUE
       WHERE t.kind = 'support' AND t.archived_at IS NULL
         AND EXISTS (SELECT 1 FROM comms.messages m WHERE m.thread_id = t.id)
       ORDER BY COALESCE(lm.created_at, t.updated_at) DESC
       LIMIT 300`,
    );
    const pii = PII_ROLES.has(staff.role);
    return c.json({
      ok: true,
      unreadTotal: rows.rows.reduce((a, r) => a + (r.unread > 0 ? 1 : 0), 0),
      threads: rows.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        customerName: customerLabel(staff.role, r.first_name, r.last_name),
        customerPhone: pii ? r.phone : null,
        lastBody: r.last_kind === 'image' ? '📷 Photo' : r.last_body,
        lastAt: r.last_at,
        lastSenderKind: r.last_sender_kind,
        unread: r.unread,
        total: r.total,
        disabled: Boolean(r.disabled_at),
        staffMembers: r.staff_members,
      })),
    });
  });

  const supportThread = async (id: string) => {
    const r = await query<{ id: string; user_id: string | null; disabled_at: Date | null; first_name: string | null; last_name: string | null; phone: string | null }>(
      `SELECT t.id, cm.user_id, t.disabled_at, u.first_name, u.last_name, u.phone
       FROM comms.threads t
       LEFT JOIN comms.thread_members cm ON cm.thread_id = t.id AND cm.actor_kind = 'customer'
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE t.id = $1 AND t.kind = 'support'
       LIMIT 1`,
      [id],
    );
    return r.rows[0] ?? null;
  };

  const joinThread = (threadId: string, staffId: string, read: boolean) =>
    query(
      `WITH upd AS (
         UPDATE comms.thread_members SET last_read_at = CASE WHEN $3 THEN NOW() ELSE last_read_at END
         WHERE thread_id = $1 AND staff_id = $2 RETURNING id
       )
       INSERT INTO comms.thread_members (thread_id, actor_kind, staff_id, last_read_at)
       SELECT $1, 'staff', $2, CASE WHEN $3 THEN NOW() END
       WHERE NOT EXISTS (SELECT 1 FROM upd)`,
      [threadId, staffId, read],
    );

  app.get('/admin/support/threads/:id', async (c) => {
    const g = await gate(c, SUPPORT_ROLES);
    if (g.error) return g.error;
    const staff = g.staff!;
    const th = await supportThread(c.req.param('id'));
    if (!th) return c.json({ ok: false, error: 'Conversation introuvable.' }, 404);
    const msgs = await query<{
      id: string;
      sender_kind: string;
      sender_staff_id: string | null;
      kind: string;
      body: string;
      payload: Record<string, unknown>;
      created_at: Date;
      staff_first: string | null;
      staff_last: string | null;
    }>(
      `SELECT m.id, m.sender_kind, m.sender_staff_id, m.kind, m.body, m.payload, m.created_at,
              s.first_name AS staff_first, s.last_name AS staff_last
       FROM comms.messages m LEFT JOIN ops.staff s ON s.id = m.sender_staff_id
       WHERE m.thread_id = $1 ORDER BY m.created_at DESC, m.id DESC LIMIT 200`,
      [th.id],
    );
    const orders = th.user_id
      ? await query(
          `SELECT id, status, created_at AS "createdAt" FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
          [th.user_id],
        )
      : { rows: [] };
    return c.json({
      ok: true,
      thread: {
        id: th.id,
        userId: th.user_id,
        customerName: customerLabel(staff.role, th.first_name, th.last_name),
        customerPhone: PII_ROLES.has(staff.role) ? th.phone : null,
        disabled: Boolean(th.disabled_at),
      },
      orders: orders.rows,
      messages: msgs.rows.reverse().map((m) => ({
        id: m.id,
        senderKind: m.sender_kind,
        senderName: m.sender_kind === 'staff' ? staffName({ first_name: m.staff_first, last_name: m.staff_last }) : null,
        mine: m.sender_staff_id === staff.id,
        kind: m.kind,
        body: m.body,
        createdAt: m.created_at,
      })),
    });
  });

  app.post('/admin/support/threads/:id/read', async (c) => {
    const g = await gate(c, SUPPORT_ROLES);
    if (g.error) return g.error;
    const th = await supportThread(c.req.param('id'));
    if (!th) return c.json({ ok: false, error: 'Conversation introuvable.' }, 404);
    await joinThread(th.id, g.staff!.id, true);
    return c.json({ ok: true });
  });

  app.post('/admin/support/threads/:id/messages', async (c) => {
    const g = await gate(c, SUPPORT_ROLES);
    if (g.error) return g.error;
    const staff = g.staff!;
    const th = await supportThread(c.req.param('id'));
    if (!th) return c.json({ ok: false, error: 'Conversation introuvable.' }, 404);
    if (th.disabled_at) return c.json({ ok: false, error: 'Conversation désactivée par le client.' }, 409);
    const body = await c.req.json().catch(() => null);
    const text = String(body?.body ?? '').trim().slice(0, 4000);
    if (!text) return c.json({ ok: false, error: 'Message vide.' }, 400);
    // Le membre staff est ajouté au fil : le client voit la réponse (ChatContext : sender_kind ≠ customer → « them »)
    // et les prochains messages du client notifient ce membre (route /comms/threads/:id/messages existante).
    await joinThread(th.id, staff.id, true);
    const msgId = `msg-${randomUUID()}`;
    await query(
      `INSERT INTO comms.messages (id, thread_id, sender_kind, sender_staff_id, kind, body, payload)
       VALUES ($1, $2, 'staff', $3, 'text', $4, $5::jsonb)`,
      [msgId, th.id, staff.id, text, JSON.stringify({ via: 'admin-panel' })],
    );
    await query(`UPDATE comms.threads SET updated_at = NOW() WHERE id = $1`, [th.id]);
    if (th.user_id) {
      void pushToUser(th.user_id, {
        title: 'Assistance Marché Doré',
        body: text.slice(0, 160),
        href: '/chat/support',
        kind: 'chat',
      }).catch(() => undefined);
    }
    return c.json({ ok: true, message: { id: msgId, senderKind: 'staff', senderName: staffName(staff), mine: true, kind: 'text', body: text, createdAt: new Date().toISOString() } });
  });

  // ---------------------------------------------------------------- journal d'appels

  app.get('/admin/calls', async (c) => {
    const g = await gate(c, CALL_ROLES);
    if (g.error) return g.error;
    const staff = g.staff!;
    const scope = scopeOf(staff);
    const filter = c.req.query('filter') ?? 'all';
    const rows = await query<{
      id: string;
      thread_id: string;
      thread_kind: string | null;
      order_id: string | null;
      media: string;
      status: string;
      end_reason: string | null;
      started_at: Date;
      answered_at: Date | null;
      ended_at: Date | null;
      caller_kind: string;
      callee_kind: string;
      caller_staff: string | null;
      callee_staff: string | null;
      caller_uf: string | null;
      caller_ul: string | null;
      callee_uf: string | null;
      callee_ul: string | null;
    }>(
      `SELECT k.id, k.thread_id, t.kind AS thread_kind, k.order_id, k.media, k.status, k.end_reason,
              k.started_at, k.answered_at, k.ended_at, k.caller_kind, k.callee_kind,
              NULLIF(trim(concat_ws(' ', cs.first_name, cs.last_name)), '') AS caller_staff,
              NULLIF(trim(concat_ws(' ', ks.first_name, ks.last_name)), '') AS callee_staff,
              cu.first_name AS caller_uf, cu.last_name AS caller_ul, ku.first_name AS callee_uf, ku.last_name AS callee_ul
       FROM comms.calls k
       LEFT JOIN comms.threads t ON t.id = k.thread_id
       LEFT JOIN orders o ON o.id = k.order_id
       LEFT JOIN ops.staff cs ON cs.id = k.caller_staff_id
       LEFT JOIN ops.staff ks ON ks.id = k.callee_staff_id
       LEFT JOIN users cu ON cu.id = k.caller_user_id
       LEFT JOIN users ku ON ku.id = k.callee_user_id
       WHERE ($1::text IS NULL OR k.order_id IS NULL OR o.store_id = $1)
         AND ($2::text <> 'missed' OR k.status IN ('missed', 'rejected') OR (k.status = 'canceled' AND k.answered_at IS NULL))
       ORDER BY k.started_at DESC
       LIMIT 300`,
      [scope, filter],
    );
    const who = (kind: string, staffNm: string | null, uf: string | null, ul: string | null) =>
      kind === 'staff' ? staffNm || 'Équipe' : customerLabel(staff.role, uf, ul);
    const list = rows.rows.map((k) => {
      const missed = ['missed', 'rejected'].includes(k.status) || (k.status === 'canceled' && !k.answered_at);
      const live = ['initiated', 'ringing', 'accepted'].includes(k.status);
      return {
        id: k.id,
        threadId: k.thread_id,
        threadKind: k.thread_kind,
        orderId: k.order_id,
        media: k.media,
        status: k.status,
        endReason: k.end_reason,
        startedAt: k.started_at,
        answeredAt: k.answered_at,
        endedAt: k.ended_at,
        durationS: k.answered_at && k.ended_at ? Math.max(0, Math.round((+new Date(k.ended_at) - +new Date(k.answered_at)) / 1000)) : null,
        missed,
        live,
        caller: { kind: k.caller_kind, name: who(k.caller_kind, k.caller_staff, k.caller_uf, k.caller_ul) },
        callee: { kind: k.callee_kind, name: who(k.callee_kind, k.callee_staff, k.callee_uf, k.callee_ul) },
      };
    });
    return c.json({
      ok: true,
      counts: { total: list.length, missed: list.filter((k) => k.missed).length, live: list.filter((k) => k.live).length },
      calls: list,
    });
  });

  // ---------------------------------------------------------------- paiements

  app.get('/admin/payments', async (c) => {
    const g = await gate(c, MANAGER_ROLES);
    if (g.error) return g.error;
    const staff = g.staff!;
    const scope = scopeOf(staff);
    const status = (c.req.query('status') ?? '').trim();
    const q = (c.req.query('q') ?? '').trim().replace(/%/g, '');
    const values: unknown[] = [scope];
    const where = ['($1::text IS NULL OR o.store_id = $1 OR o.id IS NULL)'];
    if (status) {
      values.push(status);
      where.push(`p.status = $${values.length}`);
    }
    if (q) {
      values.push(`%${q}%`);
      where.push(`(p.id ILIKE $${values.length} OR COALESCE(p.provider_id, '') ILIKE $${values.length} OR COALESCE(p.order_id, '') ILIKE $${values.length} OR u.last_name ILIKE $${values.length} OR u.first_name ILIKE $${values.length})`);
    }
    const payments = await query(
      `SELECT p.id, p.provider_id AS "providerId", p.amount, p.method, p.status, p.order_id AS "orderId",
              p.created_at AS "createdAt", p.updated_at AS "updatedAt",
              NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '') AS "customerName",
              o.total AS "orderTotal", o.status AS "orderStatus",
              (SELECT COALESCE(SUM(r.amount), 0)::int FROM public.refunds r WHERE r.payment_id = p.id AND r.status <> 'failed') AS refunded
       FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN orders o ON o.id = p.order_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.created_at DESC
       LIMIT 300`,
      values,
    );
    // Commandes marquées payées (ou déclarées payées par l'app) sans paiement confirmé :
    // réf « skip-… » envoyée par les builds actuels de Marché Doré, qui n'appellent pas FedaPay.
    const flagged = await query(
      `SELECT o.id, o.status, o.total, o.payment_id AS "paymentId", o.payment_status AS "paymentStatus",
              o.payload->>'paymentRef' AS "paymentRef", o.payload->>'clientPaymentStatus' AS "clientPaymentStatus",
              o.created_at AS "createdAt", o.store_name AS "storeName",
              NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '') AS "customerName",
              CASE WHEN COALESCE(o.payload->>'paymentRef', '') LIKE 'skip-%' THEN 'skip_ref'
                   WHEN o.payment_status = 'paid' THEN 'paid_without_payment'
                   ELSE 'client_claimed_paid' END AS flag
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE ($1::text IS NULL OR o.store_id = $1)
         AND COALESCE(o.payment_id, '') <> 'cod'
         AND (o.payment_status = 'paid' OR o.payload->>'clientPaymentStatus' = 'paid' OR COALESCE(o.payload->>'paymentRef', '') LIKE 'skip-%')
         AND NOT EXISTS (
           SELECT 1 FROM payments p WHERE (p.order_id = o.id OR p.id = o.payload->>'paymentRef')
             AND p.status IN ('paid', 'partially_refunded', 'refunded'))
       ORDER BY o.created_at DESC
       LIMIT 300`,
      [scope],
    );
    const counts = await query<{ status: string; n: number; amount: number }>(
      `SELECT p.status, COUNT(*)::int AS n, COALESCE(SUM(p.amount), 0)::int AS amount
       FROM payments p LEFT JOIN orders o ON o.id = p.order_id
       WHERE ($1::text IS NULL OR o.store_id = $1 OR o.id IS NULL)
       GROUP BY p.status`,
      [scope],
    );
    return c.json({
      ok: true,
      fedapayConfigured: fedapayConfigured(),
      fedapayRefundApi: false,
      counts: counts.rows,
      payments: payments.rows,
      flagged: flagged.rows,
    });
  });
}
