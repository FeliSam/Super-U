import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const allowNetwork = args.includes('--allow-network');
const input = resolve(args.find((arg) => !arg.startsWith('--')) ?? 'data/catalog-west-africa.json');
const outputArg = args.find((arg) => arg.startsWith('--output='));
const output = outputArg ? resolve(outputArg.slice('--output='.length)) : null;
const mediaRoot = resolve('data/catalog-media');
const allowedHosts = new Set(
  args.filter((arg) => arg.startsWith('--allow-host=')).map((arg) => arg.slice('--allow-host='.length)),
);
const allowedLocalRoots = args
  .filter((arg) => arg.startsWith('--allow-local-root='))
  .map((arg) => resolve(arg.slice('--allow-local-root='.length)));

const manifest = JSON.parse(await readFile(input, 'utf8'));
const report = { dryRun: !apply, placeholders: 0, copied: 0, downloaded: 0, skipped: 0, errors: [] };

function inside(path, root) {
  return path === root || path.startsWith(`${root}${sep}`);
}

function destinationFor(product, media, sourceName) {
  const extension = extname(sourceName).toLowerCase() || '.bin';
  return resolve(mediaRoot, `${product.sku}-${media.position}${extension}`);
}

async function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

for (const product of manifest.products ?? []) {
  for (const media of product.media ?? []) {
    if (media.placeholder) {
      report.placeholders++;
      continue;
    }
    if (!media.licenseName || (!media.licenseUrl && !media.attribution)) {
      report.errors.push({ sku: product.sku, position: media.position, error: 'Métadonnées de licence absentes.' });
      continue;
    }

    try {
      let bytes;
      let destination;
      if (media.sourceUrl) {
        const url = new URL(media.sourceUrl);
        if (!allowedHosts.has(url.hostname)) throw new Error(`Hôte non autorisé: ${url.hostname}`);
        if (!allowNetwork) {
          report.skipped++;
          continue;
        }
        destination = destinationFor(product, media, basename(url.pathname));
        if (!apply) {
          report.downloaded++;
          continue;
        }
        const response = await fetch(url, { redirect: 'error' });
        if (!response.ok) throw new Error(`Téléchargement HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
      } else if (media.sourcePath) {
        const source = resolve(media.sourcePath);
        if (!allowedLocalRoots.some((root) => inside(source, root))) {
          throw new Error(`Source locale hors racines autorisées: ${source}`);
        }
        destination = destinationFor(product, media, basename(source));
        if (!apply) {
          report.copied++;
          continue;
        }
        bytes = await readFile(source);
        await mkdir(mediaRoot, { recursive: true });
        await copyFile(source, destination);
      } else {
        throw new Error('Aucune source média.');
      }

      const checksum = await digest(bytes);
      if (media.checksumSha256 && media.checksumSha256 !== checksum) {
        throw new Error('Checksum SHA-256 différent du manifeste.');
      }
      await mkdir(mediaRoot, { recursive: true });
      if (media.sourceUrl) await writeFile(destination, bytes);
      media.localPath = destination.slice(resolve('.').length + 1).replaceAll('\\', '/');
      media.checksumSha256 = checksum;
      if (media.sourceUrl) report.downloaded++;
      else report.copied++;
    } catch (error) {
      report.errors.push({
        sku: product.sku,
        position: media.position,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

if (apply && output && report.errors.length === 0) {
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exitCode = 1;
