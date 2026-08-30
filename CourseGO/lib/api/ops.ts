import { apiFetch } from '@/lib/api/http';

export type StaffProfile = {
  vehiclePlate: string;
  ownsVehicle: boolean;
  needsKit: boolean;
  idNumber: string;
  hasLicense: boolean;
  licenseNumber: string;
  residenceLine: string;
  residenceCity: string;
  hasInsurance: boolean;
  insuranceRef: string;
  storeIds: string[];
};

export type Staff = {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  canPick: boolean;
  canDeliver: boolean;
  storeId: string | null;
  vehicle: string | null;
  photoUrl?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
  profile?: StaffProfile | null;
};

export type PickJob = {
  id: string;
  order_id: string;
  store_id: string | null;
  store_name?: string | null;
  pick_status: string;
  picker_id: string | null;
  item_count: number;
  total: number;
  slot_label: string | null;
  day_label: string | null;
  address_label: string | null;
  created_at: string;
};

export type DeliveryJob = {
  id: string;
  order_id: string;
  course_id: string | null;
  store_id: string | null;
  delivery_status: string;
  courier_id: string | null;
  cash_to_collect: number;
  pickup_lng: number | null;
  pickup_lat: number | null;
  dropoff_lng: number | null;
  dropoff_lat: number | null;
  route_distance_m: number | null;
  route_duration_s: number | null;
  address_label: string | null;
  address_line: string | null;
  address_city: string | null;
  address_phone: string | null;
  store_name: string | null;
  slot_label: string | null;
  day_label: string | null;
  total: number;
  item_count: number;
  pick_status: string | null;
  picker_id: string | null;
  packed_at: string | null;
  picked_up_at?: string | null;
  en_route_at?: string | null;
  comms_thread_id?: string | null;
  same_handler: boolean;
  comment?: string | null;
  customer_first?: string | null;
  customer_last?: string | null;
};

export type OrderLine = {
  product_id: string;
  name: string;
  unit: string | null;
  qty: number;
  unit_price: number;
  picked_qty: number | null;
  unavailable: boolean | null;
  note: string | null;
  barcode?: string | null;
  image_url?: string | null;
};

export async function opsRegister(body: Record<string, unknown>) {
  return apiFetch<{ ok: true; token: string; staff: Staff }>('/ops/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function opsLogin(identifier: string, password: string) {
  return apiFetch<{ ok: true; token: string; staff: Staff }>('/ops/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, email: identifier, password }),
  });
}

export async function opsMe() {
  return apiFetch<{ ok: true; staff: Staff }>('/ops/me');
}

export async function patchStaffPhoto(photo: string) {
  return apiFetch<{ ok: true; staff: Staff }>('/ops/me', {
    method: 'PATCH',
    body: JSON.stringify({ photo }),
  });
}

export async function patchStaffStores(storeIds: string[]) {
  return apiFetch<{ ok: true; staff: Staff }>('/ops/me', {
    method: 'PATCH',
    body: JSON.stringify({ storeIds }),
  });
}

export type MapStore = {
  id: string;
  name: string;
  format?: string | null;
  city?: string | null;
  cityLabel?: string | null;
  address?: string | null;
  coordinate: [number, number] | null;
  affiliated: boolean;
  parcels: number;
};

export async function fetchMapStores() {
  return apiFetch<{ ok: true; stores: MapStore[] }>('/ops/map-stores');
}

export async function fetchCatalogStores() {
  return apiFetch<{ ok: true; stores: Array<Record<string, unknown> & { id: string; name?: string; coordinate?: [number, number] }> }>(
    '/stores',
  );
}

export async function fetchPickJobs() {
  return apiFetch<{ ok: true; jobs: PickJob[] }>('/ops/pick-jobs');
}

export type TourHop = {
  lng: number;
  lat: number;
  storeId: string | null;
  label: string;
};

export async function fetchDeliveries() {
  return apiFetch<{ ok: true; deliveries: DeliveryJob[]; tourHop?: TourHop | null }>('/ops/deliveries');
}

export async function claimPick(id: string) {
  return apiFetch<{ ok: true; orderId: string }>(`/ops/pick-jobs/${encodeURIComponent(id)}/claim`, {
    method: 'POST',
  });
}

export async function startPick(id: string) {
  return apiFetch<{ ok: true }>(`/ops/pick-jobs/${encodeURIComponent(id)}/start`, { method: 'POST' });
}

