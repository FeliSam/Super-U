import type { SQLiteDatabase } from 'expo-sqlite';
import {
  applyCatalogRows,
  applyCatalogTombstones,
  type CatalogProductRow,
  type CatalogRows,
} from '@/lib/db/hydrateCatalog';
import { apiFetch } from '@/lib/api/http';

const PAGE_SIZE = 2000;

type SyncMarker = {
  revision: number | string;
  updatedAt: string;
  nextCursor?: string | null;
};

type Tombstone = {
  id: string;
  deletedAt: string;
  revision?: number | string;
};

type FullPage = CatalogRows & {
  storeId: string;
  sync: SyncMarker & { count: number };
};

type DeltaPage = {
  ok: boolean;
  storeId: string;
  upserts: CatalogProductRow[];
  tombstones: Tombstone[];
  sync: SyncMarker;
};

export type CatalogSyncResult = {
  ok: boolean;
  mode: 'full' | 'delta';
  changed: boolean;
};

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

async function writeProducts(
  db: SQLiteDatabase,
  storeId: string,
  rows: CatalogProductRow[],
) {
  const chunk = 80;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    await Promise.all(
      slice.flatMap((row) => {
        const categoryId = row.categoryId ?? row.category_id ?? 'epicerie';
        const payload = typeof row.payload === 'string' ? row.payload : json(row.payload);
        return [
          db.runAsync(
            `INSERT INTO catalog_products
               (id, category_id, payload, sku, barcode, image_url, available_qty, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
             ON CONFLICT(id) DO UPDATE SET
               category_id = excluded.category_id,
               payload = excluded.payload,
               sku = excluded.sku,
               barcode = excluded.barcode,
               image_url = excluded.image_url,
               available_qty = excluded.available_qty,
               updated_at = excluded.updated_at,
               deleted_at = NULL`,
            row.id,
            categoryId,
            payload,
            row.sku ?? null,
            row.barcode ?? null,
            row.imageUrl ?? null,
            row.availableQty ?? 0,
            row.updatedAt ?? null,
          ),
          db.runAsync(
            `INSERT INTO catalog_inventory (store_id, product_id, available_qty, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(store_id, product_id) DO UPDATE SET
               available_qty = excluded.available_qty,
               updated_at = excluded.updated_at`,
            storeId,
            row.id,
            row.availableQty ?? 0,
            row.updatedAt ?? null,
          ),
        ];
      }),
    );
  }
}

