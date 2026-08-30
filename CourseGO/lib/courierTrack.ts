import { cotonouMap, type LngLat } from '@/constants/map';
import { normalizeDeliveryStatus, type DeliveryStatus } from '@/lib/opsModel';

export function storeCoord(d?: {
  pickup_lng?: number | null;
  pickup_lat?: number | null;
}): LngLat {
  if (d?.pickup_lng != null && d?.pickup_lat != null && Math.abs(d.pickup_lng) > 0.2) {
    return [d.pickup_lng, d.pickup_lat];
  }
  return cotonouMap.store;
}

export function clientCoord(d?: {
  dropoff_lng?: number | null;
  dropoff_lat?: number | null;
}): LngLat {
  if (d?.dropoff_lng != null && d?.dropoff_lat != null && Math.abs(d.dropoff_lng) > 0.2) {
    return [d.dropoff_lng, d.dropoff_lat];
  }
  return cotonouMap.home;
}

/** Décale le pin livreur à côté d’un point (magasin / client) pour ne pas le superposer. */
export function offsetBeside(at: LngLat, other?: LngLat | null, meters = 90): LngLat {
  const fallback: LngLat = other && (other[0] !== at[0] || other[1] !== at[1]) ? other : [at[0] + 0.01, at[1]];
  const dLng = fallback[0] - at[0];
  const dLat = fallback[1] - at[1];
  const len = Math.hypot(dLng, dLat) || 1;
  const nx = -dLat / len;
  const ny = dLng / len;
  const degLat = meters / 111_320;
  const degLng = meters / (111_320 * Math.max(0.2, Math.cos((at[1] * Math.PI) / 180)));
  return [at[0] + nx * degLng, at[1] + ny * degLat];
}

export function courierAnchor(status: string | null | undefined): 'store' | 'route' | 'client' {
  const s = normalizeDeliveryStatus(status);
  if (s === 'picked_up' || s === 'en_route') return 'route';
  if (s === 'arrived' || s === 'delivered') return 'client';
  return 'store';
}

export function pointAlongRoute(coords: LngLat[], progress: number): LngLat {
  if (!coords.length) return cotonouMap.store;
  const t = Math.min(1, Math.max(0, progress));
  const idx = t * (coords.length - 1);
  const i = Math.floor(idx);
  const next = Math.min(coords.length - 1, i + 1);
  const f = idx - i;
  const a = coords[i];
  const b = coords[next];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export const DELIVERY_PHASE: Record<
  DeliveryStatus | 'offered',
  { title: string; hint: string; action: string }
> = {
  unassigned: {
    title: 'Course disponible',
    hint: 'Prenez cette livraison. Votre position sera le magasin.',
    action: 'Prendre la course',
  },
  offered: {
    title: 'Course disponible',
    hint: 'Prenez cette livraison. Votre position sera le magasin.',
    action: 'Prendre la course',
  },
  assigned: {
    title: 'Prêt à partir',
    hint: 'Les colis sont sélectionnés. Démarrez depuis Courses quand le sac est prêt.',
    action: 'Je démarre la tournée',
  },
  at_store: {
    title: 'Prêt à partir',
    hint: 'Les colis sont au magasin. Démarrez la tournée pour quitter le Super U.',
    action: 'Je démarre la tournée',
  },
  picked_up: {
    title: 'En route',
    hint: 'Roulez vers le prochain client. Un seul geste à l’arrivée.',
    action: 'Je suis arrivé',
  },
  en_route: {
    title: 'En route',
    hint: 'Roulez vers le prochain client. Un seul geste à l’arrivée.',
    action: 'Je suis arrivé',
  },
  arrived: {
    title: 'Sur place',
    hint: 'Demandez le code à 4 chiffres au client pour remettre le colis.',
    action: 'Je remets le colis',
  },
  delivered: {
    title: 'Livré',
    hint: 'Le colis a été remis.',
    action: 'Terminé',
  },
  failed: {
    title: 'Incident',
    hint: 'La course n’a pas pu être livrée.',
    action: 'Fermer',
  },
  cancelled: {
    title: 'Annulée',
    hint: 'Cette course n’est plus active.',
    action: 'Fermer',
  },
};
