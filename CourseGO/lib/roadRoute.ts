import { haversineMeters, type LngLat } from '@/constants/map';

export type RoadRoute = {
  coordinates: LngLat[];
  distanceMeters: number;
  durationSeconds: number;
  approximated: boolean;
};

type OsrmResponse = {
  code?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry?: { coordinates?: [number, number][] };
  }[];
};

function valid(p: LngLat | null | undefined): p is LngLat {
  return Boolean(p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) > 0.2);
}

function densify(from: LngLat, to: LngLat): RoadRoute {
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
    durationSeconds: Math.max(180, distanceMeters / 8.5),
    approximated: true,
  };
}

/**
 * Voies routières OSRM (réseau motorisé). Plusieurs points = une seule course.
 */
export async function fetchRoadRoute(waypoints: LngLat[]): Promise<RoadRoute | null> {
  const pts = waypoints.filter(valid);
  if (pts.length < 2) return null;
  const path = pts.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url =
    `https://router.project-osrm.org/route/v1/driving/${path}` +
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
      approximated: false,
    };
  } catch {
    return densify(pts[0], pts[pts.length - 1]);
  }
}

export function roundLngLat(p: LngLat, digits = 4): LngLat {
  const f = 10 ** digits;
  return [Math.round(p[0] * f) / f, Math.round(p[1] * f) / f];
}
