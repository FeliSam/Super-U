import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { migrate, pool, query } from './db.ts';
import { hashPassword, newToken, newUserId, verifyPassword } from './password.ts';
import { seedAll } from './seed.ts';
import { trackingRowToLive } from './live.ts';
import { registerOpsRoutes, rateOrder, creditCourierTip, notifyStaff, notifyStoreStaff, notifyOrderUser, attachIncidentLive, recordClientIncidentAction } from './ops.ts';
import { registerCommsRoutes, archiveDeliveredCourierThreads } from './comms.ts';
import { registerAdminRoutes } from './admin.ts';
import { readCatalogImage } from './productMedia.ts';
import { createFedapayCheckout, fedapayConfigured, getFedapayTransaction, mapFedapayStatus } from './fedapay.ts';

function makeHandoffCode() {
  return String(1000 + Math.floor(Math.random() * 9000));
}

type UserRow = {
  id: string;
  email: string;
  phone: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  onboarding_done: boolean;
  birth_date: string;
  created_at: Date;
};

function publicUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    onboardingDone: row.onboarding_done,
    birthDate: row.birth_date ?? '',
    createdAt: row.created_at,
  };
}

async function userFromToken(token: string | undefined) {
  if (!token) return null;
  const result = await query<UserRow>(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1`,
    [token],
  );
  return result.rows[0] ?? null;
}

function bearer(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

function nationalBeninDigits(phone: string): string | null {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00229')) d = d.slice(5);
  else if (d.startsWith('229')) d = d.slice(3);
  if (d.length === 10 && (d.startsWith('01') || d.startsWith('02'))) return d;
  if (d.length === 8) return `${d.startsWith('2') ? '02' : '01'}${d}`;
  return null;
}

function nationalDigits(phone: string) {
  return nationalBeninDigits(phone) ?? phone.replace(/\D/g, '').replace(/^229/, '').slice(-10);
}

function formatBeninPhone(digits: string) {
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 2) parts.push(digits.slice(i, i + 2));
  return `+229 ${parts.join(' ')}`;
}

const app = new Hono();

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.use('*', async (c, next) => {
  await next();
  c.header('Cross-Origin-Resource-Policy', 'cross-origin');
});

app.onError((err, c) => {
  console.error(err);
  const raw = err instanceof Error ? err.message : String(err);
  if (/duplicate key|unique constraint|comms_threads_courier_order/i.test(raw)) {
    return c.json({ ok: false, error: 'Cette course a déjà une conversation. Réessayez.' }, 409);
  }
  return c.json({ ok: false, error: 'Erreur serveur. Réessayez dans un instant.' }, 500);
});

app.get('/health', async (c) => {
  try {
    await query('SELECT 1');
    return c.json({ ok: true, db: true });
  } catch {
    return c.json({ ok: false, db: false }, 503);
  }
});

app.get('/catalog/media/:id', async (c) => {
  const id = c.req.param('id');
  const found = await query<{ category_id: string }>('SELECT category_id FROM products WHERE id = $1', [id]).catch(
    () => ({ rows: [] as { category_id: string }[] }),
  );
  const img = readCatalogImage(id, found.rows[0]?.category_id);
  if (!img) return c.json({ ok: false, error: 'not_found' }, 404);
  return new Response(img.buf, {
    headers: {
      'Content-Type': img.type,
      'Cache-Control': 'public, max-age=86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
});

app.get('/catalog', async (c) => {
  const [products, categories, banners, chips, merch] = await Promise.all([
    query<{ id: string; category_id: string; payload: object }>(
      'SELECT id, category_id, payload FROM products',
    ),
    query<{ id: string; payload: object }>('SELECT id, payload FROM categories'),
    query<{ id: string; payload: object }>('SELECT id, payload FROM banners'),
    query<{ id: string; payload: object }>('SELECT id, payload FROM chips'),
    query<{ payload: object }>(`SELECT payload FROM catalog_settings WHERE key = 'merch'`).catch(() => ({
      rows: [] as { payload: object }[],
    })),
  ]);
  return c.json({
    products: products.rows.map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      payload: row.payload,
    })),
    categories: categories.rows,
    banners: banners.rows,
    chips: chips.rows,
    merch: merch.rows[0]?.payload ?? null,
  });
});

app.get('/stores', async (c) => {
  const result = await query<{ id: string; payload: object }>('SELECT id, payload FROM stores');
  return c.json({
    ok: true,
    count: result.rows.length,
    stores: result.rows.map((row) => row.payload),
  });
});

app.post('/auth/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ ok: false, error: 'Requête invalide.' }, 400);

  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? '').trim();
  const password = String(body.password ?? '');

  if (!firstName || !lastName) return c.json({ ok: false, error: 'Ajoutez votre prénom et votre nom.' }, 400);
  if (!email.includes('@') || email.length < 5) {
    return c.json({ ok: false, error: 'Entrez une adresse e-mail valide.' }, 400);
  }
  const phoneDigits = nationalBeninDigits(phone);
  if (!phoneDigits) {
    return c.json({ ok: false, error: 'Numéro béninois invalide (+229 01 00 00 00 00).' }, 400);
  }
  const phoneFormatted = formatBeninPhone(phoneDigits);
  if (password.length < 6) {
    return c.json({ ok: false, error: 'Choisissez un mot de passe d’au moins 6 caractères.' }, 400);
  }

  const clashEmail = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (clashEmail.rowCount) {
    return c.json({ ok: false, error: 'Un compte existe déjà avec cet e-mail.' }, 409);
  }
  const clashPhone = await query(
    `SELECT id FROM users WHERE regexp_replace(phone, '\\D', '', 'g') LIKE $1`,
    [`%${phoneDigits}`],
  );
  if (clashPhone.rowCount) {
    return c.json({ ok: false, error: 'Un compte existe déjà avec ce numéro.' }, 409);
  }

  const id = newUserId();
  const inserted = await query<UserRow>(
    `INSERT INTO users (id, email, phone, password_hash, first_name, last_name, onboarding_done)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE)
     RETURNING *`,
    [id, email, phoneFormatted, await hashPassword(password), firstName, lastName],
  );
  const user = inserted.rows[0];
  const token = newToken();
  await query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);
  return c.json({ ok: true, token, user: publicUser(user) });
});

app.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const identifier = String(body?.identifier ?? body?.email ?? '').trim();
  const password = String(body?.password ?? '');
  if (!identifier || !password) {
    return c.json({ ok: false, error: 'Indiquez votre e-mail (ou téléphone) et votre mot de passe.' }, 400);
  }

  const email = identifier.includes('@') ? identifier.toLowerCase() : '';
  const digits = nationalDigits(identifier);
  const result = await query<UserRow>(
    email
      ? 'SELECT * FROM users WHERE email = $1 LIMIT 1'
      : `SELECT * FROM users WHERE regexp_replace(phone, '\\D', '', 'g') LIKE $1 LIMIT 1`,
    email ? [email] : [`%${digits}`],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ ok: false, error: 'Identifiants incorrects. Réessayez ou créez un compte.' }, 401);
  }

  const token = newToken();
  await query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);
  return c.json({ ok: true, token, user: publicUser(user) });
});

app.get('/auth/me', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  return c.json({ ok: true, user: publicUser(user) });
});

app.patch('/auth/me', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({}));

  const firstName =
    typeof body?.firstName === 'string' && body.firstName.trim() ? body.firstName.trim() : user.first_name;
  const lastName =
    typeof body?.lastName === 'string' && body.lastName.trim() ? body.lastName.trim() : user.last_name;
  const email =
    typeof body?.email === 'string' && body.email.includes('@')
      ? String(body.email).trim().toLowerCase()
      : user.email;
  const phoneRaw = typeof body?.phone === 'string' && body.phone.trim() ? String(body.phone).trim() : user.phone;
  const phoneDigits = nationalBeninDigits(phoneRaw);
  if (!phoneDigits) {
    return c.json({ ok: false, error: 'Numéro béninois invalide (+229 01 00 00 00 00).' }, 400);
  }
  const phone = formatBeninPhone(phoneDigits);
  const birthDate = typeof body?.birthDate === 'string' ? String(body.birthDate).trim() : user.birth_date ?? '';
  const onboardingDone = body?.onboardingDone === true ? true : user.onboarding_done;

  if (email !== user.email) {
    const clash = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, user.id]);
    if (clash.rowCount) return c.json({ ok: false, error: 'Un compte existe déjà avec cet e-mail.' }, 409);
  }
  if (phoneDigits !== nationalBeninDigits(user.phone)) {
    const clash = await query(
      `SELECT id FROM users WHERE regexp_replace(phone, '\\D', '', 'g') LIKE $1 AND id <> $2`,
      [`%${phoneDigits}`, user.id],
    );
    if (clash.rowCount) return c.json({ ok: false, error: 'Un compte existe déjà avec ce numéro.' }, 409);
  }

  const updated = await query<UserRow>(
    `UPDATE users SET first_name = $2, last_name = $3, email = $4, phone = $5, birth_date = $6, onboarding_done = $7
     WHERE id = $1 RETURNING *`,
    [user.id, firstName, lastName, email, phone, birthDate, onboardingDone],
  );
  return c.json({ ok: true, user: publicUser(updated.rows[0]) });
});

app.get('/me/state', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const result = await query<{ payload: object }>(
    'SELECT payload FROM user_state WHERE user_id = $1',
    [user.id],
  );
  return c.json({ ok: true, state: result.rows[0]?.payload ?? {} });
});

app.patch('/me/state', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ ok: false, error: 'invalid' }, 400);
  }
  const existing = await query<{ payload: Record<string, unknown> }>(
    'SELECT payload FROM user_state WHERE user_id = $1',
    [user.id],
  );
  const current = existing.rows[0]?.payload ?? {};
  const incoming = body as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...current, ...incoming };
  if (
    incoming.prefs &&
    typeof incoming.prefs === 'object' &&
    !Array.isArray(incoming.prefs) &&
    current.prefs &&
    typeof current.prefs === 'object' &&
    !Array.isArray(current.prefs)
  ) {
    merged.prefs = { ...(current.prefs as object), ...(incoming.prefs as object) };
  }
  await query(
    `INSERT INTO user_state (user_id, payload, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [user.id, JSON.stringify(merged)],
  );
  if (typeof incoming.photoUri === 'string') {
    const photo = incoming.photoUri.trim();
    if (photo.startsWith('data:image/')) {
      await query(`UPDATE users SET photo_data = $2 WHERE id = $1`, [user.id, photo]);
    } else if (!photo) {
      await query(`UPDATE users SET photo_data = NULL WHERE id = $1`, [user.id]);
    }
  }
  return c.json({ ok: true, state: merged });
});

