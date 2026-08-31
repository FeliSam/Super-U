import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

export const LOCAL_DB_NAME = 'marche-dore.db';

/** Bump when adding a migration block below. */
export const LOCAL_DB_VERSION = 3;

async function addColumnIfMissing(
  db: SQLiteDatabase,
  table: string,
  column: string,
  declaration: string,
) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((row) => row.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
  }
}

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

  if (version < 3) {
    await addColumnIfMissing(db, 'catalog_products', 'updated_at', 'TEXT');
    await addColumnIfMissing(db, 'catalog_products', 'deleted_at', 'TEXT');
    await addColumnIfMissing(db, 'catalog_products', 'image_url', 'TEXT');
    await addColumnIfMissing(db, 'catalog_products', 'available_qty', 'INTEGER');
    await addColumnIfMissing(db, 'catalog_products', 'sku', 'TEXT');
    await addColumnIfMissing(db, 'catalog_products', 'barcode', 'TEXT');
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS catalog_meta (
  store_id TEXT PRIMARY KEY NOT NULL,
  revision TEXT,
  updated_at TEXT,
  synced_at TEXT
);
CREATE TABLE IF NOT EXISTS catalog_inventory (
  store_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  available_qty INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  PRIMARY KEY (store_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_catalog_products_category
  ON catalog_products(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_updated
  ON catalog_products(updated_at);
CREATE INDEX IF NOT EXISTS idx_catalog_products_sku
  ON catalog_products(sku);
CREATE INDEX IF NOT EXISTS idx_catalog_products_barcode
  ON catalog_products(barcode);
CREATE INDEX IF NOT EXISTS idx_catalog_products_name
  ON catalog_products(json_extract(payload, '$.name'));
CREATE INDEX IF NOT EXISTS idx_catalog_inventory_store
  ON catalog_inventory(store_id, product_id);
`);
    version = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${LOCAL_DB_VERSION}`);
}
