import type { ImageRequireSource } from 'react-native';

export type TasteOption = {
  id: string;
  label: string;
  categoryIds: string[];
  chipId: string;
  image: ImageRequireSource;
};

/** Choix onboarding — ids stables, mappés vers le catalogue. */
export const TASTE_OPTIONS: TasteOption[] = [
  {
    id: 'fruits',
    label: 'Fruits & légumes',
    categoryIds: ['fruits-legumes'],
    chipId: 'fruits',
    image: require('../assets/images/catalog/cat-fruits.jpg'),
  },
  {
    id: 'cuisine',
    label: 'Cuisine prête',
    categoryIds: ['cuisine'],
    chipId: 'cuisine',
    image: require('../assets/images/catalog/cuisine-poulet-roti.png'),
  },
  {
    id: 'glaces',
    label: 'Glaces',
    categoryIds: ['glaces'],
    chipId: 'glaces',
    image: require('../assets/images/catalog/cat-glaces.png'),
  },
  {
    id: 'epicerie',
    label: 'Épicerie',
    categoryIds: ['epicerie', 'feculents', 'epices', 'huiles'],
    chipId: 'feculents',
    image: require('../assets/images/catalog/cat-epicerie.png'),
  },
  {
    id: 'boissons',
    label: 'Boissons',
    categoryIds: ['boissons'],
    chipId: 'boissons',
    image: require('../assets/images/catalog/promo-boissons.png'),
  },
  {
    id: 'bebe',
    label: 'Bébé',
    categoryIds: ['bebe'],
    chipId: 'petit-dej',
    image: require('../assets/images/catalog/cat-bebe.png'),
  },
];

export function expandInterestCategoryIds(interests: string[]): string[] {
  const out = new Set<string>();
  for (const id of interests) {
    const opt = TASTE_OPTIONS.find((o) => o.id === id);
    if (opt) {
      for (const cat of opt.categoryIds) out.add(cat);
    } else if (id) {
      out.add(id);
    }
  }
  return [...out];
}

export function primaryChipId(interests: string[]): string | null {
  const first = interests.find(Boolean);
  if (!first) return null;
  return TASTE_OPTIONS.find((o) => o.id === first)?.chipId ?? first;
}

export function interestLabels(interests: string[]): string[] {
  return interests
    .map((id) => TASTE_OPTIONS.find((o) => o.id === id)?.label)
    .filter((x): x is string => Boolean(x));
}
