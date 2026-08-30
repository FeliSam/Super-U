import { getProduct } from '@/data/catalog';
import { cotonouMap, type LngLat } from '@/constants/map';
import type { CartLine } from '@/context/CartContext';
import type { PaymentId } from '@/context/CheckoutPaymentContext';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { findNearestSuperU, fetchDrivingRoute, getSuperUById, type RouteProfile } from '@/lib/deliveryRouting';
import { apiGetOrderLive, apiGetOrders, apiPatchOrderStatus, apiPlaceOrder } from '@/lib/api/orders';
import { applyOrderLive, isActiveFulfillment, type DeliveryStatus, type PickStatus } from '@/lib/orderOps';
import { getAuthToken } from '@/lib/api/http';
import { loadAccountJson, saveAccountJson } from '@/lib/accountSync';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.orders.v2';

export type OrderStatus = 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';

/** Timeline de démo par défaut (si durée trajet inconnue). */
function statusRank(status: OrderStatus) {
  switch (status) {
    case 'delivered':
      return 3;
    case 'shipping':
      return 2;
    case 'preparing':
      return 1;
    case 'confirmed':
      return 0;
    case 'cancelled':
      return -1;
    default:
      return 0;
  }
}

/** Annulation possible uniquement avant le début de la préparation. */
export function canCancelOrder(status: OrderStatus) {
  return status === 'confirmed';
}

export type OrderLine = {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
};

export type Order = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  lines: OrderLine[];
  itemCount: number;
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  promoCode: string | null;
  dayId: string;
  dayLabel: string;
  slotId: string;
  slotLabel: string;
  paymentId: PaymentId;
  paymentLabel: string;
  paymentDetail: string | null;
  paymentStatus?: 'paid' | 'cod_pending';
  paymentRef?: string | null;
  addressLabel: string;
  addressLine: string;
  addressCity: string;
  addressPhone: string;
  /** [lng, lat] destination client */
  addressCoordinate: LngLat;
  /** Magasin de départ (Super U le plus proche) */
  storeId: string;
  storeName: string;
  storeCoordinate: LngLat;
  /** Itinéraire routier (OSRM) magasin → client */
  routeCoordinates: LngLat[];
  routeDistanceMeters: number;
  routeDurationSeconds: number;
  routeProfile: RouteProfile;
  comment: string;
  courierName: string;
  courierPhone: string;
  courierId?: string;
  courierHasPhoto?: boolean;
  /** Code 4 chiffres à donner au livreur à la remise. */
  handoffCode?: string;
  /** 'ops' = 2e app (picking / livreur) pilote le statut. */
  managedBy?: 'shop' | 'ops';
  pickStatus?: PickStatus;
  deliveryStatus?: DeliveryStatus;
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
};

export type PlaceOrderInput = {
  lines: CartLine[];
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  promoCode: string | null;
  dayId: string;
  dayLabel: string;
  slotId: string;
  slotLabel: string;
  paymentId: PaymentId;
  paymentLabel: string;
  paymentDetail: string | null;
  paymentStatus?: 'paid' | 'cod_pending';
  paymentRef?: string | null;
  comment?: string;
  addressLabel?: string;
  addressLine?: string;
  addressCity?: string;
  addressPhone?: string;
  addressCoordinate?: LngLat;
  /** Magasin choisi par l’utilisateur (sinon le plus proche). */
  storeId?: string;
};

