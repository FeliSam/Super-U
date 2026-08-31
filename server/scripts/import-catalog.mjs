import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importCatalog, CatalogValidationError } from '../src/catalogImport.ts';
import { migrate, pool } from '../src/db.ts';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArg = args.find((arg) => !arg.startsWith('--'));
const file = resolve(fileArg ?? 'data/catalog-west-africa.json');

try {
  await migrate();
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const report = await importCatalog(manifest, { dryRun, source: `cli:${file}` });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (error instanceof CatalogValidationError) {
    console.error(JSON.stringify({ ok: false, issues: error.issues }, null, 2));
  } else {
    console.error(error);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
