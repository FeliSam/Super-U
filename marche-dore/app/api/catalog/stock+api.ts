/**
 * GET /api/catalog/stock?storeId= — stock par Super U.
 * Actif uniquement si `web.output` = `server` (EAS Hosting).
 * En local, utiliser `getStoreStock()` / `getProductAvailability()` depuis `@/lib/api/catalog`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL('http://127.0.0.1:8787/catalog/stock');
  url.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const res = await fetch(target);
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
