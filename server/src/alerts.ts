/**
 * Alertes opérationnelles (P2) : évaluées côté serveur toutes les ALERT_EVAL_INTERVAL_MS (30 s par défaut),
 * stockées dans ops.alerts (schema-alerts.sql), poussées en direct sur /admin/stream (alert.raised / acked / resolved).
 *
 * - Dédoublonnage : une alerte active max par (kind, entity_id) (index unique partiel) + délai de grâce
 *   ALERT_COOLDOWN_MIN après résolution avant de relancer la même alerte.
 * - Auto-résolution : dès que la condition disparaît (stock réapprovisionné, commande préparée…) ; les
 *   alertes « événement » (appel manqué) expirent au bout de 24 h.
 * - Plusieurs instances d'API : une seule évalue à la fois (pg_try_advisory_xact_lock).
 * - Titres / détails sans donnée personnelle client (numéro de commande, produit, prénom du livreur).
 */
import type { Hono } from 'hono';
import { pool, query } from './db.ts';
import { STAFF_SESSION_ALIVE_SQL, touchStaffSession } from './sessions.ts';

export type AlertKind =
  | 'low_stock'
  | 'order_not_picked'
  | 'delivery_unclaimed'
  | 'courier_offline'
  | 'delivery_failed'
  | 'missed_call'
  | 'support_unanswered';

type Severity = 'info' | 'warning' | 'critical';

/** Rôles qui voient chaque type d'alerte (liste + flux temps réel). Le recruteur n'en voit aucune. */
export const ALERT_KIND_ROLES: Record<AlertKind, Set<string>> = {
  low_stock: new Set(['admin', 'manager', 'magasinier']),
  order_not_picked: new Set(['admin', 'manager', 'magasinier']),
  delivery_unclaimed: new Set(['admin', 'manager', 'magasinier', 'support']),
  courier_offline: new Set(['admin', 'manager', 'support']),
  delivery_failed: new Set(['admin', 'manager', 'support', 'magasinier']),
  missed_call: new Set(['admin', 'manager', 'support', 'magasinier']),
  support_unanswered: new Set(['admin', 'manager', 'support']),
};
export const ALERT_KINDS = Object.keys(ALERT_KIND_ROLES) as AlertKind[];

export function alertVisibleTo(kind: string, role: string) {
  const roles = ALERT_KIND_ROLES[kind as AlertKind];
  return Boolean(roles?.has(role));
}

const envNum = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function alertThresholds() {
  return {
    evalIntervalMs: envNum('ALERT_EVAL_INTERVAL_MS', 30_000),
    pickMin: envNum('ALERT_PICK_MIN', 20),
    deliveryUnclaimedMin: envNum('ALERT_DELIVERY_UNCLAIMED_MIN', 15),
    courierOfflineMin: envNum('ALERT_COURIER_OFFLINE_MIN', 3),
    missedCallWindowH: envNum('ALERT_MISSED_CALL_WINDOW_H', 6),
    supportMin: envNum('ALERT_SUPPORT_MIN', 10),
    cooldownMin: envNum('ALERT_COOLDOWN_MIN', 10),
  };
}

type Candidate = {
  entity: string;
  entity_id: string;
  store_id: string | null;
  order_id: string | null;
  title: string;
  detail: string | null;
  data: Record<string, unknown>;
};

type Rule = { kind: AlertKind; severity: Severity; mode: 'condition' | 'event'; sql: string; params: (t: ReturnType<typeof alertThresholds>) => unknown[] };

const ACTIVE_DELIVERY = `('assigned', 'at_store', 'picked_up', 'en_route', 'arrived')`;
const shortId = (col: string) => `regexp_replace(${col}, '^#', '')`;

