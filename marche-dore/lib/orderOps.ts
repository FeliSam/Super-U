import { offsetBeside, type LngLat } from '@/constants/map';
import { haversineMeters } from '@/lib/deliveryRouting';
import { asVehicleKind, travelSeconds, tripProgress } from '@/lib/vehicleMotion';

export type PickStatus = 'queued' | 'assigned' | 'picking' | 'packed' | 'cancelled';
export type DeliveryStatus =
  | 'unassigned'
  | 'offered'
  | 'assigned'
  | 'at_store'
  | 'picked_up'
  | 'en_route'
  | 'arrived'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export type FulfillmentPhase =
  | 'wait'
  | 'accepted'
  | 'assembled'
  | 'course'
  | 'arrived'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export type OpsEvent = {
  id: number;
  eventType: string;
  createdAt: string;
};

export type OrderLive = {
  id: string;
  status: 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';
  managedBy: 'shop' | 'ops';
  pickStatus: PickStatus | null;
  deliveryStatus: DeliveryStatus | null;
  pickerFirstName: string;
  pickerLastName: string;
  courierFirstName: string;
  courierLastName: string;
  courierPhone: string;
  courierId: string;
  courierHasPhoto: boolean;
  courierLng: number | null;
  courierLat: number | null;
  courierLocatedAt: string | null;
  courierVehicle?: string | null;
  packedAt: string | null;
  pickedUpAt: string | null;
  enRouteAt: string | null;
  commsThreadId: string | null;
  sameHandler: boolean;
  failedReason?: string | null;
  failedReasonCode?: string | null;
  incidentAction?: string | null;
  phase?: FulfillmentPhase;
  events?: OpsEvent[];
};

export type FulfillmentSnapshot = {
  status: OrderLive['status'];
  createdAt: string;
  managedBy?: 'shop' | 'ops';
  pickStatus?: PickStatus;
  deliveryStatus?: DeliveryStatus;
  courierName: string;
  courierPhone: string;
  courierId?: string;
  courierHasPhoto?: boolean;
  courierCoordinate?: LngLat;
  courierLocatedAt?: string;
  courierVehicle?: string;
  packedAt?: string;
  pickedUpAt?: string;
  enRouteAt?: string;
  commsThreadId?: string;
  sameHandler?: boolean;
  pickerName?: string;
  opsEvents?: OpsEvent[];
  failedReason?: string;
  failedReasonCode?: string;
  incidentAction?: string;
  addressCoordinate: LngLat;
  storeCoordinate?: LngLat;
  routeDurationSeconds: number;
  routeDistanceMeters?: number;
  routeCoordinates?: LngLat[];
};

export const OPS_EVENT_COPY: Record<string, string> = {
  'pick.claimed': 'Votre commande a été acceptée. Rassemblement en magasin.',
  'pick.started': 'Rassemblement en cours au magasin.',
  'pick.packed': 'Votre colis est rassemblé et prêt.',
  'delivery.claimed': 'Un coursier a pris votre course.',
  'delivery.at_store': 'Le coursier est arrivé au magasin.',
  'delivery.picked_up': 'Le colis a été récupéré. Course commencée.',
  'delivery.en_route': 'Le coursier est en route vers vous.',
  'delivery.arrived': 'Le coursier est arrivé à votre adresse.',
  'delivery.delivered': 'Votre commande a été livrée.',
  'delivery.failed': 'La livraison n’a pas pu aboutir.',
};

export function isActiveFulfillment(status: FulfillmentSnapshot['status']) {
  return status === 'confirmed' || status === 'preparing' || status === 'shipping';
}

export function isCourierAssigned(order: Pick<FulfillmentSnapshot, 'courierName'>) {
  return Boolean(order.courierName?.trim());
}

export function isCourseStarted(order: Pick<FulfillmentSnapshot, 'deliveryStatus'>) {
  const d = order.deliveryStatus;
  return d === 'picked_up' || d === 'en_route' || d === 'arrived' || d === 'delivered';
}

export function fulfillmentPhase(order: FulfillmentSnapshot): FulfillmentPhase {
  const pick = order.pickStatus;
  const del = order.deliveryStatus;
  if (order.status === 'cancelled' || pick === 'cancelled' || del === 'cancelled') return 'cancelled';
  if (del === 'failed') return 'failed';
  if (order.status === 'delivered' || del === 'delivered') return 'delivered';
  if (del === 'arrived') return 'arrived';
  if (del === 'picked_up' || del === 'en_route') return 'course';
  if (pick === 'packed') return 'assembled';
  if (pick === 'assigned' || pick === 'picking' || del === 'assigned' || del === 'at_store') return 'accepted';
  return 'wait';
}

export function opsPhaseLabel(order: FulfillmentSnapshot): string {
  switch (fulfillmentPhase(order)) {
    case 'cancelled':
      return 'Commande annulée';
    case 'failed':
      return 'Livraison en échec';
    case 'delivered':
      return 'Livrée';
    case 'arrived':
      return 'Livreur arrivé';
    case 'course':
      return order.deliveryStatus === 'picked_up' ? 'Course commencée' : 'Livreur en route';
    case 'assembled':
      if (order.deliveryStatus === 'at_store') return 'Colis prêt · coursier au magasin';
      if (order.deliveryStatus === 'assigned') return 'Colis prêt · course acceptée';
      return 'Rassemblée · en attente de la course';
    case 'accepted':
      return order.pickStatus === 'picking' ? 'Rassemblement en magasin' : 'Commande acceptée';
    default:
      return 'En attente de l’app course';
  }
}

