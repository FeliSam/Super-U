import type { Hono } from 'hono';
import { randomBytes, randomUUID } from 'node:crypto';
import { pool, query } from './db.ts';
import {
  actionsForReason,
  asClientAction,
  asReasonCode,
  CLIENT_ACTIONS,
  failedClientBody,
  isPaidOrder,
  REASON_LABELS,
} from './incidents.ts';
import { trackingRowToLive } from './live.ts';
import { productBarcode } from './productMedia.ts';
import { hashPassword, newToken, verifyPassword } from './password.ts';

type StaffRow = {
  id: string;
  email: string;
  phone: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: 'picker' | 'courier' | 'coursier' | 'dispatcher' | 'both';
  can_pick: boolean;
  can_deliver: boolean;
  store_id: string | null;
  vehicle: string | null;
  is_active: boolean;
  photo_data?: string | null;
  onboard_status?: string;
  must_reset_password?: boolean;
};

function publicStaff(row: StaffRow, extra?: { ratingAvg?: number; ratingCount?: number }) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    canPick: row.can_pick !== false,
    canDeliver: row.can_deliver !== false,
    storeId: row.store_id,
    vehicle: row.vehicle,
    photoUrl: row.photo_data ? `/ops/staff/${row.id}/photo` : null,
    ratingAvg: extra?.ratingAvg ?? 0,
    ratingCount: extra?.ratingCount ?? 0,
    mustResetPassword: Boolean(row.must_reset_password),
    onboardStatus: row.onboard_status ?? 'active',
  };
}

async function staffWithScore(row: StaffRow) {
  const s = await query<{ avg: string; n: string }>(
    `SELECT COALESCE(AVG(r.rating), 0)::text AS avg, COUNT(*)::text AS n
     FROM ops.order_ratings r
     JOIN ops.deliveries d ON d.order_id = r.order_id
     WHERE d.courier_id = $1 AND r.rater_kind = 'customer'`,
    [row.id],
  );
  const prof = await query<{
    vehicle_plate: string;
    owns_vehicle: boolean;
    needs_kit: boolean;
    id_number: string;
    has_license: boolean;
    license_number: string;
    residence_line: string;
    residence_city: string;
    has_insurance: boolean;
    insurance_ref: string;
  }>(
    `SELECT vehicle_plate, owns_vehicle, needs_kit, id_number, has_license, license_number,
            residence_line, residence_city, has_insurance, insurance_ref
     FROM ops.staff_profiles WHERE staff_id = $1`,
    [row.id],
  );
  const stores = await staffStoreIds({ id: row.id, store_id: row.store_id } as StaffRow);
  const p = prof.rows[0];
  return {
    ...publicStaff(row, {
      ratingAvg: Number(s.rows[0]?.avg ?? 0),
      ratingCount: Number(s.rows[0]?.n ?? 0),
    }),
    profile: {
      vehiclePlate: p?.vehicle_plate ?? '',
      ownsVehicle: Boolean(p?.owns_vehicle),
      needsKit: Boolean(p?.needs_kit),
      idNumber: p?.id_number ?? '',
      hasLicense: Boolean(p?.has_license),
      licenseNumber: p?.license_number ?? '',
      residenceLine: p?.residence_line ?? '',
      residenceCity: p?.residence_city ?? '',
      hasInsurance: Boolean(p?.has_insurance),
      insuranceRef: p?.insurance_ref ?? '',
      storeIds: stores,
    },
  };
}

function bearer(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

function routeId(raw: string | undefined) {
  const value = raw ?? '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function staffFromToken(token: string | undefined) {
  if (!token) return null;
  const result = await query<StaffRow>(
    `SELECT s.* FROM ops.staff_sessions sess
     JOIN ops.staff s ON s.id = sess.staff_id
     WHERE sess.token = $1 AND s.is_active = TRUE`,
    [token],
  );
  return result.rows[0] ?? null;
}

function canPick(staff: StaffRow) {
  return staff.can_pick !== false;
}

function canDeliver(staff: StaffRow) {
  return staff.can_deliver !== false;
}

function staffLabel(staff: StaffRow) {
  return { id: staff.id, name: `${staff.first_name} ${staff.last_name}`.trim(), phone: staff.phone };
}

async function patchOrderPayload(
  orderId: string,
  patch: Record<string, unknown>,
  names?: {
    picker?: { id?: string; name: string; phone: string };
    courier?: { id?: string; name: string; phone: string };
  },
) {
  const found = await query<{ payload: Record<string, unknown> }>(
    'SELECT payload FROM orders WHERE id = $1',
    [orderId],
  );
  const row = found.rows[0];
  if (!row) return null;
  const payload = {
    ...row.payload,
    ...patch,
    managedBy: 'ops',
    ...(names?.picker ? { pickerName: names.picker.name } : {}),
    ...(names?.courier
      ? {
          courierName: names.courier.name,
          courierPhone: names.courier.phone,
          courierId: names.courier.id,
        }
      : {}),
  };
  await query(
    `UPDATE orders SET payload = $2::jsonb, managed_by = 'ops' WHERE id = $1`,
    [orderId, JSON.stringify(payload)],
  );
  return payload;
}

async function restoreUnavailableOrderStock(orderId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lines = await client.query<{
      product_id: string;
      restore_qty: string;
      store_id: string;
    }>(
      `SELECT l.product_id,
              GREATEST(l.qty - COALESCE(l.picked_qty, 0), 0)::text AS restore_qty,
              COALESCE(o.store_id, 'su-aeroport') AS store_id
       FROM order_lines l
       JOIN orders o ON o.id = l.order_id
       WHERE l.order_id = $1 AND l.unavailable = TRUE
         AND GREATEST(l.qty - COALESCE(l.picked_qty, 0), 0) > 0
       ORDER BY l.product_id`,
      [orderId],
    );
    for (const line of lines.rows) {
      const stock = await client.query<{ qty: string }>(
        `SELECT qty::text FROM product_stock
         WHERE product_id = $1 AND store_id = $2
         FOR UPDATE`,
        [line.product_id, line.store_id],
      );
      const before = Number(stock.rows[0]?.qty ?? 0);
      const restore = Number(line.restore_qty);
      const move = await client.query<{ id: string }>(
        `INSERT INTO stock_moves (
           id, product_id, store_id, delta, reason, ref_type, ref_id, note, qty_before, qty_after
         ) VALUES ($1, $2, $3, $4, 'pick_unavailable', 'order', $5, $6, $7, $8)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          `unavailable-${orderId.replace(/[^a-zA-Z0-9-]/g, '')}-${line.product_id}`,
          line.product_id,
          line.store_id,
          restore,
          orderId,
          `Restitution non livré ${orderId}`,
          before,
          before + restore,
        ],
      );
      if (move.rows[0]) {
        await client.query(
          `UPDATE product_stock SET qty = qty + $3, updated_at = NOW()
           WHERE product_id = $1 AND store_id = $2`,
          [line.product_id, line.store_id, restore],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function mappedShopStatus(orderId: string) {
  const found = await query<{ shop: string }>(
    `SELECT public.map_ops_to_shop_status(pj.status, d.status) AS shop
     FROM ops.pick_jobs pj
     JOIN ops.deliveries d ON d.order_id = pj.order_id
     WHERE pj.order_id = $1`,
    [orderId],
  );
  return found.rows[0]?.shop ?? 'confirmed';
}

async function syncShopFromOps(orderId: string, courier?: { name: string; phone: string }) {
  const jobs = await query<{
    shop: string;
    pick: string;
    del: string;
    packed_at: Date | null;
    picker_id: string | null;
    courier_id: string | null;
  }>(
    `SELECT
       public.map_ops_to_shop_status(pj.status, d.status) AS shop,
       pj.status AS pick,
       d.status AS del,
       pj.packed_at,
       pj.picker_id,
       d.courier_id
     FROM ops.pick_jobs pj
     JOIN ops.deliveries d ON d.order_id = pj.order_id
     WHERE pj.order_id = $1`,
    [orderId],
  );
  const row = jobs.rows[0];
  const status = row?.shop ?? (await mappedShopStatus(orderId));
  return patchOrderPayload(
    orderId,
    {
      status,
      pickStatus: row?.pick,
      deliveryStatus: row?.del,
      packedAt: row?.packed_at ? new Date(row.packed_at).toISOString() : null,
      sameHandler: Boolean(row?.picker_id && row.courier_id && row.picker_id === row.courier_id),
    },
    {
      picker: row?.picker_id && courier ? courier : undefined,
      courier: row?.courier_id && courier ? courier : undefined,
    },
  );
}

const ACTIVE_PICK = `status IN ('assigned', 'picking')`;
const ACTIVE_DELIVERY = `status IN ('assigned', 'at_store', 'picked_up', 'en_route', 'arrived')`;
const HELD_DELIVERY = `status IN ('assigned', 'at_store')`;
const STARTED_DELIVERY = `status IN ('picked_up', 'en_route', 'arrived')`;
const MAX_ACTIVE_DELIVERIES = 3;
const AFFILIATE_STORES = ['su-aeroport', 'su-akpakpa', 'su-ganhi', 'su-calavi'];
const STORE_TITLES: Record<string, string> = {
  'su-aeroport': 'Super U Aéroport',
  'su-akpakpa': 'Super U Akpakpa',
  'su-ganhi': 'U Express Ganhi',
  'su-calavi': 'Super U Calavi',
};

function storeTitle(id: string | null | undefined) {
  if (!id) return 'ce Super U';
  return STORE_TITLES[id] ?? id;
}

type TourCap = {
  delCount: number;
  pickCount: number;
  started: boolean;
  lockedStoreId: string | null;
  slotsLeft: number;
};

async function tourCapacity(staffId: string): Promise<TourCap> {
  const del = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM ops.deliveries WHERE courier_id = $1 AND ${ACTIVE_DELIVERY}`,
    [staffId],
  );
  const pick = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM ops.pick_jobs WHERE picker_id = $1 AND ${ACTIVE_PICK}`,
    [staffId],
  );
  const started = await query<{ id: string }>(
    `SELECT id FROM ops.deliveries WHERE courier_id = $1 AND ${STARTED_DELIVERY} LIMIT 1`,
    [staffId],
  );
  const delCount = Number(del.rows[0]?.n ?? 0);
  return {
    delCount,
    pickCount: Number(pick.rows[0]?.n ?? 0),
    started: Boolean(started.rows[0]),
    lockedStoreId: await lockedPickupStore(staffId),
    slotsLeft: Math.max(0, MAX_ACTIVE_DELIVERIES - delCount),
  };
}

function tourSlotsCopy(slotsLeft: number, storeId: string | null | undefined) {
  const shop = storeTitle(storeId);
  if (slotsLeft <= 0) {
    return `Tournée complète (${MAX_ACTIVE_DELIVERIES}/${MAX_ACTIVE_DELIVERIES}). Démarrez la livraison.`;
  }
  return `Encore ${slotsLeft} place${slotsLeft > 1 ? 's' : ''} au ${shop} (max ${MAX_ACTIVE_DELIVERIES} colis). Un ramassage à la fois.`;
}

async function staffStoreIds(staff: StaffRow) {
  const rows = await query<{ store_id: string }>(
    `SELECT store_id FROM ops.staff_store_affiliations WHERE staff_id = $1
     UNION SELECT $2::text WHERE $2 IS NOT NULL`,
    [staff.id, staff.store_id],
  );
  const ids = rows.rows.map((r) => r.store_id).filter(Boolean);
  return ids.length ? ids : staff.store_id ? [staff.store_id] : [];
}

async function lockedPickupStore(staffId: string) {
  const r = await query<{ store_id: string | null }>(
    `SELECT store_id FROM (
       SELECT store_id FROM ops.pick_jobs WHERE picker_id = $1 AND ${ACTIVE_PICK}
       UNION ALL
       SELECT store_id FROM ops.deliveries WHERE courier_id = $1 AND ${ACTIVE_DELIVERY}
     ) x WHERE store_id IS NOT NULL LIMIT 1`,
    [staffId],
  );
  return r.rows[0]?.store_id ?? null;
}

async function assertSameSupermarket(staffId: string, storeId: string | null) {
  if (!storeId) return null;
  const locked = await lockedPickupStore(staffId);
  if (locked && locked !== storeId) {
    return `Vous avez déjà des colis au ${storeTitle(locked)}. Terminez-les avant de changer de magasin.`;
  }
  return null;
}

export async function markStaffCallNotifsRead(staffId: string | null | undefined, callId?: string) {
  if (!staffId) return;
  if (callId) {
    await query(
      `UPDATE ops.staff_notifications SET read_at = COALESCE(read_at, NOW())
       WHERE staff_id = $1 AND kind = 'call' AND read_at IS NULL
         AND (id = $2 OR id LIKE $3)`,
      [staffId, `ntf-call-${callId}`, `ntf-call-${callId}%`],
    );
    return;
  }
  await query(
    `UPDATE ops.staff_notifications SET read_at = COALESCE(read_at, NOW())
     WHERE staff_id = $1 AND kind = 'call' AND read_at IS NULL`,
    [staffId],
  );
}

export async function markStaffOrderNotifsRead(staffId: string, orderId: string) {
  await query(
    `UPDATE ops.staff_notifications SET read_at = COALESCE(read_at, NOW())
     WHERE staff_id = $1 AND order_id = $2 AND read_at IS NULL`,
    [staffId, orderId],
  );
}

async function assignDeliveryToStaff(staff: StaffRow, deliveryId: string) {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const course = await conn.query<{ id: string }>(
      `SELECT id FROM ops.courses
       WHERE courier_id = $1 AND status IN ('open', 'in_progress')
       ORDER BY started_at DESC LIMIT 1`,
      [staff.id],
    );
    let courseId = course.rows[0]?.id;
    if (!courseId) {
      courseId = `course-${randomBytes(6).toString('hex')}`;
      await conn.query(
        `INSERT INTO ops.courses (id, courier_id, store_id, status)
         VALUES ($1, $2, $3, 'in_progress')`,
        [courseId, staff.id, staff.store_id],
      );
    }
    const updated = await conn.query<{ order_id: string }>(
      `UPDATE ops.deliveries
       SET status = 'assigned', courier_id = $2, course_id = $3,
           assigned_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('unassigned', 'offered')
       RETURNING order_id`,
      [deliveryId, staff.id, courseId],
    );
    const orderId = updated.rows[0]?.order_id;
    if (!orderId) {
      await conn.query('ROLLBACK');
      return null;
    }
    await conn.query(
      `INSERT INTO ops.events (order_id, delivery_id, actor_kind, actor_id, event_type, payload)
       VALUES ($1, $2, 'staff', $3, 'delivery.claimed', jsonb_build_object('course_id', $4::text))`,
      [orderId, deliveryId, staff.id, courseId],
    );
    await conn.query('COMMIT');
    return { orderId, courseId };
  } catch (error) {
    await conn.query('ROLLBACK');
    throw error;
  } finally {
    conn.release();
  }
}

const CLIENT_STEP_COPY: Record<string, string> = {
  'pick.claimed': 'Votre commande a été acceptée. Rassemblement en magasin.',
  'pick.started': 'Rassemblement en cours au magasin.',
  'pick.packed': 'Votre colis est rassemblé et prêt.',
  'delivery.claimed': 'Un coursier a pris votre course.',
  'delivery.at_store': 'Le coursier est arrivé au magasin.',
  'delivery.picked_up': 'Le colis a été récupéré. Course commencée.',
  'delivery.en_route': 'Le coursier est en route vers vous.',
  'delivery.arrived': 'Le coursier est arrivé à votre adresse.',
  'delivery.delivered': 'Votre commande a été livrée.',
  'delivery.failed': 'La livraison n’a pas pu aboutir.',
};

const CLIENT_NOTIF_TITLE: Record<string, string> = {
  placed: 'Commande reçue',
  'pick.claimed': 'Commande acceptée',
  'pick.started': 'Rassemblement commencé',
  'pick.packed': 'Commande rassemblée',
  'delivery.claimed': 'Course prise',
  'delivery.at_store': 'Coursier au magasin',
  'delivery.picked_up': 'Course commencée',
  'delivery.en_route': 'Livreur en route',
  'delivery.arrived': 'Livreur arrivé',
  'delivery.delivered': 'Commande livrée',
  'delivery.failed': 'Livraison non aboutie',
};

export async function notifyCustomer(params: {
  userId: string;
  id: string;
  title: string;
  body: string;
  orderId?: string | null;
  href?: string | null;
  icon?: string;
  kind?: string;
}) {
  try {
    await query(
      `INSERT INTO public.user_notifications
         (id, user_id, kind, title, body, preview, href, order_id, icon)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        params.id,
        params.userId,
        params.kind ?? 'order',
        params.title,
        params.body.slice(0, 800),
        params.body.slice(0, 160),
        params.href ?? null,
        params.orderId ?? null,
        params.icon ?? 'bell',
      ],
    );
  } catch {
    /* table absente le temps d’une migrate */
  }
}