const RULES: Rule[] = [
  {
    kind: 'low_stock',
    severity: 'warning',
    mode: 'condition',
    sql: `SELECT 'product' AS entity, ps.product_id || '@' || ps.store_id AS entity_id, ps.store_id, NULL::text AS order_id,
                 'Stock bas : ' || COALESCE(p.payload->>'name', ps.product_id) AS title,
                 trim(to_char(GREATEST(ps.qty - ps.reserved, 0), 'FM999990.###')) || ' disponible(s), seuil '
                   || trim(to_char(ps.min_qty, 'FM999990.###')) || COALESCE(' — ' || (s.payload->>'name'), '') AS detail,
                 jsonb_build_object('productId', ps.product_id, 'available', GREATEST(ps.qty - ps.reserved, 0), 'minQty', ps.min_qty) AS data
          FROM product_stock ps
          LEFT JOIN products p ON p.id = ps.product_id
          LEFT JOIN stores s ON s.id = ps.store_id
          WHERE ps.min_qty > 0 AND ps.qty - ps.reserved < ps.min_qty
          LIMIT 500`,
    params: () => [],
  },
  {
    kind: 'order_not_picked',
    severity: 'warning',
    mode: 'condition',
    sql: `SELECT 'order' AS entity, pj.order_id AS entity_id, pj.store_id, pj.order_id,
                 'Commande ' || ${shortId('pj.order_id')} || ' non préparée' AS title,
                 'En attente depuis ' || floor(EXTRACT(EPOCH FROM NOW() - pj.created_at) / 60)::int || ' min'
                   || CASE WHEN pj.picker_id IS NULL THEN ' (aucun ramasseur)' ELSE '' END AS detail,
                 jsonb_build_object('pickStatus', pj.status, 'since', pj.created_at) AS data
          FROM ops.pick_jobs pj
          JOIN orders o ON o.id = pj.order_id
          WHERE pj.status IN ('queued', 'assigned', 'picking')
            AND o.status <> 'cancelled'
            AND pj.created_at < NOW() - make_interval(mins => $1::int)
            AND pj.created_at > NOW() - INTERVAL '2 days'
          LIMIT 500`,
    params: (t) => [t.pickMin],
  },
  {
    kind: 'delivery_unclaimed',
    severity: 'warning',
    mode: 'condition',
    sql: `SELECT 'order' AS entity, d.order_id AS entity_id, d.store_id, d.order_id,
                 'Livraison ' || ${shortId('d.order_id')} || ' sans livreur' AS title,
                 'Colis prêt depuis ' || floor(EXTRACT(EPOCH FROM NOW() - COALESCE(pj.packed_at, d.created_at)) / 60)::int || ' min' AS detail,
                 jsonb_build_object('deliveryStatus', d.status, 'since', COALESCE(pj.packed_at, d.created_at)) AS data
          FROM ops.deliveries d
          JOIN orders o ON o.id = d.order_id
          LEFT JOIN ops.pick_jobs pj ON pj.order_id = d.order_id
          WHERE d.status IN ('unassigned', 'offered')
            AND o.status <> 'cancelled'
            AND (pj.id IS NULL OR pj.status = 'packed')
            AND COALESCE(pj.packed_at, d.created_at) < NOW() - make_interval(mins => $1::int)
            AND COALESCE(pj.packed_at, d.created_at) > NOW() - INTERVAL '2 days'
          LIMIT 500`,
    params: (t) => [t.deliveryUnclaimedMin],
  },
  {
    kind: 'courier_offline',
    severity: 'critical',
    mode: 'condition',
    sql: `SELECT 'order' AS entity, d.order_id AS entity_id, d.store_id, d.order_id,
                 'Livreur sans signal : ' || trim(COALESCE(st.first_name, '') || ' ' || left(COALESCE(st.last_name, ''), 1) || '.') AS title,
                 'Aucun signal depuis ' || floor(EXTRACT(EPOCH FROM NOW() - seen.at) / 60)::int || ' min — commande ' || ${shortId('d.order_id')} AS detail,
                 jsonb_build_object('courierId', d.courier_id, 'deliveryStatus', d.status, 'lastSeenAt', seen.at) AS data
          FROM ops.deliveries d
          JOIN ops.staff st ON st.id = d.courier_id
          LEFT JOIN ops.courier_locations loc ON loc.courier_id = d.courier_id
          CROSS JOIN LATERAL (SELECT GREATEST(st.last_seen_at, loc.updated_at, d.assigned_at) AS at) seen
          WHERE d.status IN ${ACTIVE_DELIVERY}
            AND seen.at IS NOT NULL
            AND seen.at < NOW() - make_interval(mins => $1::int)
            AND d.updated_at > NOW() - INTERVAL '1 day'
          LIMIT 500`,
    params: (t) => [t.courierOfflineMin],
  },
  {
    kind: 'delivery_failed',
    severity: 'critical',
    mode: 'condition',
    sql: `SELECT 'order' AS entity, d.order_id AS entity_id, d.store_id, d.order_id,
                 'Livraison ' || ${shortId('d.order_id')} || ' en échec' AS title,
                 left(COALESCE(NULLIF(d.failed_reason, ''), 'Motif non précisé'), 160) AS detail,
                 jsonb_build_object('reasonCode', d.failed_reason_code) AS data
          FROM ops.deliveries d
          WHERE d.status = 'failed' AND d.updated_at > NOW() - INTERVAL '2 days'
          LIMIT 500`,
    params: () => [],
  },
  {
    kind: 'missed_call',
    severity: 'info',
    mode: 'event',
    sql: `SELECT 'call' AS entity, ca.id AS entity_id, o.store_id, ca.order_id,
                 CASE WHEN ca.caller_kind = 'customer' THEN 'Appel client manqué' ELSE 'Client injoignable (appel manqué)' END AS title,
                 COALESCE('Commande ' || ${shortId('ca.order_id')}, CASE t.kind WHEN 'support' THEN 'Assistance' ELSE 'Appel' END) AS detail,
                 jsonb_build_object('threadId', ca.thread_id, 'threadKind', t.kind, 'callerKind', ca.caller_kind, 'at', ca.started_at) AS data
          FROM comms.calls ca
          JOIN comms.threads t ON t.id = ca.thread_id
          LEFT JOIN orders o ON o.id = ca.order_id
          WHERE ca.status = 'missed'
            AND (ca.caller_kind = 'customer' OR ca.callee_kind = 'customer')
            AND ca.started_at > NOW() - make_interval(hours => $1::int)
          LIMIT 500`,
    params: (t) => [t.missedCallWindowH],
  },
  {
    kind: 'support_unanswered',
    severity: 'warning',
    mode: 'condition',
    sql: `SELECT 'thread' AS entity, t.id AS entity_id, o.store_id, t.order_id,
                 'Message client sans réponse' AS title,
                 'Assistance — en attente depuis ' || floor(EXTRACT(EPOCH FROM NOW() - last_c.at) / 60)::int || ' min' AS detail,
                 jsonb_build_object('threadId', t.id, 'since', last_c.at) AS data
          FROM comms.threads t
          LEFT JOIN orders o ON o.id = t.order_id
          CROSS JOIN LATERAL (
            SELECT MAX(m.created_at) AS at FROM comms.messages m
            WHERE m.thread_id = t.id AND m.sender_kind = 'customer' AND m.kind IN ('text', 'image')
          ) last_c
          WHERE t.kind = 'support'
            AND t.archived_at IS NULL AND t.disabled_at IS NULL
            AND last_c.at IS NOT NULL
            AND last_c.at < NOW() - make_interval(mins => $1::int)
            AND last_c.at > NOW() - INTERVAL '1 day'
            AND NOT EXISTS (
              SELECT 1 FROM comms.messages s
              WHERE s.thread_id = t.id AND s.sender_kind = 'staff' AND s.created_at > last_c.at)
          LIMIT 500`,
    params: (t) => [t.supportMin],
  },
];

