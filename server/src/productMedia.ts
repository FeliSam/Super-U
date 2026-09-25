import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickCatalogFilename } from '../../marche-dore/lib/productVisualMatch.ts';

let filesCache: string[] | null = null;

export function clearCatalogFilesCache() {
  filesCache = null;
}

export function catalogDir() {
  return join(dirname(fileURLToPath(import.meta.url)), '../../marche-dore/assets/images/catalog');
}

function allowedMediaRoots() {
  return [
    resolve(catalogDir()),
    resolve(dirname(fileURLToPath(import.meta.url)), '../data/catalog-media'),
  ];
}

export function resolveSafeMediaPath(localPath: string | null | undefined) {
  if (!localPath || localPath.includes('\0')) return null;
  const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const candidates = isAbsolute(localPath)
    ? [resolve(localPath)]
    : [resolve(serverRoot, localPath), ...allowedMediaRoots().map((root) => resolve(root, localPath))];
  for (const candidate of candidates) {
    const root = allowedMediaRoots().find((allowed) => {
      const rel = relative(allowed, candidate);
      return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
    });
    if (root && existsSync(candidate)) return candidate;
  }
  return null;
}

export function readCatalogLocalPath(localPath: string | null | undefined) {
  const path = resolveSafeMediaPath(localPath);
  if (!path) return null;
  const ext = extname(path).toLowerCase();
  const type = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : null;
  if (!type) return null;
  return { buf: readFileSync(path), type, name: path };
}

function listCatalog() {
  if (filesCache) return filesCache;
  try {
    filesCache = readdirSync(catalogDir());
  } catch {
    filesCache = [];
  }
  return filesCache;
}

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

export function readExactCatalogFile(productId: string) {
  const id = productId.replace(/[^a-z0-9_-]/gi, '');
  const dir = catalogDir();
  for (const name of [`${id}.png`, `${id}.jpg`, `${id}.webp`, `${id}.jpeg`]) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    const ext = name.split('.').pop()?.toLowerCase();
    const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    return { buf: readFileSync(path), type, name };
  }
  return null;
}

export function resolveCatalogFile(productId: string, categoryId?: string | null, productName?: string | null) {
  const files = listCatalog();
  return pickCatalogFilename(productId, categoryId, productName, files);
}

export function readCatalogImage(productId: string, categoryId?: string | null, productName?: string | null) {
  const name = resolveCatalogFile(productId, categoryId, productName);
  if (!name) return null;
  const path = join(catalogDir(), name);
  if (!existsSync(path)) return null;
  const ext = name.split('.').pop()?.toLowerCase();
  const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  return { buf: readFileSync(path), type, name };
}