function parseUserPhoto(raw: unknown) {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m?.[1] || !m[2] || m[2].length > 1_400_000) return null;
  return { mime: m[1], b64: m[2] };
}

app.get('/users/:id/photo', async (c) => {
  const id = c.req.param('id');
  const row = await query<{ photo: string | null }>(
    `SELECT COALESCE(u.photo_data, NULLIF(s.payload->>'photoUri', '')) AS photo
     FROM users u
     LEFT JOIN user_state s ON s.user_id = u.id
     WHERE u.id = $1`,
    [id],
  );
  const parsed = parseUserPhoto(row.rows[0]?.photo);
  if (!parsed) return c.text('Not found', 404);
  const bytes = Buffer.from(parsed.b64, 'base64');
  return new Response(bytes, {
    headers: {
      'Content-Type': parsed.mime,
      'Cache-Control': 'public, max-age=60',
    },
  });
});

app.get('/me/notifications', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  await query(
    `INSERT INTO public.user_notifications (id, user_id, kind, title, body, preview, href, order_id, icon, created_at)
     SELECT
       'order-' || e.order_id || '-' || e.event_type,
       o.user_id,
       'order',
       CASE e.event_type
         WHEN 'pick.claimed' THEN 'Commande acceptée'
         WHEN 'pick.started' THEN 'Rassemblement commencé'
         WHEN 'pick.packed' THEN 'Commande rassemblée'
         WHEN 'delivery.claimed' THEN 'Course prise'
         WHEN 'delivery.at_store' THEN 'Coursier au magasin'
         WHEN 'delivery.picked_up' THEN 'Course commencée'
         WHEN 'delivery.en_route' THEN 'Livreur en route'
         WHEN 'delivery.arrived' THEN 'Livreur arrivé'
         WHEN 'delivery.delivered' THEN 'Commande livrée'
         WHEN 'delivery.failed' THEN 'Livraison non aboutie'
         ELSE 'Mise à jour commande'
       END,
       COALESCE(e.payload->>'copy', e.event_type),
       left(COALESCE(e.payload->>'copy', e.event_type), 160),
       CASE WHEN e.event_type IN ('delivery.delivered', 'delivery.failed')
            THEN '/order/' || e.order_id
            ELSE '/tracking?id=' || e.order_id END,
       e.order_id,
       CASE WHEN e.event_type IN ('delivery.delivered') THEN 'smile'
            WHEN e.event_type IN ('delivery.failed') THEN 'x-circle'
            ELSE 'package' END,
       e.created_at
     FROM ops.events e
     JOIN orders o ON o.id = e.order_id
     WHERE o.user_id = $1
       AND e.event_type IN (
         'pick.claimed','pick.started','pick.packed',
         'delivery.claimed','delivery.at_store','delivery.picked_up','delivery.en_route',
         'delivery.arrived','delivery.delivered','delivery.failed'
       )
     ON CONFLICT (id) DO NOTHING`,
    [user.id],
  ).catch(() => undefined);
  await query(
    `INSERT INTO public.user_notifications (id, user_id, kind, title, body, preview, href, order_id, icon, created_at)
     SELECT
       'order-' || o.id || '-placed',
       o.user_id,
       'order',
       'Commande reçue',
       'Votre commande est chez Super U.',
       'Votre commande est chez Super U.',
       '/tracking?id=' || o.id,
       o.id,
       'check-circle',
       o.created_at
     FROM orders o
     WHERE o.user_id = $1
     ON CONFLICT (id) DO NOTHING`,
    [user.id],
  ).catch(() => undefined);
  const result = await query<{
    id: string;
    title: string;
    body: string;
    preview: string;
    href: string | null;
    order_id: string | null;
    icon: string;
    created_at: Date;
    read_at: Date | null;
  }>(
    `SELECT id, title, body, preview, href, order_id, icon, created_at, read_at
     FROM public.user_notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 80`,
    [user.id],
  );
  return c.json({
    ok: true,
    items: result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      preview: row.preview || row.body,
      actionHref: row.href,
      orderId: row.order_id,
      icon: row.icon,
      createdAt: new Date(row.created_at).getTime(),
      read: Boolean(row.read_at),
    })),
  });
});

