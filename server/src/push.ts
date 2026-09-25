import { query } from './db.ts';

export type ExpoPushMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
};

type DeviceRow = { id: string; push_token: string };

async function tokensForStaff(staffId: string): Promise<DeviceRow[]> {
  const res = await query<DeviceRow>(
    `SELECT id, push_token FROM comms.devices
     WHERE staff_id = $1 AND push_token IS NOT NULL AND length(trim(push_token)) > 0`,
    [staffId],
  );
  return res.rows;
}

async function tokensForUser(userId: string): Promise<DeviceRow[]> {
  const res = await query<DeviceRow>(
    `SELECT id, push_token FROM comms.devices
     WHERE user_id = $1 AND push_token IS NOT NULL AND length(trim(push_token)) > 0`,
    [userId],
  );
  return res.rows;
}

async function clearInvalidTokens(tokens: string[]) {
  if (!tokens.length) return;
  await query(`UPDATE comms.devices SET push_token = NULL, updated_at = NOW() WHERE push_token = ANY($1::text[])`, [
    tokens,
  ]).catch(() => undefined);
}

/** Send Expo push messages; best-effort, never throws to callers. */
export async function sendExpoPush(messages: ExpoPushMessage[]) {
  const valid = messages.filter((m) => typeof m.to === 'string' && m.to.startsWith('ExponentPushToken['));
  if (!valid.length) return;

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(valid),
    });
    if (!res.ok) return;
    const json = (await res.json().catch(() => null)) as {
      data?: { status?: string; details?: { error?: string }; message?: string }[];
    } | null;
    const tickets = Array.isArray(json?.data) ? json!.data! : [];
    const dead: string[] = [];
    tickets.forEach((t, i) => {
      if (t?.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
        dead.push(valid[i]!.to);
      }
    });
    if (dead.length) await clearInvalidTokens(dead);
  } catch {
    /* network / expo host — ignore */
  }
}

export async function pushToStaff(
  staffId: string,
  payload: { title: string; body?: string; href?: string | null; kind?: string },
) {
  const devices = await tokensForStaff(staffId);
  if (!devices.length) return;
  await sendExpoPush(
    devices.map((d) => ({
      to: d.push_token,
      title: payload.title,
      body: payload.body,
      sound: 'default',
      channelId: 'default',
      priority: 'high',
      data: {
        href: payload.href ?? '/notifications',
        kind: payload.kind ?? 'staff',
      },
    })),
  );
}

export async function pushToUser(
  userId: string,
  payload: { title: string; body?: string; href?: string | null; kind?: string },
) {
  const devices = await tokensForUser(userId);
  if (!devices.length) return;
  await sendExpoPush(
    devices.map((d) => ({
      to: d.push_token,
      title: payload.title,
      body: payload.body,
      sound: 'default',
      channelId: 'default',
      priority: 'high',
      data: {
        href: payload.href ?? '/notifications',
        kind: payload.kind ?? 'order',
      },
    })),
  );
}
