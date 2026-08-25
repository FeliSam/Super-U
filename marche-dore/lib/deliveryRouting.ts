import { cotonouMap, type LngLat } from '@/constants/map';
import { SUPER_U_STORES, type SuperUStore } from '@/data/superU';

export type RouteProfile = 'driving' | 'motorcycle';

export type DrivingRoute = {
  coordinates: LngLat[];
  distanceMeters: number;
  durationSeconds: number;
  profile: RouteProfile;
  /** true when OSRM failed and haversine fallback was used */
  approximated?: boolean;
};

export type NearestStoreResult = {
  store: SuperUStore;
  /** Distance à vol d’oiseau (m) — sélection magasin */
  straightMeters: number;
};

const EARTH_M = 6_371_000;

/** Distance haversine en mètres. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Super U / U Express le plus proche de l’adresse client. */
export function findNearestSuperU(destination: LngLat): NearestStoreResult {
  let best = SUPER_U_STORES[0];
  let bestD = haversineMeters(destination, best.coordinate);
  for (let i = 1; i < SUPER_U_STORES.length; i++) {
    const store = SUPER_U_STORES[i];
    const d = haversineMeters(destination, store.coordinate);
    if (d < bestD) {
      best = store;
      bestD = d;
    }
  }
  return { store: best, straightMeters: bestD };
}

/** Magasin sous le doigt / près d’un tap carte (rayon en mètres). */
export function findStoreNearPoint(point: LngLat, maxMeters = 900): NearestStoreResult | null {
  const nearest = findNearestSuperU(point);
  if (nearest.straightMeters > maxMeters) return null;
  return nearest;
}

export function getSuperUById(id: string): SuperUStore | undefined {
  return SUPER_U_STORES.find((s) => s.id === id);
}

function segmentLength(a: LngLat, b: LngLat): number {
  return haversineMeters(a, b);
}

function cumulativeLengths(coords: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + segmentLength(coords[i - 1], coords[i]));
  }
  return out;
}

/** Position le long d’une polyligne (t ∈ 0…1). */
export function pointAlongPolyline(coords: LngLat[], t: number): LngLat {
  if (!coords.length) return [...cotonouMap.store];
  if (coords.length === 1) return [...coords[0]];
  const u = Math.min(1, Math.max(0, t));
  const cum = cumulativeLengths(coords);
  const total = cum[cum.length - 1] || 1;
  const target = total * u;
  for (let i = 1; i < cum.length; i++) {
    if (target <= cum[i]) {
      const span = cum[i] - cum[i - 1] || 1;
      const local = (target - cum[i - 1]) / span;
      const a = coords[i - 1];
      const b = coords[i];
      return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local];
    }
  }
  return [...coords[coords.length - 1]];
}

/** Centre approximatif pour cadrer le trajet. */
export function routeBoundsCenter(coords: LngLat[]): LngLat {
  if (!coords.length) return [...cotonouMap.networkCenter];
  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

export function formatDistanceKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1).replace('.', ',')} km`;
}

export function formatDurationMin(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

type OsrmResponse = {
  code?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry?: { coordinates?: [number, number][] };
  }[];
};

/**
 * Itinéraire routier le plus rapide (voiture / moto via réseau routier).
 * OSRM public — profile `driving` (routes motorisées, plus rapide).
 */
export async function fetchDrivingRoute(
  from: LngLat,
  to: LngLat,
  profile: RouteProfile = 'driving',
): Promise<DrivingRoute> {
  const osrmProfile = profile === 'motorcycle' ? 'driving' : 'driving';
  const url =
    `https://router.project-osrm.org/route/v1/${osrmProfile}/` +
    `${from[0]},${from[1]};${to[0]},${to[1]}` +
    `?overview=full&geometries=geojson&alternatives=false`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = (await res.json()) as OsrmResponse;
    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (data.code !== 'Ok' || !route || !coords || coords.length < 2) {
      throw new Error('OSRM empty');
    }
    return {
      coordinates: coords.map(([lng, lat]) => [lng, lat] as LngLat),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      profile,
      approximated: false,
    };
  } catch {
    // Fallback : ligne droite densifiée (si OSRM indisponible)
    const steps = 24;
    const coordinates: LngLat[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      coordinates.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
    }
    const distanceMeters = haversineMeters(from, to);
    return {
      coordinates,
      distanceMeters,
      durationSeconds: Math.max(300, distanceMeters / 8.5),
      profile,
      approximated: true,
    };
  }
}

/** Plan complet : magasin le plus proche + trajet routier le plus rapide. */
export async function planDeliveryRoute(destination: LngLat): Promise<{
  nearest: NearestStoreResult;
  route: DrivingRoute;
}> {
  const nearest = findNearestSuperU(destination);
  const route = await fetchDrivingRoute(nearest.store.coordinate, destination, 'driving');
  return { nearest, route };
}
