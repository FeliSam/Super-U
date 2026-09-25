/**
 * Tests API critiques (P2) — `npm test` dans server/.
 *
 * Démarre sa propre API (port aléatoire, SANS aucune variable FedaPay, évaluateur d'alertes manuel) sur la base
 * locale de DATABASE_URL, crée ses propres comptes / commandes de test puis nettoie tout.
 * Refuse de tourner sur une base distante (sauf ALLOW_REMOTE_TEST_DB=1) : ne jamais le lancer contre la prod.
 *
 * Couvre : démarrage sans FedaPay, auth, commandes (COD, non-COD « pending », réf. skip-), annulation + stock,
 * encaissement espèces à la livraison (code client → paid_cash + journal), échec / annulation → reste non payé,
 * page Paiements (COD jamais « à vérifier »), actions admin + rôles, alertes (création, dédoublonnage, rôles,
 * acquittement, flux temps réel), masquage PII support / recruteur, /health/details, flux mobiles (SSE + long-poll).
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { hashPassword } from '../src/password.ts';
import { isPaidOrder } from '../src/incidents.ts';

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';

function isLocalDb(url: string) {
  try {
    const host = new URL(url).hostname;
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  } catch {
    return false;
  }
}

const skip = !databaseUrl
  ? 'DATABASE_URL requis (base locale)'
  : !isLocalDb(databaseUrl) && process.env.ALLOW_REMOTE_TEST_DB !== '1'
    ? 'DATABASE_URL ne pointe pas vers une base locale : test refusé (ALLOW_REMOTE_TEST_DB=1 pour forcer)'
    : false;

const rnd = () => randomBytes(3).toString('hex');
const digits = () => String(Math.floor(10000000 + Math.random() * 89999999));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let db: pg.Pool;
let api: ChildProcess | null = null;
let base = '';
let logs = '';
const fx = {
  startEventId: 0,
  startAlertId: 0,
  home: 'su-aeroport',
  prods: [] as { id: string; name: string }[],
  stock: [] as { product_id: string; store_id: string; qty: string; reserved: string; min_qty: string }[],
  staff: {} as Record<string, { id: string; token: string; role: string }>,
  users: [] as { id: string; token: string; email: string; first: string; last: string }[],
  orders: [] as string[],
};

async function freePort() {
  return await new Promise<number>((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function req(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* texte brut */
  }
  return { status: res.status, json };
}

type Msg = { event: string; id?: string; json?: any };
async function openSse(path: string) {
  const ctrl = new AbortController();
  const res = await fetch(base + path, { headers: { Accept: 'text/event-stream' }, signal: ctrl.signal });
  const s = { status: res.status, msgs: [] as Msg[], close: () => ctrl.abort() };
  if (res.ok && res.body) {
    void (async () => {
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const m: Msg = { event: 'message' };
            const data: string[] = [];
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) m.event = line.slice(6).trim();
              else if (line.startsWith('id:')) m.id = line.slice(3).trim();
              else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
            }
            try {
              m.json = JSON.parse(data.join('\n'));
            } catch {
              /* ping */
            }
            if (block.trim()) s.msgs.push(m);
          }
        }
      } catch {
        /* fermé */
      }
    })();
  } else {
    await res.text().catch(() => '');
  }
  return s;
}
async function waitMsg(s: { msgs: Msg[] }, pred: (m: Msg) => boolean, timeout = 4000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const hit = s.msgs.find(pred);
    if (hit) return hit;
    await sleep(20);
  }
  return null;
}

