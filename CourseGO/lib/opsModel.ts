/**
 * Contrat ops partagé Marché Doré (boutique) ↔ CourseGO (course).
 * Source SQL : SuperU/server/src/schema-ops.sql
 * Source live boutique : SuperU/server/src/live.ts + marche-dore/lib/orderOps.ts
 *
 * Une commande = 1 pick_job (`pick-{orderId}`) + 1 delivery (`del-{orderId}`).
 * La boutique lit `v_order_tracking` + `ops.events`. CourseGO écrit via `/ops/*`.
 */

export type ShopStatus = 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';
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

/** File magasin : encore à ramasser (vue `ops.v_pick_board`). */
export function isPickBoardStatus(status: string | null | undefined) {
  return status === 'queued' || status === 'assigned' || status === 'picking';
}

/** Ramassage en cours pour ce staff (Accueil « maintenant »). */
export function isActivePickStatus(status: string | null | undefined) {
  return status === 'assigned' || status === 'picking';
}

export function normalizeDeliveryStatus(status: string | null | undefined): DeliveryStatus {
  if (!status || status === 'offered') return 'unassigned';
  return status as DeliveryStatus;
}

/** Colis prêt, course pas encore prise — phase boutique `assembled`. */
export function isDeliveryClaimable(d: {
  pick_status?: string | null;
  delivery_status?: string | null;
  courier_id?: string | null;
}) {
  const del = normalizeDeliveryStatus(d.delivery_status);
  return d.pick_status === 'packed' && !d.courier_id && (del === 'unassigned' || del === 'offered');
}

/** Course prise, pas encore close. */
export function isDeliveryActive(d: { delivery_status?: string | null; courier_id?: string | null }) {
  if (!d.courier_id) return false;
  const del = normalizeDeliveryStatus(d.delivery_status);
  return del === 'assigned' || del === 'at_store' || del === 'picked_up' || del === 'en_route' || del === 'arrived';
}

export const PICK_STEPS = [
  { status: 'queued', label: 'File' },
  { status: 'assigned', label: 'Prise' },
  { status: 'picking', label: 'Scan' },
  { status: 'packed', label: 'Prêt' },
] as const;

export const DELIVERY_STEPS = [
  { status: 'unassigned', label: 'File' },
  { status: 'assigned', label: 'Prise' },
  { status: 'at_store', label: 'Magasin' },
  { status: 'picked_up', label: 'Colis' },
  { status: 'en_route', label: 'Route' },
  { status: 'arrived', label: 'Adresse' },
  { status: 'delivered', label: 'Livré' },
] as const;

export const NEXT_DELIVERY_LABEL: Record<string, string> = {
  unassigned: 'PRENDRE LA COURSE',
  offered: 'PRENDRE LA COURSE',
  assigned: 'ARRIVÉ MAGASIN',
  at_store: 'COLIS RÉCUPÉRÉ',
  picked_up: 'PARTIR CHEZ LE CLIENT',
  en_route: 'ARRIVÉ CHEZ LE CLIENT',
  arrived: 'MARQUER LIVRÉ',
};

/** Jambe GPS : magasin tant que le colis n’est pas en main, puis client. */
export function deliveryNavLeg(status: string | null | undefined): 'store' | 'client' {
  const del = normalizeDeliveryStatus(status);
  return del === 'picked_up' || del === 'en_route' || del === 'arrived' ? 'client' : 'store';
}

export function nextDeliveryStatus(status: string | null | undefined) {
  const cur = normalizeDeliveryStatus(status);
  const order = DELIVERY_STEPS.map((s) => s.status);
  const i = order.indexOf(cur);
  if (i < 0 || i >= order.length - 1) return undefined;
  return order[i + 1];
}

export function fulfillmentPhase(pick: string | null | undefined, del: string | null | undefined, shop?: string): FulfillmentPhase {
  const d = normalizeDeliveryStatus(del);
  if (shop === 'cancelled' || pick === 'cancelled' || del === 'cancelled') return 'cancelled';
  if (d === 'failed') return 'failed';
  if (shop === 'delivered' || d === 'delivered') return 'delivered';
  if (d === 'arrived') return 'arrived';
  if (d === 'picked_up' || d === 'en_route') return 'course';
  if (pick === 'packed') return 'assembled';
  if (pick === 'assigned' || pick === 'picking' || d === 'assigned' || d === 'at_store') return 'accepted';
  return 'wait';
}

export function pickJobId(orderId: string) {
  return orderId.startsWith('pick-') ? orderId : `pick-${orderId}`;
}

export function deliveryJobId(orderId: string) {
  return orderId.startsWith('del-') ? orderId : `del-${orderId}`;
}

export function orderIdFromOpsId(id: string) {
  return id.replace(/^pick-/, '').replace(/^del-/, '');
}

export function sameOpsId(a: string, b: string) {
  return a === b || orderIdFromOpsId(a) === orderIdFromOpsId(b);
}
