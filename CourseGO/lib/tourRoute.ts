import { haversineMeters, type LngLat, type MapMarker } from '@/constants/map';
import type { DeliveryJob } from '@/lib/api/ops';
import { clientCoord, storeCoord } from '@/lib/courierTrack';
import { deliveryNavLeg } from '@/lib/opsModel';
import { shortOrderId } from '@/lib/format';
import { isDeliveryActive, normalizeDeliveryStatus } from '@/lib/opsModel';
import { fetchRoadRoute, roundLngLat, type OsrmProfile } from '@/lib/roadRoute';
import type { VehicleKind } from '@/lib/vehicleMotion';

export type TourStopStatus = 'pending' | 'current' | 'done';

export type TourStop = {
  delivery: DeliveryJob;
  coordinate: LngLat;
  /** 1-based stop in optimized tour order. */
  stopIndex: number;
  status: TourStopStatus;
};

export type CourierTourPlan = {
  deliveries: DeliveryJob[];
  store: LngLat;
  storeName: string;
  tourStarted: boolean;
  /** Départ de l’itinéraire affiché : magasin, puis dernière remise. */
  routeFrom: LngLat;
  routeFromKind: 'store' | 'lastDrop';
  routeFromLabel: string;
  stops: TourStop[];
  /** Itinéraire affiché sur la carte (OSRM multi-points). */
  routeWaypoints: LngLat[];
  navFrom: LngLat;
  navTo: LngLat;
  focusDelivery: DeliveryJob;
  multiStop: boolean;
  pendingCount: number;
};

type LastDrop = {
  courierId: string;
  storeId: string | null;
  from: LngLat;
  label: string;
};

const lastDropMem = new Map<string, LastDrop>();

function lastDropKey(courierId: string) {
  return `coursego.last-drop.v1.${courierId}`;
}

function persistLastDrop(hop: LastDrop) {
  lastDropMem.set(hop.courierId, hop);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(lastDropKey(hop.courierId), JSON.stringify(hop));
  } catch {
    /* ignore */
  }
}

export function rememberLastDropoff(courierId: string | undefined, d: DeliveryJob | null | undefined) {
  if (!courierId || !d) return;
  const from = clientCoord(d);
  const label =
    d.address_label?.trim() ||
    [d.address_line, d.address_city].filter(Boolean).join(', ') ||
    'Dernière remise';
  persistLastDrop({ courierId, storeId: d.store_id ?? null, from, label });
}

export function rememberLastDropoffPoint(
  courierId: string | undefined,
  from: LngLat,
  label?: string | null,
  storeId?: string | null,
) {
  if (!courierId || !from) return;
  persistLastDrop({
    courierId,
    storeId: storeId ?? null,
    from,
    label: label?.trim() || 'Dernière remise',
  });
}

export function clearLastDropoff(courierId: string | undefined) {
  if (!courierId) return;
  lastDropMem.delete(courierId);
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(lastDropKey(courierId));
  } catch {
    /* ignore */
  }
}

export function readLastDropoff(courierId: string | undefined, storeId?: string | null): LastDrop | null {
  if (!courierId) return null;
  let hop = lastDropMem.get(courierId) ?? null;
  if (!hop) {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(lastDropKey(courierId));
        if (raw) hop = JSON.parse(raw) as LastDrop;
        if (hop) lastDropMem.set(courierId, hop);
      }
    } catch {
      hop = null;
    }
  }
  if (!hop) return null;
  if (storeId && hop.storeId && hop.storeId !== storeId) return null;
  return hop;
}

function isPendingClient(d: DeliveryJob) {
  const s = normalizeDeliveryStatus(d.delivery_status);
  return s !== 'delivered' && s !== 'failed' && s !== 'cancelled';
}

function isDoneClient(d: DeliveryJob) {
  const s = normalizeDeliveryStatus(d.delivery_status);
  return s === 'delivered' || s === 'failed';
}

