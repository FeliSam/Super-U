import type { ImageSourcePropType } from 'react-native';
import { catalogImages } from '@/lib/catalogImages.generated';
import { getApiBaseUrl } from '@/lib/api/http';

const CAT_FALLBACK: Record<string, string> = {
  'fruits-legumes': 'cat-fruits',
  viandes: 'cat-viandes',
  charcuterie: 'cat-viandes',
  poissons: 'cat-poissons',
  surgeles: 'glace-assortiment',
  laitiers: 'cat-laitiers',
  oeufs: 'poulet',
  boulangerie: 'cat-boulangerie',
  'petit-dej': 'miel',
  'cafe-the': 'glace-cafe',
  feculents: 'cuisine-riz',
  huiles: 'cat-epicerie',
  epices: 'circle-epices',
  conserves: 'cat-poissons',
  epicerie: 'cat-epicerie',
  snacking: 'plantains',
  boissons: 'cat-boissons',
  alcools: 'cat-boissons',
  bio: 'cat-fruits',
  cuisine: 'cat-cuisine',
  glaces: 'cat-glaces',
  hygiene: 'cat-hygiene',
  maison: 'cat-maison',
  bebe: 'cat-bebe',
  animalerie: 'cat-maison',
};

export function productBarcode(productId: string) {
  let h = 0;
  for (let i = 0; i < productId.length; i++) h = (Math.imul(h, 31) + productId.charCodeAt(i)) >>> 0;
  const body = `200${String(h % 1_000_000_000).padStart(9, '0')}`;
  return body + ean13Check(body);
}

function ean13Check(body12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = Number(body12[i] ?? 0);
    sum += i % 2 === 0 ? n : n * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

function lookupLocal(productId: string, categoryId?: string | null) {
  const id = productId.replace(/[^a-z0-9_-]/gi, '');
  if (catalogImages[id]) return catalogImages[id];
  const prefix = Object.keys(catalogImages).find(
    (name) => name.startsWith(`${id}-`) || name.startsWith(`cart-${id}`),
  );
  if (prefix) return catalogImages[prefix];
  const fallback = categoryId ? CAT_FALLBACK[categoryId] : null;
  if (fallback && catalogImages[fallback]) return catalogImages[fallback];
  return catalogImages['cat-epicerie'] ?? null;
}

/** Bundle first (marche-dore/assets). API only if the SKU has no local file. */
export function productImageSource(productId: string, categoryId?: string | null): ImageSourcePropType {
  const local = lookupLocal(productId, categoryId);
  if (local) return local;
  return { uri: `${getApiBaseUrl()}/catalog/media/${encodeURIComponent(productId)}` };
}

export function productImageUrl(productId: string) {
  return `${getApiBaseUrl()}/catalog/media/${encodeURIComponent(productId)}`;
}
