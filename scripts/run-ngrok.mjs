/**
 * Lance le binaire ngrok (WinGet ou PATH) avec les args passés.
 * Usage : node scripts/run-ngrok.mjs version
 *         npm run ngrok -- config add-authtoken TOKEN
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function wingetNgrok() {
  const base = join(
    process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
    'Microsoft',
    'WinGet',
  );
  const links = join(base, 'Links', 'ngrok.exe');
  if (existsSync(links)) return links;

  const packages = join(base, 'Packages');
  if (!existsSync(packages)) return null;
  for (const name of readdirSync(packages)) {
    if (!/ngrok/i.test(name)) continue;
    const exe = join(packages, name, 'ngrok.exe');
    if (existsSync(exe)) return exe;
  }
  return null;
}

const bin = process.env.NGROK_PATH && existsSync(process.env.NGROK_PATH)
  ? process.env.NGROK_PATH
  : wingetNgrok();

if (!bin) {
  console.error('ngrok introuvable. Réinstallez : winget install Ngrok.Ngrok');
  process.exit(1);
}

const args = process.argv.slice(2);
const child = spawn(bin, args, { stdio: 'inherit', shell: false, windowsHide: true });
child.on('error', (err) => {
  console.error(err.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
