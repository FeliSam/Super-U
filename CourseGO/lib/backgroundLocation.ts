/**
 * Position du livreur en arrière-plan (P2) : tant qu'une livraison est en cours, le téléphone continue
 * d'envoyer sa position au siège même écran verrouillé ou appli en fond (service de premier plan Android
 * avec notification, mode « location » iOS). La tâche s'arrête d'elle-même dès que l'API répond qu'il n'y
 * a plus de livraison active, ou si la session a disparu.
 *
 * La tâche est déclarée au chargement du module (importé tout en haut d'index.js) : sur Android, le système
 * peut relancer le JS « sans écran » juste pour elle, d'où la relecture du jeton et de l'adresse d'API.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { nearCotonou } from '../constants/map';
import { getApiBaseUrl, loadApiBaseOverride } from './api/apiBase';

export const BACKGROUND_LOCATION_TASK = 'coursego-background-location';
const TOKEN_KEY = 'coursego.ops.token.v1';
const MIN_SEND_MS = 10_000;

let lastSentAt = 0;
let baseLoaded = false;

async function readToken(): Promise<string | null> {
  try {
    if (typeof localStorage !== 'undefined') {
      const web = localStorage.getItem(TOKEN_KEY);
      if (web) return web;
    }
  } catch {
    /* ignore */
  }
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

type LocationTaskData = { locations?: Location.LocationObject[] };

async function handleLocations(locations: Location.LocationObject[]) {
  const loc = locations[locations.length - 1];
  if (!loc?.coords) return;
  const now = Date.now();
  if (now - lastSentAt < MIN_SEND_MS) return;
  const { longitude: lng, latitude: lat, heading, speed } = loc.coords;
  if (!nearCotonou(lng, lat)) return;
  const token = await readToken();
  if (!token) {
    await stopBackgroundTracking();
    return;
  }
  if (!baseLoaded) {
    baseLoaded = true;
    await loadApiBaseOverride().catch(() => null);
  }
  lastSentAt = now;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${getApiBaseUrl().replace(/\/$/, '')}/ops/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({
        lng,
        lat,
        heading: Number.isFinite(heading) && (heading as number) >= 0 ? heading : undefined,
        speedMps: Number.isFinite(speed) && (speed as number) >= 0 ? speed : undefined,
      }),
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      await stopBackgroundTracking();
      return;
    }
    const data = (await res.json().catch(() => null)) as { activeDelivery?: boolean } | null;
    // Plus aucune livraison en cours : on libère le GPS (batterie) et la notification.
    if (data && data.activeDelivery === false) await stopBackgroundTracking();
  } catch {
    /* réseau coupé : on réessaiera au prochain point */
  } finally {
    clearTimeout(timer);
  }
}

if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask<LocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
      if (error || !data?.locations?.length) return;
      await handleLocations(data.locations);
    });
  } catch {
    /* module natif absent (Expo Go ancien) : pas de suivi en arrière-plan */
  }
}

export async function isBackgroundTracking(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Démarre le suivi en arrière-plan. Demande l'autorisation « toujours » si besoin ; si le livreur refuse,
 * le suivi reste limité à l'appli ouverte (comportement actuel). Retourne `true` si le suivi tourne.
 */
export async function startBackgroundTracking(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (await isBackgroundTracking()) return true;
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    let bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted' && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15_000,
      distanceInterval: 25,
      deferredUpdatesInterval: 15_000,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'CourseGo — livraison en cours',
        notificationBody: 'Votre position est partagée avec le magasin jusqu’à la remise.',
        notificationColor: '#058d81',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    /* déjà arrêté */
  }
}

