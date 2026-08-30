import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

export const LOCAL_DB_NAME = 'marche-dore.db';

/** Bump when adding a migration block below. */
export const LOCAL_DB_VERSION = 2;

export async function migrateLocalDb(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version === 0) {
    if (Platform.OS !== 'web') {
      await db.execAsync(`PRAGMA journal_mode = WAL;`);
    }
    version = 1;
  }

  if (version < 2) {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_products (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_categories (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_stores (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_thread_messages (
  conversation_id TEXT NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (conversation_id, id)
);
CREATE TABLE IF NOT EXISTS catalog_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_banners (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_chips (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL
);
`);
    version = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${LOCAL_DB_VERSION}`);
}
