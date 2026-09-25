/**
 * GET /api/catalog — liste / filtres catalogue.
 * Actif uniquement si `web.output` = `server` (EAS Hosting).
 * En local, utiliser `listCatalogProducts()` depuis `@/lib/api/catalog`
 * (API SuperU port 8787, sinon seed `data/stock.ts`).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL('http://127.0.0.1:8787/catalog');
  url.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const res = await fetch(target);
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
