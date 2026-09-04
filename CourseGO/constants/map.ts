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
  /** OpenFreeMap — gratuit, sans clé (MapLibre vectoriel). */
  light: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  fiord: 'https://tiles.openfreemap.org/styles/fiord',
} as const;

/**
 * Raster OSM (native UrlTile + fallback web).
 * Évite CARTO Voyager qui affiche « API KEY REQUIRED » sans clé.
 * @see https://carto.com/basemaps/apikey/
 */
export const mapRasterTiles = {
  voyager: 'https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap',
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

export function remainingAlongPolyline(coords: LngLat[], from: LngLat): number {
  if (!coords.length) return 0;
  if (coords.length === 1) return haversineMeters(from, coords[0]);
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversineMeters(coords[i - 1], coords[i]));
  const total = cum[cum.length - 1] || 0;
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineMeters(from, coords[i]);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return Math.max(0, total - cum[bestI] + bestD * 0.15);
}

export function remainingToPoint(from: LngLat, to: LngLat, route?: LngLat[] | null) {
  const air = haversineMeters(from, to);
  if (!route || route.length < 2) return air * 1.28;
  const along = remainingAlongPolyline(route, from);
  if (air > 0 && along > air * 2.2) return air * 1.28;
  return along;
}

export function nearCotonou(lng: number, lat: number) {
  return Math.abs(lng - cotonouMap.home[0]) < 1.5 && Math.abs(lat - cotonouMap.home[1]) < 1.5;
}

/** Position carte si le GPS navigateur n’est pas à Cotonou (dev). */
export const courierMapFallback: LngLat = [cotonouMap.store[0] - 0.014, cotonouMap.store[1] - 0.01];
