import type { SQLiteDatabase } from 'expo-sqlite';
import {
  chips,
  exploreCategories,
  homePromoBanners,
  products,
} from '@/data/catalog';
import { conversationThreads, conversations } from '@/data/messages';
import { notifications } from '@/data/notifications';
import { SUPER_U_STORES } from '@/data/superU';

function withoutAssets<T extends object>(row: T): string {
  const copy = { ...row } as Record<string, unknown>;
  delete copy.image;
  delete copy.avatar;
  return JSON.stringify(copy);
}

/** Copy in-app catalog into SQLite once (images stay in the JS bundle). */
export async function seedCatalog(db: SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM catalog_products',
  );
  if ((existing?.c ?? 0) > 0) return;

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
DELETE FROM catalog_products;
DELETE FROM catalog_categories;
DELETE FROM catalog_stores;
DELETE FROM catalog_conversations;
DELETE FROM catalog_thread_messages;
DELETE FROM catalog_notifications;
DELETE FROM catalog_banners;
DELETE FROM catalog_chips;
`);

    for (const p of products) {
      await db.runAsync(
        'INSERT INTO catalog_products (id, category_id, payload) VALUES (?, ?, ?)',
        p.id,
        p.categoryId,
        withoutAssets(p),
      );
    }

    for (const c of exploreCategories) {
      await db.runAsync(
        'INSERT INTO catalog_categories (id, payload) VALUES (?, ?)',
        c.id,
        withoutAssets(c),
      );
    }

    for (const store of SUPER_U_STORES) {
      await db.runAsync(
        'INSERT INTO catalog_stores (id, payload) VALUES (?, ?)',
        store.id,
        JSON.stringify(store),
      );
    }

    for (const conv of conversations) {
      await db.runAsync(
        'INSERT INTO catalog_conversations (id, payload) VALUES (?, ?)',
        conv.id,
        withoutAssets(conv),
      );
    }

    for (const [conversationId, msgs] of Object.entries(conversationThreads)) {
      for (const msg of msgs) {
        await db.runAsync(
          'INSERT INTO catalog_thread_messages (conversation_id, id, payload) VALUES (?, ?, ?)',
          conversationId,
          msg.id,
          JSON.stringify(msg),
        );
      }
    }

    for (const n of notifications) {
      await db.runAsync(
        'INSERT INTO catalog_notifications (id, payload) VALUES (?, ?)',
        n.id,
        JSON.stringify(n),
      );
    }

    for (const b of homePromoBanners) {
      await db.runAsync(
        'INSERT INTO catalog_banners (id, payload) VALUES (?, ?)',
        b.id,
        withoutAssets(b),
      );
    }

    for (const chip of chips) {
      await db.runAsync(
        'INSERT INTO catalog_chips (id, payload) VALUES (?, ?)',
        chip.id,
        JSON.stringify(chip),
      );
    }
  });
}