export async function notifyOrderUser(orderId: string, eventType: string) {
  const title = CLIENT_NOTIF_TITLE[eventType];
  const body = eventType === 'placed'
    ? 'Votre commande est chez Super U. Elle sera bientôt prise en charge.'
    : CLIENT_STEP_COPY[eventType];
  if (!title || !body) return;
  const row = await query<{ user_id: string }>(`SELECT user_id FROM orders WHERE id = $1`, [orderId]);
  const userId = row.rows[0]?.user_id;
  if (!userId) return;
  const done = eventType === 'delivery.delivered' || eventType === 'delivery.failed';
  await notifyCustomer({
    userId,
    id: `order-${orderId}-${eventType}`,
    title,
    body,
    orderId,
    href: done ? `/order/${encodeURIComponent(orderId)}` : `/tracking?id=${encodeURIComponent(orderId)}`,
    icon: eventType.includes('fail') || eventType.includes('cancel') ? 'x-circle' : done ? 'smile' : 'package',
  });
}

async function notifyClient(orderId: string, staffId: string, eventType: string) {
  await notifyOrderUser(orderId, eventType);
  const body = CLIENT_STEP_COPY[eventType];
  if (!body) return;
  try {
    const tid = await query<{ tid: string }>(
      `SELECT comms.ensure_courier_thread($1, $2) AS tid`,
      [orderId, staffId],
    );
    const threadId = tid.rows[0]?.tid;
    if (!threadId) return;
    await query(
      `INSERT INTO comms.messages (id, thread_id, sender_kind, sender_staff_id, kind, body, payload)
       VALUES ($1, $2, 'system', $3, 'system', $4, $5::jsonb)`,
      [`msg-${randomUUID()}`, threadId, staffId, body, JSON.stringify({ eventType, orderId })],
    );
  } catch {
    /* thread/message best-effort — le live shop reste la source */
  }
}

