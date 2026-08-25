/** Default market geography — Marché Doré targets Benin first (Cotonou). */
export const appLocation = {
  city: 'Cotonou',
  district: 'Ganhi',
  country: 'Bénin',
  /** Short label for hero / profile chips */
  shortLabel: 'Cotonou, Ganhi',
  /** Default delivery street line */
  defaultLine: 'Rue 12, Ganhi',
  fullAddress: 'Rue 12, Ganhi, Cotonou',
  countryLine: 'Cotonou · Bénin',
  footerLine: 'Cotonou, Bénin',
  /** Approx. Ganhi — used by MapLibre delivery map */
  latitude: 6.3604,
  longitude: 2.4178,
  phone: '+229 97 12 34 56',
  phoneDigits: '+229971234567',
  supportLandline: '+229 21 00 00 00',
  supportMobile: '+229 97 00 00 00',
} as const;
