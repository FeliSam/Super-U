import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boundedLimit,
  decodeCatalogCursor,
  encodeCatalogCursor,
  normalizeBarcode,
} from '../src/catalogHelpers.ts';
import { hasValidGtinChecksum } from '../src/catalogImport.ts';
import { productBarcode } from '../src/productMedia.ts';

test('catalog limits are bounded and optional', () => {
  assert.equal(boundedLimit(undefined), null);
  assert.equal(boundedLimit('25'), 25);
  assert.equal(boundedLimit('999'), 999);
  assert.equal(boundedLimit('5000'), 2000);
  assert.equal(boundedLimit('0'), null);
  assert.equal(boundedLimit('abc'), null);
});

test('catalog cursors round-trip and reject malformed input', () => {
  const cursor = { updatedAt: '2026-08-30T12:00:00.000Z', id: 'huile-palme' };
  assert.deepEqual(decodeCatalogCursor(encodeCatalogCursor(cursor)), cursor);
  assert.equal(decodeCatalogCursor('not-a-cursor'), null);
});

test('barcode helpers keep real GTINs and generate valid fallback EAN-13', () => {
  assert.equal(normalizeBarcode('12345670'), '12345670');
  assert.equal(normalizeBarcode('../bad'), null);
  const fallback = productBarcode('tomates');
  assert.equal(fallback.length, 13);
  assert.equal(hasValidGtinChecksum(fallback), true);
});
