/**
 * GET /api/super-u — liste des Super U Cotonou & Calavi.
 * Actif uniquement si `web.output` = `server` (EAS Hosting).
 * En local, utiliser `listSuperUStores()` depuis `@/lib/api/superU`.
 */
import { SUPER_U_STORES, type SuperUCity, type SuperUFormat } from '@/data/superU';

export function GET(request: Request) {
  const url = new URL(request.url);
  const city = (url.searchParams.get('city') ?? 'all') as SuperUCity | 'all';
  const format = (url.searchParams.get('format') ?? 'all') as SuperUFormat | 'all';
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';

  const stores = SUPER_U_STORES.filter((store) => {
    if (city !== 'all' && store.city !== city) return false;
    if (format !== 'all' && store.format !== format) return false;
    if (!q) return true;
    const hay = `${store.name} ${store.address} ${store.fullAddress} ${store.cityLabel}`.toLowerCase();
    return hay.includes(q);
  });

  return Response.json({
    ok: true,
    count: stores.length,
    cities: ['cotonou', 'calavi'],
    stores });
}