app.post('/me/notifications/read-all', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  await query(
    `UPDATE public.user_notifications SET read_at = COALESCE(read_at, NOW())
     WHERE user_id = $1 AND read_at IS NULL`,
    [user.id],
  );
  return c.json({ ok: true });
});

app.post('/me/notifications/:id/read', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  await query(
    `UPDATE public.user_notifications SET read_at = NOW()
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [c.req.param('id'), user.id],
  );
  return c.json({ ok: true });
});

app.get('/me/cart', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const cart = await query<{ promo_code: string | null }>(
    'SELECT promo_code FROM carts WHERE user_id = $1',
    [user.id],
  );
  const lines = await query<{ product_id: string; qty: number; unit_override: string | null }>(
    'SELECT product_id, qty, unit_override FROM cart_lines WHERE user_id = $1',
    [user.id],
  );
  return c.json({
    ok: true,
    promoCode: cart.rows[0]?.promo_code ?? null,
    lines: lines.rows.map((row) => ({
      productId: row.product_id,
      qty: row.qty,
      ...(row.unit_override ? { unitOverride: row.unit_override } : {}),
    })),
  });
});

app.put('/me/cart', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const body = await c.req.json().catch(() => null);
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  const promoCode = typeof body?.promoCode === 'string' && body.promoCode ? body.promoCode : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO carts (user_id, promo_code, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET promo_code = EXCLUDED.promo_code, updated_at = NOW()`,
      [user.id, promoCode],
    );
    await client.query('DELETE FROM cart_lines WHERE user_id = $1', [user.id]);
    for (const line of lines) {
      const productId = String(line?.productId ?? '');
      const qty = Math.min(99, Math.floor(Number(line?.qty) || 0));
      if (!productId || qty <= 0) continue;
      await client.query(
        'INSERT INTO cart_lines (user_id, product_id, qty, unit_override) VALUES ($1, $2, $3, $4)',
        [user.id, productId, qty, typeof line.unitOverride === 'string' ? line.unitOverride : null],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return c.json({ ok: true });
});

app.get('/me/orders', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const result = await query<{ payload: object; managed_by: string; handoff_code: string | null } & Record<string, unknown>>(
    `SELECT
       o.id,
       o.payload,
       o.managed_by,
       o.handoff_code,
       t.status,
       t.pick_status,
       t.delivery_status,
       t.courier_first_name,
       t.courier_last_name,
       t.courier_phone,
       t.courier_id,
       t.courier_has_photo,
       t.courier_lng,
       t.courier_lat,
       t.courier_located_at,
       t.packed_at,
       t.same_handler,
       t.picker_first_name,
       t.picker_last_name,
       t.failed_reason,
       t.failed_reason_code,
       t.courier_vehicle,
       t.picked_up_at,
       t.en_route_at,
       comms.thread_for_order(o.id) AS comms_thread_id,
       a.action AS incident_action
     FROM orders o
     LEFT JOIN public.v_order_tracking t ON t.id = o.id
     LEFT JOIN ops.client_incident_actions a ON a.order_id = o.id
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC`,
    [user.id],
  );
  return c.json({
    ok: true,
    orders: result.rows.map((row) => {
      const live = trackingRowToLive(row, String((row.payload as { id?: string })?.id ?? ''));
      const payload = typeof row.payload === 'object' && row.payload ? row.payload : {};
      const courierName = [live.courierFirstName, live.courierLastName].filter(Boolean).join(' ').trim();
      const pickerName = [live.pickerFirstName, live.pickerLastName].filter(Boolean).join(' ').trim();
      return {
        ...payload,
        id: String(row.id),
        managedBy: live.managedBy,
        status: live.status || (payload as { status?: string }).status,
        pickStatus: live.pickStatus,
        deliveryStatus: live.deliveryStatus,
        packedAt: live.packedAt,
        pickedUpAt: live.pickedUpAt,
        enRouteAt: live.enRouteAt,
        commsThreadId: live.commsThreadId,
        sameHandler: live.sameHandler,
        courierName,
        courierId: live.courierId || undefined,
        courierHasPhoto: live.courierHasPhoto,
        courierPhone: live.courierPhone,
        courierCoordinate:
          live.courierLng != null && live.courierLat != null
            ? [live.courierLng, live.courierLat]
            : (payload as { courierCoordinate?: unknown }).courierCoordinate,
        courierLocatedAt: live.courierLocatedAt,
        pickerName,
        phase: live.phase,
        failedReason: live.failedReason,
        failedReasonCode: live.failedReasonCode,
        incidentAction: live.incidentAction,
        courierVehicle: live.courierVehicle,
        handoffCode: String(row.handoff_code || (payload as { handoffCode?: string }).handoffCode || ''),
      };
    }),
  });
});