/** Fallback sync : plus proche voisin (haversine) — UI immédiate / OSRM KO. */
export function optimizeClientOrder(origin: LngLat, deliveries: DeliveryJob[]): DeliveryJob[] {
  const pending = deliveries.filter(isPendingClient);
  if (pending.length <= 1) return pending;

  const remaining = [...pending];
  const ordered: DeliveryJob[] = [];
  let cursor = origin;

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineMeters(cursor, clientCoord(remaining[i]!));
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]!;
    ordered.push(next);
    cursor = clientCoord(next);
  }
  return ordered;
}

/** ~28 km/h — durée approximative si OSRM échoue. */
const FALLBACK_SPEED_MPS = 7.8;
const ROAD_MATRIX_TIMEOUT_MS = 8_000;
const roadDurationCache = new Map<string, number>();

function durationPairKey(a: LngLat, b: LngLat) {
  const ra = roundLngLat(a);
  const rb = roundLngLat(b);
  return `${ra[0]},${ra[1]}>${rb[0]},${rb[1]}`;
}

function haversineDurationSeconds(from: LngLat, to: LngLat) {
  return haversineMeters(from, to) / FALLBACK_SPEED_MPS;
}

async function roadLegDurationSeconds(
  from: LngLat,
  to: LngLat,
  profile: OsrmProfile | VehicleKind | string = 'driving',
): Promise<number> {
  const key = durationPairKey(from, to);
  const hit = roadDurationCache.get(key);
  if (hit != null) return hit;
  try {
    const road = await fetchRoadRoute([from, to], profile);
    if (road && Number.isFinite(road.durationSeconds) && road.durationSeconds > 0) {
      roadDurationCache.set(key, road.durationSeconds);
      return road.durationSeconds;
    }
  } catch {
    /* fallback below */
  }
  const approx = haversineDurationSeconds(from, to);
  roadDurationCache.set(key, approx);
  return approx;
}

function cachedOrHaversineDuration(from: LngLat, to: LngLat) {
  const key = durationPairKey(from, to);
  return roadDurationCache.get(key) ?? haversineDurationSeconds(from, to);
}

/** Précharge la matrice de durées (≤3 stops → peu de paires) en parallèle, avec timeout. */
async function prefetchRoadDurationMatrix(
  points: LngLat[],
  profile: OsrmProfile | VehicleKind | string = 'driving',
): Promise<void> {
  const jobs: Promise<number>[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const a = points[i]!;
      const b = points[j]!;
      if (roadDurationCache.has(durationPairKey(a, b))) continue;
      jobs.push(roadLegDurationSeconds(a, b, profile));
    }
  }
  if (!jobs.length) return;
  await Promise.race([
    Promise.all(jobs),
    new Promise<void>((resolve) => setTimeout(resolve, ROAD_MATRIX_TIMEOUT_MS)),
  ]);
}

function greedyByDuration(origin: LngLat, pending: DeliveryJob[]): DeliveryJob[] {
  if (pending.length <= 1) return pending;
  const remaining = [...pending];
  const ordered: DeliveryJob[] = [];
  let cursor = origin;
  while (remaining.length) {
    let bestIdx = 0;
    let bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cost = cachedOrHaversineDuration(cursor, clientCoord(remaining[i]!));
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]!;
    ordered.push(next);
    cursor = clientCoord(next);
  }
  return ordered;
}

/**
 * Même greedy NN que optimizeClientOrder, mais le prochain stop est choisi
 * par durée routière OSRM (cache mémoire + fallback haversine).
 */
export async function optimizeClientOrderByRoad(
  origin: LngLat,
  deliveries: DeliveryJob[],
  profile: OsrmProfile | VehicleKind | string = 'driving',
): Promise<DeliveryJob[]> {
  const pending = deliveries.filter(isPendingClient);
  if (pending.length <= 1) return pending;
  const points: LngLat[] = [origin, ...pending.map((d) => clientCoord(d))];
  await prefetchRoadDurationMatrix(points, profile);
  return greedyByDuration(origin, pending);
}