export function opsEtaCaption(order: FulfillmentSnapshot): string {
  switch (fulfillmentPhase(order)) {
    case 'course':
    case 'arrived':
      return 'Temps restant (route)';
    case 'assembled':
      return 'Colis prêt';
    case 'failed':
      return 'Incident de livraison';
    case 'accepted':
      return 'Préparation magasin';
    default:
      return 'Suivi commande';
  }
}

export function isCourierGpsFresh(locatedAt?: string | null, now = Date.now(), maxMs = 120_000) {
  if (!locatedAt) return false;
  const t = new Date(locatedAt).getTime();
  return Number.isFinite(t) && now - t >= 0 && now - t <= maxMs;
}

export function opsProgressPercent(order: FulfillmentSnapshot): number {
  if (order.status === 'cancelled' || order.deliveryStatus === 'cancelled') return 6;
  if (order.status === 'delivered' || order.deliveryStatus === 'delivered') return 100;
  const del = order.deliveryStatus;
  const pick = order.pickStatus;
  if (del === 'failed') return 100;
  if (del === 'arrived') return 94;
  if (del === 'en_route') return 82;
  if (del === 'picked_up') return 72;
  if (del === 'at_store') return 62;
  if (pick === 'packed') return 52;
  if (pick === 'picking') return 36;
  if (pick === 'assigned' || del === 'assigned') return 24;
  return 10;
}

export function remainingEnRouteSeconds(order: FulfillmentSnapshot, now = Date.now()): number | null {
  const dest = order.addressCoordinate;
  const kind = asVehicleKind(order.courierVehicle);
  const trip = travelSeconds(order.routeDistanceMeters || 0, kind, order.routeDurationSeconds);
  const started = order.enRouteAt || order.pickedUpAt;
  const progress = tripProgress(started, trip, now);
  if (progress != null) return Math.max(0, Math.round(trip * (1 - progress)));
  if (isCourierGpsFresh(order.courierLocatedAt, now) && order.courierCoordinate && dest) {
    const meters = haversineMeters(order.courierCoordinate, dest);
    return travelSeconds(meters, kind, order.routeDurationSeconds);
  }
  return trip > 0 ? trip : null;
}

function pointAlongRoute(coords: LngLat[], progress: number): LngLat {
  if (!coords.length) return coords[0];
  const t = Math.min(1, Math.max(0, progress));
  const idx = t * (coords.length - 1);
  const i = Math.floor(idx);
  const next = Math.min(coords.length - 1, i + 1);
  const f = idx - i;
  const a = coords[i];
  const b = coords[next];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export function courierMapCoordinate(
  order: FulfillmentSnapshot,
  poly: LngLat[],
  store: LngLat,
  now = Date.now(),
): LngLat {
  const dest = order.addressCoordinate ?? poly[poly.length - 1] ?? store;
  const del = order.deliveryStatus;
  if (del === 'arrived' || order.status === 'delivered' || del === 'delivered') {
    return offsetBeside(poly[poly.length - 1] ?? dest, store);
  }
  const kind = asVehicleKind(order.courierVehicle);
  const trip = travelSeconds(order.routeDistanceMeters || haversineMeters(store, dest), kind, order.routeDurationSeconds);
  const progress = tripProgress(order.enRouteAt || order.pickedUpAt, trip, now);
  if (progress != null && poly.length >= 2 && (del === 'picked_up' || del === 'en_route')) {
    return pointAlongRoute(poly, progress);
  }
  if (isCourierGpsFresh(order.courierLocatedAt, now) && order.courierCoordinate) {
    return order.courierCoordinate;
  }
  return offsetBeside(store, dest);
}

export function applyOrderLive<T extends FulfillmentSnapshot>(order: T, live: OrderLive): T {
  const name = [live.courierFirstName, live.courierLastName].filter(Boolean).join(' ').trim();
  const picker = [live.pickerFirstName, live.pickerLastName].filter(Boolean).join(' ').trim();
  const lng = live.courierLng;
  const lat = live.courierLat;
  const coord: LngLat | undefined =
    lng != null && lat != null && Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : order.courierCoordinate;
  return {
    ...order,
    status: live.status || order.status,
    managedBy: live.managedBy,
    pickStatus: live.pickStatus ?? order.pickStatus,
    deliveryStatus: live.deliveryStatus ?? order.deliveryStatus,
    courierName: name,
    courierPhone: live.courierPhone || '',
    courierId: live.courierId || order.courierId,
    courierHasPhoto: live.courierHasPhoto || order.courierHasPhoto,
    courierCoordinate: coord,
    courierLocatedAt: live.courierLocatedAt ?? order.courierLocatedAt,
    courierVehicle: live.courierVehicle ?? order.courierVehicle,
    packedAt: live.packedAt ?? order.packedAt,
    pickedUpAt: live.pickedUpAt ?? order.pickedUpAt,
    enRouteAt: live.enRouteAt ?? order.enRouteAt,
    commsThreadId: live.commsThreadId ?? order.commsThreadId,
    sameHandler: live.sameHandler,
    pickerName: picker || order.pickerName,
    opsEvents: live.events?.length ? live.events : order.opsEvents,
    failedReason: live.failedReason ?? order.failedReason,
    failedReasonCode: live.failedReasonCode ?? order.failedReasonCode,
    incidentAction: live.incidentAction ?? order.incidentAction,
  };
}
