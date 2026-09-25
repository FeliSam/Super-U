/**
 * Temps réel des apps mobiles (P2) : Marché Doré (client) et CourseGO (staff).
 *
 * Même bus que le panel (LISTEN admin_events / courier_pos, adminLive.ts), mais chaque appareil ne reçoit que
 * ce qui le concerne, sous forme de « signal » minimal : { id, type, at, orderId?, threadId?, callId?, status? }.
 * Aucune donnée personnelle ni montant : l'app recharge ensuite ses données via les routes REST existantes
 * (qui gardent leurs contrôles d'accès). Les anciens builds, qui ne se connectent pas, gardent leur polling.
 *
 * Transport :
 * - SSE : POST /me/stream-ticket (Bearer client) puis GET /me/stream?ticket=… ; staff : /ops/stream-ticket, /ops/stream.
 * - Long-poll (réseaux / proxys qui coupent le SSE) : GET /me/events?since=<id>&wait=25 et GET /ops/events (Bearer).
 * - Derrière Caddy : `flush_interval -1` sur /me/stream et /ops/stream comme sur /admin/stream.
 */
import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { randomBytes } from 'node:crypto';
import { query } from './db.ts';
import { STAFF_SESSION_ALIVE_SQL, touchStaffSession } from './sessions.ts';
import { busLastId, subscribeBus, type AdminEvent, type CourierPos } from './adminLive.ts';

type Subject =
  | { kind: 'user'; userId: string; token: string }
  | { kind: 'staff'; staffId: string; storeId: string | null; role: string; token: string };

export type MobileSignal = {
  id: number;
  type: string;
  at: string;
  orderId?: string;
  threadId?: string;
  callId?: string;
  status?: string;
};

type Audience = { users: Set<string>; staff: Set<string>; storeBoard: boolean; storeId: string | null };
type Enriched = { signal: MobileSignal; audience: Audience };

const envInt = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};
const HEARTBEAT_MS = envInt('MOBILE_STREAM_HEARTBEAT_MS', 20_000);
const MAX_STREAMS = envInt('MOBILE_STREAM_MAX', 2_000);
const TICKET_TTL_MS = 60_000;
const SESSION_RECHECK_MS = 60_000;
const RING_MAX = 1_000;
const CACHE_TTL_MS = 60_000;

const FORWARDED = ['order.', 'pick.', 'delivery.', 'thread.message', 'support.message', 'call.', 'incident.', 'payment.'];
const BOARD_ROLES = new Set(['picker', 'courier', 'coursier', 'dispatcher', 'both']);

const ring: Enriched[] = [];
const subscribers = new Set<{ subject: Subject; onSignal: (s: MobileSignal) => void; onPos: (p: MobileSignal & { lng: number; lat: number }) => void }>();
const waiters = new Set<() => void>();
const tickets = new Map<string, { subject: Subject; exp: number }>();
export const mobileStats = { streams: 0, longPolls: 0, signals: 0, started: false };

// ------------------------------------------------------------------ petites caches (ordre → client / livreur, fil → membres)

type OrderPeople = { userId: string | null; pickerId: string | null; courierId: string | null; at: number };
const orderCache = new Map<string, OrderPeople>();
const threadCache = new Map<string, { users: string[]; staff: string[]; at: number }>();

