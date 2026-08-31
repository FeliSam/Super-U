import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Hono } from 'hono';
import { query } from './db.ts';
import { hashPassword } from './password.ts';
import { catalogDir } from './productMedia.ts';
import { CatalogValidationError, hasValidGtinChecksum, importCatalog } from './catalogImport.ts';
import { normalizeBarcode } from './catalogHelpers.ts';

const CATALOG_ROLES = new Set(['admin', 'manager', 'magasinier']);
const PRICE_ROLES = new Set(['admin', 'manager']);
const CREATE_ROLES = new Set(['admin', 'manager']);
const PICK_FEE = 500;
const HR_ROLES = new Set(['admin', 'recruteur', 'manager']);
const BACKOFFICE_ROLES = new Set(['admin', 'manager', 'magasinier', 'recruteur', 'support']);

type StaffRow = {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  role: string;
  can_pick: boolean;
  can_deliver: boolean;
  store_id: string | null;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  category_id: string;
  payload: Record<string, unknown>;
};

function bearer(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

async function staffFromToken(token: string | undefined) {
  if (!token) return null;
  const result = await query<StaffRow>(
    `SELECT s.id, s.email, s.phone, s.first_name, s.last_name, s.role,
            s.can_pick, s.can_deliver, s.store_id, s.is_active
     FROM ops.staff_sessions sess
     JOIN ops.staff s ON s.id = sess.staff_id
     WHERE sess.token = $1 AND s.is_active = TRUE`,
    [token],
  );
  return result.rows[0] ?? null;
}

function publicStaff(row: StaffRow) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    storeId: row.store_id,
    canPick: row.can_pick,
    canDeliver: row.can_deliver,
    canEditPrices: PRICE_ROLES.has(row.role),
    canCreateProducts: CREATE_ROLES.has(row.role),
    canEditStock: CATALOG_ROLES.has(row.role),
    canHr: HR_ROLES.has(row.role),
    canReadHr: HR_ROLES.has(row.role) || row.role === 'support',
  };
}

async function requireCatalog(c: { req: { header: (n: string) => string | undefined }; json: (b: unknown, s?: number) => Response }) {
  const staff = await staffFromToken(bearer(c.req.header('Authorization')));
  if (!staff) return { staff: null as StaffRow | null, error: c.json({ ok: false, error: 'Session staff requise.' }, 401) };
  if (!CATALOG_ROLES.has(staff.role)) {
    return { staff: null as StaffRow | null, error: c.json({ ok: false, error: 'Accès catalogue réservé à l’équipe magasin.' }, 403) };
  }
  return { staff, error: null as Response | null };
}

async function requireBackoffice(c: { req: { header: (n: string) => string | undefined }; json: (b: unknown, s?: number) => Response }) {
  const staff = await staffFromToken(bearer(c.req.header('Authorization')));
  if (!staff) return { staff: null as StaffRow | null, error: c.json({ ok: false, error: 'Session staff requise.' }, 401) };
  if (!BACKOFFICE_ROLES.has(staff.role)) {
    return { staff: null as StaffRow | null, error: c.json({ ok: false, error: 'Accès back-office réservé au siège et au magasin.' }, 403) };
  }
  return { staff, error: null as Response | null };
}

function scopedStore(staff: StaffRow, requested?: string | null) {
  if (staff.role === 'admin') return requested || null;
  return staff.store_id;
}

