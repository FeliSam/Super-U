import { existsSync, createReadStream, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { Hono } from 'hono';

export interface AppRelease {
  id: string;
  name: string;
  role: string;
  version: string;
  filename: string;
  localPath: string;
  easProjectId: string;
  easUrl: string;
  account: string;
  lastBuildId?: string;
  description: string;
  testCredentials: { email: string; pass: string; roleDesc: string }[];
}

export const APPS: Record<string, AppRelease> = {
  coursego: {
    id: 'coursego',
    name: 'CourseGO',
    role: 'Staff terrain (Coursiers & Ramasseurs)',
    version: '1.0.0',
    filename: 'CourseGO.apk',
    localPath: resolve(process.cwd(), 'downloads/coursego.apk'),
    easProjectId: 'ec3a7b59-415b-46e9-960a-10c49848420a',
    easUrl: 'https://expo.dev/accounts/feliciano6/projects/coursego/builds/5b6d62d8-2f63-4209-bf2f-0562030cb7a8',
    lastBuildId: '5b6d62d8-2f63-4209-bf2f-0562030cb7a8',
    account: 'feliciano6',
    description: 'Application mobile terrain pour les livreurs à moto et ramasseurs en magasin.',
    testCredentials: [
      { email: 'courier@marchedore.bj', pass: 'marche2024', roleDesc: 'Coursier terrain' },
      { email: 'picker@marchedore.bj', pass: 'marche2024', roleDesc: 'Ramasseur magasin' },
    ],
  },
  marchedore: {
    id: 'marchedore',
    name: 'Marché Doré',
    role: 'Application Client',
    version: '1.0.0',
    filename: 'MarcheDore.apk',
    localPath: resolve(process.cwd(), 'downloads/marchedore.apk'),
    easProjectId: '20abed55-9ebc-46bc-acd9-14523484f61a',
    easUrl: 'https://expo.dev/accounts/feliciano6/projects/marche-dore/builds/6d6148a6-e846-4afe-a0c6-a93d3cc64106',
    lastBuildId: '6d6148a6-e846-4afe-a0c6-a93d3cc64106',
    account: 'feliciano6',
    description: 'Boutique en ligne client : catalogue, panier, suivi de commande en direct et paiement.',
    testCredentials: [
      { email: 'demo@marchedore.bj', pass: 'marche2024', roleDesc: 'Client démo' },
    ],
  },
};

export function registerDownloadRoutes(app: Hono) {
  // Liste des apps et statuts
  app.get('/downloads/apps', (c) => {
    const list = Object.values(APPS).map((item) => ({
      ...item,
      hasLocalFile: existsSync(item.localPath),
      downloadUrl: `/downloads/${item.id}.apk`,
    }));
    return c.json({ ok: true, apps: list });
  });

  // Téléchargement APK CourseGO
  app.get('/downloads/coursego.apk', (c) => {
    const appInfo = APPS.coursego;
    if (existsSync(appInfo.localPath)) {
      const stat = statSync(appInfo.localPath);
      c.header('Content-Type', 'application/vnd.android.package-archive');
      c.header('Content-Disposition', `attachment; filename="${appInfo.filename}"`);
      c.header('Content-Length', String(stat.size));
      const stream = createReadStream(appInfo.localPath);
      return c.body(stream as any);
    }
    // Redirection vers EAS builds si pas de fichier local
    return c.redirect(appInfo.easUrl, 302);
  });

  const serveMarcheDore = (c: any) => {
    const appInfo = APPS.marchedore;
    const candidates = [
      appInfo.localPath,
      resolve(process.cwd(), 'downloads/marche-dore.apk'),
    ];
    const found = candidates.find((p) => existsSync(p));
    if (found) {
      const stat = statSync(found);
      c.header('Content-Type', 'application/vnd.android.package-archive');
      c.header('Content-Disposition', `attachment; filename="${appInfo.filename}"`);
      c.header('Content-Length', String(stat.size));
      const stream = createReadStream(found);
      return c.body(stream as any);
    }
    // Redirection vers EAS builds si pas de fichier local
    return c.redirect(appInfo.easUrl, 302);
  };

  app.get('/downloads/marchedore.apk', serveMarcheDore);
  app.get('/downloads/marche-dore.apk', serveMarcheDore);
}