const EVENT_EXPIRY_H = 24;

let lastRun: { at: string; ms: number; raised: number; resolved: number; skipped?: boolean; error?: string } | null = null;
let timer: NodeJS.Timeout | null = null;
let running = false;

export function alertEvaluatorStatus() {
  return { running: Boolean(timer), lastRun };
}

/** Une passe d'évaluation. Retourne le nombre d'alertes créées / résolues. */
export async function evaluateAlerts() {
  if (running) return { raised: 0, resolved: 0, skipped: true };
  running = true;
  const t0 = Date.now();
  const t = alertThresholds();
  let raised = 0;
  let resolved = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query<{ ok: boolean }>(`SELECT pg_try_advisory_xact_lock(hashtext('ops.alerts.evaluate')) AS ok`);
    if (!lock.rows[0]?.ok) {
      await client.query('ROLLBACK');
      lastRun = { at: new Date().toISOString(), ms: Date.now() - t0, raised: 0, resolved: 0, skipped: true };
      return { raised: 0, resolved: 0, skipped: true };
    }
    for (const rule of RULES) {
      await client.query('SAVEPOINT rule');
      try {
        const found = await client.query<Candidate>(rule.sql, rule.params(t));
        const ids = found.rows.map((r) => r.entity_id);
        for (const c of found.rows) {
          const ins = await client.query(
            `INSERT INTO ops.alerts (kind, severity, entity, entity_id, store_id, order_id, title, detail, data)
             SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb
             WHERE NOT EXISTS (
               SELECT 1 FROM ops.alerts a
               WHERE a.kind = $1 AND a.entity_id = $4 AND a.status = 'resolved'
                 AND (a.resolved_at > NOW() - make_interval(mins => $10::int)
                      OR ($11::boolean AND a.resolved_reason = 'expired')))
             ON CONFLICT (kind, entity_id) WHERE status <> 'resolved'
             DO UPDATE SET last_seen_at = NOW(), detail = EXCLUDED.detail, data = EXCLUDED.data
             RETURNING (xmax = 0) AS inserted`,
            [rule.kind, rule.severity, c.entity, c.entity_id, c.store_id, c.order_id, c.title, c.detail, JSON.stringify(c.data ?? {}), t.cooldownMin, rule.mode === 'event'],
          );
          if ((ins.rows[0] as { inserted?: boolean } | undefined)?.inserted) raised++;
        }
        const res =
          rule.mode === 'condition'
            ? await client.query(
                `UPDATE ops.alerts SET status = 'resolved', resolved_at = NOW(), resolved_reason = 'cleared'
                 WHERE kind = $1 AND status <> 'resolved' AND NOT (entity_id = ANY($2::text[]))`,
                [rule.kind, ids],
              )
            : await client.query(
                `UPDATE ops.alerts SET status = 'resolved', resolved_at = NOW(), resolved_reason = 'expired'
                 WHERE kind = $1 AND status <> 'resolved' AND created_at < NOW() - make_interval(hours => $2::int)`,
                [rule.kind, EVENT_EXPIRY_H],
              );
        resolved += res.rowCount ?? 0;
        await client.query('RELEASE SAVEPOINT rule');
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT rule');
        console.warn(`[alerts] règle ${rule.kind} ignorée : ${(e as Error).message}`);
      }
    }
    // Historique : on garde 30 jours d'alertes résolues.
    await client.query(`DELETE FROM ops.alerts WHERE status = 'resolved' AND resolved_at < NOW() - INTERVAL '30 days'`);
    await client.query('COMMIT');
    lastRun = { at: new Date().toISOString(), ms: Date.now() - t0, raised, resolved };
    return { raised, resolved, skipped: false };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    lastRun = { at: new Date().toISOString(), ms: Date.now() - t0, raised, resolved, error: (e as Error).message };
    throw e;
  } finally {
    client.release();
    running = false;
  }
}

