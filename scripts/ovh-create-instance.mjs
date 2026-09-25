/**
 * Crée automatiquement une instance Public Cloud OVH pour SuperU.
 *
 * - Génère une clé SSH locale (.ssh/superu_ovh) si besoin
 * - L’enregistre dans le projet OVH
 * - Crée une VM Ubuntu 24.04 (flavor d2-2) à GRA11
 * - Attend l’IP publique et met à jour .env.ovh
 *
 * Usage : npm run ovh:create-instance
 *
 * Coût : instance facturée à l’heure (d2-2). Arrête-la si tu ne t’en sers pas.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ENDPOINTS = {
  'ovh-eu': 'https://eu.api.ovh.com/1.0',
  'ovh-us': 'https://api.us.ovhcloud.com/1.0',
  'ovh-ca': 'https://ca.api.ovh.com/1.0',
};

const REGION = process.env.OVH_REGION || 'GRA11';
const FLAVOR_NAME = process.env.OVH_FLAVOR || 'd2-2';
const IMAGE_NAME = process.env.OVH_IMAGE || 'Ubuntu 24.04';
const INSTANCE_NAME = process.env.OVH_INSTANCE_NAME || 'superu-api';

function loadEnv() {
  const file = resolve(process.cwd(), '.env.ovh');
  if (!existsSync(file)) throw new Error('Missing .env.ovh');
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

function upsertEnv(key, value) {
  const file = resolve(process.cwd(), '.env.ovh');
  let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) text = text.replace(re, `${key}=${value}`);
  else text = `${text.trimEnd()}\n${key}=${value}\n`;
  writeFileSync(file, text, 'utf8');
}

function client(env) {
  const base = ENDPOINTS[env.OVH_ENDPOINT || 'ovh-eu'];
  return {
    async request(method, path, bodyObj) {
      const url = `${base}${path}`;
      const body = bodyObj == null ? '' : JSON.stringify(bodyObj);
      const tr = await fetch(`${base}/auth/time`);
      const timestamp = Number(await tr.text());
      const toSign = `${env.OVH_APP_SECRET}+${env.OVH_CONSUMER_KEY}+${method}+${url}+${body}+${timestamp}`;
      const signature = `$1$${createHash('sha1').update(toSign).digest('hex')}`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Ovh-Application': env.OVH_APP_KEY,
          'X-Ovh-Consumer': env.OVH_CONSUMER_KEY,
          'X-Ovh-Timestamp': String(timestamp),
          'X-Ovh-Signature': signature,
        },
        body: body || undefined,
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (!res.ok) {
        const msg = data?.message || text || res.statusText;
        throw Object.assign(new Error(`[OVH ${res.status}] ${method} ${path}: ${msg}`), {
          status: res.status,
          data,
        });
      }
      return data;
    },
  };
}

function ensureSshKey() {
  const dir = resolve(process.cwd(), '.ssh');
  mkdirSync(dir, { recursive: true });
  const priv = resolve(dir, 'superu_ovh');
  const pub = `${priv}.pub`;
  if (!existsSync(priv) || !existsSync(pub)) {
    const r = spawnSync(
      'ssh-keygen',
      ['-t', 'ed25519', '-N', '', '-C', 'superu-ovh', '-f', priv],
      { encoding: 'utf8' },
    );
    if (r.status !== 0) {
      throw new Error(`ssh-keygen failed: ${r.stderr || r.stdout}`);
    }
    console.log('  Clé SSH créée : .ssh/superu_ovh');
  }
  return { priv, pub, publicKey: readFileSync(pub, 'utf8').trim() };
}

function pickPublicIp(instance) {
  const ips = instance?.ipAddresses || [];
  const v4 = ips.find((i) => i.version === 4 && i.type === 'public');
  return v4?.ip || ips.find((i) => i.version === 4)?.ip || null;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const env = loadEnv();
  const api = client(env);
  const projects = await api.request('GET', '/cloud/project');
  const project = env.OVH_CLOUD_PROJECT_ID || projects[0];
  if (!project) throw new Error('Aucun projet Public Cloud');
  upsertEnv('OVH_CLOUD_PROJECT_ID', project);

  console.log('');
  console.log('  SuperU · création instance OVH Public Cloud');
  console.log(`  projet  : ${project}`);
  console.log(`  région  : ${REGION}`);
  console.log(`  flavor  : ${FLAVOR_NAME}`);
  console.log(`  image   : ${IMAGE_NAME}`);
  console.log('');

  const existing = await api.request('GET', `/cloud/project/${project}/instance`);
  const already = (existing || []).find((i) => i.name === INSTANCE_NAME);
  if (already) {
    const ip = pickPublicIp(already);
    console.log(`  Instance « ${INSTANCE_NAME} » existe déjà (${already.status})`);
    if (ip) {
      console.log(`  IP : ${ip}`);
      upsertEnv('OVH_INSTANCE_IP', ip);
      upsertEnv('OVH_INSTANCE_ID', already.id);
    }
    console.log('');
    return;
  }

  const { publicKey } = ensureSshKey();

  let sshKeys = await api.request('GET', `/cloud/project/${project}/sshkey`);
  let ssh = (sshKeys || []).find((k) => k.name === 'superu-ovh');
  if (!ssh) {
    console.log('  Upload clé SSH → OVH…');
    try {
      ssh = await api.request('POST', `/cloud/project/${project}/sshkey`, {
        name: 'superu-ovh',
        publicKey,
      });
    } catch (e) {
      if (e.status === 403) {
        console.error('');
        console.error('  Droits API insuffisants (POST refusé).');
        console.error('  Recrée le token OVH avec aussi :');
        console.error('    POST /cloud/project/*');
        console.error('    PUT  /cloud/project/*');
        console.error('    DELETE /cloud/project/*');
        console.error('  (en plus des GET déjà donnés)');
        console.error('');
      }
      throw e;
    }
    console.log(`  SSH key id=${ssh.id}`);
  } else {
    console.log(`  SSH key déjà présente id=${ssh.id}`);
  }

  const flavors = await api.request(
    'GET',
    `/cloud/project/${project}/flavor?region=${encodeURIComponent(REGION)}`,
  );
  const flavor = (flavors || []).find((f) => f.name === FLAVOR_NAME);
  if (!flavor) throw new Error(`Flavor ${FLAVOR_NAME} introuvable en ${REGION}`);

  const images = await api.request(
    'GET',
    `/cloud/project/${project}/image?osType=linux&region=${encodeURIComponent(REGION)}`,
  );
  const image =
    (images || []).find((i) => i.name === IMAGE_NAME) ||
    (images || []).find((i) => /Ubuntu 24\.04$/i.test(i.name));
  if (!image) throw new Error(`Image ${IMAGE_NAME} introuvable en ${REGION}`);

  console.log('  Création de l’instance (peut prendre 1–3 min)…');
  console.log('  ⚠ Facturation horaire OVH active dès la création.');

  let created;
  try {
    created = await api.request('POST', `/cloud/project/${project}/instance`, {
      name: INSTANCE_NAME,
      flavorId: flavor.id,
      imageId: image.id,
      region: REGION,
      sshKeyId: ssh.id,
      monthlyBilling: false,
    });
  } catch (e) {
    if (e.status === 403) {
      console.error('');
      console.error('  POST /instance refusé — élargis les droits du token (POST /cloud/project/*).');
      console.error('');
    }
    throw e;
  }

  const id = created.id || created;
  upsertEnv('OVH_INSTANCE_ID', String(id));
  console.log(`  instance id=${id}`);

  let ip = null;
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const inst = await api.request('GET', `/cloud/project/${project}/instance/${id}`);
    process.stdout.write(`  status=${inst.status}          \r`);
    if (inst.status === 'ACTIVE') {
      ip = pickPublicIp(inst);
      console.log('');
      console.log(`  ACTIVE — IP publique : ${ip || '(pas encore)'}`);
      if (ip) break;
    }
    if (inst.status === 'ERROR') {
      console.log('');
      throw new Error(`Instance en ERROR: ${JSON.stringify(inst)}`);
    }
  }

  if (!ip) {
    const inst = await api.request('GET', `/cloud/project/${project}/instance/${id}`);
    ip = pickPublicIp(inst);
  }
  if (ip) upsertEnv('OVH_INSTANCE_IP', ip);

  console.log('');
  console.log('  Fait. Prochaines étapes :');
  console.log(`    ssh -i .ssh/superu_ovh ubuntu@${ip || 'IP'}`);
  console.log('    puis installation Node + Postgres + API SuperU');
  console.log('');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
