import { products } from './catalog';
import { SUPER_U_STORES } from './superU';

/** Quantité rayon / entrepôt pour un SKU dans un Super U. */
export type StockLevel = {
  storeId: string;
  productId: string;
  qty: number;
};

const STORE_IDS = SUPER_U_STORES.map((store) => store.id);

function hashKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Ruptures / bas stock variables pour que le changement de magasin soit visible hors-ligne. */
function seedQty(storeId: string, productId: string): number {
  if (productId === 'gingembre') {
    if (storeId === 'su-ganhi') return 0;
    if (storeId === 'su-akpakpa') return 6;
    if (storeId === 'su-calavi') return 11;
    return 28;
  }
  if (productId === 'bissap-gingembre' && storeId === 'su-ganhi') return 0;
  if (productId === 'crevettes' && storeId === 'su-calavi') return 0;
  return 16 + (hashKey(`${storeId}:${productId}`) % 42);
}

export const STOCK_LEVELS: StockLevel[] = STORE_IDS.flatMap((storeId) =>
  products.map((product) => ({
    storeId,
    productId: product.id,
    qty: seedQty(storeId, product.id),
  })),
);

export function stockQtyFor(storeId: string, productId: string): number {
  const row = STOCK_LEVELS.find((level) => level.storeId === storeId && level.productId === productId);
  if (row) return row.qty;
  return seedQty(storeId, productId);
}

export function storeStockMap(storeId: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const product of products) {
    map[product.id] = stockQtyFor(storeId, product.id);
  }
  return map;
}

/** Overlay seed local (sans images) — l’API Postgres écrase ensuite qty / reserved. */
export function applyStoreStock(storeId: string) {
  const id = storeId.trim() || 'su-aeroport';
  for (const product of products) {
    const qty = stockQtyFor(id, product.id);
    product.stockQty = qty;
    product.availableQty = qty;
    product.inStock = qty > 0;
  }
}
