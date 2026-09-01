import type { SQLiteDatabase } from 'expo-sqlite';
import {
  categoryFallbackImage,
  exploreCategories,
  homePromoBanners,
  popularIds,
  recommendedIds,
  popularSuggestions,
  products,
  chips,
  homeCategories,
  registerCatalogImageFallback,
  removeRuntimeCatalogProduct,
  pruneCatalogToRemoteIds,
  type ExploreCategory,
  type HomePromoBanner,
  type Product,
} from '@/data/catalog';
import { apiFetch, getApiBaseUrl } from '@/lib/api/http';
import { productVisualSource } from '@/lib/productVisual';

function parsePayload<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type CatalogRows = {
  products: CatalogProductRow[];
  categories: { id: string; payload: Omit<ExploreCategory, 'image'> | string }[];
  banners: { id: string; payload: Omit<HomePromoBanner, 'image'> | string }[];
  chips?: { id: string; payload: unknown }[];
  merch?: { popularIds?: string[]; recommendedIds?: string[]; trendingTerms?: string[] } | null;
};

export type CatalogProductRow = {
  id: string;
  categoryId?: string;
  category_id?: string;
  payload: Omit<Product, 'image'> | string;
  sku?: string | null;
  barcode?: string | null;
  available?: boolean;
  availableQty?: number;
  imageUrl?: string | null;
  updatedAt?: string;
  revision?: number | string;
};

function asObject<T>(payload: T | string): T | null {
  if (typeof payload === 'string') return parsePayload<T>(payload);
  return payload ?? null;
}

/**
 * Overlay live fields (price, stock, copy) onto the local catalog.
 * Images stay local unless an uploaded media URL is present.
 * `replace` drops SKUs absent from Postgres so SQLite and RAM stay aligned.
 */
export function applyCatalogRows(rows: CatalogRows, options?: { replace?: boolean }) {
  const byProduct = new Map(products.map((p) => [p.id, p]));
  for (const row of rows.products ?? []) {
    const data = asObject<Omit<Product, 'image'>>(row.payload);
    if (!data) continue;
    const categoryId = row.categoryId ?? row.category_id ?? data.categoryId ?? 'epicerie';
    const existing = byProduct.get(row.id);
    const name = typeof data.name === 'string' ? data.name : row.sku ?? row.id;
    const visual = productVisualSource(row.id, categoryId, name);
    registerCatalogImageFallback(row.id, visual);
    const overlay = { ...data } as Record<string, unknown>;
    delete overlay.image;
    delete overlay.id;
    delete overlay.categoryId;
    const imageUrl = row.imageUrl
      ? /^https?:\/\//i.test(row.imageUrl)
        ? row.imageUrl
        : `${getApiBaseUrl()}${row.imageUrl.startsWith('/') ? '' : '/'}${row.imageUrl}`
      : undefined;
    const uploaded = Boolean(imageUrl && /[?&]v=/.test(imageUrl));
    const image = uploaded ? { uri: imageUrl! } : visual;
    const target: Product =
      existing ??
      ({
        id: row.id,
        name,
        unit: typeof data.unit === 'string' ? data.unit : '1 unité',
        price: typeof data.price === 'number' ? data.price : 0,
        image,
        categoryId,
      } satisfies Product);
    Object.assign(target, overlay, {
      id: row.id,
      sku: row.sku ?? data.sku,
      barcode: row.barcode ?? data.barcode,
      categoryId,
      image,
      imageUrl,
      availableQty:
        typeof row.availableQty === 'number' ? Math.max(0, row.availableQty) : data.availableQty,
      stockQty:
        typeof row.availableQty === 'number' ? Math.max(0, row.availableQty) : data.stockQty ?? data.availableQty,
      inStock:
        typeof row.available === 'boolean'
          ? row.available
          : typeof row.availableQty === 'number'
            ? row.availableQty > 0
            : data.inStock,
      updatedAt: row.updatedAt ?? data.updatedAt,
    });
    if (!existing) {
      products.push(target);
      byProduct.set(row.id, target);
    }
  }

  if (options?.replace) {
    pruneCatalogToRemoteIds((rows.products ?? []).map((row) => row.id));
  }

  const byCat = new Map(exploreCategories.map((c) => [c.id, c]));
  for (const row of rows.categories ?? []) {
    const existing = byCat.get(row.id);
    const data = asObject<Omit<ExploreCategory, 'image'>>(row.payload);
    if (!data) continue;
    if (!existing) {
      exploreCategories.push({
        id: row.id,
        title: typeof data.title === 'string' ? data.title : row.id,
        image: categoryFallbackImage(row.id),
        flex: typeof data.flex === 'number' ? data.flex : 1,
        height: typeof data.height === 'number' ? data.height : 120,
      });
      continue;
    }
    const overlay = { ...data } as Record<string, unknown>;
    delete overlay.image;
    delete overlay.id;
    Object.assign(existing, overlay, { id: existing.id, image: existing.image });
  }

  for (const row of rows.chips ?? []) {
    const data = asObject<{ label?: string; emoji?: string; categoryId?: string }>(row.payload);
    if (!data) continue;
    const chip = chips.find((c) => c.id === row.id) as
      | { label: string; emoji: string; categoryId: string }
      | undefined;
    const home = homeCategories.find((c) => c.id === row.id);
    if (typeof data.label === 'string' && data.label.trim()) {
      if (chip) chip.label = data.label.trim();
      if (home) home.label = data.label.trim();
    }
    if (typeof data.emoji === 'string' && data.emoji.trim()) {
      if (chip) chip.emoji = data.emoji.trim();
      if (home) home.emoji = data.emoji.trim();
    }
    if (typeof data.categoryId === 'string' && data.categoryId.trim()) {
      if (chip) chip.categoryId = data.categoryId.trim();
      if (home) home.categoryId = data.categoryId.trim();
    }
  }

  for (const row of rows.banners ?? []) {
    const data = asObject<Omit<HomePromoBanner, 'image'>>(row.payload);
    const current = homePromoBanners.find((b) => b.id === row.id);
    if (!data || !current) continue;
    const overlay = { ...data } as Record<string, unknown>;
    delete overlay.image;
    delete overlay.id;
    Object.assign(current, overlay, { id: current.id, image: current.image });
  }

  if (rows.merch?.popularIds?.length) {
    popularIds.splice(0, popularIds.length, ...rows.merch.popularIds);
  }
  if (rows.merch?.recommendedIds?.length) {
    recommendedIds.splice(0, recommendedIds.length, ...rows.merch.recommendedIds);
  }
  if (rows.merch?.trendingTerms?.length) {
    popularSuggestions.splice(0, popularSuggestions.length, ...rows.merch.trendingTerms);
  }
}