/** Applique un ordre d’ids (ex. résultat road) sur les livraisons pending. */
export function orderPendingByIds(deliveries: DeliveryJob[], orderedIds: string[]): DeliveryJob[] {
  const pending = deliveries.filter(isPendingClient);
  const byId = new Map(pending.map((d) => [d.id, d]));
  const ordered: DeliveryJob[] = [];
  for (const id of orderedIds) {
    const d = byId.get(id);
    if (d) {
      ordered.push(d);
      byId.delete(id);
    }
  }
  for (const d of byId.values()) ordered.push(d);
  return ordered;
}

/** Distance air (m) magasin→client ou courrier→client pour suggestions claim. */
export function claimProximityMeters(d: DeliveryJob, from: LngLat): number {
  const drop = clientCoord(d);
  if (Number.isFinite(drop[0]) && Number.isFinite(drop[1]) && Math.abs(drop[0]) > 0.2) {
    return haversineMeters(from, drop);
  }
  const store = storeCoord(d);
  return haversineMeters(from, store);
}

/**
 * Trie les colis claimables : magasin préféré d’abord, puis plus proche du GPS courrier
 * (ou du magasin si pas de GPS utile). Ne claim pas — UI only.
 */
export function sortClaimableByProximity<T extends DeliveryJob>(
  items: T[],
  from: LngLat,
  opts?: {
    preferredStoreId?: string | null;
    slotRank?: (d: T) => number;
  },
): T[] {
  const preferred = opts?.preferredStoreId ?? null;
  const slotRank = opts?.slotRank;
  return [...items].sort((a, b) => {
    const aPref = preferred && a.store_id === preferred ? 0 : 1;
    const bPref = preferred && b.store_id === preferred ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;
    const da = claimProximityMeters(a, from);
    const db = claimProximityMeters(b, from);
    if (Math.abs(da - db) > 40) return da - db;
    if (slotRank) {
      const ra = slotRank(a);
      const rb = slotRank(b);
      if (ra !== rb) return ra - rb;
    }
    return String(b.packed_at ?? '').localeCompare(String(a.packed_at ?? ''));
  });
}

export function closestClaimableId(items: DeliveryJob[], from: LngLat): string | null {
  if (!items.length) return null;
  let bestId = items[0]!.id;
  let best = Infinity;
  for (const d of items) {
    const m = claimProximityMeters(d, from);
    if (m < best) {
      best = m;
      bestId = d.id;
    }
  }
  return bestId;
}

export function activeCourierDeliveries(deliveries: DeliveryJob[], courierId?: string | null) {
  if (!courierId) return [];
  return deliveries.filter((d) => d.courier_id === courierId && isDeliveryActive(d));
}

/** Prochaine livraison après une remise (ordre tournée conservé). */
export function nextDeliveryInTour(
  deliveries: DeliveryJob[],
  courierId: string,
  afterDeliveryId: string,
): DeliveryJob | null {
  const plan = buildCourierTourPlan(deliveries, courierId);
  if (!plan) return null;
  const next = plan.stops
    .filter((s) => s.status !== 'done' && s.delivery.id !== afterDeliveryId)
    .sort((a, b) => a.stopIndex - b.stopIndex)[0];
  return next?.delivery ?? null;
}

/** Origine tournée (magasin ou dernière remise) — partagé avec le refresh road. */
export function resolveTourOrigin(
  deliveries: DeliveryJob[],
  courierId: string | undefined,
  options?: {
    lastDrop?: LngLat | null;
    lastDropLabel?: string | null;
    lastDropStoreId?: string | null;
  },
): { origin: LngLat; store: LngLat; storeId: string | null; tourStarted: boolean } | null {
  const mine = activeCourierDeliveries(deliveries, courierId);
  if (!mine.length) return null;
  const store = storeCoord(mine[0]);
  const tourStarted = mine.some((d) => {
    const s = normalizeDeliveryStatus(d.delivery_status);
    return s === 'picked_up' || s === 'en_route' || s === 'arrived';
  });
  const cached = courierId ? readLastDropoff(courierId, mine[0].store_id) : null;
  const serverDrop =
    options?.lastDrop &&
    (!options.lastDropStoreId || !mine[0].store_id || options.lastDropStoreId === mine[0].store_id)
      ? { from: options.lastDrop, label: options.lastDropLabel?.trim() || 'Dernière remise' }
      : null;
  const lastDrop = serverDrop ?? (cached ? { from: cached.from, label: cached.label } : null);
  const fromLastDrop = Boolean(tourStarted && lastDrop);
  return {
    origin: fromLastDrop ? lastDrop!.from : store,
    store,
    storeId: mine[0].store_id ?? null,
    tourStarted,
  };
}