async function orderPeople(orderId: string): Promise<OrderPeople> {
  const hit = orderCache.get(orderId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;
  const r = await query<{ user_id: string | null; picker_id: string | null; courier_id: string | null }>(
    `SELECT o.user_id, pj.picker_id, d.courier_id FROM orders o
     LEFT JOIN ops.pick_jobs pj ON pj.order_id = o.id LEFT JOIN ops.deliveries d ON d.order_id = o.id
     WHERE o.id = $1`,
    [orderId],
  );
  const row = r.rows[0];
  const v = { userId: row?.user_id ?? null, pickerId: row?.picker_id ?? null, courierId: row?.courier_id ?? null, at: Date.now() };
  orderCache.set(orderId, v);
  if (orderCache.size > 5_000) orderCache.delete(orderCache.keys().next().value as string);
  return v;
}

async function threadMembers(threadId: string) {
  const hit = threadCache.get(threadId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;
  const r = await query<{ user_id: string | null; staff_id: string | null }>(
    `SELECT user_id, staff_id FROM comms.thread_members WHERE thread_id = $1`,
    [threadId],
  );
  const v = {
    users: r.rows.map((m) => m.user_id).filter(Boolean) as string[],
    staff: r.rows.map((m) => m.staff_id).filter(Boolean) as string[],
    at: Date.now(),
  };
  threadCache.set(threadId, v);
  if (threadCache.size > 5_000) threadCache.delete(threadCache.keys().next().value as string);
  return v;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

async function enrich(ev: AdminEvent): Promise<Enriched | null> {
  if (!FORWARDED.some((p) => ev.type.startsWith(p))) return null;
  const p = ev.payload ?? {};
  const orderId = str(p.orderId) ?? (ev.entity === 'order' ? str(ev.entityId) : undefined);
  const audience: Audience = { users: new Set(), staff: new Set(), storeBoard: false, storeId: ev.storeId };
  const signal: MobileSignal = { id: ev.id, type: ev.type, at: ev.at };
  if (orderId) signal.orderId = orderId;
  const status = str(p.status);
  if (status) signal.status = status;

  if (ev.type.startsWith('thread.') || ev.type.startsWith('support.')) {
    const threadId = str(p.threadId) ?? str(ev.entityId);
    if (!threadId) return null;
    signal.threadId = threadId;
    const m = await threadMembers(threadId);
    m.users.forEach((u) => audience.users.add(u));
    m.staff.forEach((s) => audience.staff.add(s));
    // L'expéditeur est aussi prévenu (autres appareils du même compte).
    if (str(p.senderUserId)) audience.users.add(String(p.senderUserId));
    if (str(p.senderStaffId)) audience.staff.add(String(p.senderStaffId));
  } else if (ev.type.startsWith('call.')) {
    const callId = str(p.callId) ?? str(ev.entityId);
    if (callId) signal.callId = callId;
    if (str(p.threadId)) signal.threadId = String(p.threadId);
    for (const k of ['callerUserId', 'calleeUserId']) if (str(p[k])) audience.users.add(String(p[k]));
    for (const k of ['callerStaffId', 'calleeStaffId']) if (str(p[k])) audience.staff.add(String(p[k]));
  } else if (orderId) {
    // Commande, préparation, livraison, incident, paiement : le client de la commande + son ramasseur / livreur.
    const people = await orderPeople(orderId);
    if (ev.type.startsWith('pick.') || ev.type.startsWith('delivery.') || ev.type.startsWith('order.')) {
      orderCache.delete(orderId); // l'affectation a pu changer : relecture au prochain événement
    }
    const userId = str(p.userId) ?? people.userId ?? undefined;
    if (userId) audience.users.add(userId);
    for (const s of [people.pickerId, people.courierId, str(p.pickerId), str(p.courierId), str(p.pickerFrom), str(p.courierFrom)]) {
      if (s) audience.staff.add(s);
    }
    // File d'attente du magasin (nouvelle commande à ramasser, colis prêt à livrer…) : simple « rafraîchis ».
    audience.storeBoard = ev.type.startsWith('order.') || ev.type.startsWith('pick.') || ev.type.startsWith('delivery.');
  } else {
    return null;
  }
  return { signal, audience };
}

function matches(subject: Subject, e: Enriched) {
  if (subject.kind === 'user') return e.audience.users.has(subject.userId);
  if (e.audience.staff.has(subject.staffId)) return true;
  if (!e.audience.storeBoard || !BOARD_ROLES.has(subject.role)) return false;
  return !subject.storeId || !e.audience.storeId || subject.storeId === e.audience.storeId;
}

// ------------------------------------------------------------------ positions livreur → client de la commande active

let courierOrders = new Map<string, { orderId: string; userId: string }[]>();
let courierOrdersAt = 0;
async function refreshCourierOrders() {
  if (Date.now() - courierOrdersAt < 10_000) return;
  courierOrdersAt = Date.now();
  const r = await query<{ courier_id: string; order_id: string; user_id: string }>(
    `SELECT d.courier_id, d.order_id, o.user_id FROM ops.deliveries d JOIN orders o ON o.id = d.order_id
     WHERE d.courier_id IS NOT NULL AND d.status IN ('picked_up', 'en_route', 'arrived')`,
  );
  const next = new Map<string, { orderId: string; userId: string }[]>();
  for (const row of r.rows) {
    const list = next.get(row.courier_id) ?? [];
    list.push({ orderId: row.order_id, userId: row.user_id });
    next.set(row.courier_id, list);
  }
  courierOrders = next;
}

function onPositions(batch: CourierPos[]) {
  if (![...subscribers].some((s) => s.subject.kind === 'user')) return;
  void refreshCourierOrders()
    .catch(() => undefined)
    .then(() => {
      for (const pos of batch) {
        const targets = courierOrders.get(pos.c);
        if (!targets) continue;
        for (const t of targets) {
          for (const sub of subscribers) {
            if (sub.subject.kind === 'user' && sub.subject.userId === t.userId) {
              sub.onPos({ id: 0, type: 'courier.pos', at: pos.t, orderId: t.orderId, lng: pos.lng, lat: pos.lat });
            }
          }
        }
      }
    });
}

let chain: Promise<unknown> = Promise.resolve();
function onBusEvent(ev: AdminEvent) {
  if (!FORWARDED.some((p) => ev.type.startsWith(p)) || ev.type === 'pick.line') return;
  // Enrichissement en série : l'ordre des signaux suit l'ordre des événements.
  chain = chain
    .then(() => enrich(ev))
    .then((e) => {
      if (!e) return;
      ring.push(e);
      if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
      mobileStats.signals++;
      for (const sub of subscribers) if (matches(sub.subject, e)) sub.onSignal(e.signal);
      for (const w of [...waiters]) w();
    })
    .catch((err) => console.warn('[mobile-live] événement ignoré :', (err as Error).message));
}

export function startMobileLive() {
  if (mobileStats.started) return;
  mobileStats.started = true;
  subscribeBus({ onEvent: onBusEvent, onPos: onPositions });
}

export function mobileLiveStatus() {
  return { started: mobileStats.started, streams: mobileStats.streams, longPolls: mobileStats.longPolls, signals: mobileStats.signals, ticketsPending: tickets.size, ringSize: ring.length };
}

// ------------------------------------------------------------------ auth

const bearer = (h: string | undefined) => (h?.startsWith('Bearer ') ? h.slice(7).trim() || undefined : undefined);

async function userSubject(token: string | undefined): Promise<Subject | null> {
  if (!token) return null;
  const r = await query<{ user_id: string }>(`SELECT user_id FROM sessions WHERE token = $1`, [token]);
  return r.rows[0] ? { kind: 'user', userId: r.rows[0].user_id, token } : null;
}

async function staffSubject(token: string | undefined): Promise<Subject | null> {
  if (!token) return null;
  const r = await query<{ id: string; role: string; store_id: string | null }>(
    `SELECT s.id, s.role, s.store_id FROM ops.staff_sessions sess JOIN ops.staff s ON s.id = sess.staff_id
     WHERE sess.token = $1 AND s.is_active = TRUE AND ${STAFF_SESSION_ALIVE_SQL}`,
    [token],
  );
  const row = r.rows[0];
  if (!row) return null;
  touchStaffSession(token);
  return { kind: 'staff', staffId: row.id, role: row.role, storeId: row.store_id, token };
}

const recheck = (s: Subject) => (s.kind === 'user' ? userSubject(s.token) : staffSubject(s.token));

function pruneTickets() {
  const now = Date.now();
  for (const [k, v] of tickets) if (v.exp <= now) tickets.delete(k);
}

// ------------------------------------------------------------------ routes

type Resolver = (token: string | undefined) => Promise<Subject | null>;

function registerFor(app: Hono, base: '/me' | '/ops', resolve: Resolver) {
  app.post(`${base}/stream-ticket`, async (c) => {
    const subject = await resolve(bearer(c.req.header('Authorization')));
    if (!subject) return c.json({ ok: false, error: 'unauthorized' }, 401);
    pruneTickets();
    const ticket = randomBytes(24).toString('base64url');
    tickets.set(ticket, { subject, exp: Date.now() + TICKET_TTL_MS });
    return c.json({ ok: true, ticket, expiresInMs: TICKET_TTL_MS, lastId: busLastId(), heartbeatMs: HEARTBEAT_MS });
  });

  app.get(`${base}/stream`, async (c) => {
    const key = c.req.query('ticket') ?? '';
    const entry = tickets.get(key);
    if (entry) tickets.delete(key);
    const wanted = base === '/me' ? 'user' : 'staff';
    if (!entry || entry.exp <= Date.now() || entry.subject.kind !== wanted) {
      return c.json({ ok: false, code: 'ticket_invalid', error: 'Ticket de flux invalide ou expiré.' }, 401);
    }
    if (mobileStats.streams >= MAX_STREAMS) return c.json({ ok: false, error: 'Trop de flux ouverts.' }, 503);
    const subject = entry.subject;
    const sinceRaw = c.req.header('Last-Event-ID') ?? c.req.query('since');
    const since = sinceRaw && Number.isFinite(Number(sinceRaw)) ? Math.max(0, Math.floor(Number(sinceRaw))) : null;
    c.header('Cache-Control', 'no-cache, no-transform');
    c.header('X-Accel-Buffering', 'no');
    return streamSSE(
      c,
      async (stream) => {
        mobileStats.streams++;
        let closed = false;
        let out: Promise<unknown> = Promise.resolve();
        const write = (msg: { event: string; data: string; id?: string; retry?: number }) => {
          out = out.then(() => (closed ? undefined : stream.writeSSE(msg))).catch(() => {
            closed = true;
          });
          return out;
        };
        const sub = {
          subject,
          onSignal: (s: MobileSignal) => void write({ id: String(s.id), event: 'signal', data: JSON.stringify(s) }),
          onPos: (p: MobileSignal & { lng: number; lat: number }) => void write({ event: 'pos', data: JSON.stringify(p) }),
        };
        stream.onAbort(() => {
          closed = true;
        });
        try {
          await write({ event: 'hello', retry: 3000, data: JSON.stringify({ lastId: busLastId(), heartbeatMs: HEARTBEAT_MS }) });
          if (since != null) {
            for (const e of ring) if (e.signal.id > since && matches(subject, e)) sub.onSignal(e.signal);
          }
          subscribers.add(sub);
          let lastCheck = Date.now();
          while (!closed) {
            await stream.sleep(HEARTBEAT_MS);
            if (closed) break;
            if (Date.now() - lastCheck >= SESSION_RECHECK_MS) {
              lastCheck = Date.now();
              const still = await recheck(subject).catch(() => subject);
              if (!still) {
                await write({ event: 'bye', data: JSON.stringify({ reason: 'session' }) });
                break;
              }
            }
            await write({ event: 'ping', data: String(Date.now()) });
          }
        } finally {
          closed = true;
          subscribers.delete(sub);
          mobileStats.streams--;
        }
      },
      async (err) => {
        console.warn('[mobile-live] flux interrompu :', err.message);
      },
    );
  });

  /** Long-poll : renvoie les signaux > since, ou attend jusqu'à `wait` s (25 max) le prochain. */
  app.get(`${base}/events`, async (c) => {
    const subject = await resolve(bearer(c.req.header('Authorization')));
    if (!subject) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const sinceRaw = c.req.query('since');
    const lastId = busLastId();
    if (sinceRaw == null || sinceRaw === '' || !Number.isFinite(Number(sinceRaw))) {
      return c.json({ ok: true, events: [], lastId });
    }
    const since = Math.max(0, Math.floor(Number(sinceRaw)));
    const oldest = ring[0]?.signal.id ?? null;
    // Trou plus ancien que le tampon : le client doit tout recharger une fois.
    const reset = since > 0 && oldest != null && since < oldest - 1 && since < lastId;
    const pick = () => ring.filter((e) => e.signal.id > since && matches(subject, e)).map((e) => e.signal);
    let events = pick();
    const wait = Math.min(Math.max(Number(c.req.query('wait')) || 0, 0), 25);
    if (!events.length && wait > 0 && !reset) {
      mobileStats.longPolls++;
      try {
        events = await new Promise<MobileSignal[]>((resolveWait) => {
          const done = () => {
            const found = pick();
            if (found.length) finish(found);
          };
          const timer = setTimeout(() => finish([]), wait * 1000);
          const finish = (v: MobileSignal[]) => {
            clearTimeout(timer);
            waiters.delete(done);
            resolveWait(v);
          };
          waiters.add(done);
          c.req.raw.signal?.addEventListener?.('abort', () => finish([]));
        });
      } finally {
        mobileStats.longPolls--;
      }
    }
    const maxId = events.reduce((m, e) => Math.max(m, e.id), since);
    return c.json({ ok: true, events, lastId: Math.max(maxId, reset ? busLastId() : since), reset });
  });
}

export function registerMobileLiveRoutes(app: Hono) {
  registerFor(app, '/me', userSubject);
  registerFor(app, '/ops', staffSubject);
}