export function startAlertEvaluator() {
  if (timer || process.env.ALERTS_DISABLED === '1') return;
  const { evalIntervalMs } = alertThresholds();
  const tick = () => void evaluateAlerts().catch((e) => console.warn('[alerts] évaluation échouée :', (e as Error).message));
  setTimeout(tick, envNum('ALERT_FIRST_EVAL_MS', 2_000)).unref();
  timer = setInterval(tick, evalIntervalMs);
  timer.unref();
  console.log(`Alertes opérationnelles : évaluation toutes les ${Math.round(evalIntervalMs / 1000)} s`);
}

// ------------------------------------------------------------------ routes

type Staff = { id: string; first_name: string | null; last_name: string | null; role: string; store_id: string | null };

async function staffFromHeader(header: string | undefined) {
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const r = await query<Staff>(
    `SELECT s.id, s.first_name, s.last_name, s.role, s.store_id
     FROM ops.staff_sessions sess JOIN ops.staff s ON s.id = sess.staff_id
     WHERE sess.token = $1 AND s.is_active = TRUE AND ${STAFF_SESSION_ALIVE_SQL}`,
    [token],
  );
  if (r.rows[0]) touchStaffSession(token);
  return r.rows[0] ?? null;
}

const BACKOFFICE = new Set(['admin', 'manager', 'magasinier', 'recruteur', 'support']);

function visibleKinds(role: string) {
  return ALERT_KINDS.filter((k) => ALERT_KIND_ROLES[k].has(role));
}

const scopeOf = (s: Staff) => (s.role === 'admin' ? null : s.store_id);

const ALERT_COLUMNS = `a.id::text AS id, a.kind, a.severity, a.entity, a.entity_id AS "entityId", a.store_id AS "storeId",
  a.order_id AS "orderId", a.title, a.detail, a.data, a.status, a.created_at AS "createdAt", a.last_seen_at AS "lastSeenAt",
  a.acked_at AS "ackedAt", a.acked_by_name AS "ackedBy", a.resolved_at AS "resolvedAt", a.resolved_reason AS "resolvedReason"`;