export function applyCatalogTombstones(rows: { id: string }[]) {
  for (const row of rows) removeRuntimeCatalogProduct(row.id);
}

export async function hydrateCatalogFromDb(db: SQLiteDatabase, storeId = '') {
  const productRows = await db.getAllAsync<{
    id: string;
    category_id: string;
    payload: string;
    sku: string | null;
    barcode: string | null;
    image_url: string | null;
    updated_at: string | null;
    available_qty: number | null;
  }>(
    `SELECT p.id, p.category_id, p.payload, p.sku, p.barcode, p.image_url, p.updated_at,
            i.available_qty AS available_qty
       FROM catalog_products p
       LEFT JOIN catalog_inventory i
         ON i.product_id = p.id AND i.store_id = ?
      WHERE p.deleted_at IS NULL
      ORDER BY p.rowid`,
    storeId,
  );
  const categoryRows = await db.getAllAsync<{ id: string; payload: string }>(
    'SELECT id, payload FROM catalog_categories ORDER BY rowid',
  );
  const bannerRows = await db.getAllAsync<{ id: string; payload: string }>(
    'SELECT id, payload FROM catalog_banners ORDER BY rowid',
  );
  const chipRows = await db.getAllAsync<{ id: string; payload: string }>(
    'SELECT id, payload FROM catalog_chips ORDER BY rowid',
  );
  applyCatalogRows(
    {
      products: productRows.map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        payload: row.payload,
        sku: row.sku,
        barcode: row.barcode,
        imageUrl: row.image_url,
        updatedAt: row.updated_at ?? undefined,
        availableQty: row.available_qty ?? undefined,
        available: row.available_qty == null ? undefined : row.available_qty > 0,
      })),
      categories: categoryRows,
      banners: bannerRows,
      chips: chipRows,
    },
    { replace: productRows.length >= 8 },
  );
}

/** Legacy entry point retained for callers outside the catalog provider. */
export async function hydrateCatalogFromApi(storeId?: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({ limit: '2000' });
    if (storeId) params.set('storeId', storeId);
    const data = await apiFetch<CatalogRows>(`/catalog?${params}`);
    if (!data?.products?.length) return false;
    applyCatalogRows(data, { replace: data.products.length >= 8 });
    return true;
  } catch {
    return false;
  }
}
