import type { LngLat } from '@/constants/map';
import { Platform } from 'react-native';

export type DeviceLocation = {
  coordinate: LngLat;
  accuracy?: number;
};

type ExpoLocationMod = typeof import('expo-location');

function webGeolocation(options?: {
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
      (err) => reject(err ?? new Error('Geolocation failed')),
      {
        enableHighAccuracy: true,
        timeout: options?.timeoutMs ?? 15_000,
        maximumAge: options?.maximumAgeMs ?? 8_000,
      },
    );
  });
}

async function loadExpoLocation(): Promise<ExpoLocationMod | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-location') as ExpoLocationMod | { default: ExpoLocationMod };
    if (mod && typeof (mod as ExpoLocationMod).requestForegroundPermissionsAsync === 'function') {
      return mod as ExpoLocationMod;
    }
    const nested = (mod as { default?: ExpoLocationMod }).default;
    if (nested && typeof nested.requestForegroundPermissionsAsync === 'function') return nested;
    return null;
  } catch {
    return null;
  }
}

/**
 * Position GPS exacte.
 * - Native : `expo-location` si le module Metro est dispo, sinon Geolocation API
 * - Web : Geolocation API navigateur
 */
export async function getDeviceLocation(options?: {
  timeoutMs?: number;
  maximumAgeMs?: number;
}): Promise<DeviceLocation> {
  if (Platform.OS === 'web') {
    return webGeolocation(options);
  }

  const Location = await loadExpoLocation();
  if (!Location) {
    return webGeolocation(options);
  }

  const current = await Location.getForegroundPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const asked = await Location.requestForegroundPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') {
    throw new Error('Location permission denied');
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    coordinate: [pos.coords.longitude, pos.coords.latitude],
    accuracy: pos.coords.accuracy ?? undefined,
  };
}

/** Demande explicite (réglages / onboarding). */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      await webGeolocation({ timeoutMs: 8_000, maximumAgeMs: 0 });
      return true;
    } catch {
      return false;
    }
  }

  const Location = await loadExpoLocation();
  if (!Location?.requestForegroundPermissionsAsync) {
    try {
      await webGeolocation({ timeoutMs: 8_000, maximumAgeMs: 0 });
      return true;
    } catch {
      return false;
    }
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}
