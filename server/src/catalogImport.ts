import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from './db.ts';

export type CatalogMedia = {
  kind: 'image' | 'video';
  position: number;
  sourceUrl?: string;
  localPath?: string;
  checksumSha256?: string;
  licenseName?: string;
  licenseUrl?: string;
  attribution?: string;
  placeholder: boolean;
  metadata?: Record<string, unknown>;
};

export type CatalogInitialStock = {
  storeId: string;
  qty: number;
  reserved?: number;
  minQty?: number;
};

export type CatalogProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  active: boolean;
  categoryId: string;
  payload: Record<string, unknown>;
  provenance: {
    source: string;
    country: string;
    collectedAt: string;
    notes?: string;
  };
  media: CatalogMedia[];
  initialStocks: CatalogInitialStock[];
};

export type CatalogManifest = {
  version: string;
  generatedAt: string;
  source: string;
  categories: { id: string; payload: Record<string, unknown> }[];
  banners?: { id: string; payload: Record<string, unknown> }[];
  chips?: { id: string; payload: Record<string, unknown> }[];
  stores: { id: string; payload: Record<string, unknown> }[];
  products: CatalogProduct[];
};

export type ValidationIssue = {
  path: string;
  message: string;
};

export type CatalogImportReport = {
  dryRun: boolean;
  runId: number | null;
  products: {
    total: number;
    inserted: number;
    updated: number;
    unchanged: number;
  };
  stocks: { initialized: number; skippedExisting: number };
  media: { upserted: number };
  issues: ValidationIssue[];
};

