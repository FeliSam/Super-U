import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOWNLOADS_DIR = join(ROOT, 'server/downloads');

if (!existsSync(DOWNLOADS_DIR)) {
  mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

function getBuildById(projectDir, buildId) {
  try {
    const raw = execSync(`eas build:view ${buildId} --json`, {
      cwd: join(ROOT, projectDir),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const objStart = raw.indexOf('{');
    if (objStart >= 0) {
      return JSON.parse(raw.slice(objStart));
    }
  } catch (err) {
    console.error(`Erreur lecture build ${buildId} pour ${projectDir}:`, err.message);
  }
  return null;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Téléchargement de ${url} vers ${dest}...`);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const fileStream = createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(dest);
      });
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Suivi et Synchronisation des Builds APK EAS ===\n');

  const targets = [
    { dir: 'CourseGO', name: 'CourseGO', id: '5b6d62d8-2f63-4209-bf2f-0562030cb7a8', file: 'coursego.apk' },
    { dir: 'marche-dore', name: 'Marché Doré', id: '6d6148a6-e846-4afe-a0c6-a93d3cc64106', file: 'marchedore.apk' },
  ];

  for (const t of targets) {
    console.log(`Vérification de ${t.name} (Build ID: ${t.id})...`);
    const build = getBuildById(t.dir, t.id);
    if (!build) {
      console.log(`Impossible de récupérer les infos pour ${t.name}\n`);
      continue;
    }
    console.log(`Statut: ${build.status} | Plateforme: ${build.platform} | Profil: ${build.buildProfile}`);
    const apkUrl = build.artifacts?.buildUrl || build.artifacts?.applicationArchiveUrl;
    if (build.status === 'FINISHED' && apkUrl) {
      const dest = join(DOWNLOADS_DIR, t.file);
      await downloadFile(apkUrl, dest);
      console.log(`✓ APK téléchargé et disponible localement: ${dest}\n`);
    } else if (build.status === 'IN_PROGRESS' || build.status === 'IN_QUEUE') {
      console.log(`Compilation en cours sur les serveurs EAS...`);
      console.log(`Suivi direct: https://expo.dev/accounts/feliciano6/projects/${t.dir.toLowerCase()}/builds/${t.id}\n`);
    } else {
      console.log(`Build ${t.id} en état: ${build.status}\n`);
    }
  }
}

main().catch(console.error);
