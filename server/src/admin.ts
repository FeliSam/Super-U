import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Hono } from 'hono';
import { query } from './db.ts';
import { hashPassword } from './password.ts';
import { catalogDir } from './productMedia.ts';

const CATALOG_ROLES = new Set(['admin', 'manager', 'magasinier']);
const PRICE_ROLES = new Set(['admin', 'manager']);
const CREATE_ROLES = new Set(['admin', 'manager']);

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

async function syncInStockFromQty(productId: string) {
  const tot = await query<{ available: string }>(
    `SELECT COALESCE(SUM(qty - reserved), 0)::text AS available
     FROM product_stock WHERE product_id = $1`,
    [productId],
  );
  const available = Number(tot.rows[0]?.available ?? 0);
  const inStock = available > 0;
  const found = await query<ProductRow>('SELECT id, category_id, payload FROM products WHERE id = $1', [productId]);
  const row = found.rows[0];
  if (!row) return;
  const payload = { ...row.payload };
  applyRupture(payload, inStock);
  await query('UPDATE products SET payload = $2::jsonb WHERE id = $1', [productId, JSON.stringify(payload)]);
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
         store_id = COALESCE(store_id, 'su-aeroport'), password_hash = $2
       WHERE email = $1`,
      [email, hash],
    );
    return false;
  }
  await query(
    `INSERT INTO ops.staff (id, email, phone, password_hash, first_name, last_name, role, can_pick, can_deliver, store_id, vehicle)
     VALUES ($1, $2, '+229 01 40 00 00 09', $3, 'Amina', 'KPODEKON', 'admin', FALSE, FALSE, 'su-aeroport', NULL)`,
    [`st-admin-${randomBytes(3).toString('hex')}`, email, hash],
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
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    return c.json({ ok: true, staff: publicStaff(gate.staff!) });
  });

  app.get('/admin/stores', async (c) => {
    const gate = await requireCatalog(c);
    if (gate.error) return gate.error;
    const rows = await query<{ id: string; payload: Record<string, unknown> }>(
      'SELECT id, payload FROM stores ORDER BY id',
    );
    const staff = gate.staff!;
    const list =
      staff.role === 'admin' ? rows.rows : rows.rows.filter((r) => r.id === staff.store_id);
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
    if (stock === 'in') list = list.filter((p) => p.payload.inStock !== false);
    if (stock === 'out') list = list.filter((p) => p.payload.inStock === false);
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
    const payload: Record<string, unknown> = {
      id,
      name,
      unit,
      price,
      categoryId,
      sku: String(body?.sku ?? id),
      barcode: typeof body?.barcode === 'string' ? body.barcode.trim() : undefined,
      producer: typeof body?.producer === 'string' ? body.producer.trim() : undefined,
      description: typeof body?.description === 'string' ? body.description.trim() : undefined,
      inStock: true,
    };
    if (oldPrice && oldPrice > price) {
      payload.oldPrice = oldPrice;
      payload.discount = discountLabel(price, oldPrice);
    }
    if (body?.badge === 'nouveau' || body?.badge === 'local') payload.badge = body.badge;
    await query('INSERT INTO products (id, category_id, payload) VALUES ($1, $2, $3::jsonb)', [
      id,
      categoryId,
      JSON.stringify(payload),
    ]);
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
    if (typeof body?.barcode === 'string') payload.barcode = body.barcode.trim();
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

    await query('UPDATE products SET category_id = $2, payload = $3::jsonb WHERE id = $1', [
      id,
      categoryId,
      JSON.stringify(payload),
    ]);
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
    if (reason === 'sale' || reason === 'shrink' || reason === 'pick_unavailable') {
      delta = -Math.abs(delta);
    }
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
      await query(
        `UPDATE product_stock SET qty = qty - $3, updated_at = NOW()
         WHERE product_id = $1 AND store_id = $2`,
        [productId, storeId, qty],
      );
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
      await syncInStockFromQty(productId);
      return c.json({ ok: true, transfer: { from: storeId, to: toStore, qty } });
    }

    const moveId = `mv-${randomBytes(6).toString('hex')}`;
    await query(
      `UPDATE product_stock SET qty = GREATEST(0, qty + $3), updated_at = NOW()
       WHERE product_id = $1 AND store_id = $2`,
      [productId, storeId, delta],
    );
    if (typeof body?.minQty === 'number') {
      await query(`UPDATE product_stock SET min_qty = $3, updated_at = NOW() WHERE product_id = $1 AND store_id = $2`, [
        productId,
        storeId,
        body.minQty,
      ]);
    }
    await query(
      `INSERT INTO stock_moves (id, product_id, store_id, delta, reason, ref_type, actor_staff_id, note)
       VALUES ($1, $2, $3, $4, $5, 'admin', $6, $7)`,
      [moveId, productId, storeId, delta, reason, gate.staff!.id, note || null],
    );
    await syncInStockFromQty(productId);
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
    const counts = await query<{ products: string; out: string; alerts: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM products) AS products,
         (SELECT COUNT(*)::text FROM products WHERE COALESCE(payload->>'inStock', 'true') = 'false') AS out,
         (SELECT COUNT(*)::text FROM product_stock WHERE store_id = $1 AND (qty - reserved) <= min_qty) AS alerts`,
      [storeId],
    );
    const promo = await query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM products WHERE (payload->>'oldPrice') IS NOT NULL`,
    );
    return c.json({
      ok: true,
      storeId,
      stats: {
        products: Number(counts.rows[0]?.products ?? 0),
        outOfStock: Number(counts.rows[0]?.out ?? 0),
        alerts: Number(counts.rows[0]?.alerts ?? 0),
        promotions: Number(promo.rows[0]?.c ?? 0),
      },
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