export function registerAlertRoutes(app: Hono) {
  app.get('/admin/alerts', async (c) => {
    const staff = await staffFromHeader(c.req.header('Authorization'));
    if (!staff || !BACKOFFICE.has(staff.role)) return c.json({ ok: false, error: 'Session back-office requise.' }, 401);
    const kinds = visibleKinds(staff.role);
    const status = (c.req.query('status') ?? 'active').trim();
    const statuses = status === 'all' ? ['open', 'acked', 'resolved'] : status === 'open' ? ['open'] : status === 'acked' ? ['acked'] : status === 'resolved' ? ['resolved'] : ['open', 'acked'];
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 200, 1), 500);
    const scope = scopeOf(staff);
    const rows = kinds.length
      ? await query(
          `SELECT ${ALERT_COLUMNS} FROM ops.alerts a
           WHERE a.kind = ANY($1::text[]) AND a.status = ANY($2::text[])
             AND ($3::text IS NULL OR a.store_id IS NULL OR a.store_id = $3)
           ORDER BY (a.status = 'open') DESC,
                    CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                    a.created_at DESC
           LIMIT $4`,
          [kinds, statuses, scope, limit],
        )
      : { rows: [] };
    const counts = kinds.length
      ? await query<{ kind: string; open: number; acked: number }>(
          `SELECT kind, COUNT(*) FILTER (WHERE status = 'open')::int AS open, COUNT(*) FILTER (WHERE status = 'acked')::int AS acked
           FROM ops.alerts
           WHERE kind = ANY($1::text[]) AND status <> 'resolved' AND ($2::text IS NULL OR store_id IS NULL OR store_id = $2)
           GROUP BY kind`,
          [kinds, scope],
        )
      : { rows: [] as { kind: string; open: number; acked: number }[] };
    const byKind = Object.fromEntries(counts.rows.map((r) => [r.kind, { open: r.open, acked: r.acked }]));
    return c.json({
      ok: true,
      alerts: rows.rows,
      counts: {
        open: counts.rows.reduce((a, r) => a + r.open, 0),
        acked: counts.rows.reduce((a, r) => a + r.acked, 0),
        byKind,
      },
      kinds,
      thresholds: alertThresholds(),
      evaluator: alertEvaluatorStatus(),
    });
  });

  const ack = async (staff: Staff, ids: string[] | null, kind: string | null) => {
    const kinds = visibleKinds(staff.role).filter((k) => !kind || k === kind);
    if (!kinds.length) return 0;
    const r = await query(
      `UPDATE ops.alerts SET status = 'acked', acked_at = NOW(), acked_by = $1, acked_by_name = $2
       WHERE status = 'open' AND kind = ANY($3::text[])
         AND ($4::text IS NULL OR store_id IS NULL OR store_id = $4)
         AND ($5::bigint[] IS NULL OR id = ANY($5::bigint[]))`,
      [staff.id, `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() || 'Équipe', kinds, scopeOf(staff), ids],
    );
    return r.rowCount ?? 0;
  };

  app.post('/admin/alerts/:id/ack', async (c) => {
    const staff = await staffFromHeader(c.req.header('Authorization'));
    if (!staff || !BACKOFFICE.has(staff.role)) return c.json({ ok: false, error: 'Session back-office requise.' }, 401);
    const id = c.req.param('id');
    if (!/^\d{1,18}$/.test(id)) return c.json({ ok: false, error: 'Alerte introuvable.' }, 404);
    const found = await query<{ kind: string; status: string; store_id: string | null }>(`SELECT kind, status, store_id FROM ops.alerts WHERE id = $1`, [id]);
    const row = found.rows[0];
    const scope = scopeOf(staff);
    if (!row || !alertVisibleTo(row.kind, staff.role) || (scope && row.store_id && row.store_id !== scope)) {
      return c.json({ ok: false, error: 'Alerte introuvable.' }, 404);
    }
    const n = row.status === 'open' ? await ack(staff, [id], null) : 0;
    return c.json({ ok: true, acked: n, status: n ? 'acked' : row.status });
  });

  app.post('/admin/alerts/ack', async (c) => {
    const staff = await staffFromHeader(c.req.header('Authorization'));
    if (!staff || !BACKOFFICE.has(staff.role)) return c.json({ ok: false, error: 'Session back-office requise.' }, 401);
    const body = (await c.req.json().catch(() => ({}))) as { ids?: unknown; kind?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter((s) => /^\d{1,18}$/.test(s)).slice(0, 500) : null;
    const kind = typeof body.kind === 'string' && ALERT_KINDS.includes(body.kind as AlertKind) ? body.kind : null;
    if (ids && !ids.length) return c.json({ ok: true, acked: 0 });
    return c.json({ ok: true, acked: await ack(staff, ids, kind) });
  });

  /** Réévaluation immédiate (bouton « Actualiser » du panel, tests). Admin / manager. */
  app.post('/admin/alerts/evaluate', async (c) => {
    const staff = await staffFromHeader(c.req.header('Authorization'));
    if (!staff || !['admin', 'manager'].includes(staff.role)) return c.json({ ok: false, error: 'Réservé aux administrateurs.' }, 403);
    const r = await evaluateAlerts();
    return c.json({ ok: true, ...r });
  });
}
