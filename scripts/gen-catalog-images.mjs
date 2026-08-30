import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'marche-dore/assets/images/catalog');
const files = readdirSync(dir)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .sort();

const byId = new Map();
for (const f of files) {
  const id = f.replace(/\.[^.]+$/, '');
  const ext = (f.split('.').pop() || '').toLowerCase();
  const prev = byId.get(id);
  if (!prev) {
    byId.set(id, f);
    continue;
  }
  const prevExt = (prev.split('.').pop() || '').toLowerCase();
  if (ext === 'png' && prevExt !== 'png') byId.set(id, f);
}

const lines = [...byId.entries()].map(
  ([id, f]) => `  ${JSON.stringify(id)}: require('../../marche-dore/assets/images/catalog/${f}'),`,
);

const out = `import type { ImageSourcePropType } from 'react-native';

/** Generated from marche-dore/assets/images/catalog — run \`npm run catalog:map\`. */
export const catalogImages: Record<string, ImageSourcePropType> = {
${lines.join('\n')}
};
`;

writeFileSync(join(root, 'CourseGO/lib/catalogImages.generated.ts'), out);
console.log(`Wrote ${byId.size} catalog images for CourseGO`);
