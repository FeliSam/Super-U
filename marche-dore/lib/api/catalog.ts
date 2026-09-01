import { apiAvailable, apiFetch } from '@/lib/api/http';
import { applyCatalogRows, type CatalogRows } from '@/lib/db/hydrateCatalog';
import {
  getProduct,
  productAvailableQty,
  products as catalogProducts,
  productsInCategory,
  searchProducts,
  type Product,
  type SearchOptions,
} from '@/data/catalog';
import { applyStoreStock, stockQtyFor, storeStockMap } from '@/data/stock';

export type CatalogListParams = {
  storeId?: string;
  categoryId?: string;
  q?: string;
  inStockOnly?: boolean;
  /** GET /catalog cursor (updatedAt+id). Sync uses this; category UI paginates locally after rank. */
  cursor?: string;
  limit?: number;
};

export type CatalogListResponse = {
  ok: true;
  storeId: string;
  products: Product[];
  nextCursor?: string | null;
};

export type StoreStockLevel = {
  qty: number;
  reserved: number;
  available: number;
  minQty: number;
};

export type ProductAvailability = {
  qty: number;
  inStock: boolean;
};

function filterLocal(params: CatalogListParams): Product[] {
  let list = params.categoryId ? productsInCategory(params.categoryId) : [...catalogProducts];
  const needle = params.q?.trim();
  if (needle) list = searchProducts(needle, { inStockOnly: params.inStockOnly });
  else if (params.inStockOnly) list = list.filter((p) => p.inStock !== false);
  return list;
}

/**
 * Client API — catalogue + stock par Super U (entrepôt / magasin).
 * En ligne : GET /catalog et GET /catalog/stock (Hono, port 8787).
 * Hors-ligne : seed `data/stock.ts`. Remplaçable par `fetch('/api/catalog')` si output serveur.
 */
export async function listCatalogProducts(params: CatalogListParams = {}): Promise<Product[]> {
  await Promise.resolve();
  const storeId = params.storeId?.trim() || 'su-aeroport';
  if (await apiAvailable()) {
    try {
      const qs = new URLSearchParams({
        limit: String(params.limit ?? 2000),
        storeId,
      });
      if (params.categoryId) qs.set('categoryId', params.categoryId);
      if (params.q?.trim()) qs.set('q', params.q.trim());
      if (params.cursor) qs.set('cursor', params.cursor);
      const data = await apiFetch<CatalogRows & { nextCursor?: string | null }>(`/catalog?${qs}`);
      if (data?.products?.length) {
        applyCatalogRows(data, {
          replace: !params.cursor && !params.categoryId && !params.q && data.products.length >= 8,
        });
      }
    } catch {
      /* SQLite / seed déjà posés par CatalogProvider */
    }
  }
  return filterLocal(params);
}

export async function getCatalogProduct(id: string, storeId?: string): Promise<Product | undefined> {
  await Promise.resolve();
  const store = storeId?.trim();
  if (store) {
    if (await apiAvailable()) {
      try {
        await getProductAvailability(id, store);
      } catch {
        const qty = stockQtyFor(store, id);
        const product = getProduct(id);
        if (product) {
          product.stockQty = qty;
          product.availableQty = qty;
          product.inStock = qty > 0;
        }
      }
    } else {
      const qty = stockQtyFor(store, id);
      const product = getProduct(id);
      if (product) {
        product.stockQty = qty;
        product.availableQty = qty;
        product.inStock = qty > 0;
      }
    }
  }
  return getProduct(id);
}

export async function getStoreStock(storeId: string): Promise<Record<string, number>> {
  await Promise.resolve();
  const fallback = storeStockMap(storeId);
  if (!(await apiAvailable())) return fallback;
  try {
    const res = await apiFetch<{ ok: true; stock: Record<string, StoreStockLevel> }>(
      `/catalog/stock?storeId=${encodeURIComponent(storeId)}`,
    );
    const map: Record<string, number> = {};
    for (const [id, row] of Object.entries(res.stock ?? {})) {
      const available = Math.max(0, Math.floor(row.available));
      map[id] = available;
      const product = getProduct(id);
      if (product) {
        product.availableQty = available;
        product.stockQty = available;
        product.inStock = available > 0;
      }
    }
    return Object.keys(map).length ? map : fallback;
  } catch {
    return fallback;
  }
}

export async function getProductAvailability(
  productId: string,
  storeId: string,
): Promise<ProductAvailability> {
  await Promise.resolve();
  const local = getProduct(productId);
  const seedQty = stockQtyFor(storeId, productId);
  const fallbackQty = productAvailableQty(local) ?? seedQty;
  if (!(await apiAvailable())) {
    const qty = seedQty;
    if (local) {
      local.availableQty = qty;
      local.stockQty = qty;
      local.inStock = qty > 0;
    }
    return { qty, inStock: qty > 0 };
  }
  try {
    const res = await apiFetch<ProductAvailability & { ok: true }>(
      `/catalog/stock?storeId=${encodeURIComponent(storeId)}&productId=${encodeURIComponent(productId)}`,
    );
    const qty = Math.max(0, Math.floor(res.qty));
    const inStock = Boolean(res.inStock);
    if (local) {
      local.availableQty = qty;
      local.stockQty = qty;
      local.inStock = inStock;
    }
    return { qty, inStock };
  } catch {
    return { qty: fallbackQty, inStock: fallbackQty > 0 && local?.inStock !== false };
  }
}

export function searchCatalogProducts(query: string, options: SearchOptions = {}) {
  return searchProducts(query, options);
}
