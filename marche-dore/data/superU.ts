import type { LngLat } from '@/constants/map';

/** Super U / U Express locations — Cotonou & Abomey-Calavi (Bénin). */
export type SuperUCity = 'cotonou' | 'calavi';

export type SuperUFormat = 'super_u' | 'u_express';

export type SuperUStore = {
  id: string;
  name: string;
  format: SuperUFormat;
  city: SuperUCity;
  cityLabel: string;
  /** Street / landmark line */
  address: string;
  /** Full human-readable line */
  fullAddress: string;
  phone?: string;
  /** [longitude, latitude] — MapLibre / GeoJSON order */
  coordinate: LngLat;
  /** Surface indicative (m²) when known */
  areaM2?: number;
  hours?: string;
};

/**
 * Magasins Erevan Benin (franchise Super U).
 * Coordonnées OSM / Nominatim — vérifiées 2026.
 */
export const SUPER_U_STORES: SuperUStore[] = [
  {
    id: 'su-aeroport',
    name: 'Super U Aéroport',
    format: 'super_u',
    city: 'cotonou',
    cityLabel: 'Cotonou',
    address: 'Centre commercial Erevan · Cadjehoun',
    fullAddress: 'Centre commercial Erevan, Cadjehoun, Cotonou, Bénin',
    phone: '+229 02 21 30 84 40',
    coordinate: [2.386957, 6.349016],
    areaM2: 4000,
    hours: 'Lun–Jeu 09:00–21:30 · Ven–Sam 09:00–21:00 · Dim 09:00–14:00',
  },
  {
    id: 'su-akpakpa',
    name: 'Super U Akpakpa',
    format: 'super_u',
    city: 'cotonou',
    cityLabel: 'Cotonou',
    address: 'RNIE 1 · PK3, route de Porto-Novo',
    fullAddress: 'RNIE 1, PK3 (Finagnon), Cotonou, Bénin',
    phone: '+229 02 21 33 05 66',
    coordinate: [2.46513, 6.367456],
    areaM2: 1200,
    hours: 'Lun–Jeu 09:00–20:30 · Ven–Sam 09:00–21:00 · Dim 09:00–14:00',
  },
  {
    id: 'su-ganhi',
    name: 'U Express Ganhi',
    format: 'u_express',
    city: 'cotonou',
    cityLabel: 'Cotonou',
    address: 'Avenue du Gouverneur Gal Clozel, Ganhi',
    fullAddress: 'Avenue du Gouverneur Gal Clozel, Ganhi, Cotonou, Bénin',
    coordinate: [2.437258, 6.354959],
    hours: 'Ouvert tous les jours',
  },
  {
    id: 'su-calavi',
    name: 'Super U Calavi',
    format: 'super_u',
    city: 'calavi',
    cityLabel: 'Abomey-Calavi',
    address: 'Route principale d’Akassato',
    fullAddress: 'RNIE 2, Akassato (Zoca), Abomey-Calavi, Bénin',
    coordinate: [2.359687, 6.489675],
    areaM2: 2000,
    hours: 'Ouvert tous les jours',
  },
];

export const SUPER_U_BRAND = {
  /** Classic Super U red for map pins */
  red: '#e30613',
  redDeep: '#b8050f',
  ink: '#ffffff',
} as const;
