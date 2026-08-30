import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'schema');

function dumpViaDocker() {
  try {
    const sql = execFileSync(
      'docker',
      [
        'exec',
        'marche-dore-pg',
        'pg_dump',
        '-U',
        'marche',
        '-d',
        'marche_dore',
        '--schema-only',
        '--no-owner',
        '--no-privileges',
      ],
      { encoding: 'utf8' },
    );
    return sql;
  } catch {
    return null;
  }
}

function dumpViaLocalPgDump() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    return execFileSync('pg_dump', [url, '--schema-only', '--no-owner', '--no-privileges'], {
      encoding: 'utf8',
    });
  } catch {
    return null;
  }
}

async function dumpViaPg() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const schemas = await client.query(`
      SELECT n.nspname AS schema,
             c.relname AS name,
             c.relkind AS kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'ops', 'comms')
        AND c.relkind IN ('r', 'v', 'S')
      ORDER BY n.nspname, c.relkind, c.relname
    `);
    const fns = await client.query(`
      SELECT n.nspname AS schema, p.proname AS name,
             pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname IN ('public', 'ops', 'comms')
      ORDER BY 1, 2
    `);
    const lines = [
      '-- Export inventaire Postgres (fallback si pg_dump indisponible)',
      `-- generated_at ${new Date().toISOString()}`,
      '',
      '-- Tables / vues',
      ...schemas.rows.map((r) => `-- [${r.kind}] ${r.schema}.${r.name}`),
      '',
      '-- Fonctions',
      ...fns.rows.map((r) => r.def + ';\n'),
    ];
    return lines.join('\n');
  } finally {
    await client.end();
  }
}

mkdirSync(outDir, { recursive: true });
copyFileSync(join(root, 'src/schema.sql'), join(outDir, '00-public.sql'));
copyFileSync(join(root, 'src/schema-ops.sql'), join(outDir, '01-ops.sql'));
copyFileSync(join(root, 'src/schema-comms.sql'), join(outDir, '02-comms.sql'));
const ddl = `${readFileSync(join(outDir, '00-public.sql'), 'utf8')}\n\n${readFileSync(join(outDir, '01-ops.sql'), 'utf8')}\n\n${readFileSync(join(outDir, '02-comms.sql'), 'utf8')}`;
writeFileSync(join(outDir, 'all-schemas.sql'), ddl, 'utf8');
const live = dumpViaDocker() ?? dumpViaLocalPgDump();
if (live) {
  writeFileSync(join(outDir, 'pg_dump-schema-only.sql'), live, 'utf8');
}
const inventory = await dumpViaPg();
if (inventory) {
  writeFileSync(join(outDir, 'applied-inventory.sql'), inventory, 'utf8');
}
console.log('Écrit', join(outDir, 'all-schemas.sql'));
