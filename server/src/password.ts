import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, saltHex, hashHex] = stored.split(':');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const hash = (await scrypt(password, Buffer.from(saltHex, 'hex'), 64)) as Buffer;
  const expected = Buffer.from(hashHex, 'hex');
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

export function newToken() {
  return randomBytes(32).toString('hex');
}

export function newUserId() {
  return `u-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}