type OrdersContextValue = {
  orders: Order[];
  ready: boolean;
  activeOrder: Order | null;
  activeOrders: Order[];
  placeOrder: (input: PlaceOrderInput) => Promise<Order | null>;
  getOrder: (id: string) => Order | undefined;
  setStatus: (id: string, status: OrderStatus) => void;
  setTrackingFocus: (id: string | null) => void;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

function mergeRemoteOrders(current: Order[], remote: Order[]): Order[] {
  const currentById = new Map<string, Order>();
  for (const order of current) currentById.set(normalizeId(order.id), order);
  const merged: Order[] = [];
  for (const order of remote) {
    const id = normalizeId(order.id);
    const prev = currentById.get(id);
    if (!prev) {
      merged.push(order);
      continue;
    }
    const statusRank: Record<OrderStatus, number> = {
      confirmed: 0,
      preparing: 1,
      shipping: 2,
      delivered: 3,
      cancelled: 10,
    };
    const status =
      order.status === 'cancelled' || prev.status === 'cancelled'
        ? 'cancelled'
        : (statusRank[order.status] ?? 0) >= (statusRank[prev.status] ?? 0)
          ? order.status
          : prev.status;
    merged.push({
      ...prev,
      ...order,
      status,
      lines: order.lines?.length ? order.lines : prev.lines,
      pickStatus: order.pickStatus ?? prev.pickStatus,
      deliveryStatus: order.deliveryStatus ?? prev.deliveryStatus,
      courierCoordinate: order.courierCoordinate ?? prev.courierCoordinate,
      courierLocatedAt: order.courierLocatedAt ?? prev.courierLocatedAt,
      packedAt: order.packedAt ?? prev.packedAt,
      pickedUpAt: order.pickedUpAt ?? prev.pickedUpAt,
      enRouteAt: order.enRouteAt ?? prev.enRouteAt,
      commsThreadId: order.commsThreadId ?? prev.commsThreadId,
      courierName: order.courierName,
      courierPhone: order.courierPhone,
      pickerName: order.pickerName || prev.pickerName,
      managedBy: order.managedBy === 'ops' || prev.managedBy === 'ops' ? 'ops' : order.managedBy ?? prev.managedBy,
    });
  }
  return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function normalizeId(id: string) {
  return id.replace(/^#/, '').trim();
}

function makeOrderId(existing: Order[]) {
  const year = new Date().getFullYear();
  const used = new Set(existing.map((o) => normalizeId(o.id)));
  for (let i = 0; i < 40; i++) {
    const n = 800 + Math.floor(Math.random() * 199);
    const id = `MD-${year}-${String(n).padStart(4, '0')}`;
    if (!used.has(id)) return id;
  }
  return `MD-${year}-${Date.now().toString().slice(-4)}`;
}

function snapshotLines(lines: CartLine[]): OrderLine[] {
  return lines
    .map((l) => {
      const p = getProduct(l.productId);
      if (!p) return null;
      return {
        productId: p.id,
        name: p.name,
        unit: l.unitOverride ?? p.unit,
        qty: l.qty,
        unitPrice: p.price,
      };
    })
    .filter((l): l is OrderLine => Boolean(l));
}

function paymentLabelFor(id: PaymentId) {
  switch (id) {
    case 'om':
      return 'Orange Money';
    case 'wave':
      return 'MTN MoMo';
    case 'card':
      return 'Carte';
    case 'cod':
      return 'Paiement à la livraison';
    default:
      return 'Paiement';
  }
}

function sanitizeCreatedAt(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim()) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function sanitizeCoordinate(raw: unknown, fallback: LngLat): LngLat {
  if (
    Array.isArray(raw) &&
    raw.length === 2 &&
    typeof raw[0] === 'number' &&
    typeof raw[1] === 'number' &&
    Number.isFinite(raw[0]) &&
    Number.isFinite(raw[1])
  ) {
    return [raw[0], raw[1]];
  }
  return [...fallback];
}

function sanitizeRouteCoords(raw: unknown, fallback: LngLat[]): LngLat[] {
  if (!Array.isArray(raw) || raw.length < 2) return fallback.map((c) => [...c] as LngLat);
  const coords = raw
    .map((c) => sanitizeCoordinate(c, fallback[0] ?? cotonouMap.home))
    .filter((c, i, arr) => i === 0 || c[0] !== arr[i - 1][0] || c[1] !== arr[i - 1][1]);
  return coords.length >= 2 ? coords : fallback.map((c) => [...c] as LngLat);
}

function sanitizeOrder(raw: unknown): Order | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<Order>;
  if (typeof o.id !== 'string') return null;
  if (!Array.isArray(o.lines) || o.lines.length === 0) return null;
  const lines = o.lines.filter(
    (l): l is OrderLine =>
      Boolean(l) &&
      typeof l.productId === 'string' &&
      typeof l.name === 'string' &&
      typeof l.qty === 'number' &&
      l.qty > 0,
  );
  if (!lines.length) return null;
  const paymentId = (o.paymentId as PaymentId) || 'cod';
  const paymentLabel =
    (typeof o.paymentLabel === 'string' && o.paymentLabel.trim()) || paymentLabelFor(paymentId);
  const addressCoordinate = sanitizeCoordinate(o.addressCoordinate, cotonouMap.home);
  const nearest = findNearestSuperU(addressCoordinate);
  const storeCoordinate = sanitizeCoordinate(o.storeCoordinate, nearest.store.coordinate);
  const fallbackRoute: LngLat[] = [storeCoordinate, addressCoordinate];
  return {
    id: normalizeId(o.id),
    createdAt: sanitizeCreatedAt(o.createdAt),
    status: (o.status as OrderStatus) || 'confirmed',
    lines,
    itemCount: typeof o.itemCount === 'number' ? o.itemCount : lines.reduce((s, l) => s + l.qty, 0),
    subtotal: Number(o.subtotal) || 0,
    delivery: Number(o.delivery) || 0,
    discount: Number(o.discount) || 0,
    total: Number(o.total) || 0,
    promoCode: o.promoCode ?? null,
    dayId: o.dayId || 'today',
    dayLabel: (typeof o.dayLabel === 'string' && o.dayLabel.trim()) || "Aujourd'hui",
    slotId: o.slotId || '',
    slotLabel: (typeof o.slotLabel === 'string' && o.slotLabel.trim()) || '1h – 2h',
    paymentId,
    paymentLabel,
    paymentDetail: typeof o.paymentDetail === 'string' ? o.paymentDetail : null,
    paymentStatus: o.paymentStatus === 'paid' || o.paymentStatus === 'cod_pending' ? o.paymentStatus : paymentId === 'cod' ? 'cod_pending' : undefined,
    paymentRef: typeof o.paymentRef === 'string' ? o.paymentRef : null,
    addressLabel: (typeof o.addressLabel === 'string' && o.addressLabel.trim()) || 'Adresse',
    addressLine: typeof o.addressLine === 'string' ? o.addressLine.trim() : '',
    addressCity: typeof o.addressCity === 'string' ? o.addressCity.trim() : '',
    addressPhone: typeof o.addressPhone === 'string' ? o.addressPhone.trim() : '',
    addressCoordinate,
    storeId: (typeof o.storeId === 'string' && o.storeId.trim()) || nearest.store.id,
    storeName: (typeof o.storeName === 'string' && o.storeName.trim()) || nearest.store.name,
    storeCoordinate,
    routeCoordinates: sanitizeRouteCoords(o.routeCoordinates, fallbackRoute),
    routeDistanceMeters: Number(o.routeDistanceMeters) || nearest.straightMeters,
    routeDurationSeconds: (() => {
      const dist = Number(o.routeDistanceMeters) || nearest.straightMeters;
      const raw = Number(o.routeDurationSeconds);
      // Anciennes commandes / démo trop courte → re-estimer ~8,5 m/s (~30 km/h)
      if (!Number.isFinite(raw) || raw < 60 || (dist > 1500 && raw < 120)) {
        return Math.max(300, dist / 8.5);
      }
      return raw;
    })(),
    routeProfile: o.routeProfile === 'motorcycle' ? 'motorcycle' : 'driving',
    comment: typeof o.comment === 'string' ? o.comment : '',
    handoffCode: typeof o.handoffCode === 'string' ? o.handoffCode.replace(/\D/g, '').slice(0, 4) : undefined,
    courierName: typeof o.courierName === 'string' ? o.courierName.trim() : '',
    courierPhone: typeof o.courierPhone === 'string' ? o.courierPhone.trim() : '',
    courierId: typeof o.courierId === 'string' ? o.courierId.trim() : undefined,
    courierHasPhoto: o.courierHasPhoto === true,
    managedBy: o.managedBy === 'ops' ? 'ops' : 'shop',
    pickStatus:
      o.pickStatus === 'queued' ||
      o.pickStatus === 'assigned' ||
      o.pickStatus === 'picking' ||
      o.pickStatus === 'packed' ||
      o.pickStatus === 'cancelled'
        ? o.pickStatus
        : undefined,
    deliveryStatus:
      o.deliveryStatus === 'unassigned' ||
      o.deliveryStatus === 'offered' ||
      o.deliveryStatus === 'assigned' ||
      o.deliveryStatus === 'at_store' ||
      o.deliveryStatus === 'picked_up' ||
      o.deliveryStatus === 'en_route' ||
      o.deliveryStatus === 'arrived' ||
      o.deliveryStatus === 'delivered' ||
      o.deliveryStatus === 'failed' ||
      o.deliveryStatus === 'cancelled'
        ? o.deliveryStatus
        : undefined,
    courierCoordinate: (() => {
      const raw = o.courierCoordinate;
      if (!Array.isArray(raw) || raw.length < 2) return undefined;
      const lng = Number(raw[0]);
      const lat = Number(raw[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
      return [lng, lat] as LngLat;
    })(),
    courierLocatedAt: typeof o.courierLocatedAt === 'string' ? o.courierLocatedAt : undefined,
    courierVehicle: typeof o.courierVehicle === 'string' ? o.courierVehicle : undefined,
    packedAt: typeof o.packedAt === 'string' ? o.packedAt : undefined,
    pickedUpAt: typeof o.pickedUpAt === 'string' ? o.pickedUpAt : undefined,
    enRouteAt: typeof o.enRouteAt === 'string' ? o.enRouteAt : undefined,
    commsThreadId: typeof o.commsThreadId === 'string' ? o.commsThreadId : undefined,
    sameHandler: o.sameHandler === true,
    pickerName: typeof o.pickerName === 'string' ? o.pickerName.trim() : undefined,
    failedReason: typeof o.failedReason === 'string' ? o.failedReason : undefined,
    failedReasonCode: typeof o.failedReasonCode === 'string' ? o.failedReasonCode : undefined,
    incidentAction: typeof o.incidentAction === 'string' ? o.incidentAction : undefined,
  };
}

export function statusLabel(status: OrderStatus) {
  switch (status) {
    case 'confirmed':
      return 'Confirmée';
    case 'preparing':
      return 'En préparation';
    case 'shipping':
      return 'En route';
    case 'delivered':
      return 'Livrée';
    case 'cancelled':
      return 'Annulée';
  }
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const { session, ready: authReady } = useAuth();
  const accountId = session?.accountId ?? null;
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const skipSave = useRef(true);
  const trackingFocusRef = useRef<string | null>(null);
  const setTrackingFocus = useCallback((id: string | null) => {
    trackingFocusRef.current = id;
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    skipSave.current = true;
    hydrated.current = false;
    (async () => {
      if (!accountId) {
        setOrders([]);
        hydrated.current = true;
        setReady(true);
        return;
      }
      const local = await loadAccountJson<unknown>(STORAGE_KEY, accountId);
      const localList = Array.isArray(local)
        ? local.map(sanitizeOrder).filter((o): o is Order => Boolean(o))
        : [];
      let list = localList;
      if (getAuthToken()) {
        const remote = await apiGetOrders();
        if (remote && active) {
          list = remote.map(sanitizeOrder).filter((o): o is Order => Boolean(o));
        }
      }
      if (!active) return;
      setOrders(list);
      hydrated.current = true;
      setReady(true);
      skipSave.current = false;
    })();
    return () => {
      active = false;
    };
  }, [authReady, accountId]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    void saveAccountJson(STORAGE_KEY, accountId, orders);
  }, [orders, accountId]);

  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  useEffect(() => {
    if (!authReady || !accountId || !getAuthToken()) return;
    let active = true;
    let liveTick = 0;
    const pullList = async () => {
      const remote = await apiGetOrders();
      if (!active || !remote) return;
      const list = remote.map(sanitizeOrder).filter((o): o is Order => Boolean(o));
      setOrders((current) => mergeRemoteOrders(current, list));
    };
    const pullLive = async () => {
      const ids = ordersRef.current.filter((o) => isActiveFulfillment(o.status)).map((o) => o.id);
      if (!ids.length) return;
      const lives = await Promise.all(ids.map((id) => apiGetOrderLive(id)));
      if (!active) return;
      setOrders((prev) => {
        let changed = false;
        const next = prev.map((order) => {
          const idx = ids.indexOf(order.id);
          const live = idx >= 0 ? lives[idx] : null;
          if (!live) return order;
          const merged = applyOrderLive(order, live);
          if (
            merged.status !== order.status ||
            merged.pickStatus !== order.pickStatus ||
            merged.deliveryStatus !== order.deliveryStatus ||
            merged.courierName !== order.courierName ||
            merged.courierLocatedAt !== order.courierLocatedAt ||
            merged.managedBy !== order.managedBy ||
            merged.pickerName !== order.pickerName ||
            merged.packedAt !== order.packedAt ||
            merged.enRouteAt !== order.enRouteAt ||
            merged.pickedUpAt !== order.pickedUpAt ||
            merged.failedReason !== order.failedReason ||
            merged.incidentAction !== order.incidentAction ||
            (merged.opsEvents?.at(-1)?.id ?? 0) !== (order.opsEvents?.at(-1)?.id ?? 0)
          ) {
            changed = true;
          }
          return merged;
        });
        return changed ? next : prev;
      });
    };
    void pullList();
    void pullLive();
    const listTimer = setInterval(() => void pullList(), 12_000);
    const liveTimer = setInterval(() => {
      liveTick += 1;
      const focused = Boolean(trackingFocusRef.current);
      if (!focused && liveTick % 3 !== 0) return;
      void pullLive();
    }, 3000);
    return () => {
      active = false;
      clearInterval(listTimer);
      clearInterval(liveTimer);
    };
  }, [authReady, accountId]);

  const placeOrder = useCallback(async (input: PlaceOrderInput) => {
    const lines = snapshotLines(input.lines);
    if (!lines.length) return null;

    const addressCoordinate = sanitizeCoordinate(input.addressCoordinate, cotonouMap.home);
    const preferred = input.storeId ? getSuperUById(input.storeId) : undefined;
    const store = preferred ?? findNearestSuperU(addressCoordinate).store;
    const driving = await fetchDrivingRoute(store.coordinate, addressCoordinate, 'driving');

    let created: Order | null = null;

    setOrders((prev) => {
      const order: Order = {
        id: makeOrderId(prev),
        createdAt: new Date().toISOString(),
        status: 'confirmed',
        lines,
        itemCount: lines.reduce((s, l) => s + l.qty, 0),
        subtotal: input.subtotal,
        delivery: input.delivery,
        discount: input.discount,
        total: input.total,
        promoCode: input.promoCode,
        dayId: input.dayId,
        dayLabel: input.dayLabel,
        slotId: input.slotId,
        slotLabel: input.slotLabel,
        paymentId: input.paymentId,
        paymentLabel: input.paymentLabel?.trim() || paymentLabelFor(input.paymentId),
        paymentDetail: input.paymentDetail,
        paymentStatus: input.paymentStatus ?? (input.paymentId === 'cod' ? 'cod_pending' : 'paid'),
        paymentRef: input.paymentRef ?? null,
        addressLabel: input.addressLabel?.trim() || 'Adresse',
        addressLine: input.addressLine?.trim() || '',
        addressCity: input.addressCity?.trim() || '',
        addressPhone: input.addressPhone?.trim() || profile.phone.trim() || '',
        addressCoordinate,
        storeId: store.id,
        storeName: store.name,
        storeCoordinate: [...store.coordinate],
        routeCoordinates: driving.coordinates,
        routeDistanceMeters: driving.distanceMeters,
        routeDurationSeconds: driving.durationSeconds,
        routeProfile: driving.profile,
        comment: input.comment?.trim() ?? '',
        courierName: '',
        courierPhone: '',
        pickerName: '',
        managedBy: 'shop',
        pickStatus: 'queued',
        deliveryStatus: 'unassigned',
        handoffCode: undefined,
      };
      created = order;
      return [order, ...prev];
    });

    if (!created) return null;
    if (!getAuthToken()) {
      setOrders((prev) => prev.filter((o) => o.id !== created!.id));
      return null;
    }
    try {
      const saved = await apiPlaceOrder(created);
      const code = typeof saved?.handoffCode === 'string' ? saved.handoffCode.replace(/\D/g, '').slice(0, 4) : '';
      if (code.length === 4) created.handoffCode = code;
      const remote = await apiGetOrders();
      if (remote) {
        const list = remote.map(sanitizeOrder).filter((o): o is Order => Boolean(o));
        setOrders(list);
        return list.find((o) => normalizeId(o.id) === normalizeId(created.id)) ?? { ...created };
      }
      if (code.length === 4) {
        setOrders((prev) => prev.map((o) => (o.id === created!.id ? { ...o, handoffCode: code } : o)));
      }
    } catch {
      setOrders((prev) => prev.filter((o) => o.id !== created!.id));
      return null;
    }
    return created;
  }, [profile.phone]);
  const getOrder = useCallback(
    (id: string) => {
      const key = normalizeId(id);
      const found = orders.find((o) => normalizeId(o.id) === key);
      return found ? sanitizeOrder(found) ?? found : undefined;
    },
    [orders],
  );

  const setStatus = useCallback((id: string, status: OrderStatus) => {
    const key = normalizeId(id);
    setOrders((prev) => prev.map((o) => (normalizeId(o.id) === key ? { ...o, status } : o)));
    if (getAuthToken()) {
      void apiPatchOrderStatus(id, status).catch(() => undefined);
    }
  }, []);

  const activeOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === 'confirmed' || o.status === 'preparing' || o.status === 'shipping')
      .map((o) => sanitizeOrder(o) ?? o);
  }, [orders]);

  const activeOrder = activeOrders[0] ?? null;

  const value = useMemo(
    () => ({ orders, ready, activeOrder, activeOrders, placeOrder, getOrder, setStatus, setTrackingFocus }),
    [orders, ready, activeOrder, activeOrders, placeOrder, getOrder, setStatus, setTrackingFocus],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider');
  return ctx;
}

export function formatOrderId(id: string) {
  const clean = normalizeId(id);
  return `#${clean}`;
}