app.post('/me/orders', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const order = await c.req.json().catch(() => null);
  if (!order?.id || !Array.isArray(order.lines)) {
    return c.json({ ok: false, error: 'Commande invalide.' }, 400);
  }
  const handoffCode = makeHandoffCode();
  const stored = { ...order, handoffCode };
  await query(
    'INSERT INTO orders (id, user_id, payload, created_at, handoff_code) VALUES ($1, $2, $3::jsonb, $4, $5) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload',
    [order.id, user.id, JSON.stringify(stored), order.createdAt ?? new Date().toISOString(), handoffCode],
  );
  await query(
    `UPDATE orders SET handoff_code = COALESCE(NULLIF(handoff_code, ''), $2),
       payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('handoffCode', COALESCE(NULLIF(handoff_code, ''), $2))
     WHERE id = $1`,
    [order.id, handoffCode],
  );
  const saved = await query<{ handoff_code: string | null }>(`SELECT handoff_code FROM orders WHERE id = $1`, [order.id]);
  const code = saved.rows[0]?.handoff_code || handoffCode;
  await query('DELETE FROM cart_lines WHERE user_id = $1', [user.id]);
  await query(
    `INSERT INTO carts (user_id, promo_code, updated_at) VALUES ($1, NULL, NOW())
     ON CONFLICT (user_id) DO UPDATE SET promo_code = NULL, updated_at = NOW()`,
    [user.id],
  );
  const storeId = typeof order.storeId === 'string' ? order.storeId : null;
  const comment = typeof order.comment === 'string' ? order.comment.trim() : '';
  const label = String(order.id ?? '').replace(/^#/, '');
  await notifyStoreStaff(storeId, 'pick', {
    kind: 'job',
    title: 'Nouveau ramassage',
    body: [
      `${label} · ${Number(order.itemCount ?? order.lines?.length ?? 0)} article(s). Un seul ramassage à la fois, jusqu’à 3 colis dans le même Super U.`,
      comment ? `Note client : ${comment}` : '',
    ]
      .filter(Boolean)
      .join(' '),
    href: `/job/${encodeURIComponent(`pick-${order.id}`)}`,
    orderId: String(order.id),
    idPrefix: `ntf-new-${order.id}`,
  });
  await notifyOrderUser(String(order.id), 'placed');
  return c.json({ ok: true, order: { ...order, handoffCode: code } });
});

