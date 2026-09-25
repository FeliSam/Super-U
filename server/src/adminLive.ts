/**
 * Temps réel admin : LISTEN Postgres → bus mémoire → SSE (GET /admin/stream).
 *
 * - `admin_events` : chaque ligne de ops.admin_events (schema-live.sql) notifie son id ; on relit les
 *   lignes par id exact (robuste aux commits hors ordre) puis on les diffuse.
 * - `courier_pos` : positions GPS non journalisées, fusionnées par coursier et envoyées toutes les
 *   COURIER_POS_FLUSH_MS (1 s par défaut).
 * - EventSource ne sait pas envoyer d'en-tête Authorization : le panel obtient d'abord un ticket
 *   (POST /admin/stream-ticket, Bearer), à usage unique et valable 60 s, qu'il passe dans l'URL.
 * - Déploiement derrière Caddy : `reverse_proxy` doit flusher tout de suite (`flush_interval -1`).
 */
import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { query } from './db.ts';
import { STAFF_SESSION_ALIVE_SQL, touchStaffSession } from './sessions.ts';

export type AdminEvent = {
  id: number;
  at: string;
  type: string;
  storeId: string | null;
  entity: string;
  entityId: string | null;
  payload: Record<string, unknown>;
};

export type CourierPos = {
  c: string;
  lng: number;
  lat: number;
  h: number | null;
  s: number | null;
  t: string;
  st: string | null;
};

type Viewer = { staffId: string; role: string; storeId: string | null; token: string };
type Listener = { onEvent: (ev: AdminEvent) => void; onPos: (batch: CourierPos[]) => void };

