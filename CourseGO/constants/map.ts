export const appLocation = {
  city: 'Cotonou',
  district: 'Ganhi',
  country: 'Bénin',
  latitude: 6.3604,
  longitude: 2.4178,
} as const;

export type LngLat = [number, number];

export type MapMarker = {
  id: string;
  coordinate: LngLat;
  label?: string;
  kind?: 'store' | 'home' | 'courier' | 'pin';
  vehicle?: 'moto' | 'voiture' | 'velo' | 'tricycle' | 'pied';
  heading?: number;
  /** Colis à ramasser (pin magasin). */
  badge?: number;
  /** Super U proposé (le plus proche avec file). */
  highlight?: boolean;
};

export const mapStyles = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
} as const;

export const cotonouMap = {
  store: [2.386957, 6.349016] as LngLat,
  home: [2.4178, 6.3604] as LngLat,
  zoom: 14.2,
} as const;

export function routeLineGeoJSON(route: LngLat[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: route },
  };
}

export function haversineMeters(a: LngLat, b: LngLat) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Temps moto urbain Cotonou (~22 km/h). */
export function motoEtaSeconds(from: LngLat, to: LngLat) {
  const kmh = 22;
  return Math.max(60, Math.round((haversineMeters(from, to) / 1000 / kmh) * 3600));
}

export function nearCotonou(lng: number, lat: number) {
  return Math.abs(lng - cotonouMap.home[0]) < 1.5 && Math.abs(lat - cotonouMap.home[1]) < 1.5;
}

/** Position carte si le GPS navigateur n’est pas à Cotonou (dev). */
export const courierMapFallback: LngLat = [cotonouMap.store[0] - 0.014, cotonouMap.store[1] - 0.01];
