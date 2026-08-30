import type { SQLiteDatabase } from 'expo-sqlite';
import {
  exploreCategories,
  homePromoBanners,
  popularIds,
  recommendedIds,
  products,
  restoreBundledCatalogImages,
  type ExploreCategory,
  type HomePromoBanner,
  type Product,
} from '@/data/catalog';
import { apiAvailable, apiFetch } from '@/lib/api/http';

function parsePayload<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type CatalogRows = {
  products: { id: string; categoryId?: string; category_id?: string; payload: Omit<Product, 'image'> | string }[];
  categories: { id: string; payload: Omit<ExploreCategory, 'image'> | string }[];
  banners: { id: string; payload: Omit<HomePromoBanner, 'image'> | string }[];
  merch?: { popularIds?: string[]; recommendedIds?: string[]; trendingTerms?: string[] } | null;
};

function asObject<T>(payload: T | string): T | null {
  if (typeof payload === 'string') return parsePayload<T>(payload);
  return payload ?? null;
}

/**
 * Overlay live fields (price, stock, copy) onto the local catalog.
 * Never drop bundled SKUs, never take images/URLs from the API.
 */
export function applyCatalogRows(rows: CatalogRows) {
  const byProduct = new Map(products.map((p) => [p.id, p]));
  for (const row of rows.products ?? []) {
    const existing = byProduct.get(row.id);
    const data = asObject<Omit<Product, 'image'>>(row.payload);
    if (!existing || !data) continue;
    const overlay = { ...data } as Record<string, unknown>;
    delete overlay.image;
    delete overlay.id;
    delete overlay.categoryId;
    Object.assign(existing, overlay, {
      id: existing.id,
      image: existing.image,
      categoryId: existing.categoryId,
    });
  }

  const byCat = new Map(exploreCategories.map((c) => [c.id, c]));
  for (const row of rows.categories ?? []) {
    const existing = byCat.get(row.id);
    const data = asObject<Omit<ExploreCategory, 'image'>>(row.payload);
    if (!existing || !data) continue;
    const overlay = { ...data } as Record<string, unknown>;
    delete overlay.image;
    delete overlay.id;
    Object.assign(existing, overlay, { id: existing.id, image: existing.image });
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

  restoreBundledCatalogImages();

  if (rows.merch?.popularIds?.length) {
    popularIds.splice(0, popularIds.length, ...rows.merch.popularIds);
  }
  if (rows.merch?.recommendedIds?.length) {
    recommendedIds.splice(0, recommendedIds.length, ...rows.merch.recommendedIds);
  }
}

export async function hydrateCatalogFromDb(db: SQLiteDatabase) {
  const productRows = await db.getAllAsync<{ id: string; category_id: string; payload: string }>(
    'SELECT id, category_id, payload FROM catalog_products ORDER BY rowid',
  );
  const categoryRows = await db.getAllAsync<{ id: string; payload: string }>(
    'SELECT id, payload FROM catalog_categories ORDER BY rowid',
  );
  const bannerRows = await db.getAllAsync<{ id: string; payload: string }>(
    'SELECT id, payload FROM catalog_banners ORDER BY rowid',
  );
  applyCatalogRows({
    products: productRows.map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      payload: row.payload,
    })),
    categories: categoryRows,
    banners: bannerRows,
  });
}

export async function hydrateCatalogFromApi(): Promise<boolean> {
  if (!(await apiAvailable())) return false;
  try {
    const data = await apiFetch<CatalogRows>('/catalog');
    if (!data?.products?.length) return false;
    applyCatalogRows(data);
    return true;
  } catch {
    return false;
  }
}