function slugify(raw: string) {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function discountLabel(price: number, oldPrice?: number) {
  if (!oldPrice || oldPrice <= price) return undefined;
  return `-${Math.round((1 - price / oldPrice) * 100)}%`;
}

function applyRupture(payload: Record<string, unknown>, inStock: boolean) {
  payload.inStock = inStock;
  if (!inStock) payload.badge = 'rupture';
  else if (payload.badge === 'rupture') delete payload.badge;
}

function num(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}

async function audit(
  staffId: string,
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await query(
    `INSERT INTO catalog_audit (actor_staff_id, action, entity, entity_id, before, after)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [staffId, action, entity, entityId, JSON.stringify(before ?? null), JSON.stringify(after ?? null)],
  );
}

function mapProduct(
  row: ProductRow,
  stock?: { qty: string; reserved: string; min_qty: string } | null,
) {
  const qty = stock ? Number(stock.qty) : null;
  const reserved = stock ? Number(stock.reserved) : null;
  const minQty = stock ? Number(stock.min_qty) : null;
  return {
    id: row.id,
    categoryId: row.category_id,
    payload: row.payload,
    imageUrl: `/catalog/media/${encodeURIComponent(row.id)}`,
    stock:
      qty == null
        ? null
        : {
            qty,
            reserved,
            minQty,
            available: qty - (reserved ?? 0),
            alert: minQty != null && qty - (reserved ?? 0) <= minQty,
          },
  };
}

export async function seedAdminStaff() {
  const password = process.env.DEMO_PASSWORD ?? 'marche2024';
  const email = 'admin@marchedore.bj';
  const found = await query<{ id: string }>('SELECT id FROM ops.staff WHERE email = $1', [email]);
  const hash = await hashPassword(password);
  if (found.rows[0]) {
    await query(
      `UPDATE ops.staff SET role = 'admin', can_pick = FALSE, can_deliver = FALSE,
         first_name = 'Amina', last_name = 'KPODEKON', is_active = TRUE,
         onboard_status = 'active', must_reset_password = FALSE,
         store_id = COALESCE(store_id, 'su-aeroport'), password_hash = $2
       WHERE email = $1`,
      [email, hash],
    );
  } else {
    await query(
      `INSERT INTO ops.staff (id, email, phone, password_hash, first_name, last_name, role, can_pick, can_deliver, store_id, vehicle, onboard_status)
       VALUES ($1, $2, '+229 01 40 00 00 09', $3, 'Amina', 'KPODEKON', 'admin', FALSE, FALSE, NULL, NULL, 'active')`,
      [`st-admin-${randomBytes(3).toString('hex')}`, email, hash],
    );
  }

  const rhEmail = 'rh@marchedore.bj';
  const rh = await query<{ id: string }>('SELECT id FROM ops.staff WHERE email = $1', [rhEmail]);
  if (rh.rows[0]) {
    await query(
      `UPDATE ops.staff SET role = 'recruteur', can_pick = FALSE, can_deliver = FALSE,
         first_name = 'Léa', last_name = 'HOUNSOU', is_active = TRUE,
         onboard_status = 'active', must_reset_password = FALSE,
         store_id = NULL, password_hash = $2
       WHERE email = $1`,
      [rhEmail, hash],
    );
    return false;
  }
  await query(
    `INSERT INTO ops.staff (id, email, phone, password_hash, first_name, last_name, role, can_pick, can_deliver, store_id, vehicle, onboard_status)
     VALUES ($1, $2, '+229 01 40 00 00 08', $3, 'Léa', 'HOUNSOU', 'recruteur', FALSE, FALSE, NULL, NULL, 'active')`,
    [`st-rh-${randomBytes(3).toString('hex')}`, rhEmail, hash],
  );
  return true;
}

export async function seedProductStock() {
  await query(`
    INSERT INTO product_stock (product_id, store_id, qty, reserved, min_qty)
    SELECT p.id, s.id,
      CASE WHEN COALESCE(p.payload->>'inStock', 'true') = 'false' THEN 0 ELSE 42 END,
      0,
      6
    FROM products p
    CROSS JOIN stores s
    ON CONFLICT (product_id, store_id) DO NOTHING
  `);
}

export function registerAdminRoutes(app: Hono) {
  app.get('/admin/me', async (c) => {
    const gate = await requireBackoffice(c);
    if (gate.error) return gate.error;
    return c.json({ ok: true, staff: publicStaff(gate.staff!) });
  });

  app.get('/admin/stores', async (c) => {
    const gate = await requireBackoffice(c);
    if (gate.error) return gate.error;
    const rows = await query<{ id: string; payload: Record<string, unknown> }>(
      'SELECT id, payload FROM stores ORDER BY id',
    );
    const staff = gate.staff!;
    const list =
      staff.role === 'admin' || staff.role === 'recruteur' || staff.role === 'support' || !staff.store_id
        ? rows.rows
        : rows.rows.filter((r) => r.id === staff.store_id);
    return c.json({ ok: true, stores: list });
  });

  app.get('/admin/categories', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const rows = await query<{ id: string; payload: Record<string, unknown> }>(
      'SELECT id, payload FROM categories ORDER BY id',
    );
    return c.json({ ok: true, categories: rows.rows });
  });

  app.patch('/admin/categories/:id', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    if (!CREATE_ROLES.has(gate.staff!.role)) {
      return c.json({ ok: false, error: 'Modification des rayons réservée au manager.' }, 403);
    }
    const id = c.req.param('id');
    const found = await query<{ payload: Record<string, unknown> }>('SELECT payload FROM categories WHERE id = $1', [id]);
    if (!found.rows[0]) return c.json({ ok: false, error: 'Rayon introuvable.' }, 404);
    const body = await c.req.json().catch(() => null);
    const payload = { ...found.rows[0].payload };
    if (typeof body?.title === 'string' && body.title.trim().length >= 2) payload.title = body.title.trim();
    if (typeof body?.flex === 'number') payload.flex = body.flex;
    if (typeof body?.height === 'number') payload.height = body.height;
    await query('UPDATE categories SET payload = $2::jsonb WHERE id = $1', [id, JSON.stringify(payload)]);
    await audit(gate.staff!.id, 'patch', 'category', id, found.rows[0].payload, payload);
    return c.json({ ok: true, category: { id, payload } });
  });

  app.get('/admin/banners', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const rows = await query<{ id: string; payload: Record<string, unknown> }>(
      'SELECT id, payload FROM banners ORDER BY id',
    );
    return c.json({ ok: true, banners: rows.rows });
  });

  app.patch('/admin/banners/:id', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    if (!CREATE_ROLES.has(gate.staff!.role)) {
      return c.json({ ok: false, error: 'Promotions : manager ou admin.' }, 403);
    }
    const id = c.req.param('id');
    const found = await query<{ payload: Record<string, unknown> }>('SELECT payload FROM banners WHERE id = $1', [id]);
    if (!found.rows[0]) return c.json({ ok: false, error: 'Bannière introuvable.' }, 404);
    const body = await c.req.json().catch(() => null);
    const payload = { ...found.rows[0].payload };
    for (const key of ['title', 'subtitle', 'cta', 'href'] as const) {
      if (typeof body?.[key] === 'string') payload[key] = body[key].trim();
    }
    if (typeof body?.enabled === 'boolean') payload.enabled = body.enabled;
    await query('UPDATE banners SET payload = $2::jsonb WHERE id = $1', [id, JSON.stringify(payload)]);
    await audit(gate.staff!.id, 'patch', 'banner', id, found.rows[0].payload, payload);
    return c.json({ ok: true, banner: { id, payload } });
  });

  app.get('/admin/chips', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const rows = await query<{ id: string; payload: Record<string, unknown> }>(
      'SELECT id, payload FROM chips ORDER BY id',
    );
    return c.json({ ok: true, chips: rows.rows });
  });

  app.patch('/admin/chips/:id', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    if (!CREATE_ROLES.has(gate.staff!.role)) {
      return c.json({ ok: false, error: 'Accès rapide : manager ou admin.' }, 403);
    }
    const id = c.req.param('id');
    const found = await query<{ payload: Record<string, unknown> }>('SELECT payload FROM chips WHERE id = $1', [id]);
    if (!found.rows[0]) return c.json({ ok: false, error: 'Puce introuvable.' }, 404);
    const body = await c.req.json().catch(() => null);
    const payload = { ...found.rows[0].payload };
    if (typeof body?.label === 'string') payload.label = body.label.trim();
    if (typeof body?.emoji === 'string') payload.emoji = body.emoji.trim();
    if (typeof body?.categoryId === 'string') payload.categoryId = body.categoryId;
    if (typeof body?.filter === 'string' || body?.filter === null) payload.filter = body.filter;
    await query('UPDATE chips SET payload = $2::jsonb WHERE id = $1', [id, JSON.stringify(payload)]);
    await audit(gate.staff!.id, 'patch', 'chip', id, found.rows[0].payload, payload);
    return c.json({ ok: true, chip: { id, payload } });
  });

  app.get('/admin/merch', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const row = await query<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM catalog_settings WHERE key = 'merch'`,
    );
    return c.json({ ok: true, merch: row.rows[0]?.payload ?? {} });
  });

  app.put('/admin/merch', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    if (!CREATE_ROLES.has(gate.staff!.role)) {
      return c.json({ ok: false, error: 'Vitrine : manager ou admin.' }, 403);
    }
    const body = await c.req.json().catch(() => null);
    const popularIds = Array.isArray(body?.popularIds) ? body.popularIds.map(String) : [];
    const recommendedIds = Array.isArray(body?.recommendedIds) ? body.recommendedIds.map(String) : [];
    const trendingTerms = Array.isArray(body?.trendingTerms) ? body.trendingTerms.map(String) : [];
    const payload = { popularIds, recommendedIds, trendingTerms };
    const before = await query<{ payload: unknown }>(`SELECT payload FROM catalog_settings WHERE key = 'merch'`);
    await query(
      `INSERT INTO catalog_settings (key, payload, updated_at) VALUES ('merch', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [JSON.stringify(payload)],
    );
    await audit(gate.staff!.id, 'put', 'merch', 'merch', before.rows[0]?.payload, payload);
    return c.json({ ok: true, merch: payload });
  });

  app.get('/admin/catalog/coverage', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const result = await query<{
      products: string;
      active: string;
      with_barcode: string;
      with_real_media: string;
      with_price_source: string;
      categories: string;
    }>(
      `SELECT
         COUNT(*)::text AS products,
         COUNT(*) FILTER (WHERE p.active)::text AS active,
         COUNT(*) FILTER (WHERE p.barcode IS NOT NULL)::text AS with_barcode,
         COUNT(*) FILTER (WHERE COALESCE(p.payload->>'priceSource', '') <> '')::text AS with_price_source,
         COUNT(DISTINCT p.category_id)::text AS categories,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM product_media m
           WHERE m.product_id = p.id AND m.kind = 'image' AND m.is_placeholder = FALSE
         ))::text AS with_real_media
       FROM products p`,
    );
    const row = result.rows[0];
    return c.json({
      ok: true,
      coverage: {
        products: Number(row?.products ?? 0),
        active: Number(row?.active ?? 0),
        withBarcode: Number(row?.with_barcode ?? 0),
        withRealMedia: Number(row?.with_real_media ?? 0),
        withPriceSource: Number(row?.with_price_source ?? 0),
        categories: Number(row?.categories ?? 0),
      },
    });
  });

  app.get('/admin/catalog/import/:runId', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const runId = Number(c.req.param('runId'));
    if (!Number.isSafeInteger(runId) || runId < 1) return c.json({ ok: false, error: 'runId invalide.' }, 400);
    const run = await query(
      `SELECT id, source, manifest_version, manifest_checksum_sha256, dry_run, status,
              report, started_at, finished_at
       FROM catalog_import_runs WHERE id = $1`,
      [runId],
    );
    if (!run.rows[0]) return c.json({ ok: false, error: 'Import introuvable.' }, 404);
    const rows = await query(
      `SELECT row_number, requested_id, resolved_product_id, sku, barcode, action, errors
       FROM catalog_import_rows WHERE run_id = $1 ORDER BY row_number LIMIT 2000`,
      [runId],
    );
    return c.json({ ok: true, run: run.rows[0], rows: rows.rows });
  });

  app.post('/admin/catalog/import', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    if (!CREATE_ROLES.has(gate.staff!.role)) {
      return c.json({ ok: false, error: 'Import catalogue : manager ou admin.' }, 403);
    }
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ ok: false, error: 'Manifeste JSON requis.' }, 400);
    }
    const manifest = body.manifest ?? body;
    const dryRun = body.dryRun === true;
    try {
      const report = await importCatalog(manifest, {
        dryRun,
        source: `admin:${gate.staff!.id}`,
      });
      if (!dryRun) {
        await audit(gate.staff!.id, 'import', 'catalog', String(report.runId), null, report);
      }
      return c.json({ ok: true, report });
    } catch (error) {
      if (error instanceof CatalogValidationError) {
        return c.json({ ok: false, error: error.message, issues: error.issues }, 400);
      }
      if (isUniqueConflict(error)) return c.json({ ok: false, error: 'Conflit de SKU ou code-barres.' }, 409);
      throw error;
    }
  });

  app.get('/admin/products', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const q = String(c.req.query('q') ?? '').trim().toLowerCase();
    const categoryId = String(c.req.query('categoryId') ?? '').trim();
    const stock = String(c.req.query('stock') ?? 'all');
    const merch = String(c.req.query('merch') ?? '');
    const storeId = scopedStore(gate.staff!, c.req.query('storeId') ?? null) ?? 'su-aeroport';

    const merchRow = await query<{ payload: { popularIds?: string[]; recommendedIds?: string[] } }>(
      `SELECT payload FROM catalog_settings WHERE key = 'merch'`,
    );
    const popular = new Set(merchRow.rows[0]?.payload?.popularIds ?? []);
    const recommended = new Set(merchRow.rows[0]?.payload?.recommendedIds ?? []);

    const rows = await query<ProductRow & { qty: string | null; reserved: string | null; min_qty: string | null }>(
      `SELECT p.id, p.category_id, p.payload,
              s.qty::text, s.reserved::text, s.min_qty::text
       FROM products p
       LEFT JOIN product_stock s ON s.product_id = p.id AND s.store_id = $1
       ORDER BY p.payload->>'name'`,
      [storeId],
    );

    let list = rows.rows.map((r) => {
      const mapped = mapProduct(r, r.qty != null ? { qty: r.qty, reserved: r.reserved ?? '0', min_qty: r.min_qty ?? '0' } : null);
      return {
        ...mapped,
        flags: {
          popular: popular.has(r.id),
          recommended: recommended.has(r.id),
          promo: Boolean(r.payload.oldPrice && Number(r.payload.oldPrice) > Number(r.payload.price)),
        },
      };
    });

    if (q) {
      list = list.filter((p) => {
        const name = String(p.payload.name ?? '').toLowerCase();
        const sku = String(p.payload.sku ?? p.id).toLowerCase();
        const producer = String(p.payload.producer ?? '').toLowerCase();
        return name.includes(q) || sku.includes(q) || producer.includes(q) || p.id.includes(q);
      });
    }
    if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
    if (stock === 'in') list = list.filter((p) => (p.stock?.available ?? 0) > 0);
    if (stock === 'out') list = list.filter((p) => (p.stock?.available ?? 0) <= 0);
    if (stock === 'alert') list = list.filter((p) => p.stock?.alert);
    if (merch === 'popular') list = list.filter((p) => p.flags.popular);
    if (merch === 'promo') list = list.filter((p) => p.flags.promo);
    if (merch === 'recommended') list = list.filter((p) => p.flags.recommended);

    return c.json({ ok: true, storeId, products: list, total: list.length });
  });

  app.get('/admin/products/:id', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const id = c.req.param('id');
    const storeId = scopedStore(gate.staff!, c.req.query('storeId') ?? null) ?? 'su-aeroport';
    const found = await query<ProductRow>('SELECT id, category_id, payload FROM products WHERE id = $1', [id]);
    if (!found.rows[0]) return c.json({ ok: false, error: 'Produit introuvable.' }, 404);
    const st = await query<{ qty: string; reserved: string; min_qty: string }>(
      `SELECT qty::text, reserved::text, min_qty::text FROM product_stock WHERE product_id = $1 AND store_id = $2`,
      [id, storeId],
    );
    const allStores = await query<{ store_id: string; qty: string; reserved: string; min_qty: string }>(
      `SELECT store_id, qty::text, reserved::text, min_qty::text FROM product_stock WHERE product_id = $1`,
      [id],
    );
    const hist = await query(
      `SELECT id, store_id, delta::text, reason, note, created_at, actor_staff_id
       FROM stock_moves WHERE product_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [id],
    );
    return c.json({
      ok: true,
      product: mapProduct(found.rows[0], st.rows[0] ?? null),
      stocks: allStores.rows.map((r) => ({
        storeId: r.store_id,
        qty: Number(r.qty),
        reserved: Number(r.reserved),
        minQty: Number(r.min_qty),
        available: Number(r.qty) - Number(r.reserved),
      })),
      moves: hist.rows,
    });
  });

  app.post('/admin/products', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    if (!CREATE_ROLES.has(gate.staff!.role)) {
      return c.json({ ok: false, error: 'Création SKU : manager ou admin.' }, 403);
    }
    const body = await c.req.json().catch(() => null);
    const name = String(body?.name ?? '').trim();
    const unit = String(body?.unit ?? '').trim();
    const categoryId = String(body?.categoryId ?? '').trim();
    const price = Math.round(num(body?.price));
    if (name.length < 2 || name.length > 120) return c.json({ ok: false, error: 'Nom : 2 à 120 caractères.' }, 400);
    if (!unit) return c.json({ ok: false, error: 'Unité requise.' }, 400);
    if (price < 0) return c.json({ ok: false, error: 'Prix FCFA invalide.' }, 400);
    const cat = await query('SELECT id FROM categories WHERE id = $1', [categoryId]);
    if (!cat.rowCount) return c.json({ ok: false, error: 'Rayon inconnu.' }, 400);
    let id = slugify(String(body?.id ?? name));
    if (!id) return c.json({ ok: false, error: 'Identifiant SKU invalide.' }, 400);
    const clash = await query('SELECT id FROM products WHERE id = $1', [id]);
    if (clash.rowCount) id = `${id}-${randomBytes(2).toString('hex')}`;
    const oldPrice = body?.oldPrice != null ? Math.round(num(body.oldPrice)) : undefined;
    const sku = String(body?.sku ?? id).trim();
    const barcodeRaw = typeof body?.barcode === 'string' ? body.barcode.trim() : '';
    const barcode = normalizeBarcode(barcodeRaw);
    if (!sku) return c.json({ ok: false, error: 'SKU requis.' }, 400);
    if (barcodeRaw && (!barcode || !hasValidGtinChecksum(barcode))) {
      return c.json({ ok: false, error: 'Code-barres GTIN invalide.' }, 400);
    }
    const payload: Record<string, unknown> = {
      id,
      name,
      unit,
      price,
      categoryId,
      sku,
      barcode,
      producer: typeof body?.producer === 'string' ? body.producer.trim() : undefined,
      description: typeof body?.description === 'string' ? body.description.trim() : undefined,
      provenance: typeof body?.provenance === 'object' && body.provenance ? body.provenance : undefined,
      priceSource: typeof body?.priceSource === 'string' ? body.priceSource.trim() : undefined,
      priceStatus: typeof body?.priceStatus === 'string' ? body.priceStatus.trim() : undefined,
      priceObservedAt: typeof body?.priceObservedAt === 'string' ? body.priceObservedAt.trim() : undefined,
      inStock: true,
    };
    if (oldPrice && oldPrice > price) {
      payload.oldPrice = oldPrice;
      payload.discount = discountLabel(price, oldPrice);
    }
    if (body?.badge === 'nouveau' || body?.badge === 'local') payload.badge = body.badge;
    try {
      await query(
        'INSERT INTO products (id, category_id, payload, sku, barcode, active) VALUES ($1, $2, $3::jsonb, $4, $5, TRUE)',
        [id, categoryId, JSON.stringify(payload), sku, barcode],
      );
    } catch (error) {
      if (isUniqueConflict(error)) return c.json({ ok: false, error: 'SKU ou code-barres déjà utilisé.' }, 409);
      throw error;
    }
    await query(`
      INSERT INTO product_stock (product_id, store_id, qty, reserved, min_qty)
      SELECT $1, id, 0, 0, 6 FROM stores
      ON CONFLICT DO NOTHING
    `, [id]);
    await audit(gate.staff!.id, 'create', 'product', id, null, payload);
    return c.json({ ok: true, product: mapProduct({ id, category_id: categoryId, payload }) }, 201);
  });

  app.patch('/admin/products/:id', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const id = c.req.param('id');
    const found = await query<ProductRow>('SELECT id, category_id, payload FROM products WHERE id = $1', [id]);
    if (!found.rows[0]) return c.json({ ok: false, error: 'Produit introuvable.' }, 404);
    const body = await c.req.json().catch(() => null);
    const payload = { ...found.rows[0].payload };
    let categoryId = found.rows[0].category_id;
    const staff = gate.staff!;

    if (typeof body?.name === 'string' && body.name.trim().length >= 2) payload.name = body.name.trim();
    if (typeof body?.unit === 'string' && body.unit.trim()) payload.unit = body.unit.trim();
    if (typeof body?.producer === 'string') payload.producer = body.producer.trim();
    if (typeof body?.description === 'string') payload.description = body.description.trim();
    if (typeof body?.sku === 'string') payload.sku = body.sku.trim();
    if (typeof body?.barcode === 'string') {
      const barcode = normalizeBarcode(body.barcode);
      if (body.barcode.trim() && (!barcode || !hasValidGtinChecksum(barcode))) {
        return c.json({ ok: false, error: 'Code-barres GTIN invalide.' }, 400);
      }
      payload.barcode = barcode;
    }
    if (typeof body?.provenance === 'object' && body.provenance) payload.provenance = body.provenance;
    for (const key of ['priceSource', 'priceStatus', 'priceObservedAt'] as const) {
      if (typeof body?.[key] === 'string') payload[key] = body[key].trim();
    }
    if (typeof body?.nutrition === 'object' && body.nutrition) payload.nutrition = body.nutrition;

    if (PRICE_ROLES.has(staff.role)) {
      if (body?.price != null) {
        const price = Math.round(num(body.price));
        if (price < 0) return c.json({ ok: false, error: 'Prix FCFA invalide.' }, 400);
        payload.price = price;
      }
      if (body?.oldPrice === null) {
        delete payload.oldPrice;
        delete payload.discount;
      } else if (body?.oldPrice != null) {
        payload.oldPrice = Math.round(num(body.oldPrice));
      }
      const price = num(payload.price);
      const oldPrice = payload.oldPrice != null ? num(payload.oldPrice) : undefined;
      const disc = discountLabel(price, oldPrice);
      if (disc) payload.discount = disc;
      else delete payload.discount;
      if (typeof body?.categoryId === 'string') {
        const cat = await query('SELECT id FROM categories WHERE id = $1', [body.categoryId]);
        if (!cat.rowCount) return c.json({ ok: false, error: 'Rayon inconnu.' }, 400);
        categoryId = body.categoryId;
        payload.categoryId = categoryId;
      }
      if (body?.badge === null) delete payload.badge;
      else if (body?.badge === 'nouveau' || body?.badge === 'local' || body?.badge === 'rupture') {
        payload.badge = body.badge;
      }
    }

    if (body?.inStock === true || body?.inStock === false) {
      applyRupture(payload, body.inStock);
    }

    const sku = String(payload.sku ?? id).trim();
    const barcode = normalizeBarcode(payload.barcode);
    try {
      await query(
        `UPDATE products
         SET category_id = $2, payload = $3::jsonb, sku = $4, barcode = $5
         WHERE id = $1`,
        [id, categoryId, JSON.stringify(payload), sku, barcode],
      );
    } catch (error) {
      if (isUniqueConflict(error)) return c.json({ ok: false, error: 'SKU ou code-barres déjà utilisé.' }, 409);
      throw error;
    }
    await audit(staff.id, 'patch', 'product', id, found.rows[0].payload, payload);
    return c.json({ ok: true, product: mapProduct({ id, category_id: categoryId, payload }) });
  });

  app.get('/admin/stock', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const storeId = scopedStore(gate.staff!, c.req.query('storeId') ?? null) ?? 'su-aeroport';
    const alertOnly = c.req.query('alerts') === '1';
    const rows = await query<{
      product_id: string;
      name: string;
      unit: string;
      qty: string;
      reserved: string;
      min_qty: string;
      in_stock: string | null;
    }>(
      `SELECT s.product_id, p.payload->>'name' AS name, p.payload->>'unit' AS unit,
              s.qty::text, s.reserved::text, s.min_qty::text, p.payload->>'inStock' AS in_stock
       FROM product_stock s
       JOIN products p ON p.id = s.product_id
       WHERE s.store_id = $1
       ORDER BY p.payload->>'name'`,
      [storeId],
    );
    let items = rows.rows.map((r) => {
      const qty = Number(r.qty);
      const reserved = Number(r.reserved);
      const minQty = Number(r.min_qty);
      const available = qty - reserved;
      return {
        productId: r.product_id,
        name: r.name,
        unit: r.unit,
        qty,
        reserved,
        minQty,
        available,
        alert: available <= minQty,
        inStock: r.in_stock !== 'false',
      };
    });
    if (alertOnly) items = items.filter((i) => i.alert);
    return c.json({ ok: true, storeId, items, alerts: items.filter((i) => i.alert).length });
  });

  app.post('/admin/stock/moves', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const body = await c.req.json().catch(() => null);
    const productId = String(body?.productId ?? '').trim();
    let storeId = scopedStore(gate.staff!, body?.storeId ?? null) ?? 'su-aeroport';
    if (gate.staff!.role !== 'admin' && gate.staff!.store_id && storeId !== gate.staff!.store_id) {
      return c.json({ ok: false, error: 'Stock limité à votre magasin.' }, 403);
    }
    const reason = String(body?.reason ?? '');
    const allowed = new Set(['receipt', 'sale', 'adjust', 'shrink', 'pick_unavailable', 'transfer']);
    if (!allowed.has(reason)) return c.json({ ok: false, error: 'Motif de mouvement invalide.' }, 400);
    let delta = num(body?.delta);
    if (reason === 'sale' || reason === 'shrink') {
      delta = -Math.abs(delta);
    }
    if (reason === 'pick_unavailable') delta = Math.abs(delta);
    if (reason === 'receipt') delta = Math.abs(delta);
    if (!delta) return c.json({ ok: false, error: 'Quantité nulle.' }, 400);
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (!note && (reason === 'adjust' || reason === 'shrink')) {
      return c.json({ ok: false, error: 'Un motif écrit est obligatoire pour un ajustement.' }, 400);
    }

    const exists = await query('SELECT id FROM products WHERE id = $1', [productId]);
    if (!exists.rowCount) return c.json({ ok: false, error: 'Produit introuvable.' }, 404);

    await query(
      `INSERT INTO product_stock (product_id, store_id, qty, reserved, min_qty)
       VALUES ($1, $2, 0, 0, 6)
       ON CONFLICT DO NOTHING`,
      [productId, storeId],
    );

    if (reason === 'transfer') {
      const toStore = String(body?.toStoreId ?? '').trim();
      if (!toStore || toStore === storeId) return c.json({ ok: false, error: 'Magasin destination requis.' }, 400);
      const qty = Math.abs(delta);
      const moveOut = `mv-${randomBytes(6).toString('hex')}`;
      const moveIn = `mv-${randomBytes(6).toString('hex')}`;
      const removed = await query(
        `UPDATE product_stock SET qty = qty - $3, updated_at = NOW()
         WHERE product_id = $1 AND store_id = $2 AND qty - reserved >= $3`,
        [productId, storeId, qty],
      );
      if (!removed.rowCount) return c.json({ ok: false, error: 'Stock insuffisant pour ce transfert.' }, 409);
      await query(
        `INSERT INTO product_stock (product_id, store_id, qty, reserved, min_qty)
         VALUES ($1, $2, $3, 0, 6)
         ON CONFLICT (product_id, store_id) DO UPDATE SET qty = product_stock.qty + EXCLUDED.qty, updated_at = NOW()`,
        [productId, toStore, qty],
      );
      await query(
        `INSERT INTO stock_moves (id, product_id, store_id, delta, reason, ref_type, actor_staff_id, note)
         VALUES ($1, $2, $3, $4, 'transfer', 'admin', $5, $6)`,
        [moveOut, productId, storeId, -qty, gate.staff!.id, note || `vers ${toStore}`],
      );
      await query(
        `INSERT INTO stock_moves (id, product_id, store_id, delta, reason, ref_type, actor_staff_id, note)
         VALUES ($1, $2, $3, $4, 'transfer', 'admin', $5, $6)`,
        [moveIn, productId, toStore, qty, gate.staff!.id, note || `depuis ${storeId}`],
      );
      return c.json({ ok: true, transfer: { from: storeId, to: toStore, qty } });
    }

    const moveId = `mv-${randomBytes(6).toString('hex')}`;
    const changed = await query<{ qty_before: string; qty_after: string }>(
      `UPDATE product_stock SET qty = qty + $3, updated_at = NOW()
       WHERE product_id = $1 AND store_id = $2 AND qty + $3 >= reserved
       RETURNING (qty - $3)::text AS qty_before, qty::text AS qty_after`,
      [productId, storeId, delta],
    );
    if (!changed.rows[0]) return c.json({ ok: false, error: 'Mouvement impossible : stock insuffisant.' }, 409);
    if (typeof body?.minQty === 'number') {
      await query(`UPDATE product_stock SET min_qty = $3, updated_at = NOW() WHERE product_id = $1 AND store_id = $2`, [
        productId,
        storeId,
        body.minQty,
      ]);
    }
    await query(
      `INSERT INTO stock_moves (
         id, product_id, store_id, delta, reason, ref_type, actor_staff_id, note, qty_before, qty_after
       ) VALUES ($1, $2, $3, $4, $5, 'admin', $6, $7, $8, $9)`,
      [
        moveId,
        productId,
        storeId,
        delta,
        reason,
        gate.staff!.id,
        note || null,
        changed.rows[0].qty_before,
        changed.rows[0].qty_after,
      ],
    );
    const st = await query<{ qty: string; reserved: string; min_qty: string }>(
      `SELECT qty::text, reserved::text, min_qty::text FROM product_stock WHERE product_id = $1 AND store_id = $2`,
      [productId, storeId],
    );
    return c.json({ ok: true, moveId, stock: st.rows[0] });
  });

  app.patch('/admin/stock/min', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const body = await c.req.json().catch(() => null);
    const productId = String(body?.productId ?? '');
    const storeId = scopedStore(gate.staff!, body?.storeId ?? null) ?? 'su-aeroport';
    const minQty = num(body?.minQty);
    await query(
      `INSERT INTO product_stock (product_id, store_id, qty, reserved, min_qty)
       VALUES ($1, $2, 0, 0, $3)
       ON CONFLICT (product_id, store_id) DO UPDATE SET min_qty = $3, updated_at = NOW()`,
      [productId, storeId, minQty],
    );
    return c.json({ ok: true });
  });

  app.get('/admin/audit', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    if (gate.staff!.role !== 'admin') return c.json({ ok: false, error: 'Audit réservé à l’admin.' }, 403);
    const rows = await query(
      `SELECT id, actor_staff_id, action, entity, entity_id, created_at
       FROM catalog_audit ORDER BY created_at DESC LIMIT 80`,
    );
    return c.json({ ok: true, events: rows.rows });
  });

  app.get('/admin/overview', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const storeId = scopedStore(gate.staff!, c.req.query('storeId') ?? null) ?? 'su-aeroport';
    const counts = await query<{ products: string; out: string; alerts: string; cats: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM products) AS products,
         (SELECT COUNT(*)::text FROM product_stock WHERE store_id = $1 AND (qty - reserved) <= 0) AS out,
         (SELECT COUNT(*)::text FROM product_stock WHERE store_id = $1 AND (qty - reserved) <= min_qty) AS alerts,
         (SELECT COUNT(*)::text FROM categories) AS cats`,
      [storeId],
    );
    const promo = await query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM products WHERE (payload->>'oldPrice') IS NOT NULL`,
    );
    const ops = await query<{
      orders_today: string;
      orders_open: string;
      pick_queue: string;
      pick_live: string;
      deliver_live: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM orders WHERE created_at >= CURRENT_DATE) AS orders_today,
         (SELECT COUNT(*)::text FROM orders
           WHERE status NOT IN ('delivered', 'cancelled')) AS orders_open,
         (SELECT COUNT(*)::text FROM ops.pick_jobs WHERE status = 'queued') AS pick_queue,
         (SELECT COUNT(*)::text FROM ops.pick_jobs WHERE status IN ('assigned', 'picking')) AS pick_live,
         (SELECT COUNT(*)::text FROM ops.deliveries
           WHERE status NOT IN ('delivered', 'failed', 'cancelled')) AS deliver_live`,
    );
    const alerts = await query<{
      product_id: string;
      name: string;
      available: string;
      min_qty: string;
    }>(
      `SELECT p.id AS product_id,
              COALESCE(p.payload->>'name', p.id) AS name,
              (s.qty - s.reserved)::text AS available,
              s.min_qty::text
       FROM product_stock s
       JOIN products p ON p.id = s.product_id
       WHERE s.store_id = $1 AND (s.qty - s.reserved) <= s.min_qty
       ORDER BY (s.qty - s.reserved) ASC
       LIMIT 8`,
      [storeId],
    );
    const ruptures = await query<{ id: string; name: string }>(
      `SELECT p.id, COALESCE(p.payload->>'name', p.id) AS name
       FROM products p
       JOIN product_stock s ON s.product_id = p.id
       WHERE s.store_id = $1 AND (s.qty - s.reserved) <= 0
       ORDER BY p.id
       LIMIT 6`,
      [storeId],
    );
    const orderStatuses = await query<{ status: string; n: string }>(
      `SELECT status, COUNT(*)::text AS n
       FROM orders
       WHERE created_at >= CURRENT_DATE - 29
       GROUP BY status
       ORDER BY COUNT(*) DESC`,
    );
    const paymentMethods = await query<{ label: string; n: string; amount: string }>(
      `SELECT COALESCE(NULLIF(payment_label, ''), 'Non renseigné') AS label,
              COUNT(*)::text AS n,
              COALESCE(SUM(total), 0)::text AS amount
       FROM orders
       WHERE created_at >= CURRENT_DATE - 29
       GROUP BY 1
       ORDER BY COUNT(*) DESC`,
    );
    const topProducts = await query<{
      product_id: string;
      name: string;
      qty: string;
      revenue: string;
    }>(
      `SELECT l.product_id,
              MAX(l.name) AS name,
              SUM(l.qty)::text AS qty,
              SUM(l.qty * l.unit_price)::text AS revenue
       FROM order_lines l
       JOIN orders o ON o.id = l.order_id
       WHERE o.created_at >= CURRENT_DATE - 29
       GROUP BY l.product_id
       ORDER BY SUM(l.qty) DESC, SUM(l.qty * l.unit_price) DESC
       LIMIT 8`,
    );
    const recentOrders = await query<{
      id: string;
      status: string;
      total: string;
      subtotal: string;
      delivery_fee: string;
      pick_fee: string;
      item_count: number;
      store_name: string | null;
      first_name: string;
      last_name: string;
      created_at: Date;
      missing_n: string;
      incidents_n: string;
      delivery_status: string | null;
    }>(
      `SELECT o.id, o.status, o.total::text, o.subtotal::text, o.delivery_fee::text,
              COALESCE(pp.amount, ${PICK_FEE})::text AS pick_fee,
              o.item_count, o.store_name, u.first_name, u.last_name, o.created_at,
              (SELECT COUNT(*)::text FROM order_lines l WHERE l.order_id = o.id AND l.unavailable) AS missing_n,
              (SELECT COUNT(*)::text FROM ops.delivery_incidents i WHERE i.order_id = o.id) AS incidents_n,
              d.status AS delivery_status
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN ops.staff_payouts pp ON pp.order_id = o.id AND pp.kind = 'pick'
       LEFT JOIN ops.deliveries d ON d.order_id = o.id
       ORDER BY o.created_at DESC
       LIMIT 8`,
    );
    const inventory = await query<{
      physical: string;
      reserved: string;
      available: string;
      sold_today: string;
      sold_30: string;
      received_30: string;
      shrink_30: string;
    }>(
      `SELECT
         (SELECT COALESCE(SUM(qty), 0)::text FROM product_stock WHERE store_id = $1) AS physical,
         (SELECT COALESCE(SUM(reserved), 0)::text FROM product_stock WHERE store_id = $1) AS reserved,
         (SELECT COALESCE(SUM(qty - reserved), 0)::text FROM product_stock WHERE store_id = $1) AS available,
         (SELECT COALESCE(-SUM(delta), 0)::text FROM stock_moves
            WHERE store_id = $1 AND reason = 'sale' AND created_at >= CURRENT_DATE) AS sold_today,
         (SELECT COALESCE(-SUM(delta), 0)::text FROM stock_moves
            WHERE store_id = $1 AND reason = 'sale' AND created_at >= CURRENT_DATE - 29) AS sold_30,
         (SELECT COALESCE(SUM(delta), 0)::text FROM stock_moves
            WHERE store_id = $1 AND reason = 'receipt' AND created_at >= CURRENT_DATE - 29) AS received_30,
         (SELECT COALESCE(-SUM(delta), 0)::text FROM stock_moves
            WHERE store_id = $1 AND reason IN ('shrink', 'pick_unavailable')
              AND created_at >= CURRENT_DATE - 29) AS shrink_30`,
      [storeId],
    );
    const stockTracking = await query<{
      product_id: string;
      name: string;
      initial_qty: string;
      sold: string;
      received: string;
      adjusted: string;
      reserved: string;
      remaining: string;
    }>(
      `WITH flow AS (
         SELECT product_id,
                COALESCE(-SUM(delta) FILTER (WHERE reason = 'sale'), 0) AS sold,
                COALESCE(SUM(delta) FILTER (WHERE reason = 'receipt'), 0) AS received,
                COALESCE(SUM(delta) FILTER (
                  WHERE reason NOT IN ('sale', 'receipt')
                ), 0) AS adjusted
         FROM stock_moves
         WHERE store_id = $1 AND created_at >= CURRENT_DATE - 29
         GROUP BY product_id
       )
       SELECT s.product_id,
              COALESCE(p.payload->>'name', s.product_id) AS name,
              (s.qty - COALESCE(f.received, 0) + COALESCE(f.sold, 0) - COALESCE(f.adjusted, 0))::text AS initial_qty,
              COALESCE(f.sold, 0)::text AS sold,
              COALESCE(f.received, 0)::text AS received,
              COALESCE(f.adjusted, 0)::text AS adjusted,
              s.reserved::text AS reserved,
              (s.qty - s.reserved)::text AS remaining
       FROM product_stock s
       JOIN products p ON p.id = s.product_id
       LEFT JOIN flow f ON f.product_id = s.product_id
       WHERE s.store_id = $1
         AND (COALESCE(f.sold, 0) > 0 OR COALESCE(f.received, 0) <> 0 OR s.reserved > 0)
       ORDER BY COALESCE(f.sold, 0) DESC, s.qty ASC
       LIMIT 10`,
      [storeId],
    );
    const days = await query<{
      d: string;
      orders: string;
      revenue: string;
      delivered: string;
      failed: string;
      packed: string;
    }>(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, INTERVAL '1 day')::date AS d
       ),
       rev AS (
         SELECT o.created_at::date AS d,
                COUNT(DISTINCT o.id)::text AS orders,
                COALESCE(SUM(l.qty * l.unit_price), 0)::text AS revenue
         FROM orders o
         LEFT JOIN order_lines l ON l.order_id = o.id
         WHERE o.created_at >= CURRENT_DATE - 29
         GROUP BY 1
       ),
       del AS (
         SELECT COALESCE(d.delivered_at, d.updated_at)::date AS d,
                COUNT(*) FILTER (WHERE d.status = 'delivered')::text AS delivered,
                COUNT(*) FILTER (WHERE d.status = 'failed')::text AS failed
         FROM ops.deliveries d
         WHERE COALESCE(d.delivered_at, d.updated_at) >= CURRENT_DATE - 29
         GROUP BY 1
       ),
       pk AS (
         SELECT COALESCE(p.packed_at, p.updated_at)::date AS d,
                COUNT(*)::text AS packed
         FROM ops.pick_jobs p
         WHERE p.status = 'packed' AND COALESCE(p.packed_at, p.updated_at) >= CURRENT_DATE - 29
         GROUP BY 1
       )
       SELECT days.d::text AS d,
              COALESCE(rev.orders, '0') AS orders,
              COALESCE(rev.revenue, '0') AS revenue,
              COALESCE(del.delivered, '0') AS delivered,
              COALESCE(del.failed, '0') AS failed,
              COALESCE(pk.packed, '0') AS packed
       FROM days
       LEFT JOIN rev ON rev.d = days.d
       LEFT JOIN del ON del.d = days.d
       LEFT JOIN pk ON pk.d = days.d
       ORDER BY days.d`,
    );
    const months = await query<{
      m: string;
      orders: string;
      revenue: string;
      delivered: string;
    }>(
      `WITH months AS (
         SELECT generate_series(
           date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
           date_trunc('month', CURRENT_DATE),
           INTERVAL '1 month'
         )::date AS m
       ),
       rev AS (
         SELECT date_trunc('month', o.created_at)::date AS m,
                COUNT(DISTINCT o.id)::text AS orders,
                COALESCE(SUM(l.qty * l.unit_price), 0)::text AS revenue
         FROM orders o
         LEFT JOIN order_lines l ON l.order_id = o.id
         WHERE o.created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
         GROUP BY 1
       ),
       del AS (
         SELECT date_trunc('month', COALESCE(d.delivered_at, d.updated_at))::date AS m,
                COUNT(*) FILTER (WHERE d.status = 'delivered')::text AS delivered
         FROM ops.deliveries d
         WHERE COALESCE(d.delivered_at, d.updated_at) >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
         GROUP BY 1
       )
       SELECT months.m::text AS m,
              COALESCE(rev.orders, '0') AS orders,
              COALESCE(rev.revenue, '0') AS revenue,
              COALESCE(del.delivered, '0') AS delivered
       FROM months
       LEFT JOIN rev ON rev.m = months.m
       LEFT JOIN del ON del.m = months.m
       ORDER BY months.m`,
    );
    const kpis = await query<{
      rev_today: string;
      rev_yday: string;
      rev_7: string;
      rev_30: string;
      rev_month: string;
      orders_yday: string;
      avg_basket: string;
      delivered_30: string;
      failed_30: string;
    }>(
      `SELECT
         (SELECT COALESCE(SUM(l.qty * l.unit_price), 0)::text FROM orders o
            JOIN order_lines l ON l.order_id = o.id WHERE o.created_at >= CURRENT_DATE) AS rev_today,
         (SELECT COALESCE(SUM(l.qty * l.unit_price), 0)::text FROM orders o
            JOIN order_lines l ON l.order_id = o.id
            WHERE o.created_at >= CURRENT_DATE - 1 AND o.created_at < CURRENT_DATE) AS rev_yday,
         (SELECT COALESCE(SUM(l.qty * l.unit_price), 0)::text FROM orders o
            JOIN order_lines l ON l.order_id = o.id WHERE o.created_at >= CURRENT_DATE - 6) AS rev_7,
         (SELECT COALESCE(SUM(l.qty * l.unit_price), 0)::text FROM orders o
            JOIN order_lines l ON l.order_id = o.id WHERE o.created_at >= CURRENT_DATE - 29) AS rev_30,
         (SELECT COALESCE(SUM(l.qty * l.unit_price), 0)::text FROM orders o
            JOIN order_lines l ON l.order_id = o.id
            WHERE o.created_at >= date_trunc('month', CURRENT_DATE)) AS rev_month,
         (SELECT COUNT(*)::text FROM orders
            WHERE created_at >= CURRENT_DATE - 1 AND created_at < CURRENT_DATE) AS orders_yday,
         (SELECT CASE WHEN COUNT(DISTINCT o.id) = 0 THEN '0'
                 ELSE (SUM(l.qty * l.unit_price) / COUNT(DISTINCT o.id))::text END
            FROM orders o JOIN order_lines l ON l.order_id = o.id
            WHERE o.created_at >= CURRENT_DATE - 29) AS avg_basket,
         (SELECT COUNT(*)::text FROM ops.deliveries
            WHERE status = 'delivered' AND COALESCE(delivered_at, updated_at) >= CURRENT_DATE - 29) AS delivered_30,
         (SELECT COUNT(*)::text FROM ops.deliveries
            WHERE status = 'failed' AND COALESCE(updated_at, created_at) >= CURRENT_DATE - 29) AS failed_30`,
    );
    const showMoney = PRICE_ROLES.has(gate.staff!.role);
    const dayRows = days.rows.map((r) => ({
      date: r.d.slice(0, 10),
      orders: Number(r.orders),
      revenue: showMoney ? Number(r.revenue) : 0,
      delivered: Number(r.delivered),
      failed: Number(r.failed),
      packed: Number(r.packed),
    }));
    const monthRows = months.rows.map((r) => ({
      date: r.m.slice(0, 7),
      orders: Number(r.orders),
      revenue: showMoney ? Number(r.revenue) : 0,
      delivered: Number(r.delivered),
    }));
    const k = kpis.rows[0];
    return c.json({
      ok: true,
      storeId,
      showMoney,
      stats: {
        products: Number(counts.rows[0]?.products ?? 0),
        outOfStock: Number(counts.rows[0]?.out ?? 0),
        alerts: Number(counts.rows[0]?.alerts ?? 0),
        promotions: Number(promo.rows[0]?.c ?? 0),
        categories: Number(counts.rows[0]?.cats ?? 0),
        ordersToday: Number(ops.rows[0]?.orders_today ?? 0),
        ordersOpen: Number(ops.rows[0]?.orders_open ?? 0),
        pickQueue: Number(ops.rows[0]?.pick_queue ?? 0),
        pickLive: Number(ops.rows[0]?.pick_live ?? 0),
        deliverLive: Number(ops.rows[0]?.deliver_live ?? 0),
        ordersYesterday: Number(k?.orders_yday ?? 0),
        revenueToday: showMoney ? Number(k?.rev_today ?? 0) : null,
        revenueYesterday: showMoney ? Number(k?.rev_yday ?? 0) : null,
        revenue7d: showMoney ? Number(k?.rev_7 ?? 0) : null,
        revenue30d: showMoney ? Number(k?.rev_30 ?? 0) : null,
        revenueMonth: showMoney ? Number(k?.rev_month ?? 0) : null,
        avgBasket: showMoney ? Math.round(Number(k?.avg_basket ?? 0)) : null,
        delivered30d: Number(k?.delivered_30 ?? 0),
        failed30d: Number(k?.failed_30 ?? 0),
      },
      series: { days: dayRows, months: monthRows },
      breakdowns: {
        orderStatuses: orderStatuses.rows.map((r) => ({ label: r.status, n: Number(r.n) })),
        paymentMethods: paymentMethods.rows.map((r) => ({
          label: r.label,
          n: Number(r.n),
          amount: showMoney ? Number(r.amount) : null,
        })),
      },
      topProducts: topProducts.rows.map((r) => ({
        productId: r.product_id,
        name: r.name,
        qty: Number(r.qty),
        revenue: showMoney ? Number(r.revenue) : null,
      })),
      recentOrders: recentOrders.rows.map((r) => ({
        id: r.id,
        status: r.status,
        total: showMoney ? Number(r.total) : null,
        subtotal: showMoney ? Number(r.subtotal) : null,
        deliveryFee: showMoney ? Number(r.delivery_fee) : null,
        pickFee: showMoney ? Number(r.pick_fee) : null,
        itemCount: r.item_count,
        storeName: r.store_name,
        customerName: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'Client',
        createdAt: r.created_at,
        missingCount: Number(r.missing_n),
        incidentCount: Number(r.incidents_n),
        deliveryStatus: r.delivery_status,
      })),
      inventory: {
        physical: Number(inventory.rows[0]?.physical ?? 0),
        reserved: Number(inventory.rows[0]?.reserved ?? 0),
        available: Number(inventory.rows[0]?.available ?? 0),
        soldToday: Number(inventory.rows[0]?.sold_today ?? 0),
        sold30d: Number(inventory.rows[0]?.sold_30 ?? 0),
        received30d: Number(inventory.rows[0]?.received_30 ?? 0),
        shrink30d: Number(inventory.rows[0]?.shrink_30 ?? 0),
      },
      stockTracking: stockTracking.rows.map((r) => ({
        productId: r.product_id,
        name: r.name,
        initialQty: Number(r.initial_qty),
        sold: Number(r.sold),
        received: Number(r.received),
        adjusted: Number(r.adjusted),
        reserved: Number(r.reserved),
        remaining: Number(r.remaining),
      })),
      alertItems: alerts.rows.map((r) => ({
        productId: r.product_id,
        name: r.name,
        available: Number(r.available),
        minQty: Number(r.min_qty),
      })),
      ruptures: ruptures.rows,
    });
  });

  app.get('/admin/orders', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const staff = gate.staff!;
    const showMoney = PRICE_ROLES.has(staff.role);
    const storeId = scopedStore(staff, c.req.query('storeId') ?? null);
    const q = (c.req.query('q') ?? '').trim();
    const tab = (c.req.query('tab') ?? 'all').trim();
    const values: unknown[] = [];
    const where: string[] = ['TRUE'];
    if (storeId) {
      values.push(storeId);
      where.push(`o.store_id = $${values.length}`);
    }
    if (q) {
      values.push(`%${q.replace(/%/g, '')}%`);
      const i = values.length;
      where.push(
        `(o.id ILIKE $${i} OR u.first_name ILIKE $${i} OR u.last_name ILIKE $${i} OR COALESCE(u.phone, '') ILIKE $${i})`,
      );
    }
    if (tab === 'open') where.push(`o.status NOT IN ('delivered', 'cancelled')`);
    else if (tab === 'delivered') where.push(`o.status = 'delivered'`);
    else if (tab === 'cancelled') where.push(`o.status = 'cancelled'`);
    else if (tab === 'failed') where.push(`d.status = 'failed'`);
    else if (tab === 'disputes') {
      where.push(`EXISTS (SELECT 1 FROM ops.delivery_incidents i WHERE i.order_id = o.id)`);
    } else if (tab === 'missing') {
      where.push(`EXISTS (SELECT 1 FROM order_lines l WHERE l.order_id = o.id AND l.unavailable)`);
    }
    const rows = await query<{
      id: string;
      status: string;
      total: string;
      subtotal: string;
      delivery_fee: string;
      pick_fee: string;
      item_count: number;
      store_name: string | null;
      first_name: string;
      last_name: string;
      phone: string;
      created_at: Date;
      pick_status: string | null;
      delivery_status: string | null;
      missing_n: string;
      noted_n: string;
      incidents_n: string;
    }>(
      `SELECT o.id, o.status, o.total::text, o.subtotal::text, o.delivery_fee::text,
              COALESCE(pp.amount, ${PICK_FEE})::text AS pick_fee,
              o.item_count, o.store_name, u.first_name, u.last_name, u.phone, o.created_at,
              j.status AS pick_status, d.status AS delivery_status,
              (SELECT COUNT(*)::text FROM order_lines l WHERE l.order_id = o.id AND l.unavailable) AS missing_n,
              (SELECT COUNT(*)::text FROM order_lines l WHERE l.order_id = o.id AND btrim(l.note) <> '') AS noted_n,
              (SELECT COUNT(*)::text FROM ops.delivery_incidents i WHERE i.order_id = o.id) AS incidents_n
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN ops.pick_jobs j ON j.order_id = o.id
       LEFT JOIN ops.deliveries d ON d.order_id = o.id
       LEFT JOIN ops.staff_payouts pp ON pp.order_id = o.id AND pp.kind = 'pick'
       WHERE ${where.join(' AND ')}
       ORDER BY o.created_at DESC
       LIMIT 200`,
      values,
    );
    const counts = await query<{
      all_n: string;
      open: string;
      delivered: string;
      cancelled: string;
      failed: string;
      disputes: string;
      missing: string;
    }>(
      `SELECT
         COUNT(*)::text AS all_n,
         COUNT(*) FILTER (WHERE o.status NOT IN ('delivered', 'cancelled'))::text AS open,
         COUNT(*) FILTER (WHERE o.status = 'delivered')::text AS delivered,
         COUNT(*) FILTER (WHERE o.status = 'cancelled')::text AS cancelled,
         COUNT(*) FILTER (WHERE d.status = 'failed')::text AS failed,
         COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM ops.delivery_incidents i WHERE i.order_id = o.id))::text AS disputes,
         COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM order_lines l WHERE l.order_id = o.id AND l.unavailable))::text AS missing
       FROM orders o
       LEFT JOIN ops.deliveries d ON d.order_id = o.id
       WHERE $1::text IS NULL OR o.store_id = $1`,
      [storeId],
    );
    return c.json({
      ok: true,
      showMoney,
      counts: {
        all: Number(counts.rows[0]?.all_n ?? 0),
        open: Number(counts.rows[0]?.open ?? 0),
        delivered: Number(counts.rows[0]?.delivered ?? 0),
        cancelled: Number(counts.rows[0]?.cancelled ?? 0),
        failed: Number(counts.rows[0]?.failed ?? 0),
        disputes: Number(counts.rows[0]?.disputes ?? 0),
        missing: Number(counts.rows[0]?.missing ?? 0),
      },
      orders: rows.rows.map((r) => ({
        id: r.id,
        status: r.status,
        pickStatus: r.pick_status,
        deliveryStatus: r.delivery_status,
        total: showMoney ? Number(r.total) : null,
        subtotal: showMoney ? Number(r.subtotal) : null,
        deliveryFee: showMoney ? Number(r.delivery_fee) : null,
        pickFee: showMoney ? Number(r.pick_fee) : null,
        itemCount: r.item_count,
        storeName: r.store_name,
        customerName: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'Client',
        customerPhone: r.phone,
        createdAt: r.created_at,
        missingCount: Number(r.missing_n),
        notedCount: Number(r.noted_n),
        incidentCount: Number(r.incidents_n),
      })),
    });
  });

  app.get('/admin/orders/:id', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const staff = gate.staff!;
    const showMoney = PRICE_ROLES.has(staff.role);
    const id = c.req.param('id');
    const storeId = scopedStore(staff, null);
    const head = await query<{
      id: string;
      status: string;
      total: string;
      subtotal: string;
      delivery_fee: string;
      discount: string;
      item_count: number;
      store_id: string | null;
      store_name: string | null;
      payment_label: string | null;
      payment_status: string | null;
      day_label: string | null;
      slot_label: string | null;
      address_label: string | null;
      address_line: string | null;
      address_city: string | null;
      address_phone: string | null;
      comment: string | null;
      created_at: Date;
      first_name: string;
      last_name: string;
      phone: string;
      pick_status: string | null;
      picker_name: string | null;
      delivery_status: string | null;
      courier_name: string | null;
      failed_reason: string | null;
      failed_reason_code: string | null;
      pick_fee: string;
      deliver_payout: string | null;
    }>(
      `SELECT o.id, o.status, o.total::text, o.subtotal::text, o.delivery_fee::text, o.discount::text,
              o.item_count, o.store_id, o.store_name, o.payment_label, o.payment_status,
              o.day_label, o.slot_label, o.address_label, o.address_line, o.address_city, o.address_phone,
              o.comment, o.created_at,
              u.first_name, u.last_name, u.phone,
              j.status AS pick_status,
              NULLIF(trim(COALESCE(pk.first_name, '') || ' ' || COALESCE(pk.last_name, '')), '') AS picker_name,
              d.status AS delivery_status,
              NULLIF(trim(COALESCE(cr.first_name, '') || ' ' || COALESCE(cr.last_name, '')), '') AS courier_name,
              d.failed_reason, d.failed_reason_code,
              COALESCE(pp.amount, ${PICK_FEE})::text AS pick_fee,
              dp.amount::text AS deliver_payout
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN ops.pick_jobs j ON j.order_id = o.id
       LEFT JOIN ops.staff pk ON pk.id = j.picker_id
       LEFT JOIN ops.deliveries d ON d.order_id = o.id
       LEFT JOIN ops.staff cr ON cr.id = d.courier_id
       LEFT JOIN ops.staff_payouts pp ON pp.order_id = o.id AND pp.kind = 'pick'
       LEFT JOIN ops.staff_payouts dp ON dp.order_id = o.id AND dp.kind = 'deliver'
       WHERE o.id = $1 AND ($2::text IS NULL OR o.store_id = $2)`,
      [id, storeId],
    );
    if (!head.rows[0]) return c.json({ ok: false, error: 'Commande introuvable.' }, 404);
    const o = head.rows[0];
    const lines = await query<{
      product_id: string;
      name: string;
      unit: string;
      qty: number;
      unit_price: number;
      picked_qty: number;
      unavailable: boolean;
      note: string | null;
    }>(
      `SELECT product_id, name, unit, qty, unit_price, picked_qty, unavailable, note
       FROM order_lines WHERE order_id = $1 ORDER BY position, product_id`,
      [id],
    );
    const incidents = await query<{
      id: string;
      reason_code: string;
      reason_text: string;
      created_at: Date;
      client_action: string | null;
      client_note: string | null;
    }>(
      `SELECT i.id, i.reason_code, i.reason_text, i.created_at,
              a.action AS client_action, a.note AS client_note
       FROM ops.delivery_incidents i
       LEFT JOIN ops.client_incident_actions a ON a.order_id = i.order_id
       WHERE i.order_id = $1
       ORDER BY i.created_at DESC`,
      [id],
    );
    const events = await query<{ event_type: string; actor_kind: string; created_at: Date }>(
      `SELECT event_type, actor_kind, created_at FROM ops.events
       WHERE order_id = $1 ORDER BY created_at ASC LIMIT 80`,
      [id],
    );
    const money = (n: unknown) => (showMoney ? Number(n ?? 0) : null);
    return c.json({
      ok: true,
      showMoney,
      order: {
        id: o.id,
        status: o.status,
        pickStatus: o.pick_status,
        deliveryStatus: o.delivery_status,
        pickerName: o.picker_name,
        courierName: o.courier_name,
        failedReason: o.failed_reason,
        failedReasonCode: o.failed_reason_code,
        total: money(o.total),
        subtotal: money(o.subtotal),
        deliveryFee: money(o.delivery_fee),
        pickFee: money(o.pick_fee),
        deliverPayout: money(o.deliver_payout),
        discount: money(o.discount),
        itemCount: o.item_count,
        storeId: o.store_id,
        storeName: o.store_name,
        paymentLabel: o.payment_label,
        paymentStatus: o.payment_status,
        dayLabel: o.day_label,
        slotLabel: o.slot_label,
        addressLabel: o.address_label,
        addressLine: o.address_line,
        addressCity: o.address_city,
        addressPhone: o.address_phone,
        comment: o.comment,
        createdAt: o.created_at,
        customerName: `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() || 'Client',
        customerPhone: o.phone,
      },
      lines: lines.rows.map((l) => ({
        productId: l.product_id,
        name: l.name,
        unit: l.unit,
        qty: l.qty,
        pickedQty: l.picked_qty,
        unitPrice: money(l.unit_price),
        lineTotal: money(l.qty * l.unit_price),
        unavailable: l.unavailable,
        note: l.note || '',
        replaced: Boolean(l.note && /remplac/i.test(l.note)),
      })),
      incidents: incidents.rows.map((i) => ({
        id: i.id,
        reasonCode: i.reason_code,
        reasonText: i.reason_text,
        createdAt: i.created_at,
        clientAction: i.client_action,
        clientNote: i.client_note,
      })),
      events: events.rows.map((e) => ({
        type: e.event_type,
        actor: e.actor_kind,
        at: e.created_at,
      })),
    });
  });

  app.post('/admin/products/:id/image', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    if (!CREATE_ROLES.has(gate.staff!.role)) {
      return c.json({ ok: false, error: 'Upload image : manager ou admin.' }, 403);
    }
    const id = c.req.param('id');
    const found = await query('SELECT id FROM products WHERE id = $1', [id]);
    if (!found.rowCount) return c.json({ ok: false, error: 'Produit introuvable.' }, 404);
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return c.json({ ok: false, error: 'Fichier PNG ou WebP requis (champ file).' }, 400);
    if (file.size > 2_500_000) return c.json({ ok: false, error: 'Image trop lourde (max 2,5 Mo).' }, 400);
    const type = file.type || '';
    if (!/image\/(png|webp|jpeg)/.test(type)) {
      return c.json({ ok: false, error: 'PNG, JPEG ou WebP uniquement. Pas d’URL distante.' }, 400);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = type.includes('webp') ? 'webp' : type.includes('jpeg') ? 'jpg' : 'png';
    writeFileSync(join(catalogDir(), `${id}.${ext === 'jpg' ? 'jpg' : ext}`), buf);
    if (ext !== 'png') writeFileSync(join(catalogDir(), `${id}.png`), buf);
    await audit(gate.staff!.id, 'image', 'product', id, null, { bytes: file.size, type });
    return c.json({
      ok: true,
      hint: 'Image écrite dans marche-dore/assets/images/catalog. Relancer catalog:map puis Metro pour CourseGO.',
    });
  });
}
