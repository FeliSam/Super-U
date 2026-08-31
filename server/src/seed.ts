import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, pool, query } from './db.ts';
import { hashPassword, newUserId } from './password.ts';
import { seedOpsStaff } from './ops.ts';
import { seedAdminStaff } from './admin.ts';
import { importCatalog } from './catalogImport.ts';

export async function seedCatalog() {
  const count = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM products');
  const forced =
    process.env.CATALOG_SEED_FORCE === '1' ||
    process.env.CATALOG_SEED_FORCE === 'true' ||
    process.argv.includes('--catalog');
  if (Number(count.rows[0]?.count ?? 0) > 0 && !forced) return false;
  const dataPath = join(dirname(fileURLToPath(import.meta.url)), '../data/catalog-west-africa.json');
  const data: unknown = JSON.parse(readFileSync(dataPath, 'utf8'));
  const report = await importCatalog(data, { source: 'seed:catalog-west-africa' });
  return report.products.inserted > 0 || report.products.updated > 0;
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
  await query(
    `DELETE FROM ops.staff WHERE lower(email) NOT IN (
      'courier@marchedore.bj', 'picker@marchedore.bj', 'admin@marchedore.bj', 'rh@marchedore.bj'
    )`,
  );
  await query(`DELETE FROM users WHERE lower(email) <> $1`, [demoEmail]);
  const courier = await query(`SELECT id FROM ops.staff WHERE email = 'courier@marchedore.bj'`);
  if (!courier.rowCount) await seedOpsStaff();
  return true;
}

export async function seedAll(options: { catalog?: boolean } = {}) {
  const catalog = options.catalog === false ? false : await seedCatalog();
  const demo = await seedDemoUser();
  const ops = await seedOpsStaff();
  const admin = await seedAdminStaff();
  return { catalog, demo, ops, admin };
}

const isCli = process.argv[1]?.replaceAll('\\', '/').endsWith('/src/seed.ts');
if (isCli) {
  await migrate();
  if (process.argv.includes('--reset')) {
    console.log({ reset: await resetWorkspaceKeepProfiles() });
  }
  console.log(await seedAll({ catalog: true }));
  await pool.end();
}
