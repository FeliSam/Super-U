import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDb } from '@/lib/db/client';

/** Persist app state in SQLite `kv`, always mirrored to AsyncStorage so reloads keep the session. */
export const appStorage = {
  async getItem(key: string): Promise<string | null> {
    const fallback = await AsyncStorage.getItem(key);
    try {
      const db = await getLocalDb();
      if (db) {
        const row = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM kv WHERE key = ?',
          [key],
        );
        if (row?.value != null) return row.value;
        if (fallback != null) {
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
    return fallback;
  },

  async setItem(key: string, value: string): Promise<void> {
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
    await AsyncStorage.removeItem(key).catch(() => undefined);
    try {
      const db = await getLocalDb();
      if (db) await db.runAsync('DELETE FROM kv WHERE key = ?', key);
    } catch {
      /* ignore */
    }
  },
};