export class CatalogValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(`Manifeste catalogue invalide (${issues.length} erreur(s))`);
    this.name = 'CatalogValidationError';
  }
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export function hasValidGtinChecksum(value: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop();
  let sum = 0;
  for (let index = digits.length - 1, position = 0; index >= 0; index--, position++) {
    sum += digits[index]! * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === check;
}

export function validateCatalogManifest(
  input: unknown,
  options: { expectedProducts?: number; categoryCounts?: Record<string, number> } = {},
): { manifest: CatalogManifest | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!object(input)) return { manifest: null, issues: [{ path: '$', message: 'Objet JSON attendu.' }] };

  for (const field of ['version', 'generatedAt', 'source']) {
    if (!nonEmpty(input[field])) issues.push({ path: field, message: 'Chaîne non vide requise.' });
  }
  for (const field of ['categories', 'stores', 'products']) {
    if (!Array.isArray(input[field])) issues.push({ path: field, message: 'Tableau requis.' });
  }
  if (issues.length) return { manifest: null, issues };

  const products = input.products as unknown[];
  const categories = input.categories as unknown[];
  const stores = input.stores as unknown[];
  const ids = new Set<string>();
  const skus = new Set<string>();
  const barcodes = new Set<string>();
  const counts: Record<string, number> = {};

  products.forEach((raw, index) => {
    const path = `products[${index}]`;
    if (!object(raw)) {
      issues.push({ path, message: 'Objet produit requis.' });
      return;
    }
    for (const field of ['id', 'sku', 'categoryId']) {
      if (!nonEmpty(raw[field])) issues.push({ path: `${path}.${field}`, message: 'Chaîne non vide requise.' });
    }
    const id = typeof raw.id === 'string' ? raw.id : '';
    const sku = typeof raw.sku === 'string' ? raw.sku : '';
    if (ids.has(id)) issues.push({ path: `${path}.id`, message: `ID dupliqué: ${id}` });
    if (skus.has(sku)) issues.push({ path: `${path}.sku`, message: `SKU dupliqué: ${sku}` });
    ids.add(id);
    skus.add(sku);

    if (raw.active !== true) issues.push({ path: `${path}.active`, message: 'Le SKU doit être actif.' });
    if (raw.barcode !== null) {
      if (typeof raw.barcode !== 'string' || !hasValidGtinChecksum(raw.barcode)) {
        issues.push({ path: `${path}.barcode`, message: 'EAN/GTIN et checksum invalides.' });
      } else if (barcodes.has(raw.barcode)) {
        issues.push({ path: `${path}.barcode`, message: `EAN/GTIN dupliqué: ${raw.barcode}` });
      } else {
        barcodes.add(raw.barcode);
      }
    }

    if (!object(raw.payload)) {
      issues.push({ path: `${path}.payload`, message: 'Objet payload requis.' });
    } else {
      const price = raw.payload.price;
      if (!Number.isInteger(price) || Number(price) <= 0) {
        issues.push({ path: `${path}.payload.price`, message: 'Prix FCFA entier positif requis.' });
      }
      if (!nonEmpty(raw.payload.unit)) {
        issues.push({ path: `${path}.payload.unit`, message: 'Unité requise.' });
      }
      if (!nonEmpty(raw.payload.priceSource)) {
        issues.push({ path: `${path}.payload.priceSource`, message: 'priceSource requis.' });
      }
      if (!['seed-estimate', 'observed', 'supplier'].includes(String(raw.payload.priceStatus))) {
        issues.push({ path: `${path}.payload.priceStatus`, message: 'priceStatus invalide.' });
      }
      if (!nonEmpty(raw.payload.priceObservedAt) || Number.isNaN(Date.parse(String(raw.payload.priceObservedAt)))) {
        issues.push({ path: `${path}.payload.priceObservedAt`, message: 'Date de prix ISO requise.' });
      }
    }

    if (
      !object(raw.provenance) ||
      !nonEmpty(raw.provenance.source) ||
      !nonEmpty(raw.provenance.country) ||
      !nonEmpty(raw.provenance.collectedAt) ||
      Number.isNaN(Date.parse(String(raw.provenance.collectedAt)))
    ) {
      issues.push({ path: `${path}.provenance`, message: 'Provenance source/pays/date ISO requise.' });
    }
    if (!Array.isArray(raw.media) || raw.media.length === 0) {
      issues.push({ path: `${path}.media`, message: 'Média ou placeholder explicite requis.' });
    } else {
      raw.media.forEach((media, mediaIndex) => {
        if (!object(media) || typeof media.placeholder !== 'boolean') {
          issues.push({ path: `${path}.media[${mediaIndex}]`, message: 'Média invalide.' });
        } else if (!media.placeholder && !nonEmpty(media.sourceUrl) && !nonEmpty(media.localPath)) {
          issues.push({ path: `${path}.media[${mediaIndex}]`, message: 'Source média requise.' });
        } else if (
          !media.placeholder &&
          (!nonEmpty(media.licenseName) || (!nonEmpty(media.licenseUrl) && !nonEmpty(media.attribution)))
        ) {
          issues.push({ path: `${path}.media[${mediaIndex}]`, message: 'Licence et attribution média requises.' });
        } else if (
          media.checksumSha256 !== undefined &&
          (typeof media.checksumSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(media.checksumSha256))
        ) {
          issues.push({ path: `${path}.media[${mediaIndex}]`, message: 'Checksum SHA-256 invalide.' });
        }
      });
    }
    if (!Array.isArray(raw.initialStocks)) {
      issues.push({ path: `${path}.initialStocks`, message: 'Tableau de stocks explicites requis.' });
    }
    const categoryId = typeof raw.categoryId === 'string' ? raw.categoryId : '';
    counts[categoryId] = (counts[categoryId] ?? 0) + 1;
  });

  if (options.expectedProducts !== undefined && products.length !== options.expectedProducts) {
    issues.push({
      path: 'products',
      message: `${options.expectedProducts} produits attendus, ${products.length} reçus.`,
    });
  }
  if (options.categoryCounts) {
    for (const [categoryId, expected] of Object.entries(options.categoryCounts)) {
      if ((counts[categoryId] ?? 0) !== expected) {
        issues.push({
          path: `categories.${categoryId}`,
          message: `${expected} produits attendus, ${counts[categoryId] ?? 0} reçus.`,
        });
      }
    }
    for (const categoryId of Object.keys(counts)) {
      if (!(categoryId in options.categoryCounts)) {
        issues.push({ path: `categories.${categoryId}`, message: 'Catégorie produit inattendue.' });
      }
    }
  }

  const categoryIds = new Set(
    categories.filter(object).map((category) => String(category.id ?? '')),
  );
  const storeIds = new Set(stores.filter(object).map((store) => String(store.id ?? '')));
  products.forEach((raw, index) => {
    if (!object(raw)) return;
    if (!categoryIds.has(String(raw.categoryId))) {
      issues.push({ path: `products[${index}].categoryId`, message: 'Catégorie absente du manifeste.' });
    }
    if (Array.isArray(raw.initialStocks)) {
      raw.initialStocks.forEach((stock, stockIndex) => {
        if (
          !object(stock) ||
          !storeIds.has(String(stock.storeId)) ||
          typeof stock.qty !== 'number' ||
          stock.qty < 0 ||
          (stock.reserved !== undefined && (typeof stock.reserved !== 'number' || stock.reserved < 0)) ||
          (stock.minQty !== undefined && (typeof stock.minQty !== 'number' || stock.minQty < 0))
        ) {
          issues.push({
            path: `products[${index}].initialStocks[${stockIndex}]`,
            message: 'Stock initial ou magasin invalide.',
          });
        }
      });
    }
  });

  return { manifest: issues.length ? null : (input as unknown as CatalogManifest), issues };
}

