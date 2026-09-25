import type { ImageSourcePropType } from 'react-native';
import { catalogImages } from '@/lib/catalogImages.generated';
import { getApiBaseUrl } from '@/lib/api/http';
import { pickCatalogStem } from '../../marche-dore/lib/productVisualMatch';

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

function lookupLocal(productId: string, categoryId?: string | null, productName?: string | null) {
  const id = productId.replace(/[^a-z0-9_-]/gi, '');
  if (catalogImages[id]) return catalogImages[id];
  const prefix = Object.keys(catalogImages).find(
    (name) => name.startsWith(`${id}-`) || name.startsWith(`cart-${id}`),
  );
  if (prefix) return catalogImages[prefix];
  const stem = pickCatalogStem(productId, categoryId, productName);
  return catalogImages[stem] ?? catalogImages['cat-epicerie'] ?? null;
}

function absoluteMediaUrl(imageUrl: string) {
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${getApiBaseUrl()}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

export function productImageSource(
  productId: string,
  categoryId?: string | null,
  productName?: string | null,
): ImageSourcePropType {
  const local = lookupLocal(productId, categoryId, productName);
  if (local) return local;
  return { uri: `${getApiBaseUrl()}/catalog/media/${encodeURIComponent(productId)}` };
}

export function productImageFallback(
  productId: string,
  categoryId?: string | null,
  productName?: string | null,
) {
  return lookupLocal(productId, categoryId, productName);
}

export function productImageUrl(productId: string, imageUrl?: string | null) {
  return imageUrl
    ? absoluteMediaUrl(imageUrl)
    : `${getApiBaseUrl()}/catalog/media/${encodeURIComponent(productId)}`;
}
