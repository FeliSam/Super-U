const baseUrl = (process.env.API_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const expectedProducts = 1200;

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function collectCursorPages(path, itemsField, limit) {
  const items = [];
  const cursors = new Set();
  let cursor = null;
  let pages = 0;

  do {
    const separator = path.includes('?') ? '&' : '?';
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const body = await getJson(`${path}${separator}limit=${limit}${cursorQuery}`);
    pages++;
    items.push(...body[itemsField]);
    cursor = body.sync.nextCursor;
    if (cursor) {
      assert(!cursors.has(cursor), `curseur répété à la page ${pages}`);
      cursors.add(cursor);
    }
  } while (cursor);

  return { items, pages };
}

const full = await getJson('/catalog');
const fullIds = full.products.map((product) => product.id);
const placeholderProducts = full.products.filter((product) => product.media?.placeholder).length;
const realMediaProducts = full.products.length - placeholderProducts;
assert(fullIds.length === expectedProducts, `${expectedProducts} produits API attendus, ${fullIds.length} reçus`);
assert(new Set(fullIds).size === expectedProducts, 'IDs API dupliqués');
assert(
  full.products
    .filter((product) => !product.media?.placeholder)
    .every((product) => product.media?.licenseName && (product.media?.licenseUrl || product.media?.attribution)),
  'média réel sans licence ou attribution',
);

const paged = await collectCursorPages('/catalog', 'products', 137);
const pagedIds = paged.items.map((product) => product.id);
assert(pagedIds.length === expectedProducts, `pagination: ${pagedIds.length} produits reçus`);
assert(new Set(pagedIds).size === expectedProducts, 'pagination: produits dupliqués');
assert(
  JSON.stringify(pagedIds) === JSON.stringify(fullIds),
  'pagination: ordre ou continuité différents de la réponse complète',
);

const epoch = encodeURIComponent('1970-01-01T00:00:00.000Z');
const delta = await collectCursorPages(`/catalog/sync?since=${epoch}`, 'upserts', 173);
const deltaIds = delta.items.map((product) => product.id);
assert(deltaIds.length === expectedProducts, `sync initiale: ${deltaIds.length} upserts reçus`);
assert(new Set(deltaIds).size === expectedProducts, 'sync initiale: upserts dupliqués');
assert(
  JSON.stringify(deltaIds) === JSON.stringify(fullIds),
  'sync initiale: ordre ou ensemble différent du catalogue',
);

const revision = await getJson('/catalog/revision');
const noChange = await getJson(`/catalog/sync?since=${encodeURIComponent(revision.updatedAt)}&limit=200`);
assert(noChange.upserts.length === 0, `sync sans changement: ${noChange.upserts.length} upserts inattendus`);
assert(noChange.sync.nextCursor === null, 'sync sans changement: curseur inattendu');

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  products: fullIds.length,
  uniqueProducts: new Set(fullIds).size,
  placeholderProducts,
  realMediaProducts,
  catalogPages: paged.pages,
  initialSyncPages: delta.pages,
  initialSyncUpserts: deltaIds.length,
  noChangeSyncUpserts: noChange.upserts.length,
  revision: revision.revision,
  updatedAt: revision.updatedAt,
}, null, 2));
