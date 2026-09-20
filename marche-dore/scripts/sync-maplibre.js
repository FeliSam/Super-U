/**
 * Copy MapLibre worker/shared/css into public/ for same-origin Expo web.
 * Keeps /maplibre/* in lockstep with node_modules/maplibre-gl (avoids
 * cryptic worker errors like "codePointAt is not a function").
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'node_modules', 'maplibre-gl', 'dist');
const out = path.join(root, 'public', 'maplibre');

const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl.css'];

if (!fs.existsSync(dist)) {
  console.warn('[sync-maplibre] maplibre-gl not installed — skip');
  process.exit(0);
}

fs.mkdirSync(out, { recursive: true });
for (const name of files) {
  const from = path.join(dist, name);
  const to = path.join(out, name);
  if (!fs.existsSync(from)) {
    console.warn(`[sync-maplibre] missing ${name}`);
    continue;
  }
  fs.copyFileSync(from, to);
  console.log(`[sync-maplibre] ${name}`);
}
