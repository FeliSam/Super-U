import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '../..');
const outfile = join(root, '../.tmp/catalog-bundle.mjs');

mkdirSync(join(root, '../.tmp'), { recursive: true });
mkdirSync(join(root, '../data'), { recursive: true });

await build({
  absWorkingDir: repo,
  stdin: {
    contents: `
import { products, exploreCategories, homePromoBanners, chips } from './marche-dore/data/catalog.ts';
import { SUPER_U_STORES } from './marche-dore/data/superU.ts';

function strip(row) {
  const copy = { ...row };
  delete copy.image;
  delete copy.avatar;
  return copy;
}

const data = {
  products: products.map((p) => ({ id: p.id, categoryId: p.categoryId, payload: strip(p) })),
  categories: exploreCategories.map((c) => ({ id: c.id, payload: strip(c) })),
  banners: homePromoBanners.map((b) => ({ id: b.id, payload: strip(b) })),
  chips: chips.map((c) => ({ id: c.id, payload: { ...c } })),
  stores: SUPER_U_STORES.map((s) => ({ id: s.id, payload: s })),
};

export default data;
`,
    resolveDir: repo,
    sourcefile: 'dump-catalog-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  alias: {
    'react-native': join(root, 'rn-stub.js'),
    '@/constants/map': join(root, 'map-stub.js'),
  },
  loader: {
    '.png': 'empty',
    '.jpg': 'empty',
    '.webp': 'empty',
  },
});

const mod = await import(`file://${outfile.replaceAll('\\', '/')}?t=${Date.now()}`);
const data = mod.default;
writeFileSync(join(root, '../data/catalog.json'), JSON.stringify(data, null, 2));
console.log(
  `Wrote catalog.json (${data.products.length} products, ${data.categories.length} categories, ${data.stores.length} stores)`,
);
