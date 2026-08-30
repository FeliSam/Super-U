import type { LngLat } from '@/constants/map';
import { haversineMeters } from '@/constants/map';

export type VehicleKind = 'moto' | 'voiture' | 'velo' | 'tricycle' | 'pied';

export function asVehicleKind(raw: unknown): VehicleKind {
  const s = String(raw ?? '');
  if (s === 'voiture' || s === 'velo' || s === 'tricycle' || s === 'pied') return s;
  return 'moto';
}

/** km/h urbains Cotonou, hors pic. */
export function vehicleCruiseKmh(kind: VehicleKind) {
  switch (kind) {
    case 'velo':
      return 14;
    case 'tricycle':
      return 22;
    case 'voiture':
      return 24;
    case 'pied':
      return 5;
    default:
      return 28;
  }
}

/** Pic 7h–9h et 17h–20h : saturation + feux. */
export function cotonouTrafficFactor(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= 7 && h < 9.5) return 1.55;
  if (h >= 12 && h < 14) return 1.22;
  if (h >= 17 && h < 20) return 1.62;
  if (h >= 21 || h < 6) return 0.88;
  return 1.12;
}

/** Feux / carrefours : ~un arrêt tous les 380 m. */
export function signalDelaySeconds(distanceM: number) {
  const stops = Math.max(0, Math.floor(distanceM / 380));
  return stops * 14;
}

export function osrmProfileFor(kind: VehicleKind): 'driving' | 'cycling' | 'walking' {
  if (kind === 'velo') return 'cycling';
  if (kind === 'pied') return 'walking';
  return 'driving';
}

export function withLiveTravel<T extends { distanceMeters: number; durationSeconds: number; approximated?: boolean }>(
  route: T | null | undefined,
  kind: VehicleKind,
): T | null {
  if (!route) return null;
  return {
    ...route,
    durationSeconds: travelSeconds(
      route.distanceMeters,
      kind,
      route.approximated ? null : route.durationSeconds,
    ),
  };
}

export function travelSeconds(distanceM: number, kind: VehicleKind, osrmSec?: number | null) {
  const traffic = cotonouTrafficFactor();
  const lights = signalDelaySeconds(distanceM);
  if (osrmSec && osrmSec > 30) {
    const vehicleMul =
      kind === 'moto' ? 0.82 : kind === 'tricycle' ? 1.12 : kind === 'voiture' ? 1.08 : kind === 'velo' ? 1.55 : 3.4;
    return Math.max(45, Math.round(osrmSec * vehicleMul * traffic + lights));
  }
  const kmh = vehicleCruiseKmh(kind) / traffic;
  const moving = (distanceM / 1000 / Math.max(4, kmh)) * 3600;
  return Math.max(45, Math.round(moving + lights));
}

export function tripProgress(startedAt: string | null | undefined, durationSec: number, now = Date.now()) {
  if (!startedAt || !(durationSec > 0)) return null;
  const t0 = new Date(startedAt).getTime();
  if (!Number.isFinite(t0)) return null;
  return Math.min(0.97, Math.max(0.02, (now - t0) / (durationSec * 1000)));
}

export function headingDeg(from: LngLat, to: LngLat) {
  const dLng = ((to[0] - from[0]) * Math.PI) / 180;
  const lat1 = (from[1] * Math.PI) / 180;
  const lat2 = (to[1] * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Cap vers le prochain point de route (≥ ~35 m devant), comme Google Maps. */
export function headingAlongRoute(pos: LngLat, route?: LngLat[] | null): number | null {
  if (!route || route.length < 2) return null;
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = haversineMeters(pos, route[i]);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  let j = bestI;
  while (j < route.length - 1 && haversineMeters(pos, route[j]) < 35) j += 1;
  const to = route[Math.min(j + 1, route.length - 1)];
  const from = j > 0 ? route[j] : pos;
  if (haversineMeters(from, to) < 5) return null;
  const h = headingDeg(from, to);
  return Number.isFinite(h) ? h : null;
}

export function easeOutCubic(t: number) {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) ** 3;
}
