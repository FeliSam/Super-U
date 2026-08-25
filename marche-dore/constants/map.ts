import { appLocation } from '@/constants/location';

/** [longitude, latitude] — GeoJSON / MapLibre order. */
export type LngLat = [number, number];

export type MapMarker = {
  id: string;
  coordinate: LngLat;
  label?: string;
  color?: string;
  /** Feather-like role for pin chrome */
  kind?: 'store' | 'home' | 'courier' | 'pin' | 'superu';
};

/** Free vector styles (OpenFreeMap + OSM) — no API key. */
export const mapStyles = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  /** Brighter streets — better for address picking. */
  bright: 'https://tiles.openfreemap.org/styles/bright',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

/** Cotonou · hub Super U Aéroport + livraison Ganhi. */
export const cotonouMap = {
  city: appLocation.city,
  /** Super U Aéroport (Cadjehoun) — départ préparation */
  store: [2.386957, 6.349016] as LngLat,
  /** Default “Rue 12, Ganhi” delivery spot */
  home: [2.4178, 6.3604] as LngLat,
  /** Comfortable overview zoom for the short delivery hop */
  zoom: 14.2,
  /** Slightly pulled back to frame both pins */
  overviewZoom: 13.4,
  /** Vue d’ensemble Cotonou + Calavi (tous les Super U) */
  networkZoom: 11.2,
  networkCenter: [2.41, 6.42] as LngLat,
} as const;

export function lerpLngLat(a: LngLat, b: LngLat, t: number): LngLat {
  const u = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

/**
 * Timeline locale de la simulation livreur (ms depuis création commande).
 * La phase « en route » suit la durée routière réelle supermarché → client.
 */
export const deliverySimMs = {
  /** Confirmation → début préparation */
  preparing: 25_000,
  /** Préparation → départ livreur */
  shipping: 45_000,
  /** Fallback trajet si durée inconnue (~8 min) */
  deliveredFallback: 8 * 60_000,
} as const;

/** Bornes ms pour le trajet simulé (durée OSRM réelle, bornée). */
export function shippingDurationMs(routeDurationSeconds?: number): number {
  const roadMs = Math.round((routeDurationSeconds ?? 0) * 1000);
  // Court trajet : au moins ~2 min visibles ; long : plafond 45 min pour le démo
  return Math.min(45 * 60_000, Math.max(2 * 60_000, roadMs || deliverySimMs.deliveredFallback));
}

export function demoTimelineMs(routeDurationSeconds?: number) {
  const preparing = deliverySimMs.preparing;
  const shipping = deliverySimMs.shipping;
  const delivered = shipping + shippingDurationMs(routeDurationSeconds);
  return { preparing, shipping, delivered };
}

/**
 * Progression livreur Super U → client (0…1).
 * Pendant `shipping`, interpolé selon la durée routière réelle.
 */
export function courierRouteProgress(
  status: string,
  createdAt?: string,
  now = Date.now(),
  routeDurationSeconds?: number,
): number {
  switch (status) {
    case 'confirmed':
    case 'preparing':
      return 0;
    case 'delivered':
      return 1;
    case 'cancelled':
      return 0;
    case 'shipping': {
      if (!createdAt) return 0.35;
      const created = new Date(createdAt).getTime();
      if (Number.isNaN(created)) return 0.35;
      const age = Math.max(0, now - created);
      const { shipping, delivered } = demoTimelineMs(routeDurationSeconds);
      const span = delivered - shipping;
      const t = (age - shipping) / Math.max(1, span);
      return Math.min(1, Math.max(0, t));
    }
    default:
      return 0;
  }
}

export function deliveryRouteGeoJSON(store: LngLat, home: LngLat) {
  return routeLineGeoJSON([store, home]);
}

/** Polyligne complète (itinéraire OSRM ou fallback). */
export function routeLineGeoJSON(coordinates: LngLat[]) {
  const coords = coordinates.length >= 2 ? coordinates : coordinates.length === 1 ? [coordinates[0], coordinates[0]] : [cotonouMap.store, cotonouMap.home];
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: coords,
        },
      },
    ],
  };
}
