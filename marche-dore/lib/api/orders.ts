import { apiFetch } from '@/lib/api/http';
import type { Order, OrderStatus } from '@/context/OrdersContext';
import type { DeliveryStatus, OrderLive, PickStatus } from '@/lib/orderOps';

export async function apiGetOrders(): Promise<Order[] | null> {
  try {
    const res = await apiFetch<{ ok: true; orders: Order[] }>('/me/orders');
    return Array.isArray(res.orders) ? res.orders : [];
  } catch {
    return null;
  }
}

export async function apiPlaceOrder(order: Order) {
  const res = await apiFetch<{ ok: true; order?: Order }>('/me/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  });
  return res.order ?? order;
}

export async function apiRateCourier(orderId: string, rating: number, comment: string, tipAmount = 0) {
  await apiFetch(`/me/orders/${encodeURIComponent(orderId)}/rate-courier`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment, tipAmount }),
  });
}

export async function apiPostIncidentAction(orderId: string, action: string, note = '') {
  await apiFetch(`/me/orders/${encodeURIComponent(orderId)}/incident-action`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  });
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return '';
}

const SHOP_STATUSES: OrderStatus[] = ['confirmed', 'preparing', 'shipping', 'delivered', 'cancelled'];
const PICK_STATUSES: PickStatus[] = ['queued', 'assigned', 'picking', 'packed', 'cancelled'];
const DEL_STATUSES: DeliveryStatus[] = [
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
];

function asShop(v: unknown): OrderStatus {
  const s = String(v ?? '');
  return (SHOP_STATUSES as string[]).includes(s) ? (s as OrderStatus) : 'confirmed';
}

function asPick(v: unknown): PickStatus | null {
  const s = String(v ?? '');
  return (PICK_STATUSES as string[]).includes(s) ? (s as PickStatus) : null;
}

function asDel(v: unknown): DeliveryStatus | null {
  const s = String(v ?? '');
  return (DEL_STATUSES as string[]).includes(s) ? (s as DeliveryStatus) : null;
}

export async function apiGetOrderLive(id: string): Promise<OrderLive | null> {
  try {
    const res = await apiFetch<{ ok: true; live: Record<string, unknown> }>(
      `/me/orders/${encodeURIComponent(id)}/live`,
    );
    const row = res.live;
    if (!row || typeof row !== 'object') return null;
    const pickerFirst = str(row.pickerFirstName ?? row.picker_first_name);
    const pickerLast = str(row.pickerLastName ?? row.picker_last_name);
    return {
      id: String(row.id ?? id),
      status: asShop(row.status),
      managedBy: row.managedBy === 'ops' || row.managed_by === 'ops' ? 'ops' : 'shop',
      pickStatus: asPick(row.pickStatus ?? row.pick_status),
      deliveryStatus: asDel(row.deliveryStatus ?? row.delivery_status),
      pickerFirstName: pickerFirst,
      pickerLastName: pickerLast,
      courierFirstName: str(row.courierFirstName ?? row.courier_first_name),
      courierLastName: str(row.courierLastName ?? row.courier_last_name),
      courierPhone: str(row.courierPhone ?? row.courier_phone),
      courierId: str(row.courierId ?? row.courier_id),
      courierHasPhoto:
        row.courierHasPhoto === true || row.courier_has_photo === true || row.courier_has_photo === 't',
      courierLng: num(row.courierLng ?? row.courier_lng),
      courierLat: num(row.courierLat ?? row.courier_lat),
      courierLocatedAt: str(row.courierLocatedAt ?? row.courier_located_at) || null,
      courierVehicle: str(row.courierVehicle ?? row.courier_vehicle) || null,
      packedAt: str(row.packedAt ?? row.packed_at) || null,
      pickedUpAt: str(row.pickedUpAt ?? row.picked_up_at) || null,
      enRouteAt: str(row.enRouteAt ?? row.en_route_at) || null,
      commsThreadId: str(row.commsThreadId ?? row.comms_thread_id) || null,
      sameHandler: row.sameHandler === true || row.same_handler === true || row.same_handler === 't',
      failedReason: str(row.failedReason ?? row.failed_reason) || null,
      failedReasonCode: str(row.failedReasonCode ?? row.failed_reason_code) || null,
      incidentAction: str(row.incidentAction ?? row.incident_action) || null,
      events: Array.isArray(row.events)
        ? row.events
            .map((raw) => {
              if (!raw || typeof raw !== 'object') return null;
              const e = raw as { id?: unknown; eventType?: unknown; event_type?: unknown; createdAt?: unknown; created_at?: unknown };
              const id = Number(e.id);
              const eventType = str(e.eventType ?? e.event_type);
              if (!Number.isFinite(id) || !eventType) return null;
              return { id, eventType, createdAt: str(e.createdAt ?? e.created_at) };
            })
            .filter((e): e is { id: number; eventType: string; createdAt: string } => Boolean(e))
        : [],
    };
  } catch {
    return null;
  }
}
