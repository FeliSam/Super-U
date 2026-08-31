import { randomBytes } from 'node:crypto';
import type { Hono } from 'hono';
import { query } from './db.ts';
import { hashPassword } from './password.ts';

const CATALOG_ROLES = new Set(['admin', 'manager', 'magasinier']);
const HR_WRITE = new Set(['admin', 'recruteur', 'manager']);
const HR_READ = new Set(['admin', 'recruteur', 'manager', 'support']);
const BACKOFFICE = new Set([...CATALOG_ROLES, 'recruteur', 'support']);
const RECRUITER_ROLES = new Set(['picker', 'courier', 'coursier']);
const FIELD_STORE_ROLES = new Set(['picker', 'courier', 'coursier', 'magasinier', 'manager']);
const OFFICE_ROLES = new Set(['admin', 'recruteur', 'support', 'dispatcher']);
const ALL_ROLES = [
  'picker',
  'courier',
  'coursier',
  'dispatcher',
  'manager',
  'magasinier',
  'admin',
  'recruteur',
  'support',
] as const;

type StaffRow = {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  role: string;
  can_pick: boolean;
  can_deliver: boolean;
  store_id: string | null;
  vehicle: string | null;
  is_active: boolean;
  hired_at: string | Date | null;
  onboard_status: string;
  created_by: string | null;
  notes: string | null;
  must_reset_password: boolean;
  created_at: string | Date;
  last_session_at?: string | Date | null;
};

type Actor = {
  id: string;
  email: string;
  role: string;
  store_id: string | null;
  is_active: boolean;
};

function bearer(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

async function actorFromToken(token: string | undefined) {
  if (!token) return null;
  const result = await query<Actor>(
    `SELECT s.id, s.email, s.role, s.store_id, s.is_active
     FROM ops.staff_sessions sess
     JOIN ops.staff s ON s.id = sess.staff_id
     WHERE sess.token = $1 AND s.is_active = TRUE`,
    [token],
  );
  return result.rows[0] ?? null;
}

type CtxLike = { req: { header: (n: string) => string | undefined }; json: (b: unknown, s?: number) => Response };

async function requireHr(c: CtxLike, write: boolean) {
  const staff = await actorFromToken(bearer(c.req.header('Authorization')));
  if (!staff) return { staff: null as Actor | null, error: c.json({ ok: false, error: 'Session staff requise.' }, 401) };
  const allowed = write ? HR_WRITE : HR_READ;
  if (!allowed.has(staff.role)) {
    return { staff: null as Actor | null, error: c.json({ ok: false, error: 'Accès RH réservé à l’équipe magasin / recrutement.' }, 403) };
  }
  return { staff, error: null as Response | null };
}

function formatStaffPhone(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00229')) d = d.slice(5);
  else if (d.startsWith('229')) d = d.slice(3);
  if (d.length === 8) d = `${d.startsWith('2') ? '02' : '01'}${d}`;
  if (d.length !== 10) {
    throw new Error('Téléphone invalide. Utilisez un numéro Bénin (8 ou 10 chiffres).');
  }
  const parts: string[] = [];
  for (let i = 0; i < d.length; i += 2) parts.push(d.slice(i, i + 2));
  return `+229 ${parts.join(' ')}`;
}

function flagsForRole(role: string, body: { canPick?: unknown; canDeliver?: unknown; vehicle?: unknown }) {
  if (OFFICE_ROLES.has(role) || role === 'manager' || role === 'magasinier') {
    return { canPick: false, canDeliver: false, vehicle: null as string | null };
  }
  if (role === 'coursier' || role === 'both') {
    const vehicle = String(body.vehicle || 'moto');
    return { canPick: true, canDeliver: true, vehicle };
  }
  if (role === 'picker') {
    return { canPick: true, canDeliver: false, vehicle: null as string | null };
  }
  if (role === 'courier') {
    const vehicle = String(body.vehicle || 'moto');
    return { canPick: false, canDeliver: true, vehicle };
  }
  const canPick = Boolean(body.canPick);
  const canDeliver = Boolean(body.canDeliver);
  return {
    canPick,
    canDeliver,
    vehicle: canDeliver ? String(body.vehicle || 'moto') : null,
  };
}

function normalizeVehicle(raw: string | null, canDeliver: boolean) {
  if (!canDeliver) return null;
  const v = (raw || 'moto').toLowerCase();
  if (['moto', 'voiture', 'velo', 'pied'].includes(v)) return v;
  return 'moto';
}

function publicHrStaff(row: StaffRow, extra?: { documents?: unknown[] }) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role === 'both' ? 'coursier' : row.role,
    canPick: row.can_pick,
    canDeliver: row.can_deliver,
    storeId: row.store_id,
    vehicle: row.vehicle,
    isActive: row.is_active,
    hiredAt: row.hired_at,
    onboardStatus: row.onboard_status,
    createdBy: row.created_by,
    notes: row.notes,
    mustResetPassword: row.must_reset_password,
    createdAt: row.created_at,
    lastSessionAt: row.last_session_at ?? null,
    courseGo: row.can_pick || row.can_deliver,
    documents: extra?.documents,
  };
}

