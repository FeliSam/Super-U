/**
 * Met à jour l’URL API publique dans les 2 apps + eas.json + server/.env
 * Usage : node scripts/set-api-url.mjs https://xxxx.trycloudflare.com
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = (process.argv[2] || '').trim().replace(/\/$/, '');
if (!raw || !/^https?:\/\//i.test(raw)) {
  console.error('Usage: node scripts/set-api-url.mjs https://votre-url.trycloudflare.com');
  process.exit(1);
}

function upsertEnv(file, key, value) {
  let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) text = text.replace(re, line);
  else text = `${text.trimEnd()}\n${line}\n`;
  writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

function patchEas(file) {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  for (const profile of Object.values(json.build || {})) {
    if (!profile || typeof profile !== 'object') continue;
    profile.env = { ...(profile.env || {}), EXPO_PUBLIC_API_URL: raw };
  }
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

for (const app of ['marche-dore', 'CourseGO']) {
  upsertEnv(join(root, app, '.env'), 'EXPO_PUBLIC_API_URL', raw);
  upsertEnv(join(root, app, '.env.example'), 'EXPO_PUBLIC_API_URL', raw);
  patchEas(join(root, app, 'eas.json'));
  console.log(`✓ ${app}`);
}

upsertEnv(join(root, 'server', '.env'), 'PUBLIC_API_URL', raw);
upsertEnv(join(root, 'server', '.env.example'), 'PUBLIC_API_URL', raw);
console.log('✓ server');
console.log(`\nAPI → ${raw}`);
console.log('Rebuild EAS requis pour les apps déjà buildées.');
