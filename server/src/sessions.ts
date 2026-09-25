import { query } from './db.ts';
import { newToken } from './password.ts';

/**
 * Sessions staff (CourseGO + panel admin) : expiration glissante.
 * Chaque requête authentifiée prolonge la session, au plus une écriture par jour et par jeton.
 */
export const STAFF_SESSION_TTL_DAYS = Math.max(1, Math.floor(Number(process.env.STAFF_SESSION_TTL_DAYS) || 30));

/** Condition SQL à ajouter aux lookups `FROM ops.staff_sessions sess`. */
export const STAFF_SESSION_ALIVE_SQL = 'sess.expires_at > NOW()';

export function touchStaffSession(token: string) {
  void query(
    `UPDATE ops.staff_sessions
     SET expires_at = NOW() + make_interval(days => $2::int)
     WHERE token = $1
       AND expires_at > NOW()
       AND expires_at < NOW() + make_interval(days => $2::int) - INTERVAL '1 day'`,
    [token, STAFF_SESSION_TTL_DAYS],
  ).catch(() => undefined);
}

export async function createStaffSession(staffId: string) {
  const token = newToken();
  await query(
    `INSERT INTO ops.staff_sessions (token, staff_id, expires_at)
     VALUES ($1, $2, NOW() + make_interval(days => $3::int))`,
    [token, staffId, STAFF_SESSION_TTL_DAYS],
  );
  return token;
}

export async function purgeExpiredStaffSessions() {
  await query(`DELETE FROM ops.staff_sessions WHERE expires_at < NOW() - INTERVAL '7 days'`);
}
