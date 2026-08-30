import {
  SUPER_U_STORES,
  type SuperUCity,
  type SuperUFormat,
  type SuperUStore,
} from '@/data/superU';
import { apiAvailable, apiFetch } from '@/lib/api/http';

export type SuperUListParams = {
  city?: SuperUCity | 'all';
  format?: SuperUFormat | 'all';
  q?: string;
};

export type SuperUListResponse = {
  ok: true;
  count: number;
  cities: SuperUCity[];
  stores: SuperUStore[];
};

export type SuperUDetailResponse =
  | { ok: true; store: SuperUStore }
  | { ok: false; error: 'not_found' };

function filterStores({ city = 'all', format = 'all', q }: SuperUListParams = {}): SuperUStore[] {
  const needle = q?.trim().toLowerCase();
  return SUPER_U_STORES.filter((store) => {
    if (city !== 'all' && store.city !== city) return false;
    if (format !== 'all' && store.format !== format) return false;
    if (!needle) return true;
    const hay = `${store.name} ${store.address} ${store.fullAddress} ${store.cityLabel}`.toLowerCase();
    return hay.includes(needle);
  });
}

/**
 * Client API — liste des Super U Cotonou & Calavi.
 * Remplaçable plus tard par `fetch('/api/super-u')` si output serveur activé.
 */
export async function listSuperUStores(params: SuperUListParams = {}): Promise<SuperUListResponse> {
  if (await apiAvailable()) {
    try {
      const remote = await apiFetch<{ ok: true; stores: SuperUStore[] }>('/stores');
      if (remote.ok && remote.stores?.length) {
        const city = params.city ?? 'all';
        const format = params.format ?? 'all';
        const needle = params.q?.trim().toLowerCase();
        const stores = remote.stores.filter((store) => {
          if (city !== 'all' && store.city !== city) return false;
          if (format !== 'all' && store.format !== format) return false;
          if (!needle) return true;
          const hay = `${store.name} ${store.address} ${store.fullAddress} ${store.cityLabel}`.toLowerCase();
          return hay.includes(needle);
        });
        return {
          ok: true,
          count: stores.length,
          cities: ['cotonou', 'calavi'],
          stores,
        };
      }
    } catch {
      /* local list */
    }
  }
  const stores = filterStores(params);
  return {
    ok: true,
    count: stores.length,
    cities: ['cotonou', 'calavi'],
    stores,
  };
}

export async function getSuperUStore(id: string): Promise<SuperUDetailResponse> {
  await Promise.resolve();
  const store = SUPER_U_STORES.find((s) => s.id === id);
  if (!store) return { ok: false, error: 'not_found' };
  return { ok: true, store };
}

/** Magasin principal Marché Doré (préparation / départ livreur). */
export async function getPrimarySuperUStore(): Promise<SuperUStore> {
  const res = await getSuperUStore('su-aeroport');
  if (res.ok) return res.store;
  return SUPER_U_STORES[0];
}

export function superUStoresToMapMarkers(
  stores: SuperUStore[],
  color = '#e30613',
): {
  id: string;
  coordinate: SuperUStore['coordinate'];
  kind: 'superu';
  label: string;
  color: string;
}[] {
  return stores.map((store) => ({
    id: store.id,
    coordinate: store.coordinate,
    kind: 'superu' as const,
    label: store.name.replace(/^Super U\s+/i, 'U · ').replace(/^U Express\s+/i, 'U · '),
    color,
  }));
}
