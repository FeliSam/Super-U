import type { LngLat } from '@/constants/map';

export type VehicleKind = 'moto' | 'voiture' | 'velo' | 'tricycle' | 'pied';

export function asVehicleKind(raw: unknown): VehicleKind {
  const s = String(raw ?? '');
  if (s === 'voiture' || s === 'velo' || s === 'tricycle' || s === 'pied') return s;
  return 'moto';
}

export function cotonouTrafficFactor(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= 7 && h < 9.5) return 1.55;
  if (h >= 12 && h < 14) return 1.22;
  if (h >= 17 && h < 20) return 1.62;
  if (h >= 21 || h < 6) return 0.88;
  return 1.12;
}

export function signalDelaySeconds(distanceM: number) {
  return Math.max(0, Math.floor(distanceM / 380)) * 14;
}

export function travelSeconds(distanceM: number, kind: VehicleKind, osrmSec?: number | null) {
  const traffic = cotonouTrafficFactor();
  const lights = signalDelaySeconds(distanceM);
  if (osrmSec && osrmSec > 30) {
    const vehicleMul =
      kind === 'moto' ? 0.82 : kind === 'tricycle' ? 1.12 : kind === 'voiture' ? 1.08 : kind === 'velo' ? 1.55 : 3.4;
    return Math.max(45, Math.round(osrmSec * vehicleMul * traffic + lights));
  }
  const kmh = (kind === 'velo' ? 14 : kind === 'tricycle' ? 22 : kind === 'voiture' ? 24 : kind === 'pied' ? 5 : 28) / traffic;
  return Math.max(45, Math.round((distanceM / 1000 / Math.max(4, kmh)) * 3600 + lights));
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

export function easeOutCubic(t: number) {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) ** 3;
}
