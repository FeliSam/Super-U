import type { Context, MiddlewareHandler } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

/**
 * Limitation de débit en mémoire pour les routes de connexion.
 * On compte les ÉCHECS (HTTP 401) par IP et par identifiant sur une fenêtre glissante.
 * Une connexion réussie remet à zéro le compteur de l'identifiant.
 * Mono-instance : suffisant pour le VPS actuel (un seul process Node).
 */
const WINDOW_MS = Math.max(60_000, Number(process.env.LOGIN_RATE_WINDOW_MS) || 15 * 60_000);
const MAX_PER_IDENTIFIER = Math.max(1, Number(process.env.LOGIN_RATE_MAX_PER_ID) || 8);
const MAX_PER_IP = Math.max(1, Number(process.env.LOGIN_RATE_MAX_PER_IP) || 30);

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 60_000);
sweeper.unref?.();

function current(key: string) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) return null;
  return bucket;
}

function hit(key: string) {
  const now = Date.now();
  const bucket = current(key);
  if (bucket) bucket.count += 1;
  else buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
}

export function clientIp(c: Context) {
  // Derrière Caddy : l'entrée la plus à droite de X-Forwarded-For est ajoutée par le proxy.
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1]!;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function readIdentifier(c: Context) {
  try {
    const body = (await c.req.raw.clone().json()) as Record<string, unknown> | null;
    const raw = body?.identifier ?? body?.email ?? body?.phone ?? '';
    const id = String(raw).trim().toLowerCase();
    if (!id) return '';
    if (id.includes('@')) return id;
    const digits = id.replace(/\D/g, '');
    return digits.slice(-8) || id;
  } catch {
    return '';
  }
}

export function loginRateLimit(scope: string): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method !== 'POST') return next();
    const ip = clientIp(c);
    const identifier = await readIdentifier(c);
    const ipKey = `${scope}:ip:${ip}`;
    const idKey = identifier ? `${scope}:id:${identifier}` : '';
    const ipBucket = current(ipKey);
    const idBucket = idKey ? current(idKey) : null;
    const blocked =
      (ipBucket && ipBucket.count >= MAX_PER_IP ? ipBucket : null) ??
      (idBucket && idBucket.count >= MAX_PER_IDENTIFIER ? idBucket : null);
    if (blocked) {
      const retrySec = Math.max(1, Math.ceil((blocked.resetAt - Date.now()) / 1000));
      c.header('Retry-After', String(retrySec));
      return c.json(
        {
          ok: false,
          code: 'rate_limited',
          error: `Trop de tentatives de connexion. Réessayez dans ${Math.ceil(retrySec / 60)} min.`,
        },
        429,
      );
    }
    await next();
    const status = c.res.status;
    if (status === 401) {
      hit(ipKey);
      if (idKey) hit(idKey);
    } else if (status >= 200 && status < 300 && idKey) {
      buckets.delete(idKey);
    }
  };
}
