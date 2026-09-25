/**
 * Teste les clés OVH (.env.ovh) et liste VPS + domaines.
 * Usage : npm run ovh:status
 *
 * Auth officielle OVH (sans dépendre du client npm défaillant sur Windows) :
 * https://docs.ovh.com/gb/en/api/first-steps/
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ENDPOINTS = {
  'ovh-eu': 'https://eu.api.ovh.com/1.0',
  'ovh-us': 'https://api.us.ovhcloud.com/1.0',
  'ovh-ca': 'https://ca.api.ovh.com/1.0',
};

function loadEnvOvh() {
  const file = resolve(process.cwd(), '.env.ovh');
  if (!existsSync(file)) {
    console.error('Fichier manquant : .env.ovh (copie depuis .env.ovh.example)');
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function createClient(env) {
  const endpointKey = env.OVH_ENDPOINT || 'ovh-eu';
  const base = ENDPOINTS[endpointKey];
  if (!base) {
    throw new Error(`OVH_ENDPOINT inconnu: ${endpointKey} (ovh-eu | ovh-us | ovh-ca)`);
  }
  const appKey = env.OVH_APP_KEY;
  const appSecret = env.OVH_APP_SECRET;
  const consumerKey = env.OVH_CONSUMER_KEY;
  if (!appKey || !appSecret || !consumerKey) {
    throw new Error('OVH_APP_KEY / OVH_APP_SECRET / OVH_CONSUMER_KEY manquants');
  }

  async function apiTime() {
    const res = await fetch(`${base}/auth/time`);
    if (!res.ok) throw new Error(`auth/time HTTP ${res.status}`);
    return Number(await res.text());
  }

  async function request(method, path, bodyObj) {
    const url = `${base}${path}`;
    const body = bodyObj == null ? '' : JSON.stringify(bodyObj);
    const timestamp = await apiTime();
    const toSign = `${appSecret}+${consumerKey}+${method}+${url}+${body}+${timestamp}`;
    const signature = `$1$${createHash('sha1').update(toSign).digest('hex')}`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Ovh-Application': appKey,
        'X-Ovh-Consumer': consumerKey,
        'X-Ovh-Timestamp': String(timestamp),
        'X-Ovh-Signature': signature,
      },
      body: body || undefined,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = typeof data === 'object' && data?.message ? data.message : text || res.statusText;
      const err = new Error(`[OVH ${res.status}] ${msg}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return { endpointKey, base, request };
}

async function main() {
  const env = loadEnvOvh();
  const client = createClient(env);

  console.log('');
  console.log('  SuperU · OVH status');
  console.log(`  endpoint: ${client.endpointKey} (${client.base})`);
  console.log('');

  try {
    const me = await client.request('GET', '/me');
    console.log(`  Compte : ${me.nichandle || me.email || 'ok'} (${me.country || '?'})`);
  } catch (e) {
    console.error('  Échec /me — clés invalides, expirées, ou droits insuffisants.');
    console.error(' ', e.message || e);
    if (e.status === 403) {
      console.error('  → Recrée le token avec au minimum GET /me');
    }
    process.exit(1);
  }

  console.log('');
  console.log('  VPS :');
  try {
    const list = await client.request('GET', '/vps');
    if (!list?.length) {
      console.log('    (aucun sous /vps)');
    } else {
      for (const name of list) {
        let ip = '?';
        try {
          const ips = await client.request('GET', `/vps/${encodeURIComponent(name)}/ips`);
          const arr = Array.isArray(ips) ? ips : [];
          ip = arr.find((x) => /^\d+\.\d+\.\d+\.\d+$/.test(String(x))) || arr[0] || '?';
        } catch {
          /* ignore */
        }
        console.log(`    - ${name}`);
        console.log(`      IP=${ip}`);
        console.log(`      → OVH_VPS_SERVICE_NAME=${name}`);
      }
    }
  } catch (e) {
    console.log('    (pas d’accès /vps)');
    console.log('   ', e.message || e);
    console.log('    → Ajoute le droit GET /vps/* sur le token');
  }

  console.log('');
  console.log('  Autres serveurs (si pas un VPS classique) :');
  for (const path of ['/dedicated/server', '/dedicated/nasha', '/hosting/web', '/ip', '/cloud/project']) {
    try {
      const list = await client.request('GET', path);
      const n = Array.isArray(list) ? list.length : list ? 1 : 0;
      if (!n) {
        console.log(`    ${path} : (vide)`);
        continue;
      }
      console.log(`    ${path} :`);
      for (const item of Array.isArray(list) ? list.slice(0, 10) : [list]) {
        console.log(`      - ${typeof item === 'string' ? item : JSON.stringify(item)}`);
      }
    } catch (e) {
      console.log(`    ${path} : inaccessible (${e.message || e})`);
    }
  }

  console.log('');
  console.log('  Domaines :');
  try {
    const domains = await client.request('GET', '/domain');
    if (!domains?.length) {
      console.log('    (aucun sous /domain)');
    } else {
      for (const d of domains) {
        console.log(`    - ${d}`);
        console.log(`      → OVH_DOMAIN=${d}`);
        console.log(`      → OVH_DNS_SUBDOMAIN=api  (→ https://api.${d})`);
      }
    }
  } catch (e) {
    console.log('    (pas d’accès /domain)');
    console.log('   ', e.message || e);
    console.log('    → Ajoute le droit GET /domain/* sur le token');
  }

  console.log('');
  console.log('  Zones DNS :');
  try {
    const zones = await client.request('GET', '/domain/zone');
    if (!zones?.length) {
      console.log('    (aucune)');
    } else {
      for (const z of zones) {
        console.log(`    - ${z}`);
        console.log(`      → OVH_DOMAIN=${z}`);
      }
    }
  } catch (e) {
    console.log('    (pas d’accès /domain/zone)');
    console.log('   ', e.message || e);
  }

  console.log('');
  if (env.OVH_DOMAIN && env.OVH_VPS_SERVICE_NAME) {
    console.log('  Config complète — prochain : script DNS (ovh:dns)');
  } else {
    console.log('  Complète .env.ovh avec OVH_DOMAIN et OVH_VPS_SERVICE_NAME (valeurs ci-dessus),');
    console.log('  puis relance : npm run ovh:status');
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
