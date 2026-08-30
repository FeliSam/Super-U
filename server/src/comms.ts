import type { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { query } from './db.ts';
import { notifyStaff, markStaffCallNotifsRead } from './ops.ts';

type StaffRow = { id: string };
type UserRow = { id: string };

type Actor =
  | { kind: 'staff'; staffId: string; userId?: undefined }
  | { kind: 'customer'; userId: string; staffId?: undefined };

function bearer(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

async function actorFromToken(token: string | undefined): Promise<Actor | null> {
  if (!token) return null;
  const staff = await query<StaffRow>(
    `SELECT s.id FROM ops.staff_sessions sess
     JOIN ops.staff s ON s.id = sess.staff_id
     WHERE sess.token = $1 AND s.is_active = TRUE`,
    [token],
  );
  if (staff.rows[0]) return { kind: 'staff', staffId: staff.rows[0].id };
  const user = await query<UserRow>(
    `SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1`,
    [token],
  );
  if (user.rows[0]) return { kind: 'customer', userId: user.rows[0].id };
  return null;
}

async function assertMember(threadId: string, actor: Actor) {
  const found = await query<{ ok: number }>(
    actor.kind === 'staff'
      ? `SELECT 1 AS ok FROM comms.thread_members WHERE thread_id = $1 AND staff_id = $2`
      : `SELECT 1 AS ok FROM comms.thread_members WHERE thread_id = $1 AND user_id = $2`,
    actor.kind === 'staff' ? [threadId, actor.staffId] : [threadId, actor.userId],
  );
  return Boolean(found.rows[0]);
}

async function otherMember(threadId: string, actor: Actor) {
  const members = await query<{
    actor_kind: string;
    user_id: string | null;
    staff_id: string | null;
  }>(`SELECT actor_kind, user_id, staff_id FROM comms.thread_members WHERE thread_id = $1`, [
    threadId,
  ]);
  return members.rows.find((m) => {
    if (actor.kind === 'staff') return m.staff_id !== actor.staffId && m.actor_kind !== 'system';
    return m.user_id !== actor.userId && m.actor_kind !== 'system';
  });
}

async function ensureCallPeer(threadId: string, actor: Actor) {
  const th = await query<{ order_id: string | null }>(
    `SELECT order_id FROM comms.threads WHERE id = $1`,
    [threadId],
  );
  const orderId = th.rows[0]?.order_id;
  if (orderId) {
    const courier = await query<{ courier_id: string | null }>(
      `SELECT courier_id FROM ops.deliveries
       WHERE order_id = $1 AND courier_id IS NOT NULL
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`,
      [orderId],
    );
    if (courier.rows[0]?.courier_id) {
      await query(`SELECT comms.ensure_courier_thread($1, $2)`, [orderId, courier.rows[0].courier_id]);
    } else {
      const uid = await query<{ user_id: string | null }>(
        `SELECT user_id FROM orders WHERE id = $1`,
        [orderId],
      );
      if (uid.rows[0]?.user_id) {
        await query(
          `INSERT INTO comms.thread_members (thread_id, actor_kind, user_id)
           SELECT $1, 'customer', $2
           WHERE NOT EXISTS (
             SELECT 1 FROM comms.thread_members m WHERE m.thread_id = $1 AND m.user_id = $2
           )`,
          [threadId, uid.rows[0].user_id],
        );
      }
    }
  }
  if (actor.kind === 'staff') {
    const customer = await query<{
      actor_kind: string;
      user_id: string | null;
      staff_id: string | null;
    }>(
      `SELECT actor_kind, user_id, staff_id FROM comms.thread_members
       WHERE thread_id = $1 AND actor_kind = 'customer' LIMIT 1`,
      [threadId],
    );
    return customer.rows[0] ?? otherMember(threadId, actor);
  }
  const staff = await query<{
    actor_kind: string;
    user_id: string | null;
    staff_id: string | null;
  }>(
    `SELECT actor_kind, user_id, staff_id FROM comms.thread_members
     WHERE thread_id = $1 AND actor_kind = 'staff' LIMIT 1`,
    [threadId],
  );
  return staff.rows[0] ?? otherMember(threadId, actor);
}

function threadParam(raw: string | undefined) {
  try {
    return decodeURIComponent(raw ?? '');
  } catch {
    return raw ?? '';
  }
}

async function liveCallRow(actor: Actor) {
  const result =
    actor.kind === 'staff'
      ? await query(
          `SELECT c.*,
             CASE WHEN c.caller_staff_id = $1 THEN 'caller' ELSE 'callee' END AS role,
             COALESCE(
               NULLIF(trim(both ' ' FROM coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''),
               NULLIF(trim(both ' ' FROM coalesce(s.first_name,'') || ' ' || coalesce(s.last_name,'')), ''),
               'Contact'
             ) AS peer_name
           FROM comms.calls c
           LEFT JOIN users u ON u.id = CASE
             WHEN c.caller_staff_id = $1 THEN c.callee_user_id ELSE c.caller_user_id END
           LEFT JOIN ops.staff s ON s.id = CASE
             WHEN c.caller_staff_id = $1 THEN c.callee_staff_id ELSE c.caller_staff_id END
           WHERE c.status IN ('initiated', 'ringing', 'accepted')
             AND (c.caller_staff_id = $1 OR c.callee_staff_id = $1)
           ORDER BY c.started_at DESC
           LIMIT 1`,
          [actor.staffId],
        )
      : await query(
          `SELECT c.*,
             CASE WHEN c.caller_user_id = $1 THEN 'caller' ELSE 'callee' END AS role,
             COALESCE(
               NULLIF(trim(both ' ' FROM coalesce(s.first_name,'') || ' ' || coalesce(s.last_name,'')), ''),
               NULLIF(trim(both ' ' FROM coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''),
               'Coursier'
             ) AS peer_name
           FROM comms.calls c
           LEFT JOIN ops.staff s ON s.id = CASE
             WHEN c.caller_user_id = $1 THEN c.callee_staff_id ELSE c.caller_staff_id END
           LEFT JOIN users u ON u.id = CASE
             WHEN c.caller_user_id = $1 THEN c.callee_user_id ELSE c.caller_user_id END
           WHERE c.status IN ('initiated', 'ringing', 'accepted')
             AND (c.caller_user_id = $1 OR c.callee_user_id = $1)
           ORDER BY c.started_at DESC
           LIMIT 1`,
          [actor.userId],
        );
  return result.rows[0] ?? null;
}

async function isThreadDisabled(threadId: string) {
  const found = await query<{ disabled_at: Date | null; archived_at: Date | null }>(
    `SELECT disabled_at, archived_at FROM comms.threads WHERE id = $1`,
    [threadId],
  );
  return Boolean(found.rows[0]?.disabled_at || found.rows[0]?.archived_at);
}

export async function archiveDeliveredCourierThreads() {
  await query(`SELECT comms.archive_delivered_courier_threads()`);
}

async function ensureCustomerSupport(userId: string) {
  const row = await query<{ tid: string }>(
    `SELECT comms.ensure_support_thread($1) AS tid`,
    [userId],
  );
  const id = row.rows[0]?.tid;
  if (!id) return null;
  const existing = await query<{ id: string }>(
    `SELECT id FROM comms.messages WHERE thread_id = $1 LIMIT 1`,
    [id],
  );
  if (!existing.rows[0]) {
    await query(
      `INSERT INTO comms.messages (id, thread_id, sender_kind, kind, body)
       VALUES ($1, $2, 'system', 'system', $3)
       ON CONFLICT (id) DO NOTHING`,
      [
        `msg-welcome-${userId}`,
        id,
        'Bonjour, bienvenue sur l’assistance Marché Doré. Que pouvons-nous faire pour vous ?',
      ],
    );
  }
  return id;
}

export function registerCommsRoutes(app: Hono) {
  app.get('/comms/inbox', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    await archiveDeliveredCourierThreads().catch(() => undefined);
    if (actor.kind === 'customer') {
      await ensureCustomerSupport(actor.userId).catch(() => undefined);
    }
    const result = await query(
      actor.kind === 'staff'
        ? `SELECT i.*, tm.last_read_at,
             CASE WHEN i.last_at IS NULL THEN 0
                  WHEN tm.last_read_at IS NULL THEN 1
                  WHEN i.last_at > tm.last_read_at THEN 1 ELSE 0 END AS unread,
             cu.first_name AS peer_first, cu.last_name AS peer_last, cu.phone AS peer_phone
           FROM comms.v_inbox i
           JOIN comms.thread_members tm ON tm.thread_id = i.id AND tm.staff_id = $1
           LEFT JOIN comms.thread_members cm ON cm.thread_id = i.id AND cm.actor_kind = 'customer'
           LEFT JOIN users cu ON cu.id = cm.user_id
           ORDER BY i.updated_at DESC`
        : `SELECT i.*, tm.last_read_at,
             CASE WHEN i.last_at IS NULL THEN 0
                  WHEN tm.last_read_at IS NULL THEN 1
                  WHEN i.last_at > tm.last_read_at THEN 1 ELSE 0 END AS unread,
             COALESCE(cs.first_name, s.first_name) AS peer_first,
             COALESCE(cs.last_name, s.last_name) AS peer_last,
             COALESCE(cs.phone, s.phone) AS peer_phone,
             COALESCE(cs.id, s.id) AS peer_staff_id,
             (COALESCE(cs.photo_data, s.photo_data) IS NOT NULL) AS peer_has_photo
           FROM comms.v_inbox i
           JOIN comms.thread_members tm ON tm.thread_id = i.id AND tm.user_id = $1
           LEFT JOIN ops.deliveries d ON d.order_id = i.order_id
           LEFT JOIN ops.staff cs ON cs.id = d.courier_id
           LEFT JOIN comms.thread_members sm ON sm.thread_id = i.id AND sm.actor_kind = 'staff'
           LEFT JOIN ops.staff s ON s.id = sm.staff_id
           ORDER BY i.updated_at DESC`,
      [actor.kind === 'staff' ? actor.staffId : actor.userId],
    );
    return c.json({ ok: true, threads: result.rows });
  });

  app.post('/comms/support/ensure', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor || actor.kind !== 'customer') return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = await ensureCustomerSupport(actor.userId);
    if (!id) return c.json({ ok: false, error: 'unavailable' }, 500);
    return c.json({ ok: true, id });
  });

  app.get('/comms/threads/:id', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = threadParam(c.req.param('id'));
    if (!(await assertMember(id, actor))) return c.json({ ok: false, error: 'forbidden' }, 403);
    const thread = await query(`SELECT * FROM comms.threads WHERE id = $1`, [id]);
    if (!thread.rows[0]) return c.json({ ok: false, error: 'not_found' }, 404);
    const members = await query(
      `SELECT tm.actor_kind, tm.user_id, tm.staff_id,
              u.first_name AS user_first, u.last_name AS user_last,
              s.first_name AS staff_first, s.last_name AS staff_last,
              (COALESCE(u.photo_data, NULLIF(st.payload->>'photoUri', '')) IS NOT NULL) AS user_has_photo,
              (s.photo_data IS NOT NULL AND length(s.photo_data) > 20) AS staff_has_photo
       FROM comms.thread_members tm
       LEFT JOIN users u ON u.id = tm.user_id
       LEFT JOIN user_state st ON st.user_id = tm.user_id
       LEFT JOIN ops.staff s ON s.id = tm.staff_id
       WHERE tm.thread_id = $1`,
      [id],
    );
    return c.json({ ok: true, thread: thread.rows[0], members: members.rows });
  });

  app.get('/comms/threads/:id/messages', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = threadParam(c.req.param('id'));
    if (!(await assertMember(id, actor))) return c.json({ ok: false, error: 'forbidden' }, 403);
    const before = c.req.query('before');
    const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') ?? 50)));
    const result = await query(
      before
        ? `SELECT * FROM comms.messages WHERE thread_id = $1 AND created_at < $2
           ORDER BY created_at DESC, id DESC LIMIT $3`
        : `SELECT * FROM comms.messages WHERE thread_id = $1
           ORDER BY created_at DESC, id DESC LIMIT $2`,
      before ? [id, before, limit] : [id, limit],
    );
    return c.json({ ok: true, messages: result.rows.reverse() });
  });

  app.post('/comms/threads/:id/messages', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = threadParam(c.req.param('id'));
    if (!(await assertMember(id, actor))) return c.json({ ok: false, error: 'forbidden' }, 403);
    if (await isThreadDisabled(id)) {
      return c.json({ ok: false, error: 'Conversation désactivée.' }, 409);
    }
    const body = await c.req.json().catch(() => null);
    const kind = body?.kind === 'image' ? 'image' : 'text';
    const text = String(body?.body ?? '').trim();
    if (!text) return c.json({ ok: false, error: 'Message vide.' }, 400);
    const msgId = `msg-${randomUUID()}`;
    await query(
      `INSERT INTO comms.messages (id, thread_id, sender_kind, sender_user_id, sender_staff_id, kind, body, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        msgId,
        id,
        actor.kind,
        actor.kind === 'customer' ? actor.userId : null,
        actor.kind === 'staff' ? actor.staffId : null,
        kind,
        text,
        JSON.stringify(body?.payload ?? {}),
      ],
    );
    const row = await query(`SELECT * FROM comms.messages WHERE id = $1`, [msgId]);
    if (actor.kind === 'customer') {
      const members = await query<{ staff_id: string }>(
        `SELECT staff_id FROM comms.thread_members WHERE thread_id = $1 AND staff_id IS NOT NULL`,
        [id],
      );
      const th = await query<{ order_id: string | null }>(
        `SELECT order_id FROM comms.threads WHERE id = $1`,
        [id],
      );
      const who = await query<{ first_name: string | null }>(
        `SELECT first_name FROM users WHERE id = $1`,
        [actor.userId],
      );
      const name = who.rows[0]?.first_name?.trim() || 'Un client';
      for (const m of members.rows) {
        await notifyStaff({
          staffId: m.staff_id,
          kind: 'chat',
          title: `${name} vous a écrit`,
          body: text.slice(0, 160),
          href: `/chat/${encodeURIComponent(id)}`,
          orderId: th.rows[0]?.order_id ?? null,
          id: `ntf-msg-${msgId}-${m.staff_id}`,
        });
      }
    }
    return c.json({ ok: true, message: row.rows[0] });
  });

  app.post('/comms/threads/:id/read', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = threadParam(c.req.param('id'));
    if (!(await assertMember(id, actor))) return c.json({ ok: false, error: 'forbidden' }, 403);
    await query(
      actor.kind === 'staff'
        ? `UPDATE comms.thread_members SET last_read_at = NOW() WHERE thread_id = $1 AND staff_id = $2`
        : `UPDATE comms.thread_members SET last_read_at = NOW() WHERE thread_id = $1 AND user_id = $2`,
      actor.kind === 'staff' ? [id, actor.staffId] : [id, actor.userId],
    );
    return c.json({ ok: true });
  });

  app.post('/comms/threads/:id/disable', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = threadParam(c.req.param('id'));
    if (!(await assertMember(id, actor))) return c.json({ ok: false, error: 'forbidden' }, 403);
    await query(
      `UPDATE comms.calls SET status = 'canceled', ended_at = COALESCE(ended_at, NOW()), end_reason = 'thread_disabled'
       WHERE thread_id = $1 AND status IN ('initiated', 'ringing', 'accepted')`,
      [id],
    );
    await query(
      `UPDATE comms.threads SET disabled_at = NOW(), disabled_by = $2, updated_at = NOW() WHERE id = $1`,
      [id, actor.kind],
    );
    await query(
      `INSERT INTO comms.messages (id, thread_id, sender_kind, sender_user_id, sender_staff_id, kind, body, payload)
       VALUES ($1, $2, 'system', NULL, NULL, 'system', $3, '{}'::jsonb)`,
      [`msg-${randomUUID()}`, id, 'Conversation désactivée'],
    );
    return c.json({ ok: true, disabled: true });
  });

  app.post('/comms/threads/:id/enable', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = threadParam(c.req.param('id'));
    if (!(await assertMember(id, actor))) return c.json({ ok: false, error: 'forbidden' }, 403);
    const st = await query<{ archived_at: Date | null }>(
      `SELECT archived_at FROM comms.threads WHERE id = $1`,
      [id],
    );
    if (st.rows[0]?.archived_at) {
      return c.json({ ok: false, error: 'Conversation archivée.' }, 409);
    }
    await query(
      `UPDATE comms.threads SET disabled_at = NULL, disabled_by = NULL, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    await query(
      `INSERT INTO comms.messages (id, thread_id, sender_kind, sender_user_id, sender_staff_id, kind, body, payload)
       VALUES ($1, $2, 'system', NULL, NULL, 'system', $3, '{}'::jsonb)`,
      [`msg-${randomUUID()}`, id, 'Conversation réactivée'],
    );
    return c.json({ ok: true, disabled: false });
  });

  app.post('/comms/threads/:id/calls', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = threadParam(c.req.param('id'));
    let orderHint = await query<{ order_id: string | null }>(
      `SELECT order_id FROM comms.threads WHERE id = $1`,
      [id],
    );
    if (!orderHint.rows[0] && id.startsWith('courier-')) {
      const suffix = id.slice('courier-'.length);
      const order = await query<{ id: string }>(
        `SELECT id FROM orders WHERE id = $1 OR replace(id, '#', '') = $1 LIMIT 1`,
        [suffix],
      );
      if (order.rows[0]) {
        const courier = await query<{ courier_id: string | null }>(
          `SELECT courier_id FROM ops.deliveries WHERE order_id = $1 AND courier_id IS NOT NULL LIMIT 1`,
          [order.rows[0].id],
        );
        if (courier.rows[0]?.courier_id) {
          await query(`SELECT comms.ensure_courier_thread($1, $2)`, [
            order.rows[0].id,
            courier.rows[0].courier_id,
          ]);
        }
        orderHint = await query<{ order_id: string | null }>(
          `SELECT order_id FROM comms.threads WHERE id = $1`,
          [id],
        );
      }
    }
    if (orderHint.rows[0]?.order_id) {
      const courier = await query<{ courier_id: string | null }>(
        `SELECT courier_id FROM ops.deliveries WHERE order_id = $1`,
        [orderHint.rows[0].order_id],
      );
      if (courier.rows[0]?.courier_id) {
        await query(`SELECT comms.ensure_courier_thread($1, $2)`, [
          orderHint.rows[0].order_id,
          courier.rows[0].courier_id,
        ]);
      }
    }
    if (!(await assertMember(id, actor))) return c.json({ ok: false, error: 'forbidden' }, 403);
    if (await isThreadDisabled(id)) {
      return c.json({ ok: false, error: 'Conversation désactivée.' }, 409);
    }
    const body = await c.req.json().catch(() => null);
    const media = body?.media === 'video' ? 'video' : 'audio';
    const peer = await ensureCallPeer(id, actor);
    if (!peer || (peer.actor_kind !== 'customer' && peer.actor_kind !== 'staff')) {
      return c.json({ ok: false, error: 'Destinataire introuvable.' }, 400);
    }
    const thread = await query<{ order_id: string | null }>(
      `SELECT order_id FROM comms.threads WHERE id = $1`,
      [id],
    );
    await query(
      `UPDATE comms.calls
       SET status = 'missed', ended_at = COALESCE(ended_at, NOW()), end_reason = COALESCE(end_reason, 'stale')
       WHERE thread_id = $1
         AND status IN ('initiated', 'ringing')
         AND started_at < NOW() - INTERVAL '28 seconds'`,
      [id],
    );
    const live = await query<{
      id: string;
      status: string;
      caller_kind: string;
      caller_user_id: string | null;
      caller_staff_id: string | null;
    }>(
      `SELECT * FROM comms.calls
       WHERE thread_id = $1 AND status IN ('initiated', 'ringing', 'accepted')
       ORDER BY started_at DESC LIMIT 1`,
      [id],
    );
    const open = live.rows[0];
    if (open) {
      const mine =
        (actor.kind === 'staff' && open.caller_staff_id === actor.staffId) ||
        (actor.kind === 'customer' && open.caller_user_id === actor.userId);
      if (mine && open.status !== 'accepted') {
        const row = await query(`SELECT * FROM comms.calls WHERE id = $1`, [open.id]);
        return c.json({ ok: true, call: row.rows[0] });
      }
      if (mine && open.status === 'accepted') {
        const row = await query(`SELECT * FROM comms.calls WHERE id = $1`, [open.id]);
        return c.json({ ok: true, call: row.rows[0] });
      }
      return c.json({ ok: false, error: 'Un appel est déjà en cours.' }, 409);
    }
    const callId = `call-${randomUUID()}`;
    await query(
      `INSERT INTO comms.calls (
         id, thread_id, order_id,
         caller_kind, caller_user_id, caller_staff_id,
         callee_kind, callee_user_id, callee_staff_id,
         media, status, ringing_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'initiated', NOW())`,
      [
        callId,
        id,
        thread.rows[0]?.order_id ?? null,
        actor.kind,
        actor.kind === 'customer' ? actor.userId : null,
        actor.kind === 'staff' ? actor.staffId : null,
        peer.actor_kind,
        peer.user_id,
        peer.staff_id,
        media,
      ],
    );
    await query(`UPDATE comms.calls SET status = 'ringing' WHERE id = $1`, [callId]);
    if (peer.actor_kind === 'staff' && peer.staff_id) {
      await notifyStaff({
        staffId: peer.staff_id,
        kind: 'call',
        title: 'Appel entrant',
        body: 'Un client vous appelle dans l’app.',
        href: `/chat/${encodeURIComponent(id)}`,
        orderId: thread.rows[0]?.order_id ?? null,
        id: `ntf-call-${callId}`,
      });
    }
    return c.json({ ok: true, call: await liveCallRow(actor) });
  });

  app.get('/comms/live', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    return c.json({ ok: true, call: await liveCallRow(actor) });
  });

  app.get('/comms/ringing', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const result = await query(
      actor.kind === 'staff'
        ? `SELECT c.*,
             trim(both ' ' FROM coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) AS peer_name
           FROM comms.calls c
           LEFT JOIN users u ON u.id = c.caller_user_id
           WHERE c.status IN ('initiated', 'ringing')
             AND c.callee_staff_id = $1
           ORDER BY c.started_at DESC
           LIMIT 1`
        : `SELECT c.*,
             trim(both ' ' FROM coalesce(s.first_name,'') || ' ' || coalesce(s.last_name,'')) AS peer_name
           FROM comms.calls c
           LEFT JOIN ops.staff s ON s.id = c.caller_staff_id
           WHERE c.status IN ('initiated', 'ringing')
             AND c.callee_user_id = $1
           ORDER BY c.started_at DESC
           LIMIT 1`,
      [actor.kind === 'staff' ? actor.staffId : actor.userId],
    );
    return c.json({ ok: true, call: result.rows[0] ?? null });
  });

  app.get('/comms/calls/:id', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = c.req.param('id');
    const row = await query<{ thread_id: string }>(`SELECT * FROM comms.calls WHERE id = $1`, [id]);
    if (!row.rows[0]) return c.json({ ok: false, error: 'not_found' }, 404);
    if (!(await assertMember(row.rows[0].thread_id, actor))) {
      return c.json({ ok: false, error: 'forbidden' }, 403);
    }
    return c.json({ ok: true, call: row.rows[0] });
  });

  async function patchCall(
    callId: string,
    actor: Actor,
    next: { status: string; reason?: string; stamp?: string },
  ) {
    const found = await query<{
      thread_id: string;
      status: string;
      caller_kind: string;
      caller_staff_id: string | null;
      caller_user_id: string | null;
      callee_kind: string;
      callee_staff_id: string | null;
      callee_user_id: string | null;
    }>(`SELECT * FROM comms.calls WHERE id = $1`, [callId]);
    const call = found.rows[0];
    if (!call) return { error: 'not_found', status: 404 as const };
    if (!(await assertMember(call.thread_id, actor))) return { error: 'forbidden', status: 403 as const };
    const stampSql = next.stamp ? `, ${next.stamp} = NOW()` : '';
    await query(
      `UPDATE comms.calls SET status = $2, end_reason = COALESCE($3, end_reason), ended_at = CASE
         WHEN $2 IN ('rejected','canceled','missed','ended','failed') THEN COALESCE(ended_at, NOW()) ELSE ended_at END
         ${stampSql}
       WHERE id = $1`,
      [callId, next.status, next.reason ?? null],
    );
    const row = await query(`SELECT * FROM comms.calls WHERE id = $1`, [callId]);
    const staffIds = [call.caller_staff_id, call.callee_staff_id].filter(Boolean) as string[];
    for (const sid of staffIds) {
      await markStaffCallNotifsRead(sid, callId);
    }
    return { call: row.rows[0], prev: call };
  }

  app.post('/comms/calls/:id/accept', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const result = await patchCall(c.req.param('id'), actor, { status: 'accepted', stamp: 'answered_at' });
    if ('error' in result && result.error) return c.json({ ok: false, error: result.error }, result.status);
    return c.json({ ok: true, call: result.call });
  });

  app.post('/comms/calls/:id/reject', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const result = await patchCall(c.req.param('id'), actor, { status: 'rejected' });
    if ('error' in result && result.error) return c.json({ ok: false, error: result.error }, result.status);
    return c.json({ ok: true, call: result.call });
  });

  app.post('/comms/calls/:id/cancel', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const result = await patchCall(c.req.param('id'), actor, { status: 'canceled' });
    if ('error' in result && result.error) return c.json({ ok: false, error: result.error }, result.status);
    return c.json({ ok: true, call: result.call });
  });

  app.post('/comms/calls/:id/hangup', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const found = await query<{ status: string; thread_id: string }>(
      `SELECT status, thread_id FROM comms.calls WHERE id = $1`,
      [c.req.param('id')],
    );
    const prev = found.rows[0];
    if (!prev) return c.json({ ok: false, error: 'not_found' }, 404);
    const status = prev.status === 'accepted' ? 'ended' : prev.status === 'ringing' || prev.status === 'initiated' ? 'missed' : 'ended';
    const result = await patchCall(c.req.param('id'), actor, { status });
    if ('error' in result && result.error) return c.json({ ok: false, error: result.error }, result.status);
    return c.json({ ok: true, call: result.call });
  });

  app.post('/comms/calls/:id/signals', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = c.req.param('id');
    const call = await query<{ thread_id: string }>(`SELECT thread_id FROM comms.calls WHERE id = $1`, [id]);
    if (!call.rows[0]) return c.json({ ok: false, error: 'not_found' }, 404);
    if (!(await assertMember(call.rows[0].thread_id, actor))) {
      return c.json({ ok: false, error: 'forbidden' }, 403);
    }
    const body = await c.req.json().catch(() => null);
    const signalType = String(body?.signalType ?? '');
    const allowed = ['offer', 'answer', 'ice', 'hangup', 'reject'];
    if (!allowed.includes(signalType)) return c.json({ ok: false, error: 'Signal invalide.' }, 400);
    await query(
      `INSERT INTO comms.call_signals (call_id, sender_kind, sender_user_id, sender_staff_id, signal_type, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        id,
        actor.kind,
        actor.kind === 'customer' ? actor.userId : null,
        actor.kind === 'staff' ? actor.staffId : null,
        signalType,
        JSON.stringify(body?.payload ?? {}),
      ],
    );
    return c.json({ ok: true });
  });

  app.get('/comms/calls/:id/signals', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const id = c.req.param('id');
    const call = await query<{ thread_id: string }>(`SELECT thread_id FROM comms.calls WHERE id = $1`, [id]);
    if (!call.rows[0]) return c.json({ ok: false, error: 'not_found' }, 404);
    if (!(await assertMember(call.rows[0].thread_id, actor))) {
      return c.json({ ok: false, error: 'forbidden' }, 403);
    }
    const afterId = Number(c.req.query('afterId') ?? 0);
    const result = await query(
      `SELECT * FROM comms.call_signals WHERE call_id = $1 AND id > $2 ORDER BY id ASC`,
      [id, Number.isFinite(afterId) ? afterId : 0],
    );
    return c.json({ ok: true, signals: result.rows });
  });

  app.post('/comms/devices', async (c) => {
    const actor = await actorFromToken(bearer(c.req.header('Authorization')));
    if (!actor) return c.json({ ok: false, error: 'unauthorized' }, 401);
    const body = await c.req.json().catch(() => null);
    const platform = String(body?.platform ?? 'web');
    if (!['ios', 'android', 'web'].includes(platform)) {
      return c.json({ ok: false, error: 'Plateforme invalide.' }, 400);
    }
    const id =
      actor.kind === 'staff' ? `dev-staff-${actor.staffId}-${platform}` : `dev-user-${actor.userId}-${platform}`;
    await query(
      `INSERT INTO comms.devices (id, actor_kind, user_id, staff_id, platform, push_token, voip_token, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
       ON CONFLICT (id) DO UPDATE SET
         push_token = EXCLUDED.push_token,
         voip_token = EXCLUDED.voip_token,
         updated_at = NOW()`,
      [
        id,
        actor.kind,
        actor.kind === 'customer' ? actor.userId : null,
        actor.kind === 'staff' ? actor.staffId : null,
        platform,
        typeof body?.pushToken === 'string' ? body.pushToken : null,
        typeof body?.voipToken === 'string' ? body.voipToken : null,
      ],
    );
    return c.json({ ok: true });
  });
}