registerOpsRoutes(app);
registerCommsRoutes(app);
registerAdminRoutes(app);

app.post('/me/payments', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  if (!fedapayConfigured()) {
    return c.json(
      {
        ok: false,
        error:
          'Paiement en ligne non configuré. Ajoutez FEDAPAY_SECRET_KEY sur l’API (sandbox FedaPay), ou choisissez le paiement à la livraison.',
      },
      503,
    );
  }
  const body = await c.req.json().catch(() => null);
  const amount = Math.round(Number(body?.amount));
  const method = String(body?.method ?? '');
  if (!Number.isFinite(amount) || amount < 100) {
    return c.json({ ok: false, error: 'Montant invalide.' }, 400);
  }
  if (!['om', 'wave', 'card'].includes(method)) {
    return c.json({ ok: false, error: 'Moyen de paiement en ligne invalide.' }, 400);
  }
  const publicBase = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT ?? 8787}`).replace(/\/$/, '');
  try {
    const checkout = await createFedapayCheckout({
      amount,
      description: `Marché Doré · ${method === 'om' ? 'Orange Money' : method === 'wave' ? 'MTN MoMo' : 'Carte'}`,
      callbackUrl: `${publicBase}/webhooks/fedapay`,
      customer: {
        firstname: String(body?.firstName ?? user.first_name),
        lastname: String(body?.lastName ?? user.last_name),
        email: String(body?.email ?? user.email),
        phone: String(body?.phone ?? user.phone),
      },
    });
    const id = randomUUID();
    await query(
      `INSERT INTO payments (id, user_id, provider_id, amount, method, status, checkout_url)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
      [id, user.id, checkout.providerId, amount, method, checkout.checkoutUrl],
    );
    return c.json({
      ok: true,
      payment: {
        id,
        status: 'pending',
        checkoutUrl: checkout.checkoutUrl,
        amount,
        method,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Création du paiement impossible.';
    return c.json({ ok: false, error: message }, 502);
  }
});

