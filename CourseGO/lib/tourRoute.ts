import { haversineMeters, type LngLat, type MapMarker } from '@/constants/map';
import type { DeliveryJob } from '@/lib/api/ops';
import { clientCoord, storeCoord } from '@/lib/courierTrack';
import { deliveryNavLeg } from '@/lib/opsModel';
import { shortOrderId } from '@/lib/format';
import { isDeliveryActive, normalizeDeliveryStatus } from '@/lib/opsModel';

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

/** Plus proche voisin depuis une origine — ordre de tournée fixe pour toute la course. */
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

export function buildCourierTourPlan(
  deliveries: DeliveryJob[],
  courierId: string | undefined,
  options?: {
    focusDeliveryId?: string;
    courierPosition?: LngLat;
    lastDrop?: LngLat | null;
    lastDropLabel?: string | null;
    lastDropStoreId?: string | null;
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

  const orderedAll = optimizeClientOrder(origin, mine);
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
