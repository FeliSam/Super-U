import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return pool.query<T>(text, params);
}

export async function migrate() {
  const dir = dirname(fileURLToPath(import.meta.url));
  await pool.query(readFileSync(join(dir, 'schema.sql'), 'utf8'));
  await pool.query(readFileSync(join(dir, 'schema-ops.sql'), 'utf8'));
  await pool.query(readFileSync(join(dir, 'schema-comms.sql'), 'utf8'));
  await pool.query(readFileSync(join(dir, 'schema-admin.sql'), 'utf8'));
  await pool.query(readFileSync(join(dir, 'schema-staff.sql'), 'utf8'));
  await pool.query(readFileSync(join(dir, 'schema-catalog-core.sql'), 'utf8'));
}