export function tourMembershipKey(deliveries: DeliveryJob[], courierId: string | undefined) {
  const mine = activeCourierDeliveries(deliveries, courierId);
  return mine
    .map((d) => `${d.id}:${normalizeDeliveryStatus(d.delivery_status)}`)
    .sort()
    .join('|');
}

export function buildCourierTourPlan(
  deliveries: DeliveryJob[],
  courierId: string | undefined,
  options?: {
    focusDeliveryId?: string;
    courierPosition?: LngLat;
    lastDrop?: LngLat | null;
    lastDropLabel?: string | null;
    lastDropStoreId?: string | null;
    /** Ordre clients issu d’optimizeClientOrderByRoad (ids). Sinon haversine sync. */
    orderedDeliveryIds?: string[] | null;
  },
): CourierTourPlan | null {
  const mine = activeCourierDeliveries(deliveries, courierId);
  if (!mine.length) return null;

  const store = storeCoord(mine[0]);
  const storeName = mine[0].store_name || 'Magasin';
  const tourStarted = mine.some((d) => {
    const s = normalizeDeliveryStatus(d.delivery_status);
    return s === 'picked_up' || s === 'en_route' || s === 'arrived';
  });

  const cached = courierId ? readLastDropoff(courierId, mine[0].store_id) : null;
  const serverDrop =
    options?.lastDrop &&
    (!options.lastDropStoreId || !mine[0].store_id || options.lastDropStoreId === mine[0].store_id)
      ? { from: options.lastDrop, label: options.lastDropLabel?.trim() || 'Dernière remise' }
      : null;
  const lastDrop = serverDrop ?? (cached ? { from: cached.from, label: cached.label } : null);
  const fromLastDrop = Boolean(tourStarted && lastDrop);
  const origin = fromLastDrop ? lastDrop!.from : store;
  const routeFromKind: CourierTourPlan['routeFromKind'] = fromLastDrop ? 'lastDrop' : 'store';
  const routeFromLabel = fromLastDrop ? lastDrop!.label : storeName;

  const orderedAll = options?.orderedDeliveryIds?.length
    ? orderPendingByIds(mine, options.orderedDeliveryIds)
    : optimizeClientOrder(origin, mine);
  const pendingOrdered = orderedAll.filter(isPendingClient);
  const multiStop = mine.length > 1;
  const courierPos = options?.courierPosition ?? origin;

  let focusDelivery: DeliveryJob =
    pendingOrdered.find((d) => d.id === options?.focusDeliveryId) ??
    pendingOrdered[0] ??
    mine[0]!;

  if (options?.focusDeliveryId) {
    const focused = pendingOrdered.find((d) => d.id === options.focusDeliveryId);
    if (focused) focusDelivery = focused;
  }

  const stops: TourStop[] = mine.map((d) => {
    const done = isDoneClient(d);
    const orderIdx = orderedAll.findIndex((x) => x.id === d.id);
    return {
      delivery: d,
      coordinate: clientCoord(d),
      stopIndex: orderIdx >= 0 ? orderIdx + 1 : 0,
      status: done ? 'done' : d.id === focusDelivery.id ? 'current' : 'pending',
    };
  });

  const goingToClient = deliveryNavLeg(focusDelivery.delivery_status) === 'client';
  const navFrom = courierPos;
  const navTo = goingToClient ? clientCoord(focusDelivery) : store;

  const remainingCoords = pendingOrdered.map((d) => clientCoord(d));
  let routeWaypoints: LngLat[] = [];
  if (remainingCoords.length) {
    routeWaypoints = [origin, ...remainingCoords];
  }

  return {
    deliveries: mine,
    store,
    storeName,
    tourStarted,
    routeFrom: origin,
    routeFromKind,
    routeFromLabel,
    stops,
    routeWaypoints,
    navFrom,
    navTo,
    focusDelivery,
    multiStop,
    pendingCount: pendingOrdered.length,
  };
}

