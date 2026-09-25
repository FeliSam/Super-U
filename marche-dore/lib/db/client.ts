import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { LOCAL_DB_NAME, migrateLocalDb } from '@/lib/db/migrate';
import { seedCatalog } from '@/lib/db/seed';

export { LOCAL_DB_NAME, migrateLocalDb, LOCAL_DB_VERSION } from '@/lib/db/migrate';

let db: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase | null> | null = null;

function webStorageOk() {
  if (Platform.OS !== 'web') return true;
  try {
    return typeof navigator !== 'undefined' && Boolean(navigator.storage);
  } catch {
    return false;
  }
}

export async function getLocalDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (!webStorageOk()) return null;
  if (db) return db;
  if (!opening) {
    opening = (async () => {
      try {
        const instance = await SQLite.openDatabaseAsync(LOCAL_DB_NAME);
        await migrateLocalDb(instance);
        await seedCatalog(instance);
        db = instance;
        return instance;
      } catch {
        return null;
      }
    })();
  }
  return opening;
}
