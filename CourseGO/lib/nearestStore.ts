import { haversineMeters, type LngLat } from '@/constants/map';
import type { MapStore } from '@/lib/api/ops';
import { slotKind, slotKindRank } from '@/lib/slotKind';

export type RankedStore = MapStore & {
  distanceM: number;
  waiting: number;
};

export function storeDistanceM(store: MapStore | undefined, from: LngLat) {
  if (!store?.coordinate) return Number.POSITIVE_INFINITY;
  return haversineMeters(from, store.coordinate);
}

export function rankNearbyStores(stores: MapStore[], from: LngLat): RankedStore[] {
  const list: RankedStore[] = stores
    .filter((s) => s.affiliated && s.coordinate)
    .map((s) => ({
      ...s,
      distanceM: haversineMeters(from, s.coordinate as LngLat),
      waiting: Math.max(0, Number(s.parcels) || 0),
    }));
  list.sort((a, b) => {
    const aw = a.waiting > 0 ? 0 : 1;
    const bw = b.waiting > 0 ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return a.distanceM - b.distanceM;
  });
  return list;
}

/** Super U à proposer selon la position live. Si un magasin est déjà verrouillé et tout proche, on le garde. */
export function suggestedStore(
  stores: MapStore[],
  from: LngLat,
  lockedStoreId?: string | null,
): RankedStore | null {
  const ranked = rankNearbyStores(stores, from);
  if (!ranked.length) return null;
  if (lockedStoreId) {
    const locked = ranked.find((s) => s.id === lockedStoreId);
    if (locked) return locked;
  }
  return ranked.find((s) => s.waiting > 0) ?? ranked[0];
}

/** Carte Maintenant : tous les Super U à vide, uniquement le magasin verrouillé en course. */
export function mapStoresForNow(stores: MapStore[], lockedStoreId: string | null | undefined, idle: boolean) {
  if (idle) return stores.filter((s) => s.affiliated && s.coordinate);
  if (!lockedStoreId) return [];
  return stores.filter((s) => s.id === lockedStoreId && s.coordinate);
}

export function livePosKey(p: LngLat) {
  return `${Math.round(p[0] * 8000)},${Math.round(p[1] * 8000)}`;
}

export function sortNearStore<
  T extends { store_id?: string | null; slot_label?: string | null; created_at?: string },
>(items: T[], suggestedId: string | undefined, distanceOf: (storeId: string | null | undefined) => number): T[] {
  return [...items].sort((a, b) => {
    const aSug = a.store_id && a.store_id === suggestedId ? 0 : 1;
    const bSug = b.store_id && b.store_id === suggestedId ? 0 : 1;
    if (aSug !== bSug) return aSug - bSug;
    const d = distanceOf(a.store_id) - distanceOf(b.store_id);
    if (Math.abs(d) > 80) return d;
    const ra = slotKindRank(slotKind(undefined, a.slot_label));
    const rb = slotKindRank(slotKind(undefined, b.slot_label));
    if (ra !== rb) return ra - rb;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });
}