app.get('/me/payments/:id', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const found = await query<{
    id: string;
    provider_id: string | null;
    amount: number;
    method: string;
    status: string;
    checkout_url: string | null;
  }>('SELECT id, provider_id, amount, method, status, checkout_url FROM payments WHERE id = $1 AND user_id = $2', [
    id,
    user.id,
  ]);
  const row = found.rows[0];
  if (!row) return c.json({ ok: false, error: 'not_found' }, 404);

  let status = row.status;
  if (row.provider_id && status === 'pending' && fedapayConfigured()) {
    try {
      const remote = await getFedapayTransaction(row.provider_id);
      status = mapFedapayStatus(remote.status);
      if (status !== row.status) {
        await query('UPDATE payments SET status = $2 WHERE id = $1', [row.id, status]);
      }
    } catch {
      /* keep last known status */
    }
  }

  return c.json({
    ok: true,
    payment: {
      id: row.id,
      status,
      checkoutUrl: row.checkout_url,
      amount: row.amount,
      method: row.method,
    },
  });
});

app.post('/webhooks/fedapay', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ ok: false }, 400);
  const raw = body as Record<string, unknown>;
  const entity = (raw.entity ?? raw['v1/transaction'] ?? raw.transaction ?? raw) as Record<string, unknown>;
  const providerId = String(entity.id ?? '');
  if (!providerId) return c.json({ ok: true });
  const status = mapFedapayStatus(String(entity.status ?? ''));
  await query('UPDATE payments SET status = $2 WHERE provider_id = $1 AND status = $3', [
    providerId,
    status,
    'pending',
  ]);
  return c.json({ ok: true });
});

