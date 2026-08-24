import { ImageSourcePropType } from 'react-native';

export type Review = {
  id: string;
  productId: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verified?: boolean;
  images?: ImageSourcePropType[];
};

export type RatingSummary = {
  average: number;
  total: number;
  counts: [number, number, number, number, number];
};

const catalogReviews: Review[] = [
  {
    id: 'bananes-1',
    productId: 'bananes',
    author: 'Fatou D.',
    rating: 5,
    date: '12 août 2026',
    comment: 'Bananes bien mûres, goût sucré et texture parfaite pour les beignets du dimanche.',
    verified: true,
    images: [require('../assets/images/catalog/bananes.png')],
  },
  {
    id: 'bananes-2',
    productId: 'bananes',
    author: 'Moussa K.',
    rating: 5,
    date: '3 août 2026',
    comment: 'Livraison rapide, régime complet et sans taches. Je recommande.',
    verified: true,
    images: [
      require('../assets/images/catalog/bananes.png'),
      require('../assets/images/catalog/plantains.png'),
    ],
  },
  {
    id: 'bananes-3',
    productId: 'bananes',
    author: 'Aïssatou N.',
    rating: 4,
    date: '28 juil. 2026',
    comment: 'Très bon rapport qualité-prix. Quelques bananes un peu plus vertes mais elles mûrissent bien.',
    verified: true,
  },
  {
    id: 'bananes-4',
    productId: 'bananes',
    author: 'Ibrahima S.',
    rating: 5,
    date: '20 juil. 2026',
    comment: 'Comme au marché de Sandaga, mais livré à domicile. Parfait.',
    verified: false,
  },
  {
    id: 'mangues-1',
    productId: 'mangues',
    author: 'Amina B.',
    rating: 5,
    date: '15 août 2026',
    comment: 'Chair fondante, très juteuse. Les enfants adorent.',
    verified: true,
    images: [require('../assets/images/catalog/mangues-card.png')],
  },
  {
    id: 'mangues-2',
    productId: 'mangues',
    author: 'Cheikh T.',
    rating: 5,
    date: '8 août 2026',
    comment: 'Mangues Kent authentiques, parfum incroyable. Meilleur achat de la semaine.',
    verified: true,
  },
  {
    id: 'mangues-3',
    productId: 'mangues',
    author: 'Mariama L.',
    rating: 4,
    date: '1 août 2026',
    comment: 'Belles pièces, bien calibrées. Une mangue légèrement abîmée mais le reste impeccable.',
    verified: true,
  },
  {
    id: 'tomates-1',
    productId: 'tomates',
    author: 'Ousmane F.',
    rating: 5,
    date: '10 août 2026',
    comment: 'Tomates fermes et bien rouges, idéales pour la sauce et la salade.',
    verified: true,
    images: [require('../assets/images/catalog/tomates.png')],
  },
  {
    id: 'tomates-2',
    productId: 'tomates',
    author: 'Rokhaya M.',
    rating: 4,
    date: '5 août 2026',
    comment: 'Fraîches et locales. Bon goût, livraison soignée.',
    verified: false,
  },
  {
    id: 'poulet-1',
    productId: 'poulet',
    author: 'Abdoulaye W.',
    rating: 5,
    date: '14 août 2026',
    comment: 'Poulet bien nettoyé, bon poids. Parfait pour le thiéboudienne.',
    verified: true,
  },
  {
    id: 'poulet-2',
    productId: 'poulet',
    author: 'Coumba D.',
    rating: 4,
    date: '6 août 2026',
    comment: 'Viande tendre, bien emballée sous vide. Cuisson uniforme.',
    verified: true,
  },
];

const fallbackAuthors = ['Fatou D.', 'Moussa K.', 'Aïssatou N.', 'Ibrahima S.', 'Mariama L.'];
const fallbackComments = [
  'Produit frais, conforme à la description. Je rachèterai.',
  'Bonne qualité et livraison dans les temps. Satisfait.',
  'Très bon rapport qualité-prix pour un produit local.',
  'Emballage soigné, produit arrivé en excellent état.',
  'Goût authentique, comme au marché du quartier.',
];

export function catalogReviewsForProduct(productId: string): Review[] {
  const specific = catalogReviews.filter((r) => r.productId === productId);
  if (specific.length > 0) return specific;

  return fallbackAuthors.map((author, index) => ({
    id: `${productId}-fb-${index}`,
    productId,
    author,
    rating: index === 0 ? 5 : index === 4 ? 4 : 5,
    date: `${18 - index} août 2026`,
    comment: fallbackComments[index],
    verified: index < 3,
  }));
}

export function buildRatingSummary(reviews: Review[], fallbackAverage = 4.8): RatingSummary {
  if (reviews.length === 0) {
    return { average: fallbackAverage, total: 0, counts: [0, 0, 0, 0, 0] };
  }

  const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const review of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(review.rating)));
    counts[star - 1] += 1;
    sum += review.rating;
  }

  return {
    average: Math.round((sum / reviews.length) * 10) / 10,
    total: reviews.length,
    counts,
  };
}
