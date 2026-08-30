import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, pool, query } from './db.ts';
import { hashPassword, newUserId } from './password.ts';
import { seedOpsStaff } from './ops.ts';
import { seedAdminStaff, seedProductStock } from './admin.ts';

type CatalogFile = {
  products: { id: string; categoryId: string; payload: object }[];
  categories: { id: string; payload: object }[];
  banners: { id: string; payload: object }[];
  chips: { id: string; payload: object }[];
  stores: { id: string; payload: object }[];
};

export async function seedCatalog() {
  const existing = await query<{ c: string }>('SELECT COUNT(*)::text AS c FROM products');
  if (Number(existing.rows[0]?.c ?? 0) > 0) return false;

  const dataPath = join(dirname(fileURLToPath(import.meta.url)), '../data/catalog.json');
  const data = JSON.parse(readFileSync(dataPath, 'utf8')) as CatalogFile;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of data.products) {
      await client.query(
        'INSERT INTO products (id, category_id, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING',
        [p.id, p.categoryId, JSON.stringify(p.payload)],
      );
    }
    for (const row of data.categories) {
      await client.query(
        'INSERT INTO categories (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING',
        [row.id, JSON.stringify(row.payload)],
      );
    }
    for (const row of data.banners) {
      await client.query(
        'INSERT INTO banners (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING',
        [row.id, JSON.stringify(row.payload)],
      );
    }
    for (const row of data.chips) {
      await client.query(
        'INSERT INTO chips (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING',
        [row.id, JSON.stringify(row.payload)],
      );
    }
    for (const row of data.stores) {
      await client.query(
        'INSERT INTO stores (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING',
        [row.id, JSON.stringify(row.payload)],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return true;
}

export async function seedDemoUser() {
  const email = (process.env.DEMO_EMAIL ?? 'demo@marchedore.bj').toLowerCase();
  const password = process.env.DEMO_PASSWORD ?? 'marche2024';
  const found = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (found.rowCount) {
    await query(`UPDATE users SET first_name = 'Merveille', last_name = 'ADJO' WHERE email = $1`, [email]);
    return false;
  }

  await query(
    `INSERT INTO users (id, email, phone, password_hash, first_name, last_name, onboarding_done)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
    [
      newUserId(),
      email,
      '+229 01 00 00 00 00',
      await hashPassword(password),
      'Merveille',
      'ADJO',
    ],
  );
  return true;
}

export async function resetWorkspaceKeepProfiles() {
  const demoEmail = (process.env.DEMO_EMAIL ?? 'demo@marchedore.bj').toLowerCase();
  await query(`DELETE FROM comms.call_signals`);
  await query(`DELETE FROM comms.calls`);
  await query(`DELETE FROM comms.messages`);
  await query(`DELETE FROM comms.thread_members`);
  await query(`DELETE FROM comms.threads`);
  await query(`DELETE FROM ops.staff_notifications`);
  await query(`DELETE FROM public.user_notifications`);
  await query(`DELETE FROM orders`);
  await query(`DELETE FROM ops.courses`);
  await query(`DELETE FROM cart_lines`);
  await query(`DELETE FROM carts`);
  await query(`UPDATE user_state SET payload = '{}'::jsonb`);
  await query(`DELETE FROM ops.staff WHERE lower(email) NOT IN ('courier@marchedore.bj', 'admin@marchedore.bj')`);
  await query(`DELETE FROM users WHERE lower(email) <> $1`, [demoEmail]);
  const courier = await query(`SELECT id FROM ops.staff WHERE email = 'courier@marchedore.bj'`);
  if (!courier.rowCount) await seedOpsStaff();
  return true;
}

export async function seedAll() {
  const catalog = await seedCatalog();
  const demo = await seedDemoUser();
  const ops = await seedOpsStaff();
  const admin = await seedAdminStaff();
  await seedProductStock();
  return { catalog, demo, ops, admin };
}

const isCli = process.argv[1]?.replaceAll('\\', '/').endsWith('/src/seed.ts');
if (isCli) {
  await migrate();
  if (process.argv.includes('--reset')) {
    console.log({ reset: await resetWorkspaceKeepProfiles() });
  }
  console.log(await seedAll());
  await pool.end();
}
