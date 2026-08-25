import type { LngLat } from '@/constants/map';

export type DeviceLocation = {
  coordinate: LngLat;
  accuracy?: number;
};

/**
 * Position GPS exacte (web / native via Geolocation API).
 * Demande la permission navigateur / OS au premier appel.
 */
export function getDeviceLocation(options?: {
  timeoutMs?: number;
  maximumAgeMs?: number;
}): Promise<DeviceLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          coordinate: [pos.coords.longitude, pos.coords.latitude],
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        reject(err ?? new Error('Geolocation failed'));
      },
      {
        enableHighAccuracy: true,
        timeout: options?.timeoutMs ?? 15_000,
        maximumAge: options?.maximumAgeMs ?? 8_000,
      },
    );
  });
}