async function mkStaff(key: string, role: string, first: string, opts: { pick?: boolean; deliver?: boolean } = {}) {
  const id = `st-test${rnd()}`;
  const email = `test-${role}-${rnd()}@test.local`;
  const pw = `P${rnd()}${rnd()}!`;
  fx.staff[key] = { id, token: '', role };
  await db.query(
    `INSERT INTO ops.staff (id, email, phone, password_hash, first_name, last_name, role, can_pick, can_deliver, store_id, vehicle, onboard_status)
     VALUES ($1,$2,$3,$4,$5,'Testeur',$6,$7,$8,$9,'moto','active')`,
    [id, email, `+229 01${digits()}`, await hashPassword(pw), first, role, !!opts.pick, !!opts.deliver, fx.home],
  );
  await db.query(`INSERT INTO ops.staff_store_affiliations (staff_id, store_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, fx.home]).catch(() => undefined);
  const login = await req('POST', '/ops/login', { email, password: pw });
  assert.equal(login.status, 200, `connexion ${role}`);
  fx.staff[key].token = login.json.token;
}
const T = (k: string) => fx.staff[k].token;

async function placeOrder(u: (typeof fx.users)[number], extra: Record<string, unknown>) {
  const id = `MD-TEST-${Date.now().toString(36)}${rnd()}`.toUpperCase();
  fx.orders.push(id);
  const r = await req(
    'POST',
    '/me/orders',
    { id, storeId: fx.home, createdAt: new Date().toISOString(), lines: [{ productId: fx.prods[0].id, name: fx.prods[0].name, qty: 1 }], slotId: 'standard', total: 1, ...extra },
    u.token,
  );
  assert.equal(r.status, 200, `commande ${JSON.stringify(r.json)}`);
  return id;
}
const orderRow = async (id: string) =>
  (
    await db.query(
      `SELECT o.status, o.payment_id, o.payment_status, o.payload->>'cashCollectedAt' AS cash_at, o.total::int AS total, o.handoff_code,
              d.id AS delivery_id, d.status AS del
       FROM orders o LEFT JOIN ops.deliveries d ON d.order_id = o.id WHERE o.id = $1`,
      [id],
    )
  ).rows[0];
/** Raccourci de fixture : colis prêt et livraison « en route » avec le coursier donné. */
async function putEnRoute(orderId: string, courierKey: string) {
  await db.query(`UPDATE ops.pick_jobs SET status = 'packed', packed_at = NOW(), updated_at = NOW() WHERE order_id = $1`, [orderId]);
  await db.query(
    `UPDATE ops.deliveries SET status = 'en_route', courier_id = $2, assigned_at = NOW(), picked_up_at = NOW(), en_route_at = NOW(), updated_at = NOW()
     WHERE order_id = $1`,
    [orderId, fx.staff[courierKey].id],
  );
}

async function cleanup() {
  const staffIds = Object.values(fx.staff).map((s) => s.id);
  const userIds = fx.users.map((u) => u.id);
  const orderIds = userIds.length
    ? (await db.query<{ id: string }>(`SELECT id FROM orders WHERE user_id = ANY($1)`, [userIds])).rows.map((r) => r.id)
    : [];
  const del = async (sql: string, params: unknown[]) => {
    try {
      await db.query(sql, params);
    } catch (e) {
      if (!/does not exist/.test((e as Error).message)) console.error('nettoyage :', sql.slice(0, 70), (e as Error).message);
    }
  };
  const alertIds = (await db.query<{ id: string }>(`SELECT id::text FROM ops.alerts WHERE id > $1`, [fx.startAlertId]).catch(() => ({ rows: [] as { id: string }[] }))).rows.map((r) => r.id);
  await del(`DELETE FROM ops.alerts WHERE id > $1`, [fx.startAlertId]);
  await del(`DELETE FROM public.refunds WHERE order_id = ANY($1)`, [orderIds]);
  await del(`DELETE FROM ops.order_audit WHERE order_id = ANY($1)`, [orderIds]);
  await del(`DELETE FROM stock_moves WHERE ref_type = 'order' AND ref_id = ANY($1)`, [orderIds]);
  await del(`DELETE FROM ops.delivery_incidents WHERE order_id = ANY($1)`, [orderIds]);
  await del(`DELETE FROM ops.events WHERE order_id = ANY($1)`, [orderIds]);
  await del(`DELETE FROM comms.calls WHERE order_id = ANY($1)`, [orderIds]);
  await del(`DELETE FROM comms.threads WHERE order_id = ANY($1) OR id = ANY($2)`, [orderIds, userIds.map((u) => `support-${u}`)]);
  await del(`DELETE FROM orders WHERE id = ANY($1)`, [orderIds]);
  await del(`DELETE FROM payments WHERE user_id = ANY($1)`, [userIds]);
  await del(`DELETE FROM user_notifications WHERE user_id = ANY($1)`, [userIds]);
  await del(`DELETE FROM sessions WHERE user_id = ANY($1)`, [userIds]);
  await del(`DELETE FROM user_state WHERE user_id = ANY($1)`, [userIds]);
  await del(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
  await del(`DELETE FROM ops.courier_locations WHERE courier_id = ANY($1)`, [staffIds]);
  await del(`DELETE FROM ops.courses WHERE courier_id = ANY($1)`, [staffIds]);
  await del(`DELETE FROM ops.staff_notifications WHERE staff_id = ANY($1) OR order_id = ANY($2)`, [staffIds, orderIds]);
  await del(`DELETE FROM ops.staff_seen_log WHERE staff_id = ANY($1)`, [staffIds]);
  await del(`DELETE FROM ops.staff_sessions WHERE staff_id = ANY($1)`, [staffIds]);
  await del(`DELETE FROM ops.staff_store_affiliations WHERE staff_id = ANY($1)`, [staffIds]);
  await del(`DELETE FROM ops.staff WHERE id = ANY($1)`, [staffIds]);
  for (const s of fx.stock) {
    await del(`UPDATE product_stock SET qty = $3, reserved = $4, min_qty = $5 WHERE product_id = $1 AND store_id = $2`, [s.product_id, s.store_id, s.qty, s.reserved, s.min_qty]);
  }
  // Journal temps réel : uniquement les lignes produites par ce test.
  const ids = [...orderIds, ...staffIds, ...userIds, ...alertIds, ...fx.prods.map((p) => p.id)];
  await del(
    `DELETE FROM ops.admin_events WHERE id > $1 AND (entity_id = ANY($2) OR payload->>'orderId' = ANY($3) OR payload->>'userId' = ANY($4))`,
    [fx.startEventId, ids, orderIds, userIds],
  );
}

describe('API critique (P2)', { skip }, () => {
  before(async () => {
    db = new pg.Pool({ connectionString: databaseUrl, max: 4 });
    fx.startEventId = Number((await db.query(`SELECT COALESCE(MAX(id), 0)::text AS m FROM ops.admin_events`)).rows[0].m);
    fx.startAlertId = Number((await db.query(`SELECT COALESCE(MAX(id), 0)::text AS m FROM ops.alerts`).catch(() => ({ rows: [{ m: '0' }] }))).rows[0].m);
    fx.prods = (
      await db.query(
        `SELECT p.id, p.payload->>'name' AS name FROM products p JOIN product_stock s ON s.product_id = p.id AND s.store_id = $1
         WHERE COALESCE(p.active, TRUE) AND (p.payload->>'price') ~ '^[0-9]+$' AND (p.payload->>'price')::int > 0 AND s.qty - s.reserved >= 20
         ORDER BY p.id LIMIT 2`,
        [fx.home],
      )
    ).rows;
    assert.equal(fx.prods.length, 2, 'deux produits en stock requis au magasin de test');
    fx.stock = (
      await db.query(`SELECT product_id, store_id, qty::text, reserved::text, min_qty::text FROM product_stock WHERE product_id = ANY($1) AND store_id = $2`, [
        fx.prods.map((p) => p.id),
        fx.home,
      ])
    ).rows;

    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    api = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: serverDir,
      env: {
        ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('NODE_TEST'))),
        PORT: String(port),
        CORS_ORIGIN: '*',
        FEDAPAY_SECRET_KEY: '',
        FEDAPAY_PUBLIC_KEY: '',
        FEDAPAY_WEBHOOK_SECRET: '',
        FEDAPAY_ENV: '',
        ALERT_EVAL_INTERVAL_MS: '3600000',
        ALERT_FIRST_EVAL_MS: '3600000',
        ADMIN_STREAM_HEARTBEAT_MS: '2000',
        MOBILE_STREAM_HEARTBEAT_MS: '2000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    api.stdout!.on('data', (b) => (logs += b.toString()));
    api.stderr!.on('data', (b) => (logs += b.toString()));
    const end = Date.now() + 90_000;
    while (!/API http/.test(logs)) {
      if (Date.now() > end || api.exitCode != null) {
        await sleep(800);
        throw new Error(`API non démarrée (code ${api.exitCode}) :\n${logs.slice(-3000)}`);
      }
      await sleep(200);
    }

    await mkStaff('admin', 'admin', 'Awa');
    await mkStaff('manager', 'manager', 'Marc');
    await mkStaff('support', 'support', 'Sena');
    await mkStaff('recruteur', 'recruteur', 'Rita');
    await mkStaff('magasinier', 'magasinier', 'Mathieu');
    await mkStaff('courier1', 'coursier', 'Koffi', { pick: true, deliver: true });
    await mkStaff('courier2', 'coursier', 'Yao', { deliver: true });
    for (const [first, last] of [
      ['Aminata', 'Houngbo'],
      ['Rodrigue', 'Adjovi'],
    ]) {
      const email = `test-client-${rnd()}@test.local`;
      const r = await req('POST', '/auth/register', { firstName: first, lastName: last, email, phone: `+229 01${digits()}`, password: `u${rnd()}${rnd()}` });
      assert.ok(r.json?.token, `inscription ${r.status}`);
      fx.users.push({ id: r.json.user.id, token: r.json.token, email, first, last });
    }
  });

  after(async () => {
    if (db) await cleanup().catch((e) => console.error('nettoyage échoué', e));
    if (api && api.exitCode == null) {
      api.kill();
      await new Promise((r) => api!.once('exit', r)).catch(() => undefined);
    }
    await db?.end();
  });

  test('démarre sans aucune variable FedaPay (avertissement, pas d’erreur)', async () => {
    assert.match(logs, /\[fedapay\] non configuré/);
    assert.doesNotMatch(logs, /Error:|TypeError|ReferenceError|UnhandledPromiseRejection/);
    const h = await req('GET', '/health');
    assert.equal(h.status, 200);
    assert.equal(h.json.db, true);
    // Paiement en ligne refusé proprement, sans faux « payé ».
    const pay = await req('POST', '/me/payments', { amount: 1000, method: 'om' }, fx.users[0].token);
    assert.equal(pay.status, 503, `POST /me/payments sans FedaPay → ${pay.status}`);
    assert.equal(pay.json.ok, false);
    assert.ok(!pay.json.payment);
    // Webhook « payé » non vérifiable ignoré.
    const wh = await req('POST', '/webhooks/fedapay', { entity: { id: 'fake-tx', status: 'approved' } });
    assert.equal(wh.status, 200);
    assert.equal(wh.json.ignored, 'unverified');
  });

  test('auth : jetons requis, rôles', async () => {
    assert.equal((await req('GET', '/me/orders')).status, 401);
    assert.equal((await req('GET', '/admin/alerts')).status, 401);
    assert.equal((await req('GET', '/admin/payments', undefined, T('support'))).status, 403);
    assert.equal((await req('GET', '/admin/payments', undefined, T('manager'))).status, 200);
  });

  test('isPaidOrder : seul un paiement en ligne confirmé est remboursable', () => {
    assert.equal(isPaidOrder('cod', 'cod_pending'), false);
    assert.equal(isPaidOrder('cod', 'paid_cash'), false);
    assert.equal(isPaidOrder('om', 'pending'), false);
    assert.equal(isPaidOrder('om', null), false);
    assert.equal(isPaidOrder('om', 'paid'), true);
    assert.equal(isPaidOrder('card', 'partially_refunded'), true);
  });

  test('commande non-COD : « en attente », jamais payée (même avec réf. skip-)', async () => {
    const u = fx.users[0];
    const id = await placeOrder(u, { paymentId: 'om', paymentStatus: 'paid', paymentRef: `skip-${Date.now()}` });
    const row = await orderRow(id);
    assert.equal(row.payment_status, 'pending');
    const list = await req('GET', '/me/orders', undefined, u.token);
    const mine = list.json.orders.find((o: any) => o.id === id);
    assert.equal(mine.paymentStatus, 'pending');
    // …et elle apparaît dans « À vérifier » (déclarée payée par l'app, aucun paiement reçu).
    const p = await req('GET', '/admin/payments', undefined, T('admin'));
    const flag = p.json.flagged.find((f: any) => f.id === id);
    assert.ok(flag, 'commande non-COD déclarée payée → à vérifier');
    assert.equal(flag.flag, 'skip_ref');
    assert.equal(p.json.fedapayConfigured, false);
  });

  test('COD livré avec le code client → payé en espèces + journal ; mauvais code refusé', async () => {
    const u = fx.users[0];
    const id = await placeOrder(u, { paymentId: 'cod', paymentStatus: 'paid' /* ancien build : ignoré */ });
    let row = await orderRow(id);
    assert.equal(row.payment_status, 'cod_pending');
    assert.match(String(row.handoff_code), /^\d{4}$/);

    // Page Paiements : une commande COD normale n'est jamais « à vérifier » et compte dans « à encaisser ».
    const p0 = await req('GET', '/admin/payments', undefined, T('admin'));
    assert.ok(!p0.json.flagged.some((f: any) => f.id === id), 'COD jamais signalée');
    const toCollect0 = p0.json.cod.toCollect.n;
    assert.ok(toCollect0 >= 1);

    await putEnRoute(id, 'courier1');
    const wrong = String((Number(row.handoff_code) + 1) % 10000).padStart(4, '0');
    const bad = await req('POST', `/ops/deliveries/${encodeURIComponent(row.delivery_id)}/status`, { status: 'delivered', handoffCode: wrong }, T('courier1'));
    assert.equal(bad.status, 400);
    assert.equal((await orderRow(id)).payment_status, 'cod_pending');

    const ok = await req('POST', `/ops/deliveries/${encodeURIComponent(row.delivery_id)}/status`, { status: 'delivered', handoffCode: row.handoff_code }, T('courier1'));
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    row = await orderRow(id);
    assert.equal(row.payment_status, 'paid_cash');
    assert.ok(row.cash_at, 'cashCollectedAt');

    const audit = (await db.query(`SELECT action, actor_staff_id, before, after FROM ops.order_audit WHERE order_id = $1 AND action = 'cash-collected'`, [id])).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor_staff_id, fx.staff.courier1.id);
    assert.equal(audit[0].before.paymentStatus, 'cod_pending');
    assert.equal(audit[0].after.paymentStatus, 'paid_cash');
    assert.equal(audit[0].after.amount, row.total);
    const ev = (await db.query(`SELECT payload FROM ops.events WHERE order_id = $1 AND event_type = 'payment.cash_collected'`, [id])).rows;
    assert.equal(ev.length, 1);
    assert.equal(ev[0].payload.amount, row.total);
    const adminEv = (await db.query(`SELECT payload FROM ops.admin_events WHERE type = 'order.payment' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [id])).rows[0];
    assert.equal(adminEv?.payload?.paymentStatus, 'paid_cash');

    // Rejouer « livré » ne double pas l'encaissement.
    await req('POST', `/ops/deliveries/${encodeURIComponent(row.delivery_id)}/status`, { status: 'delivered', handoffCode: row.handoff_code }, T('courier1'));
    const again = (await db.query(`SELECT COUNT(*)::int AS n FROM ops.order_audit WHERE order_id = $1 AND action = 'cash-collected'`, [id])).rows[0].n;
    assert.equal(again, 1);

    // App client : anciens builds voient « paid », nouveaux builds le détail « paid_cash ».
    const list = await req('GET', '/me/orders', undefined, u.token);
    const mine = list.json.orders.find((o: any) => o.id === id);
    assert.equal(mine.paymentStatus, 'paid');
    assert.equal(mine.paymentStatusDetail, 'paid_cash');

    // Paiements : encaissé aujourd'hui, toujours pas « à vérifier ».
    const p1 = await req('GET', '/admin/payments', undefined, T('admin'));
    assert.ok(!p1.json.flagged.some((f: any) => f.id === id));
    assert.ok(p1.json.cod.collectedToday.n >= 1);
    // Fiche commande : le paiement espèces est remboursable par un manager (montant encaissé).
    const ops = await req('GET', `/admin/orders/${encodeURIComponent(id)}/ops`, undefined, T('manager'));
    assert.equal(ops.status, 200);
    assert.equal(ops.json.money?.paid, row.total);
  });

  test('COD en échec (coursier) ou annulé (siège / client) → reste « à régler »', async () => {
    const u = fx.users[1];
    const failedId = await placeOrder(u, { paymentId: 'cod' });
    await putEnRoute(failedId, 'courier2');
    const fr = await orderRow(failedId);
    const f = await req('POST', `/ops/deliveries/${encodeURIComponent(fr.delivery_id)}/status`, { status: 'failed', reasonCode: 'client_absent', reason: 'Client absent' }, T('courier2'));
    assert.equal(f.status, 200, JSON.stringify(f.json));
    assert.equal((await orderRow(failedId)).payment_status, 'cod_pending');
    assert.equal((await db.query(`SELECT COUNT(*)::int AS n FROM ops.order_audit WHERE order_id = $1 AND action = 'cash-collected'`, [failedId])).rows[0].n, 0);

    // Échec déclaré par le siège sur une commande COD en route.
    const adminFailed = await placeOrder(u, { paymentId: 'cod' });
    await putEnRoute(adminFailed, 'courier2');
    const af = await req('POST', `/admin/orders/${encodeURIComponent(adminFailed)}/status`, { status: 'failed', reason: 'Adresse introuvable' }, T('manager'));
    assert.equal(af.status, 200, JSON.stringify(af.json));
    assert.equal((await orderRow(adminFailed)).payment_status, 'cod_pending');

    // Annulation siège (avec restockage) : toujours non payée.
    const stockBefore = Number((await db.query(`SELECT qty::text FROM product_stock WHERE product_id = $1 AND store_id = $2`, [fx.prods[0].id, fx.home])).rows[0].qty);
    const cancelId = await placeOrder(u, { paymentId: 'cod' });
    const c = await req('POST', `/admin/orders/${encodeURIComponent(cancelId)}/cancel`, { reason: 'Doublon client' }, T('manager'));
    assert.equal(c.status, 200, JSON.stringify(c.json));
    const cr = await orderRow(cancelId);
    assert.equal(cr.status, 'cancelled');
    assert.equal(cr.payment_status, 'cod_pending');
    const stockAfter = Number((await db.query(`SELECT qty::text FROM product_stock WHERE product_id = $1 AND store_id = $2`, [fx.prods[0].id, fx.home])).rows[0].qty);
    assert.equal(stockAfter, stockBefore, 'stock réintégré');
    const audit = (await db.query(`SELECT action, actor_role FROM ops.order_audit WHERE order_id = $1`, [cancelId])).rows;
    assert.ok(audit.some((a) => a.action === 'cancel' && a.actor_role === 'manager'));

    // Annulation par le client (PATCH, route utilisée par le bouton « Annuler » de Marché Doré).
    const clientCancel = await placeOrder(u, { paymentId: 'cod' });
    const pc = await req('PATCH', `/me/orders/${encodeURIComponent(clientCancel)}`, { status: 'cancelled' }, u.token);
    assert.equal(pc.status, 200);
    const cc = await orderRow(clientCancel);
    assert.equal(cc.status, 'cancelled');
    assert.equal(cc.payment_status, 'cod_pending');
  });

  test('livré par le siège (COD) → payé en espèces, acteur = admin ; rôles', async () => {
    const id = await placeOrder(fx.users[1], { paymentId: 'cod' });
    await putEnRoute(id, 'courier1');
    assert.equal((await req('POST', `/admin/orders/${encodeURIComponent(id)}/status`, { status: 'delivered' }, T('magasinier'))).status, 403);
    assert.equal((await req('POST', `/admin/orders/${encodeURIComponent(id)}/status`, { status: 'delivered' }, T('support'))).status, 403);
    const r = await req('POST', `/admin/orders/${encodeURIComponent(id)}/status`, { status: 'delivered', reason: 'Code oublié par le client' }, T('admin'));
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await orderRow(id)).payment_status, 'paid_cash');
    const a = (await db.query(`SELECT actor_staff_id, actor_role, reason FROM ops.order_audit WHERE order_id = $1 AND action = 'cash-collected'`, [id])).rows[0];
    assert.equal(a.actor_staff_id, fx.staff.admin.id);
    assert.equal(a.actor_role, 'admin');
    assert.match(a.reason, /siège/);
  });

  test('/ops/location indique s’il reste une livraison active ; candidats triés avec distance', async () => {
    const loc = await req('POST', '/ops/location', { lng: 2.3905, lat: 6.3525, heading: 0, speedMps: 3 }, T('courier2'));
    assert.equal(loc.status, 200);
    assert.equal(typeof loc.json.activeDelivery, 'boolean');
    const id = await placeOrder(fx.users[0], { paymentId: 'cod' });
    await db.query(`UPDATE ops.pick_jobs SET status = 'packed', packed_at = NOW() WHERE order_id = $1`, [id]);
    const cands = await req('GET', `/admin/orders/${encodeURIComponent(id)}/candidates?kind=courier`, undefined, T('manager'));
    assert.equal(cands.status, 200);
    const c2 = cands.json.staff.find((s: any) => s.id === fx.staff.courier2.id);
    assert.ok(c2, 'coursier du magasin proposé');
    assert.equal(typeof c2.distanceM, 'number');
    // Réassignation depuis la carte = même route P1b (manager) → livraison attribuée + journal.
    const ra = await req('POST', `/admin/orders/${encodeURIComponent(id)}/reassign-courier`, { staffId: fx.staff.courier2.id }, T('manager'));
    assert.equal(ra.status, 200, JSON.stringify(ra.json));
    const loc2 = await req('POST', '/ops/location', { lng: 2.3906, lat: 6.3526 }, T('courier2'));
    assert.equal(loc2.json.activeDelivery, true);
    const rel = await req('POST', `/admin/orders/${encodeURIComponent(id)}/release`, { target: 'courier' }, T('manager'));
    assert.equal(rel.status, 200, JSON.stringify(rel.json));
    const actions = (await db.query(`SELECT action FROM ops.order_audit WHERE order_id = $1 ORDER BY id`, [id])).rows.map((r) => r.action);
    assert.deepEqual(actions.filter((a) => a !== 'cash-collected'), ['reassign-courier', 'release-courier']);
    // Terrain : file à pourvoir avec repère (adresse pour admin, masquée pour le support) + magasins.
    const floorA = await req('GET', '/admin/floor', undefined, T('admin'));
    assert.ok(Array.isArray(floorA.json.stores) && floorA.json.stores.length >= 1);
    const floorS = await req('GET', '/admin/floor', undefined, T('support'));
    assert.equal(floorS.json.piiMasked, true);
    assert.ok(floorS.json.queue.every((q: any) => q.dropoff == null && q.address == null));
  });

  test('alertes : création, dédoublonnage, rôles, acquittement, flux temps réel', async () => {
    // Condition « stock bas » (seuil au-dessus du disponible) + livraison en échec (test précédent).
    const [lowProd] = fx.prods;
    await db.query(`UPDATE product_stock SET min_qty = qty - reserved + 5 WHERE product_id = $1 AND store_id = $2`, [lowProd.id, fx.home]);
    const supTicket = (await req('POST', '/admin/stream-ticket', undefined, T('support'))).json.ticket;
    const recTicket = (await req('POST', '/admin/stream-ticket', undefined, T('recruteur'))).json.ticket;
    const magTicket = (await req('POST', '/admin/stream-ticket', undefined, T('magasinier'))).json.ticket;
    const SUP = await openSse(`/admin/stream?ticket=${supTicket}`);
    const REC = await openSse(`/admin/stream?ticket=${recTicket}`);
    const MAG = await openSse(`/admin/stream?ticket=${magTicket}`);
    await Promise.all([SUP, REC, MAG].map((s) => waitMsg(s, (m) => m.event === 'hello')));

    assert.equal((await req('POST', '/admin/alerts/evaluate', undefined, T('support'))).status, 403);
    const ev1 = await req('POST', '/admin/alerts/evaluate', undefined, T('admin'));
    assert.equal(ev1.status, 200, JSON.stringify(ev1.json));
    const entity = `${lowProd.id}@${fx.home}`;
    const rows = async () => (await db.query(`SELECT id::text, kind, status FROM ops.alerts WHERE kind = 'low_stock' AND entity_id = $1 ORDER BY id`, [entity])).rows;
    let low = await rows();
    assert.equal(low.length, 1);
    assert.equal(low[0].status, 'open');
    await req('POST', '/admin/alerts/evaluate', undefined, T('admin'));
    assert.equal((await rows()).length, 1, 'pas de doublon');

    const failed = (await db.query(`SELECT a.id::text, a.order_id FROM ops.alerts a JOIN orders o ON o.id = a.order_id WHERE a.kind = 'delivery_failed' AND o.user_id = $1 AND a.status <> 'resolved'`, [fx.users[1].id])).rows;
    assert.ok(failed.length >= 1, 'alerte livraison en échec');

    // Temps réel : le magasinier reçoit « stock bas », pas le support ; le support reçoit l'échec ; le recruteur rien.
    const magLow = await waitMsg(MAG, (m) => m.event === 'admin' && m.json?.type === 'alert.raised' && m.json?.payload?.kind === 'low_stock' && m.json.payload.entityId === entity);
    assert.ok(magLow, 'alert.raised stock bas → magasinier');
    const supFailed = await waitMsg(SUP, (m) => m.event === 'admin' && m.json?.type === 'alert.raised' && m.json?.payload?.kind === 'delivery_failed');
    assert.ok(supFailed, 'alert.raised échec → support');
    await sleep(300);
    assert.ok(!SUP.msgs.some((m) => m.json?.payload?.kind === 'low_stock'), 'support ne voit pas le stock');
    assert.ok(!REC.msgs.some((m) => String(m.json?.type ?? '').startsWith('alert.')), 'recruteur : aucune alerte');

    // Liste filtrée par rôle.
    const listSup = await req('GET', '/admin/alerts', undefined, T('support'));
    assert.ok(!listSup.json.kinds.includes('low_stock'));
    assert.ok(!listSup.json.alerts.some((a: any) => a.kind === 'low_stock'));
    const listRec = await req('GET', '/admin/alerts', undefined, T('recruteur'));
    assert.deepEqual(listRec.json.kinds, []);
    assert.equal(listRec.json.alerts.length, 0);
    const listMag = await req('GET', '/admin/alerts', undefined, T('magasinier'));
    assert.ok(listMag.json.alerts.some((a: any) => a.id === low[0].id));
    // Le support ne peut pas acquitter une alerte stock (invisible pour lui).
    assert.equal((await req('POST', `/admin/alerts/${low[0].id}/ack`, undefined, T('support'))).status, 404);

    const ack = await req('POST', `/admin/alerts/${low[0].id}/ack`, undefined, T('magasinier'));
    assert.equal(ack.status, 200);
    assert.equal(ack.json.status, 'acked');
    const ackEv = await waitMsg(MAG, (m) => m.json?.type === 'alert.acked' && m.json?.payload?.alertId === Number(low[0].id));
    assert.ok(ackEv, 'alert.acked diffusé');
    await req('POST', '/admin/alerts/evaluate', undefined, T('admin'));
    low = await rows();
    assert.equal(low.length, 1);
    assert.equal(low[0].status, 'acked', 'reste acquittée tant que la condition dure');

    // Condition levée → résolue automatiquement ; pas de nouvelle alerte pendant le délai de grâce.
    await db.query(`UPDATE product_stock SET min_qty = 0 WHERE product_id = $1 AND store_id = $2`, [lowProd.id, fx.home]);
    await req('POST', '/admin/alerts/evaluate', undefined, T('admin'));
    low = await rows();
    assert.equal(low[0].status, 'resolved');
    await db.query(`UPDATE product_stock SET min_qty = qty - reserved + 5 WHERE product_id = $1 AND store_id = $2`, [lowProd.id, fx.home]);
    await req('POST', '/admin/alerts/evaluate', undefined, T('admin'));
    assert.equal((await rows()).length, 1, 'délai de grâce après résolution');
    await db.query(`UPDATE product_stock SET min_qty = $3 WHERE product_id = $1 AND store_id = $2`, [lowProd.id, fx.home, fx.stock.find((s) => s.product_id === lowProd.id)!.min_qty]);

    // Acquittement groupé par type.
    const bulk = await req('POST', '/admin/alerts/ack', { kind: 'delivery_failed' }, T('support'));
    assert.equal(bulk.status, 200);
    assert.ok(bulk.json.acked >= 1);
    [SUP, REC, MAG].forEach((s) => s.close());
  });

  test('masquage PII : support / recruteur voient des données client réduites', async () => {
    const u = fx.users[0];
    const admin = await req('GET', `/admin/shop-users?q=${encodeURIComponent(u.email)}`, undefined, T('admin'));
    assert.equal(admin.json.users.length, 1);
    assert.equal(admin.json.users[0].email, u.email);
    assert.equal(admin.json.piiMasked, false);

    for (const role of ['support', 'recruteur']) {
      const byEmail = await req('GET', `/admin/shop-users?q=${encodeURIComponent(u.email)}`, undefined, T(role));
      assert.equal(byEmail.json.users.length, 0, `${role} : pas de recherche par e-mail`);
      const byName = await req('GET', `/admin/shop-users?q=${encodeURIComponent(u.last)}`, undefined, T(role));
      const row = byName.json.users.find((x: any) => x.id === u.id);
      assert.ok(row, `${role} : recherche par nom`);
      assert.equal(byName.json.piiMasked, true);
      assert.notEqual(row.email, u.email);
      assert.match(row.phone, /••/);
      assert.equal(row.lastName, `${u.last.charAt(0)}.`);
      const detail = await req('GET', `/admin/shop-users/${encodeURIComponent(u.id)}`, undefined, T(role));
      assert.equal(detail.json.piiMasked, true);
      assert.equal(detail.json.user.birthDate, null);
      assert.deepEqual(detail.json.user.addresses, []);
      const floor = await req('GET', '/admin/floor', undefined, T(role));
      assert.equal(floor.json.piiMasked, true);
    }
    const mag = await req('GET', `/admin/shop-users/${encodeURIComponent(u.id)}`, undefined, T('magasinier'));
    assert.equal(mag.json.piiMasked, false);
    assert.equal(mag.json.user.email, u.email);
  });

  test('/health/details réservé à l’admin', async () => {
    assert.equal((await req('GET', '/health/details')).status, 401);
    assert.equal((await req('GET', '/health/details', undefined, T('manager'))).status, 403);
    const h = await req('GET', '/health/details', undefined, T('admin'));
    assert.equal(h.status, 200, JSON.stringify(h.json));
    assert.equal(h.json.db.ok, true);
    assert.equal(h.json.live.listening, true);
    assert.equal(h.json.payments.mode, 'cod_only');
    assert.ok(h.json.alerts.lastRun, 'dernière évaluation des alertes');
    assert.equal(typeof h.json.mobile.streams, 'number');
  });

  test('flux mobiles : chaque appareil ne reçoit que ses signaux, sans donnée personnelle', async () => {
    const [u0, u1] = fx.users;
    const init0 = await req('GET', '/me/events', undefined, u0.token);
    const init1 = await req('GET', '/me/events', undefined, u1.token);
    assert.equal(init0.status, 200);
    assert.equal((await req('GET', '/me/events')).status, 401);
    assert.equal((await req('POST', '/me/stream-ticket')).status, 401);
    const tk = await req('POST', '/me/stream-ticket', undefined, u0.token);
    assert.equal(tk.status, 200);
    const S0 = await openSse(`/me/stream?ticket=${tk.json.ticket}`);
    assert.equal(S0.status, 200);
    assert.ok(await waitMsg(S0, (m) => m.event === 'hello'));
    // Un ticket client ne vaut pas pour le flux staff, et il est à usage unique.
    assert.equal((await openSse(`/me/stream?ticket=${tk.json.ticket}`)).status, 401);
    const stk = await req('POST', '/ops/stream-ticket', undefined, T('courier1'));
    assert.equal(stk.status, 200);
    assert.equal((await req('POST', '/ops/stream-ticket', undefined, u0.token)).status, 401);

    const courierInit = await req('GET', '/ops/events', undefined, T('courier1'));
    const poll1 = req('GET', `/me/events?since=${init1.json.lastId}&wait=3`, undefined, u1.token);
    const poll0 = req('GET', `/me/events?since=${init0.json.lastId}&wait=10`, undefined, u0.token);
    const id = await placeOrder(u0, { paymentId: 'cod' });
    const r0 = await poll0;
    assert.equal(r0.status, 200);
    const mine = r0.json.events.filter((e: any) => e.orderId === id);
    assert.ok(mine.length >= 1, 'long-poll : signal pour sa commande');
    for (const e of r0.json.events) {
      for (const k of Object.keys(e)) assert.ok(['id', 'type', 'at', 'orderId', 'threadId', 'callId', 'status'].includes(k), `clé ${k} interdite`);
    }
    const sseHit = await waitMsg(S0, (m) => m.event === 'signal' && m.json?.orderId === id);
    assert.ok(sseHit, 'SSE : signal pour sa commande');
    assert.equal(sseHit!.json.money, undefined);
    assert.equal(sseHit!.json.pii, undefined);
    const r1 = await poll1;
    assert.ok(!r1.json.events.some((e: any) => e.orderId === id), 'un autre client ne reçoit rien');

    // Le coursier du magasin reçoit le « rafraîchis » de la file (nouvelle commande), sans données client.
    const rc = await req('GET', `/ops/events?since=${courierInit.json.lastId}&wait=3`, undefined, T('courier1'));
    assert.ok(rc.json.events.some((e: any) => e.orderId === id), 'signal file magasin → coursier');
    S0.close();
  });
});
