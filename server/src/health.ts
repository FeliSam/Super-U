/**
 * GET /health/details (P2) : état détaillé pour la supervision, réservé aux administrateurs (Bearer staff admin).
 * GET /health reste public et minimal ({ ok, db }) pour les sondes.
 * Aucune donnée personnelle : compteurs et horodatages uniquement.
 */
import type { Hono } from 'hono';
import { query } from './db.ts';
import { STAFF_SESSION_ALIVE_SQL } from './sessions.ts';
import { adminLiveStatus } from './adminLive.ts';
import { mobileLiveStatus } from './mobileLive.ts';
import { alertEvaluatorStatus } from './alerts.ts';
import { fedapayConfigured } from './fedapay.ts';

const bootedAt = Date.now();

export function registerHealthRoutes(app: Hono) {
  app.get('/health/details', async (c) => {
    const h = c.req.header('Authorization');
    const token = h?.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!token) return c.json({ ok: false, error: 'Session administrateur requise.' }, 401);
    const who = await query<{ role: string }>(
      `SELECT s.role FROM ops.staff_sessions sess JOIN ops.staff s ON s.id = sess.staff_id
       WHERE sess.token = $1 AND s.is_active = TRUE AND ${STAFF_SESSION_ALIVE_SQL}`,
      [token],
    ).catch(() => ({ rows: [] as { role: string }[] }));
    const role = who.rows[0]?.role;
    if (!role) return c.json({ ok: false, error: 'Session administrateur requise.' }, 401);
    if (role !== 'admin') return c.json({ ok: false, error: 'Réservé aux administrateurs.' }, 403);

    const t0 = Date.now();
    let db: { ok: boolean; latencyMs: number | null; error?: string } = { ok: false, latencyMs: null };
    let openAlerts: Record<string, number> = {};
    try {
      await query('SELECT 1');
      db = { ok: true, latencyMs: Date.now() - t0 };
      const a = await query<{ severity: string; n: number }>(
        `SELECT severity, COUNT(*)::int AS n FROM ops.alerts WHERE status = 'open' GROUP BY severity`,
      );
      openAlerts = Object.fromEntries(a.rows.map((r) => [r.severity, r.n]));
    } catch (e) {
      db = { ok: false, latencyMs: Date.now() - t0, error: (e as Error).message.slice(0, 120) };
    }
    const live = adminLiveStatus();
    const alerts = alertEvaluatorStatus();
    const ok = db.ok && live.listening;
    return c.json(
      {
        ok,
        uptimeS: Math.round((Date.now() - bootedAt) / 1000),
        startedAt: new Date(bootedAt).toISOString(),
        node: process.version,
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        db,
        live,
        mobile: mobileLiveStatus(),
        alerts: { ...alerts, open: openAlerts },
        payments: { fedapayConfigured: fedapayConfigured(), mode: fedapayConfigured() ? 'fedapay+cod' : 'cod_only' },
      },
      ok ? 200 : 503,
    );
  });
}
