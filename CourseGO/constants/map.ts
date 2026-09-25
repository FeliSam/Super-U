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

/**
 * Tracé restant depuis la position livreur — efface le chemin déjà parcouru.
 * Projette sur le segment le plus proche pour éviter une ligne droite parasite.
 */
export function remainingRouteCoordinates(route: LngLat[], from: LngLat): LngLat[] {
  if (route.length < 2) return route.slice();

  let bestI = 0;
  let bestT = 0;
  let bestD = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!;
    const b = route[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((from[0] - a[0]) * dx + (from[1] - a[1]) * dy) / len2)) : 0;
    const proj: LngLat = [a[0] + dx * t, a[1] + dy * t];
    const d = haversineMeters(from, proj);
    if (d < bestD) {
      bestD = d;
      bestI = i;
      bestT = t;
    }
  }

  const onSeg: LngLat =
    bestT > 0.02
      ? [
          route[bestI]![0] + (route[bestI + 1]![0] - route[bestI]![0]) * bestT,
          route[bestI]![1] + (route[bestI + 1]![1] - route[bestI]![1]) * bestT,
        ]
      : route[bestI]!;

  let startIdx = bestT > 0.85 ? bestI + 1 : bestI;
  while (startIdx < route.length - 1 && haversineMeters(from, route[startIdx]!) < 14) startIdx += 1;

  const pts: LngLat[] = [];
  if (bestD > 80) pts.push(from);
  if (bestD <= 80 || bestT > 0.02) {
    if (!pts.length || haversineMeters(pts[0]!, onSeg) > 2) pts.push(onSeg);
  }
  for (let i = startIdx + (bestT > 0.02 ? 1 : 0); i < route.length; i++) {
    const p = route[i]!;
    const prev = pts[pts.length - 1];
    if (prev && haversineMeters(prev, p) < 1.5) continue;
    pts.push(p);
  }
  if (pts.length < 2) {
    return [from, route[route.length - 1]!];
  }
  return pts;
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
