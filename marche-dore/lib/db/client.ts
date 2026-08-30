import * as SQLite from 'expo-sqlite';
import { LOCAL_DB_NAME, migrateLocalDb } from '@/lib/db/migrate';
import { seedCatalog } from '@/lib/db/seed';
import { hydrateCatalogFromDb } from '@/lib/db/hydrateCatalog';

export { LOCAL_DB_NAME, migrateLocalDb, LOCAL_DB_VERSION } from '@/lib/db/migrate';

let db: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase | null> | null = null;

export async function getLocalDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (db) return db;
  if (!opening) {
    opening = (async () => {
      try {
        const instance = await SQLite.openDatabaseAsync(LOCAL_DB_NAME);
        await migrateLocalDb(instance);
        await seedCatalog(instance);
        await hydrateCatalogFromDb(instance);
        db = instance;
        return instance;
      } catch (error) {
        console.warn('[sqlite]', error);
        return null;
      }
    })();
  }
  return opening;
}