export async function notifyStaff(params: {
  staffId: string;
  kind: string;
  title: string;
  body?: string;
  href?: string | null;
  orderId?: string | null;
  id?: string;
}) {
  try {
    await query(
      `INSERT INTO ops.staff_notifications (id, staff_id, kind, title, body, href, order_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        params.id ?? `ntf-${randomUUID()}`,
        params.staffId,
        params.kind,
        params.title,
        (params.body ?? '').slice(0, 400),
        params.href ?? null,
        params.orderId ?? null,
      ],
    );
  } catch {
    /* table absente le temps d’une migrate */
  }
}

export async function notifyStoreStaff(
  storeId: string | null | undefined,
  role: 'pick' | 'deliver',
  payload: {
    kind: string;
    title: string;
    body?: string;
    href?: string | null;
    orderId?: string | null;
    idPrefix: string;
  },
  exceptStaffId?: string | null,
) {
  const staff = await query<{ id: string }>(
    role === 'pick'
      ? `SELECT DISTINCT s.id FROM ops.staff s
         LEFT JOIN ops.staff_store_affiliations a ON a.staff_id = s.id
         WHERE s.is_active = TRUE AND s.can_pick = TRUE
           AND ($1::text IS NULL OR s.store_id = $1 OR a.store_id = $1)`
      : `SELECT DISTINCT s.id FROM ops.staff s
         LEFT JOIN ops.staff_store_affiliations a ON a.staff_id = s.id
         WHERE s.is_active = TRUE AND s.can_deliver = TRUE
           AND ($1::text IS NULL OR s.store_id = $1 OR a.store_id = $1)`,
    [storeId ?? null],
  );
  for (const row of staff.rows) {
    if (exceptStaffId && row.id === exceptStaffId) continue;
    await notifyStaff({
      staffId: row.id,
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      href: payload.href,
      orderId: payload.orderId,
      id: `${payload.idPrefix}-${row.id}`,
    });
  }
}

const PICK_PAYOUT = 500;
const DELIVER_PAYOUT_MIN = 1500;

async function creditPayout(params: {
  staffId: string;
  kind: 'pick' | 'deliver' | 'tip';
  orderId: string;
  refId: string;
  amount: number;
}) {
  if (params.amount <= 0) return 0;
  const id = `pay-${params.kind}-${params.refId}`;
  const inserted = await query<{ amount: number }>(
    `INSERT INTO ops.staff_payouts (id, staff_id, kind, order_id, ref_id, amount)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (kind, ref_id) DO UPDATE SET amount = EXCLUDED.amount
     RETURNING amount`,
    [id, params.staffId, params.kind, params.orderId, params.refId, params.amount],
  );
  return Number(inserted.rows[0]?.amount ?? params.amount);
}

async function creditPickPayout(staffId: string, pickJobId: string, orderId: string) {
  return creditPayout({
    staffId,
    kind: 'pick',
    orderId,
    refId: pickJobId,
    amount: PICK_PAYOUT,
  });
}

async function creditDeliverPayout(staffId: string, deliveryId: string, orderId: string) {
  const fee = await query<{ delivery_fee: number }>(
    `SELECT delivery_fee FROM orders WHERE id = $1`,
    [orderId],
  );
  const amount = Math.max(Number(fee.rows[0]?.delivery_fee ?? 0), DELIVER_PAYOUT_MIN);
  return creditPayout({
    staffId,
    kind: 'deliver',
    orderId,
    refId: deliveryId,
    amount,
  });
}

export async function creditCourierTip(staffId: string, orderId: string, amount: number) {
  return creditPayout({
    staffId,
    kind: 'tip',
    orderId,
    refId: `tip-${orderId}`,
    amount,
  });
}

function parseStaffPhoto(raw: unknown) {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m?.[1] || !m[2] || m[2].length > 1_400_000) return null;
  return { mime: m[1], b64: m[2], dataUrl: `data:${m[1]};base64,${m[2]}` };
}

export async function rateOrder(params: {
  orderId: string;
  raterKind: 'customer' | 'staff';
  userId?: string | null;
  staffId?: string | null;
  rating: number;
  comment: string;
  tipAmount?: number;
}) {
  const rating = Math.round(params.rating);
  if (rating < 1 || rating > 5) return;
  const tip = params.raterKind === 'customer' ? Math.max(0, Math.round(Number(params.tipAmount ?? 0))) : 0;
  await query(
    `INSERT INTO ops.order_ratings (id, order_id, rater_kind, rater_user_id, rater_staff_id, rating, comment, tip_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (order_id, rater_kind) DO UPDATE SET
       rating = EXCLUDED.rating,
       comment = EXCLUDED.comment,
       tip_amount = EXCLUDED.tip_amount,
       created_at = NOW()`,
    [
      `rate-${params.raterKind}-${params.orderId}`,
      params.orderId,
      params.raterKind,
      params.userId ?? null,
      params.staffId ?? null,
      rating,
      params.comment.trim().slice(0, 280),
      tip,
    ],
  );
}

export async function seedOpsStaff() {
  const password = process.env.DEMO_PASSWORD ?? 'marche2024';
  const hash = await hashPassword(password);
  const existing = await query<{ id: string }>('SELECT id FROM ops.staff WHERE email = $1', [
    'courier@marchedore.bj',
  ]);
  let courierId = existing.rows[0]?.id;
  if (!courierId) {
    courierId = `st-courier-${randomBytes(3).toString('hex')}`;
    await query(
      `INSERT INTO ops.staff (id, email, phone, password_hash, first_name, last_name, role, can_pick, can_deliver, store_id, vehicle)
       VALUES ($1, 'courier@marchedore.bj', '+229 01 40 00 00 02', $2, 'Bodouin', 'Dognon', 'coursier', TRUE, TRUE, 'su-aeroport', 'moto')`,
      [courierId, hash],
    );
  } else {
    await query(
      `UPDATE ops.staff SET first_name = 'Bodouin', last_name = 'Dognon',
         role = 'coursier', can_pick = TRUE, can_deliver = TRUE, vehicle = COALESCE(NULLIF(vehicle, ''), 'moto'),
         phone = COALESCE(NULLIF(phone, ''), '+229 01 40 00 00 02')
       WHERE id = $1`,
      [courierId],
    );
  }
  for (const storeId of AFFILIATE_STORES) {
    await query(
      `INSERT INTO ops.staff_store_affiliations (staff_id, store_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [courierId, storeId],
    );
  }
  await query(
    `INSERT INTO ops.staff_profiles (
       staff_id, vehicle_kind, vehicle_plate, owns_vehicle, needs_kit,
       id_number, has_license, license_number, residence_line, residence_city,
       insurance_ref, has_insurance
     ) VALUES (
       $1, 'moto', 'AC 4821 RB', TRUE, FALSE,
       'CIP-BJ-1994-8821', TRUE, 'BJ-04-192847',
       'Rue des Cocotiers, Cadjehoun', 'Cotonou',
       'AXA-BJ-229441', TRUE
     )
     ON CONFLICT (staff_id) DO UPDATE SET
       vehicle_kind = COALESCE(NULLIF(ops.staff_profiles.vehicle_kind, ''), EXCLUDED.vehicle_kind),
       vehicle_plate = CASE WHEN ops.staff_profiles.vehicle_plate = '' THEN EXCLUDED.vehicle_plate ELSE ops.staff_profiles.vehicle_plate END,
       id_number = CASE WHEN ops.staff_profiles.id_number = '' THEN EXCLUDED.id_number ELSE ops.staff_profiles.id_number END,
       license_number = CASE WHEN ops.staff_profiles.license_number = '' THEN EXCLUDED.license_number ELSE ops.staff_profiles.license_number END,
       residence_line = CASE WHEN ops.staff_profiles.residence_line = '' THEN EXCLUDED.residence_line ELSE ops.staff_profiles.residence_line END,
       residence_city = CASE WHEN ops.staff_profiles.residence_city = '' THEN EXCLUDED.residence_city ELSE ops.staff_profiles.residence_city END,
       updated_at = NOW()`,
    [courierId],
  );
  return !existing.rowCount;
}

function liveStaffHref(row: {
  kind: string;
  href: string | null;
  order_id: string | null;
  staffId: string;
  pick_status?: string | null;
  delivery_status?: string | null;
  shop_status?: string | null;
  picker_id?: string | null;
  courier_id?: string | null;
}) {
  if (row.kind === 'chat' || row.kind === 'call') {
    if (row.order_id) {
      return `/chat/${encodeURIComponent(`courier-${String(row.order_id).replace(/^#/, '')}`)}`;
    }
    return row.href || '/notifications';
  }
  if (row.kind === 'rating') return '/(tabs)/earnings';
  const oid = row.order_id ? String(row.order_id).replace(/^#/, '') : '';
  if (!oid) return row.href || '/notifications';
  const pick = row.pick_status ?? '';
  const del = row.delivery_status ?? '';
  const shop = row.shop_status ?? '';
  const minePick = row.picker_id === row.staffId;
  const mineDel = row.courier_id === row.staffId;
  if (
    shop === 'cancelled' ||
    pick === 'cancelled' ||
    del === 'cancelled' ||
    del === 'failed' ||
    shop === 'delivered' ||
    del === 'delivered'
  ) {
    return '/(tabs)/history';
  }
  if (del === 'arrived' && mineDel) return `/wait/${encodeURIComponent(`del-${oid}`)}`;
  if (mineDel && del && del !== 'unassigned' && del !== 'offered') {
    return `/run/${encodeURIComponent(`del-${oid}`)}`;
  }
  if (pick === 'packed' && (!row.courier_id || mineDel) && (!del || del === 'unassigned' || del === 'offered')) {
    return `/run/${encodeURIComponent(`del-${oid}`)}`;
  }
  if (row.courier_id && !mineDel) return '/(tabs)/missions';
  if (minePick && (pick === 'assigned' || pick === 'picking')) {
    return `/job/${encodeURIComponent(`pick-${oid}`)}`;
  }
  if (pick === 'queued' || (!row.picker_id && pick !== 'packed')) {
    return `/job/${encodeURIComponent(`pick-${oid}`)}`;
  }
  if (row.picker_id && !minePick && pick !== 'packed') return '/(tabs)/missions';
  return row.href || '/(tabs)/missions';
}

function liveStaffHint(row: {
  kind: string;
  picker_id?: string | null;
  courier_id?: string | null;
  staffId: string;
  pick_status?: string | null;
  delivery_status?: string | null;
  shop_status?: string | null;
}) {
  if (row.kind === 'chat' || row.kind === 'call' || row.kind === 'rating') return '';
  const pick = row.pick_status ?? '';
  const del = row.delivery_status ?? '';
  const shop = row.shop_status ?? '';
  if (shop === 'delivered' || del === 'delivered') return 'Déjà livrée';
  if (del === 'failed') return 'Livraison non aboutie';
  if (shop === 'cancelled' || pick === 'cancelled' || del === 'cancelled') return 'Annulée';
  if (row.courier_id && row.courier_id !== row.staffId) return 'Course déjà prise';
  if (row.picker_id && row.picker_id !== row.staffId && pick !== 'packed') return 'Préparation déjà prise';
  if (pick === 'packed' && !row.courier_id) return 'Colis prêt · à livrer';
  if (pick === 'picking' && row.picker_id === row.staffId) return 'Ramassage en cours';
  return '';
}

export async function attachIncidentLive<T extends { incidentAction: string | null }>(live: T, orderId: string) {
  try {
    const row = await query<{ action: string }>(
      `SELECT action FROM ops.client_incident_actions WHERE order_id = $1`,
      [orderId],
    );
    live.incidentAction = row.rows[0]?.action ?? live.incidentAction;
  } catch {
    /* table absente le temps d’une migrate */
  }
  return live;
}

export async function recordClientIncidentAction(params: {
  orderId: string;
  userId: string;
  action: string;
  note?: string;
}) {
  const action = asClientAction(params.action);
  if (!action) return { ok: false as const, error: 'Action invalide.', status: 400 };
  const found = await query<{
    id: string;
    status: string;
    failed_reason_code: string | null;
    courier_id: string | null;
    store_id: string | null;
    payment_id: string | null;
    payment_status: string | null;
  }>(
    `SELECT d.id, d.status, d.failed_reason_code, d.courier_id, o.store_id, o.payment_id, o.payment_status
     FROM ops.deliveries d
     JOIN orders o ON o.id = d.order_id
     WHERE d.order_id = $1 AND o.user_id = $2
     ORDER BY d.updated_at DESC
     LIMIT 1`,
    [params.orderId, params.userId],
  );
  const row = found.rows[0];
  if (!row) return { ok: false as const, error: 'Commande introuvable.', status: 404 };
  if (row.status !== 'failed') {
    return { ok: false as const, error: 'Aucun incident ouvert sur cette commande.', status: 409 };
  }
  const offered = actionsForReason(row.failed_reason_code || 'other', {
    paid: isPaidOrder(row.payment_id, row.payment_status),
  });
  if (!offered.includes(action)) {
    return { ok: false as const, error: 'Cette action n’est pas proposée pour cet incident.', status: 400 };
  }
  const incident = await query<{ id: string }>(
    `SELECT id FROM ops.delivery_incidents WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [params.orderId],
  );
  const incidentId = incident.rows[0]?.id ?? null;
  const note = (params.note ?? '').trim().slice(0, 400);
  await query(
    `INSERT INTO ops.client_incident_actions (id, order_id, user_id, incident_id, action, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (order_id) DO UPDATE
       SET action = EXCLUDED.action, note = EXCLUDED.note, incident_id = EXCLUDED.incident_id, created_at = NOW()`,
    [`act-${params.orderId}`, params.orderId, params.userId, incidentId, action, note],
  );
  await query(
    `INSERT INTO ops.events (order_id, delivery_id, actor_kind, actor_id, event_type, payload)
     VALUES ($1, $2, 'customer', $3, 'client.incident_action',
       jsonb_build_object('action', $4::text, 'note', $5::text))`,
    [params.orderId, row.id, params.userId, action, note || null],
  );
  const actionTitle = CLIENT_ACTIONS[action].title;
  await notifyStoreStaff(row.store_id, 'pick', {
    kind: 'incident_action',
    title: `Client · ${actionTitle}`,
    body: `Commande ${params.orderId} : le client a choisi « ${actionTitle} ».`,
    href: '/(tabs)/history',
    orderId: params.orderId,
    idPrefix: `act-${params.orderId}-${action}`,
  });
  if (row.courier_id) {
    await notifyStaff({
      staffId: row.courier_id,
      kind: 'incident_action',
      title: `Client · ${actionTitle}`,
      body: `Le client a répondu à l’incident de ${params.orderId}.`,
      href: '/(tabs)/history',
      orderId: params.orderId,
      id: `act-courier-${params.orderId}-${action}`,
    });
  }
  return { ok: true as const, action, offered };
}

export function registerOpsRoutes(app: Hono) {
  app.get('/ops/staff/:id/photo', async (c) => {
    const id = routeId(c.req.param('id'));
    const found = await query<{ photo_data: string | null }>(
      `SELECT photo_data FROM ops.staff WHERE id = $1 AND is_active = TRUE`,
      [id],
    );
    const parsed = parseStaffPhoto(found.rows[0]?.photo_data);
    if (!parsed) return c.text('Not found', 404);
    const bytes = Buffer.from(parsed.b64, 'base64');
    return new Response(bytes, {
      headers: {
        'Content-Type': parsed.mime,
        'Cache-Control': 'public, max-age=60',
      },
    });
  });

  app.post('/ops/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const identifier = String(body?.email ?? body?.phone ?? body?.identifier ?? '')
      .trim()
      .toLowerCase();
    const password = String(body?.password ?? '');
    if (!identifier || !password) return c.json({ ok: false, error: 'Identifiants requis.' }, 400);
    const digits = identifier.replace(/\D/g, '').replace(/^229/, '');
    const found = await query<StaffRow>(
      `SELECT * FROM ops.staff
       WHERE email = $1
         OR regexp_replace(phone, '\\D', '', 'g') LIKE '%' || $2
       LIMIT 1`,
      [identifier, digits.length >= 8 ? digits : identifier],
    );
    const staff = found.rows[0];
    if (!staff || !(await verifyPassword(password, staff.password_hash))) {
      return c.json({ ok: false, error: 'Téléphone, e-mail ou mot de passe incorrect.' }, 401);
    }
    if (!staff.is_active) {
      return c.json({ ok: false, error: 'Compte désactivé. Contactez le magasin ou les RH.' }, 403);
    }
    if ((staff.onboard_status ?? 'active') !== 'active') {
      return c.json({ ok: false, error: 'Compte non activé, voir le magasin / RH.' }, 403);
    }
    const token = newToken();
    await query('INSERT INTO ops.staff_sessions (token, staff_id) VALUES ($1, $2)', [token, staff.id]);
    return c.json({ ok: true, token, staff: await staffWithScore(staff) });
  });

  app.post('/ops/register', async (c) => {
    const body = await c.req.json().catch(() => null);
    const firstName = String(body?.firstName ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const phone = String(body?.phone ?? '').trim();
    const password = String(body?.password ?? '');
    const vehicleRaw = String(body?.vehicle ?? 'moto');
    const vehicle = ['moto', 'voiture', 'velo', 'tricycle'].includes(vehicleRaw) ? vehicleRaw : 'moto';
    const jobRaw = String(body?.job ?? body?.role ?? 'coursier');
    const job = jobRaw === 'ramasseur' || jobRaw === 'picker' ? 'ramasseur' : jobRaw === 'livreur' || jobRaw === 'courier' ? 'livreur' : 'coursier';
    const canPick = job !== 'livreur';
    const canDeliver = job !== 'ramasseur';
    const role = job === 'ramasseur' ? 'picker' : job === 'livreur' ? 'courier' : 'coursier';
    if (firstName.length < 2 || lastName.length < 2) {
      return c.json({ ok: false, error: 'Indiquez votre nom complet.' }, 400);
    }
    if (!email.includes('@')) return c.json({ ok: false, error: 'E-mail invalide.' }, 400);
    if (password.length < 6) return c.json({ ok: false, error: 'Mot de passe trop court (6 caractères).' }, 400);
    const clash = await query(
      `SELECT id FROM ops.staff WHERE email = $1 OR regexp_replace(phone, '\\D', '', 'g') = regexp_replace($2, '\\D', '', 'g')`,
      [email, phone || 'x'],
    );
    if (clash.rows[0]) return c.json({ ok: false, error: 'Un compte existe déjà avec cet e-mail ou ce numéro.' }, 409);
    const id = `st-${randomBytes(4).toString('hex')}`;
    const hash = await hashPassword(password);
    const photo = parseStaffPhoto(body?.selfiePhoto ?? body?.photo);
    await query(
      `INSERT INTO ops.staff (id, email, phone, password_hash, first_name, last_name, role, can_pick, can_deliver, store_id, vehicle, photo_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        email,
        phone || `+229 01 ${id.slice(-8)}`,
        hash,
        firstName,
        lastName,
        role,
        canPick,
        canDeliver,
        'su-aeroport',
        vehicle,
        photo?.dataUrl ?? null,
      ],
    );
    const stores = Array.isArray(body?.storeIds)
      ? body.storeIds.map((s: unknown) => String(s)).filter((s: string) => AFFILIATE_STORES.includes(s))
      : ['su-aeroport'];
    for (const storeId of stores.length ? stores : ['su-aeroport']) {
      await query(
        `INSERT INTO ops.staff_store_affiliations (staff_id, store_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, storeId],
      );
    }
    await query(
      `INSERT INTO ops.staff_profiles (
         staff_id, vehicle_kind, vehicle_plate, owns_vehicle, needs_kit, vehicle_photo,
         id_number, id_photo, license_number, has_license, license_photo, selfie_license_photo,
         residence_line, residence_city, insurance_ref, has_insurance, insurance_photo
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (staff_id) DO UPDATE SET
         vehicle_kind = EXCLUDED.vehicle_kind,
         vehicle_plate = EXCLUDED.vehicle_plate,
         owns_vehicle = EXCLUDED.owns_vehicle,
         needs_kit = EXCLUDED.needs_kit,
         updated_at = NOW()`,
      [
        id,
        vehicle,
        String(body?.vehiclePlate ?? '').trim(),
        Boolean(body?.ownsVehicle),
        Boolean(body?.needsKit) || !body?.ownsVehicle,
        parseStaffPhoto(body?.vehiclePhoto)?.dataUrl ?? null,
        String(body?.idNumber ?? '').trim(),
        parseStaffPhoto(body?.idPhoto)?.dataUrl ?? null,
        String(body?.licenseNumber ?? '').trim(),
        Boolean(body?.hasLicense),
        parseStaffPhoto(body?.licensePhoto)?.dataUrl ?? null,
        parseStaffPhoto(body?.selfiePhoto)?.dataUrl ?? null,
        String(body?.residenceLine ?? '').trim(),
        String(body?.residenceCity ?? 'Cotonou').trim(),
        String(body?.insuranceRef ?? '').trim(),
        Boolean(body?.hasInsurance),
        parseStaffPhoto(body?.insurancePhoto)?.dataUrl ?? null,
      ],
    );
    const token = newToken();
    await query('INSERT INTO ops.staff_sessions (token, staff_id) VALUES ($1, $2)', [token, id]);
    const staff = (await query<StaffRow>(`SELECT * FROM ops.staff WHERE id = $1`, [id])).rows[0];
    return c.json({ ok: true, token, staff: await staffWithScore(staff) });
  });

  app.get('/ops/me', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    return c.json({ ok: true, staff: await staffWithScore(staff) });
  });

  app.patch('/ops/me', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const body = await c.req.json().catch(() => null);
    const hasPhoto = body?.photo != null && String(body.photo).trim() !== '';
    const hasStores = Array.isArray(body?.storeIds);
    if (!hasPhoto && !hasStores) {
      return c.json({ ok: false, error: 'Rien à mettre à jour.' }, 400);
    }
    if (hasPhoto) {
      const parsed = parseStaffPhoto(body.photo);
      if (!parsed) return c.json({ ok: false, error: 'Photo invalide (JPEG/PNG, max ~1 Mo).' }, 400);
      await query(`UPDATE ops.staff SET photo_data = $2 WHERE id = $1`, [staff.id, parsed.dataUrl]);
    }
    if (hasStores) {
      const stores = (body.storeIds as unknown[])
        .map((s) => String(s))
        .filter((s) => AFFILIATE_STORES.includes(s));
      const unique = [...new Set(stores)];
      if (!unique.length) {
        return c.json({ ok: false, error: 'Choisissez au moins un Super U affilié.' }, 400);
      }
      const locked = await lockedPickupStore(staff.id);
      if (locked && !unique.includes(locked)) {
        return c.json(
          {
            ok: false,
            error: `Terminez d’abord la course en cours au ${storeTitle(locked)} avant de le retirer.`,
          },
          409,
        );
      }
      await query(`DELETE FROM ops.staff_store_affiliations WHERE staff_id = $1`, [staff.id]);
      for (const storeId of unique) {
        await query(
          `INSERT INTO ops.staff_store_affiliations (staff_id, store_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [staff.id, storeId],
        );
      }
      await query(`UPDATE ops.staff SET store_id = $2 WHERE id = $1`, [staff.id, unique[0]]);
    }
    const next = await query<StaffRow>(`SELECT * FROM ops.staff WHERE id = $1`, [staff.id]);
    return c.json({ ok: true, staff: await staffWithScore(next.rows[0] ?? staff) });
  });

  app.patch('/ops/me/password', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const body = await c.req.json().catch(() => null);
    const nextPassword = String(body?.password ?? '');
    if (nextPassword.length < 6) {
      return c.json({ ok: false, error: 'Mot de passe trop court (6 caractères).' }, 400);
    }
    if (!staff.must_reset_password) {
      const current = String(body?.currentPassword ?? '');
      if (!(await verifyPassword(current, staff.password_hash))) {
        return c.json({ ok: false, error: 'Mot de passe actuel incorrect.' }, 401);
      }
    }
    await query(`UPDATE ops.staff SET password_hash = $2, must_reset_password = FALSE WHERE id = $1`, [
      staff.id,
      await hashPassword(nextPassword),
    ]);
    const next = await query<StaffRow>(`SELECT * FROM ops.staff WHERE id = $1`, [staff.id]);
    return c.json({ ok: true, staff: await staffWithScore(next.rows[0] ?? staff) });
  });

  app.get('/ops/map-stores', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const affiliated = await staffStoreIds(staff);
    const [catalog, queued, packed] = await Promise.all([
      query<{ id: string; payload: Record<string, unknown> }>('SELECT id, payload FROM stores'),
      query<{ store_id: string | null; n: string }>(
        `SELECT store_id, COUNT(*)::text AS n FROM ops.pick_jobs WHERE status = 'queued' GROUP BY store_id`,
      ),
      query<{ store_id: string | null; n: string }>(
        `SELECT d.store_id, COUNT(*)::text AS n
         FROM ops.deliveries d
         JOIN ops.pick_jobs pj ON pj.order_id = d.order_id
         WHERE d.courier_id IS NULL
           AND d.status IN ('unassigned', 'offered')
           AND pj.status = 'packed'
         GROUP BY d.store_id`,
      ),
    ]);
    const queuedMap = new Map(queued.rows.map((r) => [r.store_id ?? '', Number(r.n)]));
    const packedMap = new Map(packed.rows.map((r) => [r.store_id ?? '', Number(r.n)]));
    const stores = catalog.rows.map((row) => {
      const p = row.payload ?? {};
      const coord = Array.isArray(p.coordinate) ? p.coordinate : null;
      const lng = Number(coord?.[0]);
      const lat = Number(coord?.[1]);
      const isAffiliated = affiliated.includes(row.id);
      const parcels = isAffiliated
        ? (queuedMap.get(row.id) ?? 0) + (packedMap.get(row.id) ?? 0)
        : 0;
      return {
        id: row.id,
        name: typeof p.name === 'string' ? p.name : row.id,
        format: p.format ?? null,
        city: p.city ?? null,
        cityLabel: typeof p.cityLabel === 'string' ? p.cityLabel : null,
        address: typeof p.address === 'string' ? p.address : null,
        coordinate: Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null,
        affiliated: isAffiliated,
        parcels,
      };
    });
    return c.json({ ok: true, stores });
  });

  app.get('/ops/products/by-barcode/:code', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const code = routeId(c.req.param('code')).trim();
    if (!/^\d{8}$|^\d{12,14}$/.test(code)) {
      return c.json({ ok: false, error: 'Code-barres invalide.' }, 400);
    }
    const requestedStore = String(c.req.query('storeId') ?? staff.store_id ?? 'su-aeroport');
    const allowedStores = await staffStoreIds(staff);
    if (allowedStores.length && !allowedStores.includes(requestedStore)) {
      return c.json({ ok: false, error: 'Magasin non autorisé.' }, 403);
    }
    const found = await query<{
      id: string;
      category_id: string;
      payload: Record<string, unknown>;
      sku: string | null;
      barcode: string | null;
      available_qty: string;
      checksum_sha256: string | null;
      attribution: string | null;
      license_name: string | null;
      license_url: string | null;
    }>(
      `SELECT p.id, p.category_id, p.payload, p.sku, p.barcode,
              COALESCE(s.qty - s.reserved, 0)::text AS available_qty,
              m.checksum_sha256, m.attribution, m.license_name, m.license_url
       FROM products p
       LEFT JOIN product_stock s ON s.product_id = p.id AND s.store_id = $2
       LEFT JOIN LATERAL (
         SELECT checksum_sha256, attribution, license_name, license_url
         FROM product_media
         WHERE product_id = p.id AND kind = 'image'
         ORDER BY (position = 0) DESC, is_placeholder ASC, position
         LIMIT 1
       ) m ON TRUE
       WHERE p.active = TRUE
         AND (p.barcode = $1 OR (p.barcode IS NULL AND p.payload->>'barcode' = $1))
       LIMIT 1`,
      [code, requestedStore],
    );
    const row = found.rows[0];
    if (!row) return c.json({ ok: false, error: 'Produit introuvable.' }, 404);
    const availableQty = Number(row.available_qty);
    return c.json({
      ok: true,
      storeId: requestedStore,
      product: {
        id: row.id,
        categoryId: row.category_id,
        payload: row.payload,
        sku: row.sku ?? row.payload.sku ?? row.id,
        barcode: row.barcode ?? row.payload.barcode ?? productBarcode(row.id),
        availableQty,
        available: availableQty > 0,
        imageUrl: `/catalog/media/${encodeURIComponent(row.id)}`,
        image: {
          checksumSha256: row.checksum_sha256,
          attribution: row.attribution,
          licenseName: row.license_name,
          licenseUrl: row.license_url,
        },
      },
    });
  });

  app.get('/ops/pick-jobs', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    if (!canPick(staff)) return c.json({ ok: false, error: 'forbidden' }, 403);
    const stores = await staffStoreIds(staff);
    const cap = await tourCapacity(staff.id);
    const result = await query(
      `SELECT * FROM ops.v_pick_board
       WHERE (store_id IS NULL OR store_id = ANY($1::text[]))
         AND (picker_id IS NULL OR picker_id = $2)
         AND (
           picker_id = $2
           OR (
             $3::boolean = FALSE
             AND $4::int > 0
             AND ($5::text IS NULL OR store_id = $5)
           )
         )
       ORDER BY created_at ASC`,
      [stores, staff.id, cap.started, cap.slotsLeft, cap.lockedStoreId],
    );
    return c.json({ ok: true, jobs: result.rows });
  });

  app.post('/ops/pick-jobs/:id/claim', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    if (!canPick(staff)) return c.json({ ok: false, error: 'forbidden' }, 403);
    const id = routeId(c.req.param('id'));
    const jobMeta = await query<{ store_id: string | null; order_id: string | null; picker_id: string | null; status: string }>(
      `SELECT store_id, order_id, picker_id, status FROM ops.pick_jobs WHERE id = $1`,
      [id],
    );
    if (!jobMeta.rows[0]) return c.json({ ok: false, error: 'Job introuvable.' }, 404);
    const jobStore = jobMeta.rows[0].store_id;
    const cap = await tourCapacity(staff.id);
    const busyOther = await query<{ id: string }>(
      `SELECT id FROM ops.pick_jobs WHERE picker_id = $1 AND ${ACTIVE_PICK} AND id <> $2 LIMIT 1`,
      [staff.id, id],
    );
    if (busyOther.rows[0]) {
      return c.json(
        {
          ok: false,
          error: 'Vous ne pouvez ramasser qu’un colis à la fois. Terminez d’abord le ramassage en cours.',
        },
        409,
      );
    }
    if (cap.started) {
      return c.json(
        {
          ok: false,
          error: 'Tournée déjà démarrée. Terminez les livraisons avant de ramasser un autre colis.',
        },
        409,
      );
    }
    if (cap.delCount >= MAX_ACTIVE_DELIVERIES) {
      return c.json(
        {
          ok: false,
          error: `Vous avez déjà ${MAX_ACTIVE_DELIVERIES} colis. Livrez-les avant d’en ramasser un autre.`,
        },
        409,
      );
    }
    const storeErr = await assertSameSupermarket(staff.id, jobStore);
    if (storeErr) return c.json({ ok: false, error: storeErr }, 409);
    const updated = await query(
      `UPDATE ops.pick_jobs
       SET status = 'assigned', picker_id = $2, assigned_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'queued'
       RETURNING order_id`,
      [id, staff.id],
    );
    const orderId = updated.rows[0]?.order_id;
    if (!orderId) {
      const mine = await query<{ order_id: string; status: string }>(
        `SELECT order_id, status FROM ops.pick_jobs WHERE id = $1 AND picker_id = $2`,
        [id, staff.id],
      );
      if (mine.rows[0]) return c.json({ ok: true, orderId: mine.rows[0].order_id });
      return c.json(
        { ok: false, error: 'Ce ramassage a déjà été pris. Il n’est plus disponible.' },
        409,
      );
    }
    await query(
      `INSERT INTO ops.events (order_id, pick_job_id, actor_kind, actor_id, event_type)
       VALUES ($1, $2, 'staff', $3, 'pick.claimed')`,
      [orderId, id, staff.id],
    );
    await syncShopFromOps(orderId, staffLabel(staff));
    await notifyClient(orderId, staff.id, 'pick.claimed');
    await markStaffOrderNotifsRead(staff.id, orderId);
    const after = await tourCapacity(staff.id);
    await notifyStaff({
      staffId: staff.id,
      kind: 'job',
      title: 'Ramassage pris',
      body: `${orderId.replace(/^#/, '')} · un colis à la fois. ${tourSlotsCopy(after.slotsLeft, jobStore)}`,
      href: `/job/${encodeURIComponent(id)}`,
      orderId,
      id: `ntf-pick-mine-${orderId}-${staff.id}`,
    });
    await notifyStoreStaff(
      jobStore,
      'pick',
      {
        kind: 'job',
        title: 'Ramassage plus disponible',
        body: `${orderId.replace(/^#/, '')} est déjà pris. Il n’apparaît plus dans votre file.`,
        href: '/(tabs)/missions',
        orderId,
        idPrefix: `ntf-pick-gone-${orderId}`,
      },
      staff.id,
    );
    return c.json({ ok: true, orderId });
  });

  app.post('/ops/pick-jobs/:id/release', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = routeId(c.req.param('id'));
    const updated = await query<{ order_id: string }>(
      `UPDATE ops.pick_jobs
       SET status = 'queued', picker_id = NULL, assigned_at = NULL, updated_at = NOW()
       WHERE id = $1 AND picker_id = $2 AND status = 'assigned'
       RETURNING order_id`,
      [id, staff.id],
    );
    const orderId = updated.rows[0]?.order_id;
    if (!orderId) {
      return c.json({ ok: false, error: 'Impossible de laisser cette préparation (déjà commencée).' }, 409);
    }
    await query(
      `INSERT INTO ops.events (order_id, pick_job_id, actor_kind, actor_id, event_type)
       VALUES ($1, $2, 'staff', $3, 'pick.released')`,
      [orderId, id, staff.id],
    );
    await syncShopFromOps(orderId, staffLabel(staff));
    return c.json({ ok: true, orderId });
  });

  app.post('/ops/pick-jobs/:id/start', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = routeId(c.req.param('id'));
    const updated = await query<{ order_id: string }>(
      `UPDATE ops.pick_jobs
       SET status = 'picking', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
       WHERE id = $1 AND picker_id = $2 AND status = 'assigned'
       RETURNING order_id`,
      [id, staff.id],
    );
    let orderId = updated.rows[0]?.order_id;
    if (!orderId) {
      const already = await query<{ order_id: string }>(
        `SELECT order_id FROM ops.pick_jobs WHERE id = $1 AND picker_id = $2 AND status = 'picking'`,
        [id, staff.id],
      );
      if (!already.rows[0]) return c.json({ ok: false, error: 'Job introuvable.' }, 404);
      return c.json({ ok: true, orderId: already.rows[0].order_id });
    }
    await query(
      `INSERT INTO ops.events (order_id, pick_job_id, actor_kind, actor_id, event_type)
       VALUES ($1, $2, 'staff', $3, 'pick.started')`,
      [orderId, id, staff.id],
    );
    await syncShopFromOps(orderId, staffLabel(staff));
    await notifyClient(orderId, staff.id, 'pick.started');
    return c.json({ ok: true, orderId });
  });

  app.patch('/ops/pick-jobs/:id/lines', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = routeId(c.req.param('id'));
    const job = await query<{ order_id: string }>(
      'SELECT order_id FROM ops.pick_jobs WHERE id = $1 AND picker_id = $2',
      [id, staff.id],
    );
    const orderId = job.rows[0]?.order_id;
    if (!orderId) return c.json({ ok: false, error: 'Job introuvable.' }, 404);
    const body = await c.req.json().catch(() => null);
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    for (const line of lines) {
      const productId = String(line?.productId ?? '');
      if (!productId) continue;
      await query(
        `UPDATE public.order_lines
         SET picked_qty = GREATEST(0, COALESCE($3::int, picked_qty)),
             unavailable = COALESCE($4::boolean, unavailable),
             note = COALESCE($5, note)
         WHERE order_id = $1 AND product_id = $2`,
        [
          orderId,
          productId,
          line.pickedQty == null ? null : Number(line.pickedQty),
          typeof line.unavailable === 'boolean' ? line.unavailable : null,
          typeof line.note === 'string' ? line.note : null,
        ],
      );
    }
    return c.json({ ok: true });
  });

  app.post('/ops/pick-jobs/:id/pack', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = routeId(c.req.param('id'));
    const job = await query<{ order_id: string; status: string }>(
      `SELECT order_id, status FROM ops.pick_jobs WHERE id = $1 AND picker_id = $2`,
      [id, staff.id],
    );
    const orderId = job.rows[0]?.order_id;
    if (!orderId) return c.json({ ok: false, error: 'Job introuvable.' }, 404);
    if (job.rows[0].status === 'packed') return c.json({ ok: true, orderId });
    const leftover = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.order_lines
       WHERE order_id = $1
         AND COALESCE(unavailable, FALSE) = FALSE
         AND COALESCE(picked_qty, 0) < qty`,
      [orderId],
    );
    if (Number(leftover.rows[0]?.n ?? 0) > 0) {
      return c.json({ ok: false, error: 'Scannez tous les produits avant de terminer le ramassage.' }, 409);
    }
    await restoreUnavailableOrderStock(orderId);
    const updated = await query(
      `UPDATE ops.pick_jobs
       SET status = 'packed', packed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND picker_id = $2 AND status IN ('picking', 'assigned')
       RETURNING order_id`,
      [id, staff.id],
    );
    if (!updated.rows[0]) return c.json({ ok: false, error: 'Job introuvable.' }, 404);
    await query(
      `INSERT INTO ops.events (order_id, pick_job_id, actor_kind, actor_id, event_type)
       VALUES ($1, $2, 'staff', $3, 'pick.packed')`,
      [orderId, id, staff.id],
    );
    await syncShopFromOps(orderId, staffLabel(staff));
    await notifyClient(orderId, staff.id, 'pick.packed');
    const payout = await creditPickPayout(staff.id, id, orderId);
    const packedMeta = await query<{ store_id: string | null }>(
      `SELECT store_id FROM ops.pick_jobs WHERE id = $1`,
      [id],
    );
    const shop = packedMeta.rows[0]?.store_id ?? staff.store_id;
    const label = orderId.replace(/^#/, '');
    let addedToTour = false;
    if (canDeliver(staff)) {
      const cap = await tourCapacity(staff.id);
      const delRow = await query<{ id: string }>(
        `SELECT id FROM ops.deliveries WHERE order_id = $1 LIMIT 1`,
        [orderId],
      );
      const deliveryId = delRow.rows[0]?.id;
      if (deliveryId && !cap.started && cap.delCount < MAX_ACTIVE_DELIVERIES) {
        const storeErr = await assertSameSupermarket(staff.id, shop);
        if (!storeErr) {
          const claimed = await assignDeliveryToStaff(staff, deliveryId);
          if (claimed) {
            addedToTour = true;
            await syncShopFromOps(claimed.orderId, staffLabel(staff));
            await notifyClient(claimed.orderId, staff.id, 'delivery.claimed');
            const after = await tourCapacity(staff.id);
            await notifyStaff({
              staffId: staff.id,
              kind: 'job',
              title: `Colis ajouté à la tournée (${after.delCount}/${MAX_ACTIVE_DELIVERIES})`,
              body: tourSlotsCopy(after.slotsLeft, shop),
              href: '/(tabs)/missions',
              orderId,
              id: `ntf-claim-${orderId}-${staff.id}`,
            });
            await notifyStoreStaff(
              shop,
              'deliver',
              {
                kind: 'job',
                title: 'Colis plus disponible',
                body: `${label} a été ajouté à une tournée. Il n’est plus dans votre file.`,
                href: '/(tabs)/missions',
                orderId,
                idPrefix: `ntf-del-gone-${orderId}`,
              },
              staff.id,
            );
          }
        }
      }
    }
    if (!addedToTour) {
      await notifyStoreStaff(shop, 'deliver', {
        kind: 'job',
        title: 'Colis prêt à livrer',
        body: `${storeTitle(shop)} · ${label}. Ajoutez-le à votre tournée (max ${MAX_ACTIVE_DELIVERIES}). Une fois pris, il disparaît pour les autres.`,
        href: `/run/${encodeURIComponent(`del-${orderId}`)}`,
        orderId,
        idPrefix: `ntf-ready-${orderId}`,
      });
    }
    return c.json({ ok: true, orderId, payout, addedToTour });
  });

  app.get('/ops/deliveries', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    if (!canDeliver(staff)) return c.json({ ok: false, error: 'forbidden' }, 403);
    const stores = await staffStoreIds(staff);
    const cap = await tourCapacity(staff.id);
    const result = await query(
      `SELECT v.*, comms.thread_for_order(v.order_id) AS comms_thread_id
       FROM ops.v_delivery_board v
       WHERE (v.courier_id IS NULL OR v.courier_id = $1)
         AND (v.store_id IS NULL OR v.store_id = ANY($2::text[]))
         AND v.pick_status = 'packed'
         AND (
           v.courier_id = $1
           OR (
             $3::boolean = FALSE
             AND $4::int > 0
             AND ($5::text IS NULL OR v.store_id = $5)
           )
         )
       ORDER BY v.created_at ASC`,
      [staff.id, stores, cap.started, cap.slotsLeft, cap.lockedStoreId],
    );
    const hop = await query<{
      lng: number;
      lat: number;
      store_id: string | null;
      label: string;
    }>(
      `SELECT d.dropoff_lng AS lng, d.dropoff_lat AS lat, d.store_id,
              COALESCE(NULLIF(o.address_label, ''), NULLIF(o.address_line, ''), o.address_city, 'Dernière remise') AS label
       FROM ops.deliveries d
       JOIN orders o ON o.id = d.order_id
       WHERE d.courier_id = $1
         AND d.status IN ('delivered', 'failed')
         AND d.course_id IN (
           SELECT DISTINCT course_id FROM ops.deliveries
           WHERE courier_id = $1 AND course_id IS NOT NULL
             AND status IN ('assigned', 'at_store', 'picked_up', 'en_route', 'arrived')
         )
         AND d.dropoff_lng IS NOT NULL AND ABS(d.dropoff_lng) > 0.2
       ORDER BY COALESCE(d.delivered_at, d.updated_at) DESC
       LIMIT 1`,
      [staff.id],
    );
    const row = hop.rows[0];
    const tourHop = row
      ? { lng: Number(row.lng), lat: Number(row.lat), storeId: row.store_id, label: row.label }
      : null;
    return c.json({ ok: true, deliveries: result.rows, tourHop });
  });

  app.post('/ops/deliveries/:id/claim', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    if (!canDeliver(staff)) return c.json({ ok: false, error: 'forbidden' }, 403);
    const id = routeId(c.req.param('id'));
    const packed = await query<{ id: string; pick: string; order_id: string }>(
      `SELECT d.id, pj.status AS pick, d.order_id FROM ops.deliveries d
       JOIN ops.pick_jobs pj ON pj.order_id = d.order_id
       WHERE d.id = $1 OR d.order_id = $2`,
      [id, id.replace(/^del-/, '')],
    );
    const deliveryId = packed.rows[0]?.id ?? id;
    if (packed.rows[0]?.pick !== 'packed') {
      return c.json({ ok: false, error: 'Le ramassage n’est pas terminé.' }, 409);
    }
    const orderId = packed.rows[0].order_id;
    const delStore = await query<{ store_id: string | null }>(
      `SELECT store_id FROM ops.deliveries WHERE id = $1`,
      [deliveryId],
    );
    const storeErr = await assertSameSupermarket(staff.id, delStore.rows[0]?.store_id ?? null);
    if (storeErr) return c.json({ ok: false, error: storeErr }, 409);
    const started = await query<{ id: string }>(
      `SELECT id FROM ops.deliveries WHERE courier_id = $1 AND ${STARTED_DELIVERY} LIMIT 1`,
      [staff.id],
    );
    if (started.rows[0]) {
      return c.json(
        { ok: false, error: 'Tournée déjà démarrée. Terminez-la avant d’ajouter un colis.' },
        409,
      );
    }
    const busyDel = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ops.deliveries
       WHERE courier_id = $1 AND ${ACTIVE_DELIVERY} AND id <> $2`,
      [staff.id, deliveryId],
    );
    if (Number(busyDel.rows[0]?.n ?? 0) >= MAX_ACTIVE_DELIVERIES) {
      return c.json(
        {
          ok: false,
          error: `Vous avez déjà ${MAX_ACTIVE_DELIVERIES} colis (maximum). Retirez-en un ou démarrez la tournée.`,
        },
        409,
      );
    }
    const busyPick = await query<{ id: string; order_id: string }>(
      `SELECT id, order_id FROM ops.pick_jobs WHERE picker_id = $1 AND ${ACTIVE_PICK} LIMIT 1`,
      [staff.id],
    );
    if (busyPick.rows[0] && busyPick.rows[0].order_id !== orderId) {
      return c.json(
        {
          ok: false,
          error: 'Terminez d’abord le ramassage en cours (un colis à la fois) avant d’ajouter un autre à la tournée.',
        },
        409,
      );
    }
    const claimed = await assignDeliveryToStaff(staff, deliveryId);
    if (!claimed) {
      const mine = await query<{ order_id: string; course_id: string | null }>(
        `SELECT order_id, course_id FROM ops.deliveries WHERE (id = $1 OR order_id = $2) AND courier_id = $3`,
        [deliveryId, orderId, staff.id],
      );
      if (mine.rows[0]) {
        return c.json({ ok: true, orderId: mine.rows[0].order_id, courseId: mine.rows[0].course_id });
      }
      return c.json(
        { ok: false, error: 'Ce colis a déjà été ajouté à la tournée d’un autre livreur. Il n’est plus disponible.' },
        409,
      );
    }
    await syncShopFromOps(claimed.orderId, staffLabel(staff));
    await notifyClient(claimed.orderId, staff.id, 'delivery.claimed');
    await markStaffOrderNotifsRead(staff.id, claimed.orderId);
    const after = await tourCapacity(staff.id);
    const shop = delStore.rows[0]?.store_id ?? null;
    await notifyStaff({
      staffId: staff.id,
      kind: 'job',
      title: `Colis ajouté à la tournée (${after.delCount}/${MAX_ACTIVE_DELIVERIES})`,
      body: tourSlotsCopy(after.slotsLeft, shop),
      href: '/(tabs)/missions',
      orderId: claimed.orderId,
      id: `ntf-claim-${claimed.orderId}-${staff.id}`,
    });
    await notifyStoreStaff(
      shop,
      'deliver',
      {
        kind: 'job',
        title: 'Colis plus disponible',
        body: `${claimed.orderId.replace(/^#/, '')} a été ajouté à une tournée. Il n’est plus dans votre file.`,
        href: '/(tabs)/missions',
        orderId: claimed.orderId,
        idPrefix: `ntf-del-gone-${claimed.orderId}`,
      },
      staff.id,
    );
    return c.json({ ok: true, orderId: claimed.orderId, courseId: claimed.courseId });
  });

  app.post('/ops/deliveries/:id/release', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    if (!canDeliver(staff)) return c.json({ ok: false, error: 'forbidden' }, 403);
    const id = routeId(c.req.param('id'));
    const updated = await query<{ order_id: string }>(
      `UPDATE ops.deliveries
       SET status = 'unassigned', courier_id = NULL, course_id = NULL,
           assigned_at = NULL, at_store_at = NULL, updated_at = NOW()
       WHERE (id = $1 OR order_id = $2) AND courier_id = $3 AND ${HELD_DELIVERY}
       RETURNING order_id`,
      [id, id.replace(/^del-/, ''), staff.id],
    );
    const orderId = updated.rows[0]?.order_id;
    if (!orderId) {
      return c.json({ ok: false, error: 'Ce colis ne peut plus être retiré (tournée déjà démarrée).' }, 409);
    }
    await query(
      `INSERT INTO ops.events (order_id, delivery_id, actor_kind, actor_id, event_type)
       VALUES ($1, $2, 'staff', $3, 'delivery.released')`,
      [orderId, id.startsWith('del-') ? id : `del-${orderId}`, staff.id],
    );
    await syncShopFromOps(orderId, staffLabel(staff));
    return c.json({ ok: true, orderId });
  });

  app.post('/ops/deliveries/start-run', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    if (!canDeliver(staff)) return c.json({ ok: false, error: 'forbidden' }, 403);
    const held = await query<{ id: string; order_id: string }>(
      `SELECT id, order_id FROM ops.deliveries
       WHERE courier_id = $1 AND ${HELD_DELIVERY}
       ORDER BY assigned_at ASC NULLS LAST, created_at ASC`,
      [staff.id],
    );
    if (!held.rows[0]) {
      return c.json({ ok: false, error: 'Sélectionnez d’abord les colis à livrer.' }, 409);
    }
    await query(
      `UPDATE ops.deliveries
       SET status = 'picked_up',
           at_store_at = COALESCE(at_store_at, NOW()),
           picked_up_at = COALESCE(picked_up_at, NOW()),
           updated_at = NOW()
       WHERE courier_id = $1 AND ${HELD_DELIVERY}`,
      [staff.id],
    );
    const name = staffLabel(staff);
    for (const row of held.rows) {
      await query(
        `INSERT INTO ops.events (order_id, delivery_id, actor_kind, actor_id, event_type, payload)
         VALUES ($1, $2, 'staff', $3, 'delivery.picked_up', jsonb_build_object('tour', true))`,
        [row.order_id, row.id, staff.id],
      );
      await syncShopFromOps(row.order_id, name);
      await notifyClient(row.order_id, staff.id, 'delivery.picked_up');
    }
    return c.json({ ok: true, deliveryId: held.rows[0].id, count: held.rows.length });
  });

  app.post('/ops/deliveries/:id/status', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = routeId(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const status = String(body?.status ?? '');
    const allowed = ['at_store', 'picked_up', 'en_route', 'arrived', 'delivered', 'failed'];
    if (!allowed.includes(status)) {
      return c.json({ ok: false, error: 'Statut invalide.' }, 400);
    }
    const found = await query<{ id: string }>(
      `SELECT id FROM ops.deliveries
       WHERE id = $1 OR order_id = $2 OR id = $3
       LIMIT 1`,
      [id, id.replace(/^del-/, ''), id.startsWith('del-') ? id : `del-${id}`],
    );
    const deliveryId = found.rows[0]?.id ?? id;
    if (status === 'delivered') {
      const given = String(body?.handoffCode ?? '').replace(/\D/g, '');
      const want = await query<{ handoff_code: string | null }>(
        `SELECT o.handoff_code FROM orders o
         JOIN ops.deliveries d ON d.order_id = o.id
         WHERE d.id = $1`,
        [deliveryId],
      );
      const expected = String(want.rows[0]?.handoff_code ?? '').replace(/\D/g, '');
      if (expected.length !== 4 || given !== expected) {
        return c.json({ ok: false, error: 'Code de confirmation incorrect. Demandez le code à 4 chiffres au client.' }, 400);
      }
    }
    const stamp =
      status === 'at_store'
        ? 'at_store_at'
        : status === 'picked_up'
          ? 'picked_up_at'
          : status === 'en_route'
            ? 'en_route_at'
          : status === 'delivered'
            ? 'delivered_at'
            : null;
    const sql =
      status === 'arrived'
        ? `UPDATE ops.deliveries
         SET status = $3, en_route_at = COALESCE(en_route_at, NOW()), updated_at = NOW(),
             failed_reason = $4, proof_url = COALESCE($5, proof_url)
         WHERE id = $1 AND courier_id = $2
         RETURNING order_id`
        : stamp
          ? `UPDATE ops.deliveries
         SET status = $3, ${stamp} = NOW(), updated_at = NOW(),
             failed_reason = $4, proof_url = COALESCE($5, proof_url)
         WHERE id = $1 AND courier_id = $2
         RETURNING order_id`
          : `UPDATE ops.deliveries
         SET status = $3, updated_at = NOW(),
             failed_reason = $4, proof_url = COALESCE($5, proof_url)
         WHERE id = $1 AND courier_id = $2
         RETURNING order_id`;
    const reasonText = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const reasonCode = status === 'failed' ? asReasonCode(body?.reasonCode ?? body?.reason_code) : null;
    const updated = await query<{ order_id: string }>(sql, [
      deliveryId,
      staff.id,
      status,
      reasonText || null,
      typeof body?.proofUrl === 'string' ? body.proofUrl : null,
    ]);
    const orderId = updated.rows[0]?.order_id;
    if (!orderId) return c.json({ ok: false, error: 'Livraison introuvable.' }, 404);
    if (status === 'failed' && reasonCode) {
      await query(`UPDATE ops.deliveries SET failed_reason_code = $2 WHERE id = $1`, [
        deliveryId,
        reasonCode,
      ]);
    }
    if (status === 'delivered' || status === 'failed') {
      await query(
        `UPDATE ops.courses SET status = 'completed', ended_at = NOW()
         WHERE id = (SELECT course_id FROM ops.deliveries WHERE id = $1)
           AND NOT EXISTS (
             SELECT 1 FROM ops.deliveries
             WHERE course_id = ops.courses.id AND status NOT IN ('delivered', 'failed', 'cancelled')
           )`,
        [deliveryId],
      );
    }
    const name = staffLabel(staff);
    await syncShopFromOps(orderId, name);
    await query(
      `INSERT INTO ops.events (order_id, delivery_id, actor_kind, actor_id, event_type, payload)
       VALUES ($1, $2, 'staff', $3, $4,
         jsonb_build_object('status', $5::text, 'reason_code', $6::text, 'reason', $7::text))`,
      [orderId, deliveryId, staff.id, `delivery.${status}`, status, reasonCode, reasonText || null],
    );
    if (status === 'failed' && reasonCode) {
      const incidentId = `inc-${deliveryId}-${Date.now()}`;
      await query(
        `INSERT INTO ops.delivery_incidents (id, order_id, delivery_id, staff_id, reason_code, reason_text)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [incidentId, orderId, deliveryId, staff.id, reasonCode, reasonText || REASON_LABELS[reasonCode]],
      );
      const pay = await query<{
        store_id: string | null;
        payment_id: string | null;
        payment_status: string | null;
      }>(`SELECT store_id, payment_id, payment_status FROM orders WHERE id = $1`, [orderId]);
      const payRow = pay.rows[0];
      const offered = actionsForReason(reasonCode, {
        paid: isPaidOrder(payRow?.payment_id, payRow?.payment_status),
      });
      const label = REASON_LABELS[reasonCode];
      const userRow = await query<{ user_id: string }>(`SELECT user_id FROM orders WHERE id = $1`, [orderId]);
      const userId = userRow.rows[0]?.user_id;
      if (userId) {
        await notifyCustomer({
          userId,
          id: `order-${orderId}-delivery.failed`,
          title: 'Livraison non aboutie',
          body: failedClientBody(label, offered),
          orderId,
          href: `/tracking?id=${encodeURIComponent(orderId)}`,
          icon: 'x-circle',
          kind: 'order',
        });
      }
      await notifyStoreStaff(payRow?.store_id, 'pick', {
        kind: 'incident',
        title: `Incident · ${label}`,
        body: reasonText || `Course ${orderId} clôturée en échec.`,
        href: '/(tabs)/history',
        orderId,
        idPrefix: `inc-${incidentId}`,
      });
      await notifyStaff({
        staffId: staff.id,
        kind: 'incident',
        title: `Incident enregistré · ${label}`,
        body: 'Le client a été notifié et peut choisir une action.',
        href: '/(tabs)/history',
        orderId,
        id: `inc-self-${incidentId}`,
      });
      try {
        const tid = await query<{ tid: string }>(
          `SELECT comms.ensure_courier_thread($1, $2) AS tid`,
          [orderId, staff.id],
        );
        const threadId = tid.rows[0]?.tid;
        if (threadId) {
          await query(
            `INSERT INTO comms.messages (id, thread_id, sender_kind, sender_staff_id, kind, body, payload)
             VALUES ($1, $2, 'system', $3, 'system', $4, $5::jsonb)`,
            [
              `msg-${randomUUID()}`,
              threadId,
              staff.id,
              CLIENT_STEP_COPY['delivery.failed'],
              JSON.stringify({ eventType: 'delivery.failed', orderId, reasonCode }),
            ],
          );
        }
      } catch {
        /* thread best-effort */
      }
    } else {
      await notifyClient(orderId, staff.id, `delivery.${status}`);
    }
    const payout = status === 'delivered' ? await creditDeliverPayout(staff.id, deliveryId, orderId) : 0;
    const customerRating = Number(body?.customerRating);
    if (status === 'delivered' && customerRating >= 1 && customerRating <= 5) {
      await rateOrder({
        orderId,
        raterKind: 'staff',
        staffId: staff.id,
        rating: customerRating,
        comment: typeof body?.customerComment === 'string' ? body.customerComment : '',
      });
    }
    let nextDeliveryId: string | null = null;
    if (status === 'delivered' || status === 'failed') {
      const nxt = await query<{ id: string }>(
        `SELECT id FROM ops.deliveries
         WHERE courier_id = $1
           AND course_id = (SELECT course_id FROM ops.deliveries WHERE id = $2)
           AND status IN ('assigned', 'at_store', 'picked_up', 'en_route', 'arrived')
           AND id <> $2
         ORDER BY assigned_at ASC NULLS LAST, created_at ASC
         LIMIT 1`,
        [staff.id, deliveryId],
      );
      nextDeliveryId = nxt.rows[0]?.id ?? null;
    }
    return c.json({ ok: true, orderId, status, payout, nextDeliveryId });
  });

  app.post('/ops/deliveries/:id/rate-customer', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = routeId(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    const rating = Number(body?.rating ?? body?.customerRating);
    const found = await query<{ id: string; order_id: string; status: string }>(
      `SELECT id, order_id, status FROM ops.deliveries
       WHERE (id = $1 OR order_id = $2 OR id = $3) AND courier_id = $4
       LIMIT 1`,
      [id, id.replace(/^del-/, ''), id.startsWith('del-') ? id : `del-${id}`, staff.id],
    );
    const row = found.rows[0];
    if (!row) return c.json({ ok: false, error: 'Livraison introuvable.' }, 404);
    if (row.status !== 'delivered') {
      return c.json({ ok: false, error: 'Confirmez d’abord le code de réception.' }, 400);
    }
    if (!(rating >= 1 && rating <= 5)) {
      return c.json({ ok: false, error: 'Note invalide.' }, 400);
    }
    await rateOrder({
      orderId: row.order_id,
      raterKind: 'staff',
      staffId: staff.id,
      rating,
      comment: typeof body?.comment === 'string' ? body.comment : typeof body?.customerComment === 'string' ? body.customerComment : '',
    });
    return c.json({ ok: true });
  });

  app.post('/ops/location', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    if (!canDeliver(staff)) return c.json({ ok: false, error: 'forbidden' }, 403);
    const body = await c.req.json().catch(() => null);
    const lng = Number(body?.lng);
    const lat = Number(body?.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return c.json({ ok: false, error: 'Position invalide.' }, 400);
    }
    await query(
      `INSERT INTO ops.courier_locations (courier_id, lng, lat, heading, speed_mps, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (courier_id) DO UPDATE SET
         lng = EXCLUDED.lng, lat = EXCLUDED.lat,
         heading = EXCLUDED.heading, speed_mps = EXCLUDED.speed_mps, updated_at = NOW()`,
      [
        staff.id,
        lng,
        lat,
        Number.isFinite(Number(body?.heading)) ? Number(body.heading) : null,
        Number.isFinite(Number(body?.speedMps)) ? Number(body.speedMps) : null,
      ],
    );
    return c.json({ ok: true });
  });

  app.get('/ops/notifications', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const result = await query<{
      id: string;
      kind: string;
      title: string;
      body: string;
      href: string | null;
      order_id: string | null;
      created_at: Date;
      read_at: Date | null;
      pick_status: string | null;
      delivery_status: string | null;
      shop_status: string | null;
      picker_id: string | null;
      courier_id: string | null;
    }>(
      `SELECT n.id, n.kind, n.title, n.body, n.href, n.order_id, n.created_at, n.read_at,
              t.pick_status, t.delivery_status, t.status AS shop_status, t.picker_id, t.courier_id
       FROM ops.staff_notifications n
       LEFT JOIN public.v_order_tracking t ON t.id = n.order_id
       WHERE n.staff_id = $1
       ORDER BY n.created_at DESC
       LIMIT 80`,
      [staff.id],
    );
    return c.json({
      ok: true,
      items: result.rows.map((row) => {
        const ctx = { ...row, staffId: staff.id };
        const hint = liveStaffHint(ctx);
        return {
          id: row.id,
          kind: row.kind,
          title: row.title,
          body: hint ? `${row.body ? `${row.body} · ` : ''}${hint}` : row.body,
          href: liveStaffHref(ctx),
          order_id: row.order_id,
          created_at: row.created_at,
          read_at: row.read_at,
          live_hint: hint || null,
        };
      }),
    });
  });

  app.post('/ops/notifications/read-all', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    await query(
      `UPDATE ops.staff_notifications SET read_at = COALESCE(read_at, NOW()) WHERE staff_id = $1 AND read_at IS NULL`,
      [staff.id],
    );
    return c.json({ ok: true });
  });

  app.post('/ops/notifications/:id/read', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    await query(
      `UPDATE ops.staff_notifications SET read_at = NOW()
       WHERE id = $1 AND staff_id = $2 AND read_at IS NULL`,
      [routeId(c.req.param('id')), staff.id],
    );
    return c.json({ ok: true });
  });

  app.get('/ops/history', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const result = await query(
      `SELECT * FROM (
         SELECT
           j.id,
           'pick'::text AS kind,
           j.order_id,
           j.status,
           COALESCE(j.packed_at, j.updated_at) AS at,
           COALESCE(p.amount, 0) AS payout,
           o.total,
           o.address_label,
           NULL::text AS failed_reason,
           NULL::text AS failed_reason_code,
           NULL::text AS client_action
         FROM ops.pick_jobs j
         JOIN orders o ON o.id = j.order_id
         LEFT JOIN ops.staff_payouts p ON p.kind = 'pick' AND p.ref_id = j.id
         WHERE j.picker_id = $1 AND j.status = 'packed'
         UNION ALL
         SELECT
           d.id,
           'deliver'::text AS kind,
           d.order_id,
           d.status,
           COALESCE(d.delivered_at, d.updated_at) AS at,
           COALESCE(p.amount, 0) AS payout,
           o.total,
           o.address_label,
           d.failed_reason,
           d.failed_reason_code,
           a.action AS client_action
         FROM ops.deliveries d
         JOIN orders o ON o.id = d.order_id
         LEFT JOIN ops.staff_payouts p ON p.kind = 'deliver' AND p.ref_id = d.id
         LEFT JOIN ops.client_incident_actions a ON a.order_id = d.order_id
         WHERE d.courier_id = $1 AND d.status IN ('delivered', 'failed', 'cancelled')
       ) h
       ORDER BY at DESC
       LIMIT 80`,
      [staff.id],
    );
    return c.json({ ok: true, items: result.rows });
  });

  app.get('/ops/incidents', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const result = await query(
      `SELECT
         i.id,
         i.order_id,
         i.delivery_id,
         i.staff_id,
         i.reason_code,
         i.reason_text,
         i.created_at,
         o.address_label,
         o.store_id,
         a.action AS client_action,
         a.note AS client_note,
         a.created_at AS client_action_at,
         u.first_name AS customer_first,
         u.last_name AS customer_last
       FROM ops.delivery_incidents i
       JOIN orders o ON o.id = i.order_id
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN ops.client_incident_actions a ON a.order_id = i.order_id
       WHERE $1::text IS NULL OR o.store_id = $1
       ORDER BY i.created_at DESC
       LIMIT 120`,
      [staff.store_id],
    );
    return c.json({ ok: true, items: result.rows });
  });

  app.get('/ops/earnings', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const sums = await query<{
      today: string;
      week: string;
      all_time: string;
      deliveries_today: string;
      picks_today: string;
      pick_today: string;
      deliver_today: string;
      pick_week: string;
      deliver_week: string;
      deliveries_week: string;
      picks_week: string;
      avg_deliver: string;
      jobs_all: string;
      tip_today: string;
      tip_all: string;
    }>(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE), 0)::text AS today,
         COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('week', CURRENT_TIMESTAMP)), 0)::text AS week,
         COALESCE(SUM(amount), 0)::text AS all_time,
         COUNT(*) FILTER (WHERE kind = 'deliver' AND created_at >= CURRENT_DATE)::text AS deliveries_today,
         COUNT(*) FILTER (WHERE kind = 'pick' AND created_at >= CURRENT_DATE)::text AS picks_today,
         COALESCE(SUM(amount) FILTER (WHERE kind = 'pick' AND created_at >= CURRENT_DATE), 0)::text AS pick_today,
         COALESCE(SUM(amount) FILTER (WHERE kind = 'deliver' AND created_at >= CURRENT_DATE), 0)::text AS deliver_today,
         COALESCE(SUM(amount) FILTER (WHERE kind = 'pick' AND created_at >= date_trunc('week', CURRENT_TIMESTAMP)), 0)::text AS pick_week,
         COALESCE(SUM(amount) FILTER (WHERE kind = 'deliver' AND created_at >= date_trunc('week', CURRENT_TIMESTAMP)), 0)::text AS deliver_week,
         COUNT(*) FILTER (WHERE kind = 'deliver' AND created_at >= date_trunc('week', CURRENT_TIMESTAMP))::text AS deliveries_week,
         COUNT(*) FILTER (WHERE kind = 'pick' AND created_at >= date_trunc('week', CURRENT_TIMESTAMP))::text AS picks_week,
         COALESCE(AVG(amount) FILTER (WHERE kind = 'deliver'), 0)::text AS avg_deliver,
         COALESCE(SUM(amount) FILTER (WHERE kind = 'tip' AND created_at >= CURRENT_DATE), 0)::text AS tip_today,
         COALESCE(SUM(amount) FILTER (WHERE kind = 'tip'), 0)::text AS tip_all,
         COUNT(*) FILTER (WHERE kind IN ('pick', 'deliver'))::text AS jobs_all
       FROM ops.staff_payouts
       WHERE staff_id = $1`,
      [staff.id],
    );
    const cash = await query<{ cash: string }>(
      `SELECT COALESCE(SUM(cash_to_collect), 0)::text AS cash
       FROM ops.deliveries
       WHERE courier_id = $1 AND status = 'delivered' AND delivered_at >= CURRENT_DATE`,
      [staff.id],
    );
    const extra = await query<{ failed: string; delivered: string; avg_min: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
         COUNT(*) FILTER (WHERE status = 'delivered')::text AS delivered,
         COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - assigned_at)) / 60) FILTER (WHERE status = 'delivered' AND assigned_at IS NOT NULL AND delivered_at IS NOT NULL), 0)::text AS avg_min
       FROM ops.deliveries
       WHERE courier_id = $1`,
      [staff.id],
    );
    const days = await query<{ d: string; amt: string }>(
      `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS d, COALESCE(SUM(amount), 0)::text AS amt
       FROM ops.staff_payouts
       WHERE staff_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY 1
       ORDER BY 1`,
      [staff.id],
    );
    const scored = await staffWithScore(staff);
    const row = sums.rows[0];
    const x = extra.rows[0];
    const deliveredN = Number(x?.delivered ?? 0);
    const failedN = Number(x?.failed ?? 0);
    return c.json({
      ok: true,
      today: Number(row?.today ?? 0),
      week: Number(row?.week ?? 0),
      allTime: Number(row?.all_time ?? 0),
      deliveriesToday: Number(row?.deliveries_today ?? 0),
      picksToday: Number(row?.picks_today ?? 0),
      cashToday: Number(cash.rows[0]?.cash ?? 0),
      pickToday: Number(row?.pick_today ?? 0),
      deliverToday: Number(row?.deliver_today ?? 0),
      pickWeek: Number(row?.pick_week ?? 0),
      deliverWeek: Number(row?.deliver_week ?? 0),
      deliveriesWeek: Number(row?.deliveries_week ?? 0),
      picksWeek: Number(row?.picks_week ?? 0),
      avgDeliveryPayout: Math.round(Number(row?.avg_deliver ?? 0)),
      jobsAll: Number(row?.jobs_all ?? 0),
      failedAll: failedN,
      successRate: deliveredN + failedN > 0 ? Math.round((deliveredN / (deliveredN + failedN)) * 100) : null,
      avgMinutes: Math.round(Number(x?.avg_min ?? 0)),
      ratingAvg: scored.ratingAvg,
      ratingCount: scored.ratingCount,
      tipToday: Number(row?.tip_today ?? 0),
      tipAll: Number(row?.tip_all ?? 0),
      weekDays: days.rows.map((r) => ({ date: r.d, amount: Number(r.amt ?? 0) })),
    });
  });

  app.get('/ops/orders/:id', async (c) => {
    const staff = await staffFromToken(bearer(c.req.header('Authorization')));
    if (!staff) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = routeId(c.req.param('id'));
    const order = await query(`SELECT * FROM public.v_order_tracking WHERE id = $1`, [id]);
    if (!order.rows[0]) return c.json({ ok: false, error: 'not_found' }, 404);
    const lines = await query<{
      product_id: string;
      name: string;
      unit: string;
      qty: number;
      unit_price: number;
      picked_qty: number;
      unavailable: boolean;
      note: string | null;
      category_id: string | null;
      barcode: string | null;
      available_qty: string;
      stock_before: string | null;
      stock_after: string | null;
      image_checksum: string | null;
      image_attribution: string | null;
      image_license_name: string | null;
      image_license_url: string | null;
    }>(
      `SELECT l.product_id, l.name, l.unit, l.qty, l.unit_price, l.picked_qty, l.unavailable, l.note,
              p.category_id, p.barcode,
              COALESCE(s.qty - s.reserved, 0)::text AS available_qty,
              sale.qty_before::text AS stock_before, sale.qty_after::text AS stock_after,
              m.checksum_sha256 AS image_checksum, m.attribution AS image_attribution,
              m.license_name AS image_license_name, m.license_url AS image_license_url
       FROM public.order_lines l
       JOIN orders o ON o.id = l.order_id
       LEFT JOIN products p ON p.id = l.product_id
       LEFT JOIN product_stock s
         ON s.product_id = l.product_id AND s.store_id = COALESCE(o.store_id, 'su-aeroport')
       LEFT JOIN stock_moves sale
         ON sale.product_id = l.product_id
        AND sale.store_id = COALESCE(o.store_id, 'su-aeroport')
        AND sale.ref_type = 'order' AND sale.ref_id = o.id AND sale.reason = 'sale'
       LEFT JOIN LATERAL (
         SELECT checksum_sha256, attribution, license_name, license_url
         FROM product_media
         WHERE product_id = l.product_id AND kind = 'image'
         ORDER BY (position = 0) DESC, is_placeholder ASC, position
         LIMIT 1
       ) m ON TRUE
       WHERE l.order_id = $1
       ORDER BY l.position`,
      [id],
    );
    const events = await query(
      `SELECT event_type, actor_kind, payload, created_at FROM ops.events
       WHERE order_id = $1 ORDER BY created_at ASC`,
      [id],
    );
    return c.json({
      ok: true,
      order: order.rows[0],
      live: trackingRowToLive(order.rows[0] as Record<string, unknown>, id),
      lines: lines.rows.map((row) => ({
        ...row,
        barcode: row.barcode ?? productBarcode(row.product_id),
        category_id: row.category_id,
        available_qty: Number(row.available_qty),
        stock_before: row.stock_before == null ? null : Number(row.stock_before),
        stock_after: row.stock_after == null ? null : Number(row.stock_after),
        image_url: `/catalog/media/${encodeURIComponent(row.product_id)}`,
        image: {
          checksum_sha256: row.image_checksum,
          attribution: row.image_attribution,
          license_name: row.image_license_name,
          license_url: row.image_license_url,
        },
      })),
      events: events.rows,
    });
  });
}
