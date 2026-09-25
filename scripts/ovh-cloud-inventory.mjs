/**
 * Explore Public Cloud: usable regions, cheapest linux flavor, Ubuntu image, SSH keys.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

const ENDPOINTS = {
  'ovh-eu': 'https://eu.api.ovh.com/1.0',
  'ovh-us': 'https://api.us.ovhcloud.com/1.0',
  'ovh-ca': 'https://ca.api.ovh.com/1.0',
};

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

const env = loadEnv();
const api = client(env);
const projects = await api.request('GET', '/cloud/project');
const project = env.OVH_CLOUD_PROJECT_ID || projects[0];
console.log('project', project);

const regionList = await api.request('GET', `/cloud/project/${project}/region`);
console.log('raw regions count', regionList?.length);

const details = [];
for (const name of regionList || []) {
  try {
    const r = await api.request('GET', `/cloud/project/${project}/region/${encodeURIComponent(name)}`);
    const instanceSvc = (r.services || []).find((s) => s.name === 'instance');
    details.push({
      name: r.name,
      status: r.status,
      instance: instanceSvc?.status,
      continentCode: r.continentCode,
    });
  } catch {
    /* skip */
  }
}

const usable = details.filter((r) => r.status === 'UP' && r.instance === 'UP');
console.log(
  'usable instance regions:',
  usable.map((r) => r.name).slice(0, 20),
);

const prefer = ['GRA11', 'GRA9', 'SBG5', 'DE1', 'WAW1', 'BHS5', 'EU-WEST-PAR'];
const region = prefer.find((p) => usable.some((u) => u.name === p)) || usable[0]?.name;
console.log('chosen', region);

if (!region) process.exit(1);

const flavors = await api.request(
  'GET',
  `/cloud/project/${project}/flavor?region=${encodeURIComponent(region)}`,
);
const linux = (flavors || [])
  .filter((f) => f.available !== false && f.osType === 'linux')
  .sort((a, b) => a.vcpus - b.vcpus || a.ram - b.ram);
console.log(
  'cheapest flavors:',
  linux.slice(0, 10).map((f) => ({
    name: f.name,
    id: f.id,
    vcpus: f.vcpus,
    ram: f.ram,
    disk: f.disk,
    planCodes: f.planCodes,
  })),
);

const images = await api.request(
  'GET',
  `/cloud/project/${project}/image?osType=linux&region=${encodeURIComponent(region)}`,
);
const ubuntu = (images || []).filter((i) => /Ubuntu/i.test(i.name) && /(22\.04|24\.04)/.test(i.name));
console.log(
  'ubuntu:',
  ubuntu.slice(0, 10).map((i) => ({ name: i.name, id: i.id, visibility: i.visibility, status: i.status })),
);

const keys = await api.request('GET', `/cloud/project/${project}/sshkey`);
console.log(
  'sshkeys',
  (keys || []).map((k) => ({ id: k.id, name: k.name, regions: k.regions })),
);
