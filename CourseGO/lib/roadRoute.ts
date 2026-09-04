import { type LngLat } from '@/constants/map';
import { getApiBaseUrl } from '@/lib/api/http';
import type { VehicleKind } from '@/lib/vehicleMotion';
import { osrmProfileFor } from '@/lib/vehicleMotion';
import { Platform } from 'react-native';

export type RoadRoute = {
  coordinates: LngLat[];
  distanceMeters: number;
  durationSeconds: number;
  approximated: boolean;
};

export type OsrmProfile = 'driving' | 'cycling' | 'walking';

type Cached = { route: RoadRoute; at: number };

const cache = new Map<string, Cached>();
const inflight = new Map<string, Promise<RoadRoute | null>>();

const OSRM_DRIVING_BASES = [
  'https://router.project-osrm.org/route/v1/',
  'https://routing.openstreetmap.de/routed-car/route/v1/',
];

function valid(p: LngLat | null | undefined): p is LngLat {
  return Boolean(p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) > 0.2);
}

export function roundLngLat(p: LngLat, digits = 4): LngLat {
  const f = 10 ** digits;
  return [Math.round(p[0] * f) / f, Math.round(p[1] * f) / f];
}

export function roadWaypointsKey(waypoints: LngLat[] | null | undefined, digits = 4) {
  const pts = (waypoints ?? []).filter(valid);
  if (pts.length < 2) return '';
  return pts.map((p) => roundLngLat(p, digits).join(',')).join('>');
}

function parseOsrmJson(data: {
  code?: string;
  routes?: { distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }[];
}): RoadRoute | null {
  const route = data.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (data.code !== 'Ok' || !route || !coords || coords.length < 2) return null;
  return {
    coordinates: coords.map(([lng, lat]) => [lng, lat] as LngLat),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    approximated: false,
  };
}

async function fetchOsrmAtBase(base: string, pts: LngLat[], profile: OsrmProfile): Promise<RoadRoute | null> {
  const path = pts.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `${base}${profile}/${path}?overview=full&geometries=geojson&alternatives=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return parseOsrmJson((await res.json()) as Parameters<typeof parseOsrmJson>[0]);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOsrmDirect(pts: LngLat[], profile: OsrmProfile): Promise<RoadRoute | null> {
  const bases =
    profile === 'driving'
      ? OSRM_DRIVING_BASES
      : ['https://router.project-osrm.org/route/v1/'];
  for (const base of bases) {
    try {
      const route = await fetchOsrmAtBase(base, pts, profile);
      if (route) return route;
    } catch {
      /* try next mirror */
    }
  }
  return null;
}

async function fetchViaApi(pts: LngLat[], profile: OsrmProfile): Promise<RoadRoute | null> {
  const points = pts.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/geo/route?points=${encodeURIComponent(points)}&profile=${encodeURIComponent(profile)}`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      coordinates?: [number, number][];
      distanceMeters?: number;
      durationSeconds?: number;
    };
    if (!data.ok || !data.coordinates || data.coordinates.length < 2) return null;
    return {
      coordinates: data.coordinates.map(([lng, lat]) => [lng, lat] as LngLat),
      distanceMeters: Number(data.distanceMeters) || 0,
      durationSeconds: Number(data.durationSeconds) || 0,
      approximated: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

function apiLikelyUnreachableFromDevice(): boolean {
  if (Platform.OS === 'web') return false;
  const base = getApiBaseUrl();
  return /127\.0\.0\.1|localhost/i.test(base);
}

/**
 * Itinéraire routier (OSRM). Jamais de ligne droite ici : échec → null.
 * Les hooks gardent le dernier tracé valide.
 */
export async function fetchRoadRoute(
  waypoints: LngLat[],
  profile: OsrmProfile | VehicleKind | string = 'driving',
): Promise<RoadRoute | null> {
  const pts = waypoints.filter(valid);
  if (pts.length < 2) return null;
  const osrm =
    profile === 'driving' || profile === 'cycling' || profile === 'walking'
      ? profile
      : osrmProfileFor(profile as VehicleKind);
  const key = `${osrm}|${roadWaypointsKey(pts)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 180_000) return hit.route;

  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    // Sur appareil : OSRM d'abord (API locale souvent inaccessible).
    // Sur web : API d'abord (évite CORS OSRM).
    let route: RoadRoute | null = null;
    const preferOsrm = apiLikelyUnreachableFromDevice() || Platform.OS !== 'web';
    if (preferOsrm) {
      route = await fetchOsrmDirect(pts, osrm).catch(() => null);
      if (!route && !apiLikelyUnreachableFromDevice()) {
        route = await fetchViaApi(pts, osrm).catch(() => null);
      }
    } else {
      route = await fetchViaApi(pts, osrm).catch(() => null);
      if (!route) route = await fetchOsrmDirect(pts, osrm).catch(() => null);
    }
    if (route) cache.set(key, { route, at: Date.now() });
    return route;
  })();

  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

export function prefetchRoadRoute(waypoints: LngLat[], profile?: OsrmProfile | VehicleKind | string) {
  void fetchRoadRoute(waypoints, profile);
}
