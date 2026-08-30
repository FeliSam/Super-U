/** Contrat live partagé boutique ↔ app course (colonnes v_order_tracking).
 *  Miroir CourseGO : lib/opsModel.ts
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

export type OrderLiveDto = {
  id: string;
  status: ShopStatus;
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
  courierVehicle: string | null;
  packedAt: string | null;
  pickedUpAt: string | null;
  enRouteAt: string | null;
  commsThreadId: string | null;
  sameHandler: boolean;
  failedReason: string | null;
  failedReasonCode: string | null;
  incidentAction: string | null;
  phase: FulfillmentPhase;
  events: { id: number; eventType: string; createdAt: string }[];
};

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return v == null ? '' : String(v);
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asShop(v: unknown): ShopStatus {
  const s = String(v ?? '');
  return (['confirmed', 'preparing', 'shipping', 'delivered', 'cancelled'] as const).includes(s as ShopStatus)
    ? (s as ShopStatus)
    : 'confirmed';
}

function asPick(v: unknown): PickStatus | null {
  const s = String(v ?? '');
  return (['queued', 'assigned', 'picking', 'packed', 'cancelled'] as const).includes(s as PickStatus)
    ? (s as PickStatus)
    : null;
}

function asDel(v: unknown): DeliveryStatus | null {
  const s = String(v ?? '');
  return (
    [
      'unassigned',
      'offered',
      'assigned',
      'at_store',
      'picked_up',
      'en_route',
      'arrived',
      'delivered',
      'failed',
      'cancelled',
    ] as const
  ).includes(s as DeliveryStatus)
    ? (s as DeliveryStatus)
    : null;
}

export function fulfillmentPhaseFromJobs(
  shop: ShopStatus,
  pick: PickStatus | null,
  del: DeliveryStatus | null,
): FulfillmentPhase {
  if (shop === 'cancelled' || pick === 'cancelled' || del === 'cancelled') return 'cancelled';
  if (del === 'failed') return 'failed';
  if (shop === 'delivered' || del === 'delivered') return 'delivered';
  if (del === 'arrived') return 'arrived';
  if (del === 'picked_up' || del === 'en_route') return 'course';
  if (pick === 'packed') return 'assembled';
  if (pick === 'assigned' || pick === 'picking' || del === 'assigned' || del === 'at_store') return 'accepted';
  return 'wait';
}

export function trackingRowToLive(row: Record<string, unknown>, fallbackId = ''): OrderLiveDto {
  const pick = asPick(row.pick_status ?? row.pickStatus);
  const del = asDel(row.delivery_status ?? row.deliveryStatus);
  const status = asShop(row.status);
  return {
    id: str(row.id) || fallbackId,
    status,
    managedBy: row.managed_by === 'ops' || row.managedBy === 'ops' ? 'ops' : 'shop',
    pickStatus: pick,
    deliveryStatus: del,
    pickerFirstName: str(row.picker_first_name ?? row.pickerFirstName),
    pickerLastName: str(row.picker_last_name ?? row.pickerLastName),
    courierFirstName: str(row.courier_first_name ?? row.courierFirstName),
    courierLastName: str(row.courier_last_name ?? row.courierLastName),
    courierPhone: str(row.courier_phone ?? row.courierPhone),
    courierId: str(row.courier_id ?? row.courierId),
    courierHasPhoto:
      row.courier_has_photo === true ||
      row.courierHasPhoto === true ||
      row.courier_has_photo === 't',
    courierLng: num(row.courier_lng ?? row.courierLng),
    courierLat: num(row.courier_lat ?? row.courierLat),
    courierLocatedAt: str(row.courier_located_at ?? row.courierLocatedAt) || null,
    courierVehicle: str(row.courier_vehicle ?? row.courierVehicle) || null,
    packedAt: str(row.packed_at ?? row.packedAt) || null,
    pickedUpAt: str(row.picked_up_at ?? row.pickedUpAt) || null,
    enRouteAt: str(row.en_route_at ?? row.enRouteAt) || null,
    commsThreadId: str(row.comms_thread_id ?? row.commsThreadId) || null,
    sameHandler: row.same_handler === true || row.same_handler === 't' || row.sameHandler === true,
    failedReason: str(row.failed_reason ?? row.failedReason) || null,
    failedReasonCode: str(row.failed_reason_code ?? row.failedReasonCode) || null,
    incidentAction: str(row.incident_action ?? row.incidentAction) || null,
    phase: fulfillmentPhaseFromJobs(status, pick, del),
    events: [],
  };
}