function scopedStore(actor: Actor, requested?: string | null) {
  if (actor.role === 'admin' || actor.role === 'recruteur' || actor.role === 'support') return requested ?? null;
  return actor.store_id;
}

function canTargetRole(actor: Actor, role: string) {
  if (actor.role === 'admin') return ALL_ROLES.includes(role as (typeof ALL_ROLES)[number]) || role === 'both';
  if (actor.role === 'recruteur') return RECRUITER_ROLES.has(role);
  if (actor.role === 'manager') return RECRUITER_ROLES.has(role) || role === 'magasinier';
  return false;
}

async function countAdmins() {
  const r = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM ops.staff WHERE role = 'admin' AND is_active = TRUE`,
  );
  return Number(r.rows[0]?.n ?? 0);
}

function staffSelect() {
  return `SELECT s.id, s.email, s.phone, s.first_name, s.last_name, s.role, s.can_pick, s.can_deliver,
            s.store_id, s.vehicle, s.is_active, s.hired_at, s.onboard_status, s.created_by, s.notes,
            s.must_reset_password, s.created_at,
            (SELECT MAX(sess.created_at) FROM ops.staff_sessions sess WHERE sess.staff_id = s.id) AS last_session_at
     FROM ops.staff s`;
}

export function isBackofficeRole(role: string) {
  return BACKOFFICE.has(role);
}

export function registerAdminStaffRoutes(app: Hono) {
  app.get('/admin/staff/overview', async (c) => {
    const gate = await requireHr(c, false);
    if (gate.error) return gate.error;
    const actor = gate.staff!;
    const store = scopedStore(actor, c.req.query('storeId'));
    const params: unknown[] = [];
    let where = 'TRUE';
    if (store) {
      params.push(store);
      where = `store_id = $${params.length}`;
    }
    const counts = await query<{ onboard_status: string; is_active: boolean; n: string }>(
      `SELECT onboard_status, is_active, COUNT(*)::text AS n FROM ops.staff WHERE ${where} GROUP BY 1, 2`,
      params,
    );
    const byRole = await query<{ role: string; n: string }>(
      `SELECT role, COUNT(*)::text AS n FROM ops.staff WHERE ${where} GROUP BY 1 ORDER BY 1`,
      params,
    );
    const recent = await query<{
      id: string;
      first_name: string;
      last_name: string;
      role: string;
      onboard_status: string;
      is_active: boolean;
      created_at: Date;
    }>(
      `SELECT id, first_name, last_name, role, onboard_status, is_active, created_at
       FROM ops.staff ${store ? 'WHERE store_id = $1' : ''}
       ORDER BY created_at DESC LIMIT 8`,
      store ? [store] : [],
    );
    const hiresDays = await query<{ d: string; n: string }>(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, INTERVAL '1 day')::date AS d
       )
       SELECT days.d::text AS d, COUNT(s.id)::text AS n
       FROM days
       LEFT JOIN ops.staff s ON s.created_at::date = days.d ${store ? 'AND s.store_id = $1' : ''}
       GROUP BY days.d
       ORDER BY days.d`,
      store ? [store] : [],
    );
    const hiresMonths = await query<{ m: string; n: string }>(
      `WITH months AS (
         SELECT generate_series(
           date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
           date_trunc('month', CURRENT_DATE),
           INTERVAL '1 month'
         )::date AS m
       )
       SELECT months.m::text AS m, COUNT(s.id)::text AS n
       FROM months
       LEFT JOIN ops.staff s ON date_trunc('month', s.created_at)::date = months.m ${store ? 'AND s.store_id = $1' : ''}
       GROUP BY months.m
       ORDER BY months.m`,
      store ? [store] : [],
    );
    const suspended = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM ops.staff WHERE ${where} AND is_active = FALSE`,
      params,
    );
    return c.json({
      ok: true,
      counts: counts.rows.map((r) => ({
        onboardStatus: r.onboard_status,
        isActive: r.is_active,
        n: Number(r.n),
      })),
      byRole: byRole.rows.map((r) => ({ role: r.role, n: Number(r.n) })),
      suspended: Number(suspended.rows[0]?.n ?? 0),
      recent: recent.rows.map((r) => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        role: r.role,
        onboardStatus: r.onboard_status,
        isActive: r.is_active,
        createdAt: r.created_at,
      })),
      series: {
        days: hiresDays.rows.map((r) => ({ date: r.d.slice(0, 10), n: Number(r.n) })),
        months: hiresMonths.rows.map((r) => ({ date: r.m.slice(0, 7), n: Number(r.n) })),
      },
    });
  });

  app.get('/admin/staff', async (c) => {
    const gate = await requireHr(c, false);
    if (gate.error) return gate.error;
    const actor = gate.staff!;
    const q = String(c.req.query('q') ?? '').trim().toLowerCase();
    const role = String(c.req.query('role') ?? '').trim();
    const onboard = String(c.req.query('onboard') ?? '').trim();
    const activeRaw = c.req.query('active');
    const store = scopedStore(actor, c.req.query('storeId'));
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (store) {
      params.push(store);
      clauses.push(`s.store_id = $${params.length}`);
    }
    if (role) {
      params.push(role === 'coursier' ? ['coursier', 'both'] : [role]);
      clauses.push(`s.role = ANY($${params.length}::text[])`);
    }
    if (onboard) {
      params.push(onboard.split(',').map((x) => x.trim()).filter(Boolean));
      clauses.push(`s.onboard_status = ANY($${params.length}::text[])`);
    }
    if (activeRaw === '1' || activeRaw === '0') {
      params.push(activeRaw === '1');
      clauses.push(`s.is_active = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      clauses.push(
        `(lower(s.first_name || ' ' || s.last_name) LIKE $${params.length}
          OR lower(s.email) LIKE $${params.length}
          OR regexp_replace(s.phone, '\\D', '', 'g') LIKE regexp_replace($${params.length}, '\\D', '', 'g'))`,
      );
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await query<StaffRow>(
      `${staffSelect()} ${where} ORDER BY s.last_name, s.first_name`,
      params,
    );
    return c.json({ ok: true, staff: rows.rows.map((r) => publicHrStaff(r)) });
  });

  app.get('/admin/staff/:id', async (c) => {
    const gate = await requireHr(c, false);
    if (gate.error) return gate.error;
    const actor = gate.staff!;
    const id = c.req.param('id');
    const found = await query<StaffRow>(`${staffSelect()} WHERE s.id = $1`, [id]);
    const row = found.rows[0];
    if (!row) return c.json({ ok: false, error: 'Collaborateur introuvable.' }, 404);
    const store = scopedStore(actor, null);
    if (store && row.store_id !== store) return c.json({ ok: false, error: 'Hors de votre magasin.' }, 403);
    const docs = await query(
      `SELECT id, kind, label, url_or_path, verified_at, verified_by, created_at
       FROM ops.staff_documents WHERE staff_id = $1 ORDER BY created_at DESC`,
      [id],
    );
    return c.json({
      ok: true,
      staff: publicHrStaff(row, {
        documents: docs.rows.map((d) => ({
          id: d.id,
          kind: d.kind,
          label: d.label,
          urlOrPath: d.url_or_path,
          verifiedAt: d.verified_at,
          verifiedBy: d.verified_by,
          createdAt: d.created_at,
        })),
      }),
    });
  });

  app.post('/admin/staff', async (c) => {
    const gate = await requireHr(c, true);
    if (gate.error) return gate.error;
    const actor = gate.staff!;
    const body = await c.req.json().catch(() => null);
    const firstName = String(body?.firstName ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    let phone: string;
    try {
      phone = formatStaffPhone(String(body?.phone ?? ''));
    } catch (e) {
      return c.json({ ok: false, error: e instanceof Error ? e.message : 'Téléphone invalide.' }, 400);
    }
    const role = String(body?.role ?? 'coursier');
    if (role === 'both') return c.json({ ok: false, error: 'Utilisez le rôle coursier (plus both).' }, 400);
    if (!ALL_ROLES.includes(role as (typeof ALL_ROLES)[number])) {
      return c.json({ ok: false, error: 'Rôle inconnu.' }, 400);
    }
    if (!canTargetRole(actor, role)) {
      return c.json({ ok: false, error: 'Vous ne pouvez pas créer ce rôle.' }, 403);
    }
    if (firstName.length < 2 || lastName.length < 2) {
      return c.json({ ok: false, error: 'Indiquez le nom complet.' }, 400);
    }
    if (!email.includes('@')) return c.json({ ok: false, error: 'E-mail invalide.' }, 400);
    const flags = flagsForRole(role, body ?? {});
    if (role === 'coursier' && flags.canPick !== flags.canDeliver) {
      return c.json({ ok: false, error: 'Un coursier ramasse et livre.' }, 400);
    }
    if (flags.canDeliver && !normalizeVehicle(flags.vehicle, true)) {
      return c.json({ ok: false, error: 'Véhicule requis pour la livraison.' }, 400);
    }
    const vehicle = normalizeVehicle(flags.vehicle, flags.canDeliver);
    const storeId = scopedStore(actor, body?.storeId ? String(body.storeId) : null);
    if (FIELD_STORE_ROLES.has(role) && !storeId) {
      return c.json({ ok: false, error: 'Magasin obligatoire pour ce rôle.' }, 400);
    }
    if (actor.role === 'manager' && storeId !== actor.store_id) {
      return c.json({ ok: false, error: 'Vous ne pouvez rattacher qu’à votre magasin.' }, 403);
    }
    const temp = String(body?.temporaryPassword ?? '').trim();
    if (temp && temp.length < 6) return c.json({ ok: false, error: 'Mot de passe trop court (6 caractères).' }, 400);
    const password = temp || `tmp-${randomBytes(4).toString('hex')}`;
    const clash = await query(
      `SELECT email, phone FROM ops.staff
       WHERE email = $1 OR regexp_replace(phone, '\\D', '', 'g') = regexp_replace($2, '\\D', '', 'g')`,
      [email, phone],
    );
    if (clash.rows[0]) {
      const sameMail = clash.rows[0].email === email;
      return c.json(
        { ok: false, error: sameMail ? 'E-mail déjà enregistré.' : 'Téléphone déjà enregistré.' },
        409,
      );
    }
    const id = `st-${role.slice(0, 6)}-${randomBytes(3).toString('hex')}`;
    const activateNow = actor.role === 'admin' && body?.activateNow !== false;
    const onboard = activateNow ? 'active' : temp ? 'invited' : 'draft';
    const isActive = activateNow;
    await query(
      `INSERT INTO ops.staff (
         id, email, phone, password_hash, first_name, last_name, role, can_pick, can_deliver,
         store_id, vehicle, is_active, hired_at, onboard_status, created_by, notes, must_reset_password
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13,$14,$15,TRUE)`,
      [
        id,
        email,
        phone,
        await hashPassword(password),
        firstName,
        lastName,
        role,
        flags.canPick,
        flags.canDeliver,
        OFFICE_ROLES.has(role) && role !== 'dispatcher' ? storeId : storeId,
        vehicle,
        isActive,
        onboard,
        actor.id,
        String(body?.notes ?? '').trim() || null,
      ],
    );
    const row = (await query<StaffRow>(`${staffSelect()} WHERE s.id = $1`, [id])).rows[0];
    return c.json({
      ok: true,
      temporaryPassword: password,
      staff: publicHrStaff(row),
    });
  });

  app.patch('/admin/staff/:id', async (c) => {
    const gate = await requireHr(c, true);
    if (gate.error) return gate.error;
    const actor = gate.staff!;
    const id = c.req.param('id');
    const found = await query<StaffRow>(`${staffSelect()} WHERE s.id = $1`, [id]);
    const row = found.rows[0];
    if (!row) return c.json({ ok: false, error: 'Collaborateur introuvable.' }, 404);
    const storeScope = scopedStore(actor, null);
    if (storeScope && row.store_id !== storeScope) return c.json({ ok: false, error: 'Hors de votre magasin.' }, 403);
    const body = await c.req.json().catch(() => ({}));
    const nextRole = body.role != null ? String(body.role) : row.role === 'both' ? 'coursier' : row.role;
    if (nextRole === 'both') return c.json({ ok: false, error: 'Utilisez le rôle coursier.' }, 400);
    if (!ALL_ROLES.includes(nextRole as (typeof ALL_ROLES)[number])) {
      return c.json({ ok: false, error: 'Rôle inconnu.' }, 400);
    }
    if (body.role != null && !canTargetRole(actor, nextRole)) {
      return c.json({ ok: false, error: 'Vous ne pouvez pas assigner ce rôle.' }, 403);
    }
    if (row.role === 'admin' && nextRole !== 'admin') {
      if ((await countAdmins()) <= 1) {
        return c.json({ ok: false, error: 'Impossible de rétrograder le dernier administrateur.' }, 400);
      }
    }
    const flags = flagsForRole(nextRole, {
      canPick: body.canPick ?? row.can_pick,
      canDeliver: body.canDeliver ?? row.can_deliver,
      vehicle: body.vehicle ?? row.vehicle,
    });
    if (nextRole === 'coursier' && flags.canPick !== flags.canDeliver) {
      return c.json({ ok: false, error: 'Un coursier ramasse et livre.' }, 400);
    }
    const vehicle = normalizeVehicle(flags.vehicle, flags.canDeliver);
    if (flags.canDeliver && !vehicle) {
      return c.json({ ok: false, error: 'Véhicule requis pour la livraison.' }, 400);
    }
    let storeId = body.storeId !== undefined ? String(body.storeId || '') || null : row.store_id;
    storeId = actor.role === 'manager' ? actor.store_id : storeId;
    if (FIELD_STORE_ROLES.has(nextRole) && !storeId) {
      return c.json({ ok: false, error: 'Magasin obligatoire pour ce rôle.' }, 400);
    }
    let phone = row.phone;
    if (body.phone != null) {
      try {
        phone = formatStaffPhone(String(body.phone));
      } catch (e) {
        return c.json({ ok: false, error: e instanceof Error ? e.message : 'Téléphone invalide.' }, 400);
      }
    }
    const email = body.email != null ? String(body.email).trim().toLowerCase() : row.email;
    const firstName = body.firstName != null ? String(body.firstName).trim() : row.first_name;
    const lastName = body.lastName != null ? String(body.lastName).trim() : row.last_name;
    const notes = body.notes !== undefined ? String(body.notes ?? '').trim() || null : row.notes;
    const clash = await query(
      `SELECT id, email FROM ops.staff
       WHERE id <> $1 AND (email = $2 OR regexp_replace(phone, '\\D', '', 'g') = regexp_replace($3, '\\D', '', 'g'))`,
      [id, email, phone],
    );
    if (clash.rows[0]) {
      const sameMail = clash.rows[0].email === email;
      return c.json(
        { ok: false, error: sameMail ? 'E-mail déjà enregistré.' : 'Téléphone déjà enregistré.' },
        409,
      );
    }
    await query(
      `UPDATE ops.staff SET
         first_name = $2, last_name = $3, email = $4, phone = $5, role = $6,
         can_pick = $7, can_deliver = $8, store_id = $9, vehicle = $10, notes = $11
       WHERE id = $1`,
      [id, firstName, lastName, email, phone, nextRole, flags.canPick, flags.canDeliver, storeId, vehicle, notes],
    );
    const next = (await query<StaffRow>(`${staffSelect()} WHERE s.id = $1`, [id])).rows[0];
    return c.json({ ok: true, staff: publicHrStaff(next) });
  });

  app.post('/admin/staff/:id/disable', async (c) => {
    const gate = await requireHr(c, true);
    if (gate.error) return gate.error;
    const actor = gate.staff!;
    const id = c.req.param('id');
    if (id === actor.id) return c.json({ ok: false, error: 'Vous ne pouvez pas vous suspendre vous-même.' }, 400);
    const found = await query<StaffRow>(`${staffSelect()} WHERE s.id = $1`, [id]);
    const row = found.rows[0];
    if (!row) return c.json({ ok: false, error: 'Collaborateur introuvable.' }, 404);
    if (row.role === 'admin' && (await countAdmins()) <= 1) {
      return c.json({ ok: false, error: 'Impossible de suspendre le dernier administrateur.' }, 400);
    }
    if (actor.role === 'recruteur' && !RECRUITER_ROLES.has(row.role) && row.role !== 'both') {
      return c.json({ ok: false, error: 'Le recruteur ne peut suspendre que le personnel terrain.' }, 403);
    }
    await query(
      `UPDATE ops.staff SET is_active = FALSE, onboard_status = 'suspended' WHERE id = $1`,
      [id],
    );
    await query(`DELETE FROM ops.staff_sessions WHERE staff_id = $1`, [id]);
    const next = (await query<StaffRow>(`${staffSelect()} WHERE s.id = $1`, [id])).rows[0];
    return c.json({ ok: true, staff: publicHrStaff(next) });
  });

  app.post('/admin/staff/:id/enable', async (c) => {
    const gate = await requireHr(c, true);
    if (gate.error) return gate.error;
    const actor = gate.staff!;
    const id = c.req.param('id');
    const found = await query<StaffRow>(`${staffSelect()} WHERE s.id = $1`, [id]);
    const row = found.rows[0];
    if (!row) return c.json({ ok: false, error: 'Collaborateur introuvable.' }, 404);
    if (actor.role === 'recruteur' && !RECRUITER_ROLES.has(row.role) && row.role !== 'both') {
      return c.json({ ok: false, error: 'Le recruteur ne peut activer que le personnel terrain.' }, 403);
    }
    await query(
      `UPDATE ops.staff SET is_active = TRUE, onboard_status = 'active' WHERE id = $1`,
      [id],
    );
    const next = (await query<StaffRow>(`${staffSelect()} WHERE s.id = $1`, [id])).rows[0];
    return c.json({ ok: true, staff: publicHrStaff(next) });
  });

  app.post('/admin/staff/:id/reset-password', async (c) => {
    const gate = await requireHr(c, true);
    if (gate.error) return gate.error;
    const id = c.req.param('id');
    const found = await query<StaffRow>(`${staffSelect()} WHERE s.id = $1`, [id]);
    if (!found.rows[0]) return c.json({ ok: false, error: 'Collaborateur introuvable.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const temp = String(body?.temporaryPassword ?? '').trim() || `tmp-${randomBytes(4).toString('hex')}`;
    if (temp.length < 6) return c.json({ ok: false, error: 'Mot de passe trop court (6 caractères).' }, 400);
    await query(
      `UPDATE ops.staff SET password_hash = $2, must_reset_password = TRUE WHERE id = $1`,
      [id, await hashPassword(temp)],
    );
    await query(`DELETE FROM ops.staff_sessions WHERE staff_id = $1`, [id]);
    return c.json({ ok: true, temporaryPassword: temp });
  });

  app.post('/admin/staff/:id/documents', async (c) => {
    const gate = await requireHr(c, true);
    if (gate.error) return gate.error;
    const actor = gate.staff!;
    const id = c.req.param('id');
    const found = await query(`SELECT id FROM ops.staff WHERE id = $1`, [id]);
    if (!found.rows[0]) return c.json({ ok: false, error: 'Collaborateur introuvable.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const kind = String(body?.kind ?? 'autre');
    if (!['cip', 'permis', 'photo', 'contrat', 'autre'].includes(kind)) {
      return c.json({ ok: false, error: 'Type de document inconnu.' }, 400);
    }
    const docId = `doc-${randomBytes(4).toString('hex')}`;
    await query(
      `INSERT INTO ops.staff_documents (id, staff_id, kind, label, url_or_path, verified_at, verified_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        docId,
        id,
        kind,
        String(body?.label ?? '').trim() || null,
        String(body?.urlOrPath ?? '').trim() || null,
        body?.verified ? new Date().toISOString() : null,
        body?.verified ? actor.id : null,
      ],
    );
    const docs = await query(
      `SELECT id, kind, label, url_or_path, verified_at, verified_by, created_at
       FROM ops.staff_documents WHERE staff_id = $1 ORDER BY created_at DESC`,
      [id],
    );
    return c.json({
      ok: true,
      documents: docs.rows.map((d) => ({
        id: d.id,
        kind: d.kind,
        label: d.label,
        urlOrPath: d.url_or_path,
        verifiedAt: d.verified_at,
        verifiedBy: d.verified_by,
        createdAt: d.created_at,
      })),
    });
  });
}
