import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

/** Bump when adding a migration block below. */
export const LOCAL_DB_VERSION = 1;

/**
 * Local SQLite (on-device / browser). Postgres stays off this app:
 * you host it yourself later and the server talks to it — not Expo.
 */
export async function migrateLocalDb(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= LOCAL_DB_VERSION) return;

  if (version === 0) {
    if (Platform.OS !== 'web') {
      await db.execAsync(`PRAGMA journal_mode = WAL;`);
    }
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cart_lines (
  product_id TEXT PRIMARY KEY NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);
    version = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${LOCAL_DB_VERSION}`);
}
