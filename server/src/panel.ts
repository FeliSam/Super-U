import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Hono } from 'hono';

/**
 * Sert le build du panel admin (marche-admin/dist) sous /panel/ sur la même origine que l'API.
 * Aucun sous-domaine ni règle Caddy supplémentaire : https://api.moxtapp.ru/panel/
 * - fichiers existants → servis tels quels (assets/* en cache long, immuables)
 * - toute autre route /panel/... sans extension → index.html (fallback SPA)
 */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function panelDistDir() {
  const fromEnv = process.env.PANEL_DIST_DIR?.trim();
  if (fromEnv) return resolve(fromEnv);
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '../../marche-admin/dist');
}

function securityHeaders(headers: Record<string, string>) {
  return {
    ...headers,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  };
}

export function registerPanelRoutes(app: Hono) {
  const root = panelDistDir();
  if (existsSync(join(root, 'index.html'))) {
    console.log(`Panel admin servi depuis ${root} sur /panel/`);
  } else {
    console.warn(`Panel admin non construit (${root}/index.html absent) : /panel/ répondra 503.`);
  }

  const sendFile = (file: string, cache: string) => {
    const ext = extname(file).toLowerCase();
    return new Response(readFileSync(file), {
      headers: securityHeaders({
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Cache-Control': cache,
      }),
    });
  };

  const sendIndex = () => {
    const index = join(root, 'index.html');
    if (!existsSync(index)) {
      return new Response('Panel admin non construit : lancez « npm run build » dans marche-admin.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return sendFile(index, 'no-cache');
  };

  app.get('/panel', (c) => c.redirect('/panel/', 301));

  app.get('/panel/*', (c) => {
    let rel: string;
    try {
      rel = decodeURIComponent(c.req.path.slice('/panel/'.length));
    } catch {
      return c.text('Bad request', 400);
    }
    if (!rel || rel.endsWith('/')) return sendIndex();
    const target = normalize(join(root, rel));
    if (target !== root && !target.startsWith(root + sep)) return c.text('Not found', 404);
    if (existsSync(target) && statSync(target).isFile()) {
      const immutable = rel.startsWith('assets/');
      return sendFile(target, immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
    }
    // Un fichier avec extension introuvable → vrai 404 (pas de HTML à la place d'un JS).
    if (extname(rel)) return c.text('Not found', 404);
    return sendIndex();
  });
}
