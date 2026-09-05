/**
 * Tunnel public → API SuperU (port 8787).
 * Préfère ngrok ; bascule sur Cloudflare (cloudflared) si ngrok est bloqué
 * (Smart App Control Windows) ou trop ancien.
 * Voir docs/NGROK.md
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.SUPERU_API_PORT || '8787';
const prefer = (process.env.SUPERU_TUNNEL || '').toLowerCase(); // ngrok | cloudflare

function wingetNgrokCandidates() {
  const out = [];
  const base = join(
    process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
    'Microsoft',
    'WinGet',
  );
  const tools = join(root, 'tools', 'ngrok', 'ngrok.exe');
  if (existsSync(tools)) out.push(tools);
  const links = join(base, 'Links', 'ngrok.exe');
  if (existsSync(links)) out.push(links);
  const packages = join(base, 'Packages');
  if (existsSync(packages)) {
    for (const name of readdirSync(packages)) {
      if (!/ngrok/i.test(name)) continue;
      const exe = join(packages, name, 'ngrok.exe');
      if (existsSync(exe)) out.push(exe);
    }
  }
  return out;
}

function tryNgrokBin() {
  if (process.env.NGROK_PATH && existsSync(process.env.NGROK_PATH)) {
    return process.env.NGROK_PATH;
  }
  for (const bin of wingetNgrokCandidates()) {
    try {
      execFileSync(bin, ['version'], { stdio: 'ignore', windowsHide: true, timeout: 5000 });
      return bin;
    } catch {
      /* Smart App Control / too old / missing */
    }
  }
  return null;
}

function findCloudflared() {
  if (process.env.CLOUDFLARED_PATH && existsSync(process.env.CLOUDFLARED_PATH)) {
    return process.env.CLOUDFLARED_PATH;
  }
  const candidates = [
    join(process.env.ProgramFiles || 'C:\\Program Files', 'cloudflared', 'cloudflared.exe'),
    join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'cloudflared.exe'),
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
}

function userNgrokConfig() {
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'ngrok', 'ngrok.yml');
  }
  return join(homedir(), '.config', 'ngrok', 'ngrok.yml');
}

function printHelp(kind) {
  console.log('');
  console.log(`  SuperU · tunnel API (${kind})`);
  console.log('');
  console.log('  1. Laissez tourner `npm run dev:api` (port 8787).');
  console.log('  2. Copiez l’URL https://… affichée ci-dessous.');
  console.log('  3. Collez-la dans Réglages → Adresse API (apps) ou EXPO_PUBLIC_API_URL.');
  console.log('  4. Optionnel : PUBLIC_API_URL=<cette-url> dans server/.env');
  console.log('');
}

function run(bin, args) {
  const child = spawn(bin, args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
    windowsHide: true,
  });
  child.on('error', (err) => {
    console.error(err.message);
    process.exit(1);
  });
  child.on('exit', (code) => process.exit(code ?? 1));
}

function startCloudflare() {
  const bin = findCloudflared();
  printHelp('cloudflare quick tunnel');
  console.log(`  → ${bin} tunnel --url http://127.0.0.1:${port}`);
  console.log('');
  run(bin, ['tunnel', '--url', `http://127.0.0.1:${port}`]);
}

function startNgrok(bin) {
  const projectConfig = join(root, 'ngrok.yml');
  const userConfig = userNgrokConfig();
  const args = [];
  if (existsSync(userConfig)) args.push('--config', userConfig);
  if (existsSync(projectConfig)) {
    args.push('--config', projectConfig);
    args.push('start', 'api');
  } else {
    args.push('http', port);
  }
  printHelp('ngrok');
  console.log(`  → ${bin} ${args.join(' ')}`);
  console.log('');
  run(bin, args);
}

if (prefer === 'cloudflare' || prefer === 'cloudflared') {
  startCloudflare();
} else {
  const ngrok = tryNgrokBin();
  if (ngrok && prefer !== 'off') {
    try {
      const ver = execFileSync(ngrok, ['version'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000,
      });
      const m = /version\s+(\d+)\.(\d+)/i.exec(ver);
      const major = m ? Number(m[1]) : 0;
      const minor = m ? Number(m[2]) : 0;
      // Compte gratuit exige souvent >= 3.20
      if (major > 3 || (major === 3 && minor >= 20)) {
        startNgrok(ngrok);
      } else {
        console.log(`  ngrok ${ver.trim()} trop ancien (min 3.20) → bascule Cloudflare.`);
        console.log('  (Windows bloque souvent la mise à jour ngrok : Smart App Control)');
        startCloudflare();
      }
    } catch {
      startCloudflare();
    }
  } else {
    console.log('  ngrok indisponible → bascule Cloudflare quick tunnel.');
    startCloudflare();
  }
}
