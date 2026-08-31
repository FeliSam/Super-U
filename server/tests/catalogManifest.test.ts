import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';
import {
  hasValidGtinChecksum,
  validateCatalogManifest,
  type CatalogManifest,
} from '../src/catalogImport.ts';
import { productBarcode } from '../src/productMedia.ts';

const expectedCounts: Record<string, number> = {
  'fruits-legumes': 100, viandes: 50, charcuterie: 35, poissons: 50, surgeles: 45,
  laitiers: 60, oeufs: 20, boulangerie: 45, 'petit-dej': 50, 'cafe-the': 35,
  feculents: 80, huiles: 45, epices: 45, conserves: 50, epicerie: 65, snacking: 45,
  boissons: 80, alcools: 45, bio: 25, cuisine: 35, glaces: 30, hygiene: 55,
  maison: 50, bebe: 35, animalerie: 25,
};

const manifest = JSON.parse(
  readFileSync(resolve('data/catalog-west-africa.json'), 'utf8'),
) as CatalogManifest;

test('manifest has exactly 1200 unique, correctly distributed SKUs', () => {
  const validation = validateCatalogManifest(manifest, {
    expectedProducts: 1200,
    categoryCounts: expectedCounts,
  });
  assert.deepEqual(validation.issues, []);
  assert.equal(manifest.products.length, 1200);
  assert.equal(new Set(manifest.products.map((product) => product.id)).size, 1200);
  assert.equal(new Set(manifest.products.map((product) => product.sku)).size, 1200);
});

test('every product has dated provenance and licensed media or an explicit placeholder', () => {
  for (const product of manifest.products) {
    assert.ok(product.provenance.source.trim(), `${product.id}: provenance source`);
    assert.ok(product.provenance.country.trim(), `${product.id}: provenance country`);
    assert.ok(!Number.isNaN(Date.parse(product.provenance.collectedAt)), `${product.id}: provenance date`);
    assert.ok(product.media.length > 0, `${product.id}: media`);

    for (const media of product.media) {
      if (media.placeholder) {
        assert.equal(
          typeof media.metadata?.reason,
          'string',
          `${product.id}: placeholder reason`,
        );
      } else {
        assert.ok(media.sourceUrl || media.localPath, `${product.id}: media source`);
        assert.ok(media.licenseName, `${product.id}: media license`);
        assert.ok(media.licenseUrl || media.attribution, `${product.id}: media attribution`);
      }
    }
  }
});

test('manifest validator rejects missing provenance and unlicensed non-placeholder media', () => {
  const withoutDate = structuredClone(manifest);
  withoutDate.products[0]!.provenance.collectedAt = '';
  assert.ok(
    validateCatalogManifest(withoutDate).issues.some(
      (issue) => issue.path === 'products[0].provenance',
    ),
  );

  const unlicensed = structuredClone(manifest);
  unlicensed.products[0]!.media = [{
    kind: 'image',
    position: 0,
    sourceUrl: 'https://example.test/image.jpg',
    placeholder: false,
  }];
  assert.ok(
    validateCatalogManifest(unlicensed).issues.some(
      (issue) => issue.path === 'products[0].media[0]',
    ),
  );
});

test('EAN/GTIN helper accepts known vectors and generates valid deterministic EAN-13', () => {
  assert.equal(hasValidGtinChecksum('4006381333931'), true);
  assert.equal(hasValidGtinChecksum('4006381333932'), false);
  assert.equal(hasValidGtinChecksum('12345670'), true);
  assert.equal(hasValidGtinChecksum('12345671'), false);
  assert.equal(hasValidGtinChecksum('not-an-ean'), false);

  for (const productId of ['tomates', 'huile-palme', 'SKU avec accents é']) {
    const generated = productBarcode(productId);
    assert.match(generated, /^2\d{12}$/);
    assert.equal(hasValidGtinChecksum(generated), true);
    assert.equal(productBarcode(productId), generated);
  }
});
