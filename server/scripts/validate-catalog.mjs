import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateCatalogManifest } from '../src/catalogImport.ts';

const expectedCounts = {
  'fruits-legumes': 100, viandes: 50, charcuterie: 35, poissons: 50, surgeles: 45,
  laitiers: 60, oeufs: 20, boulangerie: 45, 'petit-dej': 50, 'cafe-the': 35,
  feculents: 80, huiles: 45, epices: 45, conserves: 50, epicerie: 65, snacking: 45,
  boissons: 80, alcools: 45, bio: 25, cuisine: 35, glaces: 30, hygiene: 55,
  maison: 50, bebe: 35, animalerie: 25,
};

const file = resolve(process.argv[2] ?? 'data/catalog-west-africa.json');
const legacyFile = resolve('data/catalog.json');
const manifest = JSON.parse(readFileSync(file, 'utf8'));
const legacy = JSON.parse(readFileSync(legacyFile, 'utf8'));
const validation = validateCatalogManifest(manifest, {
  expectedProducts: 1200,
  categoryCounts: expectedCounts,
});

const manifestIds = new Set(
  Array.isArray(manifest.products) ? manifest.products.map((product) => product.id) : [],
);
const missingLegacyIds = legacy.products
  .map((product) => product.id)
  .filter((id) => !manifestIds.has(id));
if (legacy.products.length !== 122) {
  validation.issues.push({
    path: 'legacy.products',
    message: `122 IDs historiques attendus, ${legacy.products.length} reçus.`,
  });
}
for (const id of missingLegacyIds) {
  validation.issues.push({ path: 'legacy.products', message: `ID historique absent: ${id}` });
}

if (validation.issues.length) {
  console.error(JSON.stringify({ ok: false, issues: validation.issues }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    products: manifest.products.length,
    active: manifest.products.filter((product) => product.active).length,
    categories: expectedCounts,
    preservedLegacyIds: legacy.products.length,
    validBarcodes: manifest.products.filter((product) => product.barcode !== null).length,
  }, null, 2));
}