const envInt = (name: string, fallback: number) => {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const TICKET_TTL_MS = 60_000;
const HEARTBEAT_MS = envInt('ADMIN_STREAM_HEARTBEAT_MS', 15_000);
const SESSION_RECHECK_MS = 60_000;
const COURIER_POS_FLUSH_MS = envInt('COURIER_POS_FLUSH_MS', 1_000);
const BACKFILL_MAX = 1_000;
/** Recouvrement de backfill : rattrape un id plus petit commité après un id plus grand (le client déduplique). */
const BACKFILL_OVERLAP = 25;
const MAX_STREAMS = envInt('ADMIN_STREAM_MAX', 200);
const RETENTION_DAYS = envInt('ADMIN_EVENTS_RETENTION_DAYS', 7);

const BACKOFFICE_ROLES = new Set(['admin', 'manager', 'magasinier', 'recruteur', 'support']);
/** Rôles qui voient les données personnelles client (payload.pii) : ceux qui les voient déjà dans le panel. */
const PII_ROLES = new Set(['admin', 'manager', 'magasinier']);
/** Rôles qui voient les montants (payload.money) : même règle que showMoney dans admin.ts. */
const MONEY_ROLES = new Set(['admin', 'manager']);
const ROLE_CATEGORIES: Record<string, Set<string> | 'all'> = {
  admin: 'all',
  manager: 'all',
  magasinier: new Set(['order', 'pick', 'delivery', 'stock', 'client', 'staff', 'rating', 'incident', 'call', 'support', 'thread', 'courier']),
  support: new Set(['order', 'pick', 'delivery', 'rating', 'incident', 'call', 'support', 'thread', 'client', 'staff', 'courier']),
  recruteur: new Set(['staff', 'pick', 'delivery', 'courier']),
};

// ------------------------------------------------------------------ bus

const listeners = new Set<Listener>();
const ring: AdminEvent[] = [];
const RING_MAX = 2_000;
const recentIds = new Set<number>();
let lastId = 0;
let pendingIds: number[] = [];
let fetchTimer: NodeJS.Timeout | null = null;
const posPending = new Map<string, CourierPos>();
let busClient: pg.Client | null = null;
let busConnected = false;
let reconnectDelay = 1_000;
let reconnectTimer: NodeJS.Timeout | null = null;
let busStarted = false;
const stats = { events: 0, positions: 0, reconnects: 0, streams: 0 };

type EventRow = {
  id: string;
  created_at: Date;
  type: string;
  store_id: string | null;
  entity: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
};

const EVENT_COLUMNS = 'id, created_at, type, store_id, entity, entity_id, payload';

function rowToEvent(row: EventRow): AdminEvent {
  return {
    id: Number(row.id),
    at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    type: row.type,
    storeId: row.store_id,
    entity: row.entity,
    entityId: row.entity_id,
    payload: row.payload ?? {},
  };
}

function dispatch(ev: AdminEvent) {
  if (recentIds.has(ev.id)) return;
  recentIds.add(ev.id);
  ring.push(ev);
  if (ring.length > RING_MAX) {
    const dropped = ring.splice(0, ring.length - RING_MAX);
    for (const d of dropped) recentIds.delete(d.id);
  }
  if (ev.id > lastId) lastId = ev.id;
  stats.events++;
  for (const l of listeners) {
    try {
      l.onEvent(ev);
    } catch {
      /* un flux cassé ne doit pas bloquer les autres */
    }
  }
}

async function fetchPending() {
  fetchTimer = null;
  const ids = pendingIds;
  pendingIds = [];
  if (!ids.length) return;
  try {
    const r = await query<EventRow>(
      `SELECT ${EVENT_COLUMNS} FROM ops.admin_events WHERE id = ANY($1::bigint[]) ORDER BY id`,
      [ids],
    );
    for (const row of r.rows) dispatch(rowToEvent(row));
  } catch (error) {
    console.warn('[live] lecture ops.admin_events impossible :', (error as Error).message);
  }
}

function onNotification(msg: pg.Notification) {
  if (msg.channel === 'admin_events') {
    const id = Number(msg.payload);
    if (!Number.isFinite(id) || recentIds.has(id)) return;
    pendingIds.push(id);
    // Micro-fenêtre de 10 ms : une rafale (commande = 5-10 événements) = une seule requête.
    if (!fetchTimer) fetchTimer = setTimeout(() => void fetchPending(), 10);
  } else if (msg.channel === 'courier_pos') {
    try {
      const pos = JSON.parse(msg.payload ?? '') as CourierPos;
      if (pos?.c) posPending.set(pos.c, pos);
    } catch {
      /* ignore */
    }
  }
}

function flushPositions() {
  if (!posPending.size) return;
  const batch = [...posPending.values()];
  posPending.clear();
  stats.positions += batch.length;
  for (const l of listeners) {
    try {
      l.onPos(batch);
    } catch {
      /* ignore */
    }
  }
}

async function catchUp() {
  // Notifications perdues pendant une coupure LISTEN : on relit tout ce qui dépasse le dernier id vu.
  const r = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM ops.admin_events WHERE id > $1 ORDER BY id LIMIT 5000`,
    [lastId],
  );
  for (const row of r.rows) dispatch(rowToEvent(row));
}

function scheduleReconnect(client: pg.Client, reason: string) {
  if (busClient !== client) return;
  busClient = null;
  busConnected = false;
  client.removeAllListeners('notification');
  client.end().catch(() => undefined);
  if (reconnectTimer) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
  stats.reconnects++;
  console.warn(`[live] LISTEN interrompu (${reason}), nouvelle tentative dans ${Math.round(delay / 1000)} s`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectBus();
  }, delay);
}

async function connectBus() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    keepAlive: true,
    application_name: 'superu-admin-live',
  });
  busClient = client;
  client.on('notification', onNotification);
  client.on('error', (err) => scheduleReconnect(client, err.message));
  client.on('end', () => scheduleReconnect(client, 'connexion fermée'));
  try {
    await client.connect();
    await client.query('LISTEN admin_events');
    await client.query('LISTEN courier_pos');
    busConnected = true;
    reconnectDelay = 1_000;
    await catchUp();
  } catch (error) {
    scheduleReconnect(client, (error as Error).message);
  }
}

export async function startAdminLive() {
  if (busStarted) return;
  busStarted = true;
  const r = await query<{ m: string }>(`SELECT COALESCE(MAX(id), 0)::text AS m FROM ops.admin_events`);
  lastId = Number(r.rows[0]?.m ?? 0);
  await connectBus();
  setInterval(flushPositions, COURIER_POS_FLUSH_MS).unref();
  const purge = () =>
    query<{ n: string }>(`SELECT ops.purge_admin_events($1)::text AS n`, [RETENTION_DAYS]).catch(() => undefined);
  void purge();
  setInterval(() => void purge(), 60 * 60 * 1000).unref();
  console.log(`Temps réel admin : LISTEN admin_events + courier_pos (dernier id ${lastId}, rétention ${RETENTION_DAYS} j)`);
}

// ------------------------------------------------------------------ filtrage par rôle / magasin

function categoryOf(type: string) {
  return type.split('.')[0] ?? type;
}

function scopeOf(viewer: Viewer) {
  // Même règle que scopedStore() dans admin.ts : l'admin voit tout, les autres leur magasin (ou tout si aucun).
  return viewer.role === 'admin' ? null : viewer.storeId;
}

function allowed(viewer: Viewer, category: string, storeId: string | null) {
  const cats = ROLE_CATEGORIES[viewer.role];
  if (!cats) return false;
  if (cats !== 'all' && !cats.has(category)) return false;
  const scope = scopeOf(viewer);
  return !scope || !storeId || storeId === scope;
}

export function viewEvent(ev: AdminEvent, viewer: Viewer): AdminEvent | null {
  if (!allowed(viewer, categoryOf(ev.type), ev.storeId)) return null;
  const payload = { ...ev.payload };
  if (!PII_ROLES.has(viewer.role)) delete payload.pii;
  if (!MONEY_ROLES.has(viewer.role)) delete payload.money;
  return { ...ev, payload };
}

// ------------------------------------------------------------------ auth (tickets)

const tickets = new Map<string, { token: string; exp: number }>();

async function viewerFromToken(token: string | undefined): Promise<Viewer | null> {
  if (!token) return null;
  const r = await query<{ id: string; role: string; store_id: string | null }>(
    `SELECT s.id, s.role, s.store_id
     FROM ops.staff_sessions sess
     JOIN ops.staff s ON s.id = sess.staff_id
     WHERE sess.token = $1 AND s.is_active = TRUE AND ${STAFF_SESSION_ALIVE_SQL}`,
    [token],
  );
  const row = r.rows[0];
  if (!row || !BACKOFFICE_ROLES.has(row.role)) return null;
  touchStaffSession(token);
  return { staffId: row.id, role: row.role, storeId: row.store_id, token };
}

function pruneTickets() {
  const now = Date.now();
  for (const [k, v] of tickets) if (v.exp <= now) tickets.delete(k);
}

// ------------------------------------------------------------------ routes

export function registerAdminLiveRoutes(app: Hono) {
  app.post('/admin/stream-ticket', async (c) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    const viewer = await viewerFromToken(token);
    if (!viewer) return c.json({ ok: false, error: 'Session back-office requise.' }, 401);
    pruneTickets();
    const ticket = randomBytes(24).toString('base64url');
    tickets.set(ticket, { token: viewer.token, exp: Date.now() + TICKET_TTL_MS });
    c.header('Cache-Control', 'no-store');
    return c.json({ ok: true, ticket, expiresIn: TICKET_TTL_MS / 1000 });
  });

  app.get('/admin/stream', async (c) => {
    const key = c.req.query('ticket') ?? '';
    const entry = tickets.get(key);
    if (entry) tickets.delete(key); // usage unique, même s'il a expiré
    if (!entry || entry.exp <= Date.now()) {
      return c.json({ ok: false, code: 'ticket_invalid', error: 'Ticket de flux invalide ou expiré.' }, 401);
    }
    const viewer = await viewerFromToken(entry.token);
    if (!viewer) return c.json({ ok: false, error: 'Session back-office requise.' }, 401);
    if (stats.streams >= MAX_STREAMS) return c.json({ ok: false, error: 'Trop de flux ouverts.' }, 503);

    const sinceRaw = c.req.header('Last-Event-ID') ?? c.req.query('since');
    const sinceNum = sinceRaw == null || sinceRaw === '' ? null : Number(sinceRaw);
    const since = sinceNum != null && Number.isFinite(sinceNum) && sinceNum >= 0 ? Math.floor(sinceNum) : null;

    // Aucun intermédiaire ne doit mettre le flux en tampon (nginx : X-Accel-Buffering, Caddy : flush_interval -1).
    c.header('Cache-Control', 'no-cache, no-transform');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(
      c,
      async (stream) => {
        stats.streams++;
        let closed = false;
        let chain: Promise<unknown> = Promise.resolve();
        const sent = new Set<number>();
        const buffered: AdminEvent[] = [];
        let backfilling = true;

        const write = (msg: { event: string; data: string; id?: string; retry?: number }) => {
          chain = chain.then(() => (closed ? undefined : stream.writeSSE(msg))).catch(() => {
            closed = true;
          });
          return chain;
        };
        const push = (ev: AdminEvent, replay = false) => {
          if (sent.has(ev.id)) return;
          const view = viewEvent(ev, viewer);
          if (!view) return;
          sent.add(ev.id);
          if (sent.size > 5_000) sent.clear();
          void write({ id: String(ev.id), event: 'admin', data: JSON.stringify(replay ? { ...view, replay: true } : view) });
        };
        const listener: Listener = {
          onEvent: (ev) => (backfilling ? buffered.push(ev) : push(ev)),
          onPos: (batch) => {
            if (backfilling) return;
            const visible = batch.filter((p) => allowed(viewer, 'courier', p.st));
            if (visible.length) void write({ event: 'courier_pos', data: JSON.stringify(visible) });
          },
        };
        listeners.add(listener);
        stream.onAbort(() => {
          closed = true;
        });

        try {
          await write({
            event: 'hello',
            retry: 3000,
            data: JSON.stringify({
              lastId,
              since,
              role: viewer.role,
              storeScope: scopeOf(viewer),
              pii: PII_ROLES.has(viewer.role),
              money: MONEY_ROLES.has(viewer.role),
              heartbeatMs: HEARTBEAT_MS,
              listening: busConnected,
            }),
          });

          if (since != null) {
            const min = await query<{ m: string | null }>(`SELECT MIN(id)::text AS m FROM ops.admin_events`);
            const minId = min.rows[0]?.m == null ? null : Number(min.rows[0].m);
            const rows = await query<EventRow>(
              `SELECT ${EVENT_COLUMNS} FROM ops.admin_events WHERE id > $1 ORDER BY id LIMIT $2`,
              [Math.max(0, since - BACKFILL_OVERLAP), BACKFILL_MAX + 1],
            );
            if ((minId != null && since > 0 && since + 1 < minId) || rows.rows.length > BACKFILL_MAX) {
              // Trou trop ancien (purgé) ou trop gros : le panel recharge tout plutôt que de rejouer.
              await write({ event: 'reset', data: JSON.stringify({ reason: rows.rows.length > BACKFILL_MAX ? 'too_many' : 'purged', lastId }) });
              for (const row of rows.rows) sent.add(Number(row.id));
            } else {
              for (const row of rows.rows) push(rowToEvent(row), true);
            }
          }
          backfilling = false;
          for (const ev of buffered.splice(0)) push(ev);

          let lastCheck = Date.now();
          while (!closed) {
            await stream.sleep(HEARTBEAT_MS);
            if (closed) break;
            if (Date.now() - lastCheck >= SESSION_RECHECK_MS) {
              lastCheck = Date.now();
              const still = await viewerFromToken(viewer.token).catch(() => viewer);
              if (!still || still.role !== viewer.role || still.storeId !== viewer.storeId) {
                await write({ event: 'bye', data: JSON.stringify({ reason: 'session' }) });
                break;
              }
            }
            await write({ event: 'ping', data: String(Date.now()) });
          }
        } finally {
          closed = true;
          listeners.delete(listener);
          stats.streams--;
        }
      },
      async (err) => {
        console.warn('[live] flux SSE interrompu :', err.message);
      },
    );
  });

  app.get('/admin/stream/status', async (c) => {
    const header = c.req.header('Authorization');
    const viewer = await viewerFromToken(header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined);
    if (!viewer) return c.json({ ok: false, error: 'Session back-office requise.' }, 401);
    return c.json({ ok: true, listening: busConnected, lastId, ...stats, tickets: tickets.size });
  });
}