app.patch('/me/orders/:id', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const status = String(body?.status ?? '');
  const found = await query<{ payload: Record<string, unknown> }>(
    'SELECT payload FROM orders WHERE id = $1 AND user_id = $2',
    [id, user.id],
  );
  if (!found.rows[0]) return c.json({ ok: false, error: 'not_found' }, 404);
  const payload = { ...found.rows[0].payload, status };
  await query('UPDATE orders SET payload = $3::jsonb WHERE id = $1 AND user_id = $2', [
    id,
    user.id,
    JSON.stringify(payload),
  ]);
  return c.json({ ok: true, order: payload });
});

app.get('/me/orders/:id/live', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const found = await query(
    `SELECT t.*, comms.thread_for_order(t.id) AS comms_thread_id
     FROM public.v_order_tracking t WHERE t.id = $1 AND t.user_id = $2`,
    [id, user.id],
  );
  if (!found.rows[0]) return c.json({ ok: false, error: 'not_found' }, 404);
  const live = trackingRowToLive(found.rows[0] as Record<string, unknown>, id);
  try {
    const events = await query<{ id: number; event_type: string; created_at: Date }>(
      `SELECT id, event_type, created_at FROM ops.events WHERE order_id = $1 ORDER BY id DESC LIMIT 16`,
      [id],
    );
    live.events = events.rows
      .slice()
      .reverse()
      .map((e) => ({
        id: Number(e.id),
        eventType: String(e.event_type),
        createdAt: e.created_at instanceof Date ? e.created_at.toISOString() : String(e.created_at),
      }));
  } catch {
    live.events = [];
  }
  await attachIncidentLive(live, id);
  return c.json({ ok: true, live });
});

app.post('/me/orders/:id/incident-action', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const result = await recordClientIncidentAction({
    orderId: id,
    userId: user.id,
    action: String(body?.action ?? ''),
    note: typeof body?.note === 'string' ? body.note : '',
  });
  if (!result.ok) return c.json({ ok: false, error: result.error }, result.status);
  return c.json({ ok: true, action: result.action, offered: result.offered });
});

app.post('/me/orders/:id/rate-courier', async (c) => {
  const user = await userFromToken(bearer(c.req.header('Authorization')));
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const owned = await query<{ status: string }>(
    `SELECT status FROM orders WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!owned.rows[0]) return c.json({ ok: false, error: 'not_found' }, 404);
  if (owned.rows[0].status !== 'delivered') {
    return c.json({ ok: false, error: 'La livraison n’est pas encore terminée.' }, 409);
  }
  const body = await c.req.json().catch(() => null);
  const rating = Number(body?.rating);
  if (rating < 1 || rating > 5) return c.json({ ok: false, error: 'Note invalide.' }, 400);
  const tipRaw = Number(body?.tipAmount ?? body?.tip ?? 0);
  const tipAmount = !Number.isFinite(tipRaw) || tipRaw <= 0 ? 0 : Math.min(100_000, Math.round(tipRaw));
  if (tipAmount > 0 && tipAmount < 100) {
    return c.json({ ok: false, error: 'Pourboire minimum : 100 F.' }, 400);
  }
  await rateOrder({
    orderId: id,
    raterKind: 'customer',
    userId: user.id,
    rating,
    comment: typeof body?.comment === 'string' ? body.comment : '',
    tipAmount,
  });
  const courier = await query<{ courier_id: string | null }>(
    `SELECT courier_id FROM ops.deliveries WHERE order_id = $1`,
    [id],
  );
  const staffId = courier.rows[0]?.courier_id;
  if (staffId) {
    if (tipAmount > 0) await creditCourierTip(staffId, id, tipAmount);
    const note = typeof body?.comment === 'string' ? body.comment.trim() : '';
    const tipBit = tipAmount > 0 ? ` · pourboire ${tipAmount} F` : '';
    await notifyStaff({
      staffId,
      kind: 'rating',
      title: `La cliente vous a noté ${rating}/5${tipBit}`,
      body: note || (tipAmount > 0 ? 'Merci pour la course.' : 'Merci pour la course.'),
      href: '/(tabs)/earnings',
      orderId: id,
      id: `ntf-rate-${id}`,
    });
  }
  return c.json({ ok: true, tipAmount });
});

const port = Number(process.env.PORT ?? 8787);

await migrate();
await seedAll();

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`Marché Doré API http://localhost:${port}`);
});

setInterval(() => {
  void archiveDeliveredCourierThreads().catch(() => undefined);
}, 15_000);
void archiveDeliveredCourierThreads().catch(() => undefined);