export function buildTourMapMarkers(
  plan: CourierTourPlan,
  courierPosition: LngLat,
  courierVehicle: MapMarker['vehicle'],
  courierLabel: string,
): MapMarker[] {
  const markers: MapMarker[] = [];

  if (plan.routeFromKind === 'store') {
    markers.push({
      id: 'store',
      coordinate: plan.store,
      kind: 'store',
      label: plan.storeName,
    });
  } else {
    markers.push({
      id: 'last-drop',
      coordinate: plan.routeFrom,
      kind: 'pin',
      label: `Départ · ${plan.routeFromLabel}`,
    });
  }

  const pendingStops = plan.stops
    .filter((s) => s.status !== 'done')
    .sort((a, b) => a.stopIndex - b.stopIndex);

  for (const stop of pendingStops) {
    const oid = shortOrderId(stop.delivery.order_id);
    const name =
      stop.delivery.address_label?.trim() ||
      [stop.delivery.address_line, stop.delivery.address_city].filter(Boolean).join(', ') ||
      'Client';
    const label =
      plan.multiStop || plan.pendingCount > 1
        ? `Client ${stop.stopIndex} · ${oid}`
        : name;

    markers.push({
      id: stop.delivery.id,
      coordinate: stop.coordinate,
      kind: 'home',
      label,
      highlight: stop.status === 'current',
    });
  }

  markers.push({
    id: 'me',
    coordinate: courierPosition,
    kind: 'courier',
    vehicle: courierVehicle ?? 'moto',
    label: courierLabel,
  });

  return markers;
}

export function googleMapsTourUrl(from: LngLat, clientStops: LngLat[]) {
  if (!clientStops.length) {
    return `https://www.google.com/maps/dir/?api=1&destination=${from[1]},${from[0]}&travelmode=driving`;
  }
  if (clientStops.length === 1) {
    const c = clientStops[0]!;
    return `https://www.google.com/maps/dir/?api=1&origin=${from[1]},${from[0]}&destination=${c[1]},${c[0]}&travelmode=driving`;
  }
  const destination = clientStops[clientStops.length - 1]!;
  const waypoints = clientStops
    .slice(0, -1)
    .map((c) => `${c[1]},${c[0]}`)
    .join('|');
  return (
    `https://www.google.com/maps/dir/?api=1&origin=${from[1]},${from[0]}` +
    `&destination=${destination[1]},${destination[0]}&waypoints=${waypoints}&travelmode=driving`
  );
}

export function tourRouteSummary(plan: CourierTourPlan) {
  const pending = plan.stops.filter((s) => s.status !== 'done').sort((a, b) => a.stopIndex - b.stopIndex);
  if (!pending.length) return null;
  if (plan.tourStarted) {
    const current = pending.find((s) => s.status === 'current') ?? pending[0];
    const rest = pending.filter((s) => s.delivery.id !== current?.delivery.id);
    const from = plan.routeFromKind === 'lastDrop' ? 'Dernière remise' : 'Magasin';
    if (rest.length) {
      return `${from} → Client ${current!.stopIndex} · puis ${rest.map((s) => s.stopIndex).join(' → ')}`;
    }
    return `${from} → client ${current!.stopIndex}`;
  }
  if (!plan.multiStop || pending.length <= 1) return null;
  return `Tournée · Magasin → ${pending.map((s) => `Client ${s.stopIndex}`).join(' → ')}`;
}