async function writeDecorations(db: SQLiteDatabase, page: Partial<CatalogRows>) {
  for (const row of page.categories ?? []) {
    await db.runAsync(
      `INSERT INTO catalog_categories (id, payload) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
      row.id,
      typeof row.payload === 'string' ? row.payload : json(row.payload),
    );
  }
  for (const row of page.banners ?? []) {
    await db.runAsync(
      `INSERT INTO catalog_banners (id, payload) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
      row.id,
      typeof row.payload === 'string' ? row.payload : json(row.payload),
    );
  }
  for (const row of page.chips ?? []) {
    await db.runAsync(
      `INSERT INTO catalog_chips (id, payload) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
      row.id,
      json(row.payload),
    );
  }
}

async function readMarker(db: SQLiteDatabase | null, storeId: string) {
  if (!db) return null;
  return db.getFirstAsync<{ revision: string | null; updated_at: string | null }>(
    'SELECT revision, updated_at FROM catalog_meta WHERE store_id = ?',
    storeId,
  );
}

async function saveMarker(db: SQLiteDatabase, storeId: string, marker: SyncMarker) {
  await db.runAsync(
    `INSERT INTO catalog_meta (store_id, revision, updated_at, synced_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(store_id) DO UPDATE SET
       revision = excluded.revision,
       updated_at = excluded.updated_at,
       synced_at = excluded.synced_at`,
    storeId,
    String(marker.revision),
    marker.updatedAt,
    new Date().toISOString(),
  );
}

export async function syncCatalogCache(options: {
  db: SQLiteDatabase | null;
  storeId: string;
  forceFull?: boolean;
  onChange: () => void;
  isCurrent?: () => boolean;
}): Promise<CatalogSyncResult> {
  const { db, storeId, onChange } = options;
  const isCurrent = options.isCurrent ?? (() => true);
  const marker = options.forceFull ? null : await readMarker(db, storeId);
  const delta = Boolean(marker?.revision && marker.updated_at);

  if (delta && marker && !options.forceFull) {
    try {
      const head = await apiFetch<{ revision?: number | string; updatedAt?: string }>('/catalog/revision');
      if (head.revision != null && String(head.revision) === String(marker.revision)) {
        return { ok: true, mode: 'delta', changed: false };
      }
    } catch {
      /* fall through to delta fetch */
    }
  }

  let cursor: string | null = null;
  let finalMarker: SyncMarker | null = null;
  let changed = false;
  const seen = new Set<string>();
  let removedAfterFull: { id: string }[] = [];
  const collected: CatalogProductRow[] = [];
  let decorations: Partial<CatalogRows> | null = null;
  const collectedTombs: Tombstone[] = [];

  do {
    const params = new URLSearchParams({ storeId, limit: String(PAGE_SIZE) });
    if (cursor) params.set('cursor', cursor);
    if (delta) params.set('since', marker!.updated_at!);
    const path = delta ? `/catalog/sync?${params}` : `/catalog?${params}`;
    const page = delta
      ? await apiFetch<DeltaPage>(path)
      : await apiFetch<FullPage>(path);
    if (!isCurrent()) return { ok: false, mode: delta ? 'delta' : 'full', changed };

    const upserts = delta ? (page as DeltaPage).upserts : (page as FullPage).products;
    const tombstones = delta ? (page as DeltaPage).tombstones : [];
    for (const row of upserts) seen.add(row.id);
    collected.push(...upserts);
    collectedTombs.push(...tombstones);
    if (!delta) decorations = page as FullPage;

    finalMarker = page.sync;
    cursor = page.sync.nextCursor ?? null;
  } while (cursor);

  if (!isCurrent()) return { ok: false, mode: delta ? 'delta' : 'full', changed };

  if (db && finalMarker) {
    await db.withTransactionAsync(async () => {
      if (collected.length) await writeProducts(db, storeId, collected);
      if (!delta && decorations) await writeDecorations(db, decorations);
      for (const row of collectedTombs) {
        await db.runAsync(
          'UPDATE catalog_products SET deleted_at = ? WHERE id = ?',
          row.deletedAt,
          row.id,
        );
        await db.runAsync('DELETE FROM catalog_inventory WHERE product_id = ?', row.id);
      }
      if (!delta) {
        const stale = await db.getAllAsync<{ id: string }>(
          'SELECT id FROM catalog_products WHERE updated_at IS NOT NULL AND deleted_at IS NULL',
        );
        const removed = stale.filter((row) => !seen.has(row.id));
        removedAfterFull = removed;
        const deletedAt = finalMarker!.updatedAt;
        for (const row of removed) {
          await db.runAsync(
            'UPDATE catalog_products SET deleted_at = ? WHERE id = ?',
            deletedAt,
            row.id,
          );
          await db.runAsync('DELETE FROM catalog_inventory WHERE product_id = ?', row.id);
        }
      }
      await saveMarker(db, storeId, finalMarker!);
    });
  }

  if (collected.length || collectedTombs.length || decorations) {
    applyCatalogRows({
      products: collected,
      categories: decorations?.categories ?? [],
      banners: decorations?.banners ?? [],
      chips: decorations?.chips ?? [],
      merch: decorations?.merch ?? null,
    });
    applyCatalogTombstones(collectedTombs);
    changed = true;
  }
  if (removedAfterFull.length) {
    applyCatalogTombstones(removedAfterFull);
    changed = true;
  }
  if (changed) onChange();

  return { ok: true, mode: delta ? 'delta' : 'full', changed };
}