export async function patchPickLines(
  id: string,
  lines: { productId: string; pickedQty?: number; unavailable?: boolean; note?: string }[],
) {
  return apiFetch<{ ok: true }>(`/ops/pick-jobs/${encodeURIComponent(id)}/lines`, {
    method: 'PATCH',
    body: JSON.stringify({ lines }),
  });
}

export async function packPick(id: string) {
  return apiFetch<{ ok: true; orderId?: string; payout?: number; addedToTour?: boolean }>(
    `/ops/pick-jobs/${encodeURIComponent(id)}/pack`,
    { method: 'POST' },
  );
}

export async function claimDelivery(id: string) {
  return apiFetch<{ ok: true; orderId: string; courseId: string }>(
    `/ops/deliveries/${encodeURIComponent(id)}/claim`,
    { method: 'POST' },
  );
}

export async function releaseDelivery(id: string) {
  return apiFetch<{ ok: true; orderId: string }>(`/ops/deliveries/${encodeURIComponent(id)}/release`, {
    method: 'POST',
  });
}

export async function startDeliveryRun() {
  return apiFetch<{ ok: true; deliveryId: string; count: number }>('/ops/deliveries/start-run', {
    method: 'POST',
  });
}

export async function releasePick(id: string) {
  return apiFetch<{ ok: true; orderId: string }>(`/ops/pick-jobs/${encodeURIComponent(id)}/release`, {
    method: 'POST',
  });
}

export async function setDeliveryStatus(
  id: string,
  status: string,
  extra?: {
    reason?: string;
    reasonCode?: string;
    proofUrl?: string;
    customerRating?: number;
    customerComment?: string;
    handoffCode?: string;
  },
) {
  return apiFetch<{ ok: true; payout?: number; nextDeliveryId?: string | null }>(`/ops/deliveries/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, ...extra }),
  });
}

export async function rateCustomer(
  id: string,
  extra: { rating: number; comment?: string },
) {
  return apiFetch<{ ok: true }>(`/ops/deliveries/${encodeURIComponent(id)}/rate-customer`, {
    method: 'POST',
    body: JSON.stringify(extra),
  });
}

export type OpsHistoryItem = {
  id: string;
  kind: 'pick' | 'deliver';
  order_id: string;
  status: string;
  at: string;
  payout: number;
  total: number;
  address_label: string | null;
  failed_reason?: string | null;
  failed_reason_code?: string | null;
  client_action?: string | null;
};

export async function fetchHistory() {
  return apiFetch<{ ok: true; items: OpsHistoryItem[] }>('/ops/history');
}

export type OpsIncidentItem = {
  id: string;
  order_id: string;
  reason_code: string;
  reason_text: string;
  created_at: string;
  address_label: string | null;
  client_action: string | null;
  client_note: string | null;
  client_action_at: string | null;
};

export async function fetchIncidents() {
  return apiFetch<{ ok: true; items: OpsIncidentItem[] }>('/ops/incidents');
}

export async function fetchEarnings() {
  return apiFetch<{
    ok: true;
    today: number;
    week: number;
    allTime: number;
    deliveriesToday: number;
    picksToday: number;
    cashToday: number;
    pickToday: number;
    deliverToday: number;
    pickWeek: number;
    deliverWeek: number;
    deliveriesWeek: number;
    picksWeek: number;
    avgDeliveryPayout: number;
    jobsAll: number;
    failedAll: number;
    successRate: number | null;
    avgMinutes: number;
    ratingAvg: number;
    ratingCount: number;
    tipToday: number;
    tipAll: number;
    weekDays: { date: string; amount: number }[];
  }>('/ops/earnings');
}

export type StaffNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  order_id: string | null;
  created_at: string;
  read_at: string | null;
  live_hint?: string | null;
};

export async function fetchNotifications() {
  return apiFetch<{ ok: true; items: StaffNotification[] }>('/ops/notifications');
}

export async function markNotificationRead(id: string) {
  return apiFetch<{ ok: true }>(`/ops/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead() {
  return apiFetch<{ ok: true }>('/ops/notifications/read-all', { method: 'POST' });
}

export async function postLocation(lng: number, lat: number, heading?: number, speedMps?: number) {
  return apiFetch<{ ok: true }>('/ops/location', {
    method: 'POST',
    body: JSON.stringify({ lng, lat, heading, speedMps }),
  });
}

export async function fetchOrder(id: string) {
  return apiFetch<{
    ok: true;
    order: Record<string, unknown>;
    lines: OrderLine[];
    events: unknown[];
  }>(`/ops/orders/${encodeURIComponent(id)}`);
}
