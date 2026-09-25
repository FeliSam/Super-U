/**
 * Tunnel ngrok SDK → API SuperU (port 8787) avec domaine réservé.
 * Usage : npm run tunnel:ngrok
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import ngrok from '@ngrok/ngrok';

const addr = Number(process.env.SUPERU_API_PORT || 8787);
const domain =
  (process.env.NGROK_DOMAIN || 'giveaway-rack-obtrusive.ngrok-free.dev').trim();

function readAuthtokenFromConfig() {
  const candidates = [
    join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'ngrok', 'ngrok.yml'),
    join(homedir(), '.config', 'ngrok', 'ngrok.yml'),
    join(homedir(), '.ngrok2', 'ngrok.yml'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const m = /^\s*authtoken:\s*(\S+)\s*$/m.exec(text);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

async function main() {
  const token = (process.env.NGROK_AUTHTOKEN || '').trim() || readAuthtokenFromConfig();
  if (!token) {
    console.error('NGROK_AUTHTOKEN manquant. Dashboard → Your Authtoken.');
    process.exit(1);
  }
  process.env.NGROK_AUTHTOKEN = token;

  console.log('');
  console.log('  SuperU · ngrok SDK');
  console.log(`  → localhost:${addr}  →  https://${domain}`);
  console.log('');

  const listener = await ngrok.forward({
    addr,
    authtoken_from_env: true,
    domain,
  });

  const url = listener.url();
  console.log(`  En ligne : ${url}`);
  console.log(`  Health   : ${url.replace(/\/$/, '')}/health`);
  console.log('  Ctrl+C pour arrêter. Laisse ce terminal ouvert.');
  console.log('');

  const stop = async () => {
    console.log('  Arrêt ngrok…');
    try {
      await listener.close();
    } catch {
      /* ignore */
    }
    try {
      await ngrok.kill();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());

  // Ref handles so the event loop never drains (SDK can otherwise exit)
  const heartbeat = setInterval(() => {
    /* keep alive */
  }, 30_000);
  if (typeof heartbeat.unref !== 'function') {
    /* older node */
  } else {
    // DO NOT unref — we want the timer to keep the process alive
  }
}

main().catch((err) => {
  console.error('Échec ngrok :', err?.message || err);
  process.exit(1);
});
