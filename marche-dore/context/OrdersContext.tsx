import { getProduct } from '@/data/catalog';
import { cotonouMap, deliverySimMs, demoTimelineMs, type LngLat } from '@/constants/map';
import { appLocation } from '@/constants/location';
import type { CartLine } from '@/context/CartContext';
import type { PaymentId } from '@/context/CheckoutPaymentContext';
import { useProfile } from '@/context/ProfileContext';
import { findNearestSuperU, fetchDrivingRoute, getSuperUById, type RouteProfile } from '@/lib/deliveryRouting';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.orders.v2';

export type OrderStatus = 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';

/** Timeline de démo par défaut (si durée trajet inconnue). */
export const DEMO_STATUS_TIMELINE: { status: Exclude<OrderStatus, 'cancelled'>; afterMs: number }[] = [
  { status: 'confirmed', afterMs: 0 },
  { status: 'preparing', afterMs: deliverySimMs.preparing },
  { status: 'shipping', afterMs: deliverySimMs.shipping },
  { status: 'delivered', afterMs: deliverySimMs.shipping + deliverySimMs.deliveredFallback },
];

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

export function expectedDemoStatus(
  createdAt: string,
  now = Date.now(),
  routeDurationSeconds?: number,
): OrderStatus {
  const created = new Date(createdAt).getTime();
  const age = Number.isNaN(created) ? 0 : Math.max(0, now - created);
  const timeline = demoTimelineMs(routeDurationSeconds);
  const steps: { status: Exclude<OrderStatus, 'cancelled'>; afterMs: number }[] = [
    { status: 'confirmed', afterMs: 0 },
    { status: 'preparing', afterMs: timeline.preparing },
    { status: 'shipping', afterMs: timeline.shipping },
    { status: 'delivered', afterMs: timeline.delivered },
  ];
  let status: OrderStatus = 'confirmed';
  for (const step of steps) {
    if (age >= step.afterMs) status = step.status;
  }
  return status;
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
  placeOrder: (input: PlaceOrderInput) => Promise<Order | null>;
  getOrder: (id: string) => Order | undefined;
  setStatus: (id: string, status: OrderStatus) => void;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

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
    addressLabel: (typeof o.addressLabel === 'string' && o.addressLabel.trim()) || 'Domicile',
    addressLine: (typeof o.addressLine === 'string' && o.addressLine.trim()) || appLocation.defaultLine,
    addressCity: (typeof o.addressCity === 'string' && o.addressCity.trim()) || appLocation.city,
    addressPhone: (typeof o.addressPhone === 'string' && o.addressPhone.trim()) || appLocation.phone,
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
    courierName: (typeof o.courierName === 'string' && o.courierName.trim()) || 'Moussa Ndiaye',
    courierPhone: (typeof o.courierPhone === 'string' && o.courierPhone.trim()) || '+229971234567',
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const parsed = JSON.parse(raw) as unknown;
          const list = Array.isArray(parsed)
            ? parsed.map(sanitizeOrder).filter((o): o is Order => Boolean(o))
            : [];
          // Keep any order placed before hydration finished (race with AsyncStorage).
          setOrders((current) => {
            if (!current.length) return list;
            const seen = new Set(current.map((o) => normalizeId(o.id)));
            return [...current, ...list.filter((o) => !seen.has(normalizeId(o.id)))];
          });
        }
      } catch {
        // ignore
      } finally {
        if (active) {
          hydrated.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(orders)).catch(() => undefined);
  }, [orders]);

  // Local demo: advance confirmed → preparing → shipping → delivered on a timer.
  useEffect(() => {
    if (!ready) return;

    const sync = () => {
      setOrders((prev) => {
        let changed = false;
        const next = prev.map((order) => {
          if (order.status === 'cancelled') return order;
          const expected = expectedDemoStatus(order.createdAt, Date.now(), order.routeDurationSeconds);
          if (statusRank(expected) <= statusRank(order.status)) return order;
          changed = true;
          return { ...order, status: expected };
        });
        return changed ? next : prev;
      });
    };

    sync();
    const timer = setInterval(sync, 2000);
    return () => clearInterval(timer);
  }, [ready]);

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
        addressLabel: input.addressLabel?.trim() || 'Domicile',
        addressLine: input.addressLine?.trim() || appLocation.defaultLine,
        addressCity: input.addressCity?.trim() || appLocation.city,
        addressPhone: input.addressPhone?.trim() || profile.phone,
        addressCoordinate,
        storeId: store.id,
        storeName: store.name,
        storeCoordinate: [...store.coordinate],
        routeCoordinates: driving.coordinates,
        routeDistanceMeters: driving.distanceMeters,
        routeDurationSeconds: driving.durationSeconds,
        routeProfile: driving.profile,
        comment: input.comment?.trim() ?? '',
        courierName: 'Moussa Ndiaye',
        courierPhone: '+229971234567',
      };
      created = order;
      return [order, ...prev];
    });

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
  }, []);

  const activeOrder = useMemo(() => {
    const found =
      orders.find((o) => o.status === 'confirmed' || o.status === 'preparing' || o.status === 'shipping') ?? null;
    return found ? sanitizeOrder(found) ?? found : null;
  }, [orders]);

  const value = useMemo(
    () => ({ orders, ready, activeOrder, placeOrder, getOrder, setStatus }),
    [orders, ready, activeOrder, placeOrder, getOrder, setStatus],
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
