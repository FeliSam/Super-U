import type { ImageSourcePropType } from 'react-native';
import { Asset } from 'expo-asset';

/**
 * Fonds de tuiles « Tous les rayons ».
 * Fichiers : `marche-dore/assets/images/catalog/cat-*.png|jpg`
 * (bundlés via require — pas d’URL API).
 *
 * Préférer les .jpg quand dispo : les PNG cat-* font ~1.2 Mo et
 * saturent souvent le décodeur iOS / Expo Go.
 */
export const CATEGORY_LOCAL_ART: Record<string, ImageSourcePropType> = {
  'fruits-legumes': require('../assets/images/catalog/cat-fruits.jpg'),
  viandes: require('../assets/images/catalog/cat-viandes.png'),
  charcuterie: require('../assets/images/catalog/cat-viandes.png'),
  poissons: require('../assets/images/catalog/cat-poissons.png'),
  surgeles: require('../assets/images/catalog/cat-glaces.png'),
  laitiers: require('../assets/images/catalog/cat-laitiers.png'),
  oeufs: require('../assets/images/catalog/poulet.png'),
  boulangerie: require('../assets/images/catalog/cat-boulangerie.png'),
  'petit-dej': require('../assets/images/catalog/miel.png'),
  'cafe-the': require('../assets/images/catalog/glace-cafe.png'),
  feculents: require('../assets/images/catalog/cuisine-riz.png'),
  huiles: require('../assets/images/catalog/cat-epicerie.png'),
  epices: require('../assets/images/catalog/circle-epices.png'),
  conserves: require('../assets/images/catalog/cat-poissons.png'),
  epicerie: require('../assets/images/catalog/cat-epicerie.png'),
  snacking: require('../assets/images/catalog/plantains.png'),
  boissons: require('../assets/images/catalog/cat-boissons.png'),
  alcools: require('../assets/images/catalog/cat-boissons.png'),
  bio: require('../assets/images/catalog/cat-fruits.jpg'),
  cuisine: require('../assets/images/catalog/cat-cuisine.jpg'),
  glaces: require('../assets/images/catalog/cat-glaces.png'),
  hygiene: require('../assets/images/catalog/cat-hygiene.png'),
  maison: require('../assets/images/catalog/cat-maison.png'),
  bebe: require('../assets/images/catalog/cat-bebe.png'),
  animalerie: require('../assets/images/catalog/cat-maison.png'),
};

/** Grille en sixièmes : 2/6 · 3/6 · 4/6 · 5/6 (pas de 1/6 — trop étroit). */
export const RAYON_SPAN_TOTAL = 6;
export type RayonSpan = 2 | 3 | 4 | 5;

const SPAN_PATTERN: RayonSpan[] = [2, 4, 3, 3, 4, 2, 3, 3, 2, 4, 3, 3, 2, 4];

export function categoryLocalArt(categoryId: string): ImageSourcePropType {
  return CATEGORY_LOCAL_ART[categoryId] ?? require('../assets/images/catalog/cat-epicerie.png');
}

export function pinExploreCategoriesLocalArt(
  categories: { id: string; image: ImageSourcePropType }[],
) {
  for (const cat of categories) {
    cat.image = categoryLocalArt(cat.id);
  }
}

export function rayonSpanFor(_categoryId: string, index: number): RayonSpan {
  return SPAN_PATTERN[Math.abs(index) % SPAN_PATTERN.length]!;
}

/** Empile les rayons en lignes dont les spans somment à 6. */
export function packRayonRowsBySpan<T extends { id: string }>(
  items: T[],
): { row: T[]; spans: RayonSpan[] }[] {
  const out: { row: T[]; spans: RayonSpan[] }[] = [];
  let row: T[] = [];
  let spans: RayonSpan[] = [];
  let used = 0;

  items.forEach((item, index) => {
    let span = rayonSpanFor(item.id, index);
    if (used + span > RAYON_SPAN_TOTAL) {
      if (row.length) {
        out.push({ row, spans });
        row = [];
        spans = [];
        used = 0;
      }
      if (span > RAYON_SPAN_TOTAL) span = 5;
    }
    row.push(item);
    spans.push(span);
    used += span;
    if (used === RAYON_SPAN_TOTAL) {
      out.push({ row, spans });
      row = [];
      spans = [];
      used = 0;
    }
  });

  if (row.length) {
    const remain = RAYON_SPAN_TOTAL - used;
    if (remain > 0 && spans.length) {
      const last = spans[spans.length - 1]!;
      spans[spans.length - 1] = Math.min(5, Math.max(2, last + remain)) as RayonSpan;
    }
    out.push({ row, spans });
  }

  return out;
}

export const RAYON_GRID_COLS = RAYON_SPAN_TOTAL;

let downloadPromise: Promise<void> | null = null;

/** Précharge les modules bundlés (garde le require numérique — ne pas forcer d’URI HTTP). */
export function downloadCategoryLocalArt(): Promise<void> {
  if (!downloadPromise) {
    downloadPromise = (async () => {
      const modules = [
        ...new Set(
          Object.values(CATEGORY_LOCAL_ART).filter((s): s is number => typeof s === 'number'),
        ),
      ];
      await Asset.loadAsync(modules).catch(() => undefined);
    })();
  }
  return downloadPromise;
}