async function resolveProductId(client: PoolClient, product: CatalogProduct): Promise<string | null> {
  if (product.barcode) {
    const byBarcode = await client.query<{ id: string }>(
      'SELECT id FROM products WHERE barcode = $1',
      [product.barcode],
    );
    if (byBarcode.rows[0]) return byBarcode.rows[0].id;
  }
  const bySku = await client.query<{ id: string }>('SELECT id FROM products WHERE sku = $1', [product.sku]);
  if (bySku.rows[0]) return bySku.rows[0].id;
  const byId = await client.query<{ id: string }>('SELECT id FROM products WHERE id = $1', [product.id]);
  return byId.rows[0]?.id ?? null;
}

export async function importCatalog(
  input: unknown,
  options: { dryRun?: boolean; source?: string } = {},
): Promise<CatalogImportReport> {
  const validated = validateCatalogManifest(input);
  if (!validated.manifest) throw new CatalogValidationError(validated.issues);
  const manifest = validated.manifest;
  const dryRun = options.dryRun ?? false;
  const report: CatalogImportReport = {
    dryRun,
    runId: null,
    products: { total: manifest.products.length, inserted: 0, updated: 0, unchanged: 0 },
    stocks: { initialized: 0, skippedExisting: 0 },
    media: { upserted: 0 },
    issues: [],
  };
  const checksum = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = await client.query<{ id: string }>(
      `INSERT INTO catalog_import_runs
         (source, manifest_version, manifest_checksum_sha256, dry_run)
       VALUES ($1, $2, $3, $4) RETURNING id::text`,
      [options.source ?? manifest.source, manifest.version, checksum, dryRun],
    );
    report.runId = Number(run.rows[0]!.id);

    for (const category of manifest.categories) {
      await client.query(
        `INSERT INTO categories (id, payload) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload
         WHERE categories.payload IS DISTINCT FROM EXCLUDED.payload`,
        [category.id, JSON.stringify(category.payload)],
      );
    }
    for (const store of manifest.stores) {
      await client.query(
        `INSERT INTO stores (id, payload) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload
         WHERE stores.payload IS DISTINCT FROM EXCLUDED.payload`,
        [store.id, JSON.stringify(store.payload)],
      );
    }
    for (const [table, rows] of [
      ['banners', manifest.banners ?? []],
      ['chips', manifest.chips ?? []],
    ] as const) {
      for (const row of rows) {
        await client.query(
          `INSERT INTO ${table} (id, payload) VALUES ($1, $2::jsonb)
           ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload
           WHERE ${table}.payload IS DISTINCT FROM EXCLUDED.payload`,
          [row.id, JSON.stringify(row.payload)],
        );
      }
    }

    for (const [index, product] of manifest.products.entries()) {
      const resolved = await resolveProductId(client, product);
      const productId = resolved ?? product.id;
      const payload = {
        ...product.payload,
        id: productId,
        categoryId: product.categoryId,
        sku: product.sku,
        barcode: product.barcode,
        active: product.active,
        provenance: product.provenance,
      };
      let action: 'inserted' | 'updated' | 'unchanged';
      if (!resolved) {
        await client.query(
          `INSERT INTO products (id, category_id, payload, sku, barcode, active)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
          [productId, product.categoryId, JSON.stringify(payload), product.sku, product.barcode, product.active],
        );
        report.products.inserted++;
        action = 'inserted';
      } else {
        const changed = await client.query(
          `UPDATE products
           SET category_id = $2, payload = $3::jsonb, sku = $4, barcode = $5, active = $6
           WHERE id = $1 AND (
             category_id IS DISTINCT FROM $2 OR payload IS DISTINCT FROM $3::jsonb OR
             sku IS DISTINCT FROM $4 OR barcode IS DISTINCT FROM $5 OR active IS DISTINCT FROM $6
           )`,
          [productId, product.categoryId, JSON.stringify(payload), product.sku, product.barcode, product.active],
        );
        if (changed.rowCount) {
          report.products.updated++;
          action = 'updated';
        } else {
          report.products.unchanged++;
          action = 'unchanged';
        }
      }

      for (const media of product.media) {
        await client.query(
          `INSERT INTO product_media
             (product_id, kind, position, source_url, local_path, checksum_sha256,
              license_name, license_url, attribution, is_placeholder, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
           ON CONFLICT (product_id, kind, position) DO UPDATE SET
             source_url = EXCLUDED.source_url,
             local_path = EXCLUDED.local_path,
             checksum_sha256 = EXCLUDED.checksum_sha256,
             license_name = EXCLUDED.license_name,
             license_url = EXCLUDED.license_url,
             attribution = EXCLUDED.attribution,
             is_placeholder = EXCLUDED.is_placeholder,
             metadata = EXCLUDED.metadata
           WHERE NOT EXCLUDED.is_placeholder OR product_media.is_placeholder`,
          [
            productId,
            media.kind,
            media.position,
            media.sourceUrl ?? null,
            media.localPath ?? null,
            media.checksumSha256 ?? null,
            media.licenseName ?? null,
            media.licenseUrl ?? null,
            media.attribution ?? null,
            media.placeholder,
            JSON.stringify(media.metadata ?? {}),
          ],
        );
        report.media.upserted++;
      }

      for (const stock of product.initialStocks) {
        const inserted = await client.query(
          `INSERT INTO product_stock (product_id, store_id, qty, reserved, min_qty)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (product_id, store_id) DO NOTHING`,
          [productId, stock.storeId, stock.qty, stock.reserved ?? 0, stock.minQty ?? 0],
        );
        if (inserted.rowCount) report.stocks.initialized++;
        else report.stocks.skippedExisting++;
      }

      await client.query(
        `INSERT INTO catalog_import_rows
           (run_id, row_number, requested_id, resolved_product_id, sku, barcode, action)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [report.runId, index + 1, product.id, productId, product.sku, product.barcode, action],
      );
    }

    await client.query(
      `UPDATE catalog_import_runs
       SET status = $2, report = $3::jsonb, finished_at = NOW()
       WHERE id = $1`,
      [report.runId, dryRun ? 'dry-run' : 'completed', JSON.stringify(report)],
    );
    if (dryRun) {
      await client.query('ROLLBACK');
      report.runId = null;
    } else {
      await client.query('COMMIT');
    }
    return report;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
