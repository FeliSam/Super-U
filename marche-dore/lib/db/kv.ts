import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDb } from '@/lib/db/client';

const mem = new Map<string, string | null>();

/** Persist app state in SQLite `kv`, always mirrored to AsyncStorage so reloads keep the session. */
export const appStorage = {
  async getItem(key: string): Promise<string | null> {
    if (mem.has(key)) return mem.get(key) ?? null;
    const fallback = await AsyncStorage.getItem(key);
    try {
      const db = await getLocalDb();
      if (db) {
        const row = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM kv WHERE key = ?',
          [key],
        );
        if (row?.value != null) {
          mem.set(key, row.value);
          return row.value;
        }
        if (fallback != null) {
          mem.set(key, fallback);
          await db.runAsync(
            'INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)',
            key,
            fallback,
            new Date().toISOString(),
          );
        }
      }
    } catch {
      /* sqlite web can fail on reload — AsyncStorage is enough */
    }
    mem.set(key, fallback);
    return fallback;
  },

  async setItem(key: string, value: string): Promise<void> {
    mem.set(key, value);
    await AsyncStorage.setItem(key, value);
    try {
      const db = await getLocalDb();
      if (db) {
        await db.runAsync(
          'INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)',
          key,
          value,
          new Date().toISOString(),
        );
      }
    } catch {
      /* keep AsyncStorage copy */
    }
  },

  async removeItem(key: string): Promise<void> {
    mem.delete(key);
    await AsyncStorage.removeItem(key).catch(() => undefined);
    try {
      const db = await getLocalDb();
      if (db) await db.runAsync('DELETE FROM kv WHERE key = ?', key);
    } catch {
      /* ignore */
    }
  },
};
