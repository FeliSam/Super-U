import { ImageSourcePropType } from 'react-native';

export type Product = {
  id: string;
  name: string;
  unit: string;
  price: number;
  oldPrice?: number;
  discount?: string;
  image: ImageSourcePropType;
  categoryId: string;
  producer?: string;
  description?: string;
  inStock?: boolean;
  rating?: number;
  reviews?: number;
};

export type ExploreCategory = {
  id: string;
  title: string;
  image: ImageSourcePropType;
  flex: number;
  height: number;
};

export const products: Product[] = [
  {
    id: 'tomates',
    name: 'Tomates Rondes',
    unit: '1 kg',
    price: 1200,
    image: require('../assets/images/catalog/tomates.png'),
    categoryId: 'fruits-legumes',
    producer: 'Ferme du Soleil',
  },
  {
    id: 'bananes',
    name: 'Bananes Douces',
    unit: '1 régime',
    price: 800,
    oldPrice: 1000,
    discount: '-20%',
    image: require('../assets/images/catalog/bananes.png'),
    categoryId: 'fruits-legumes',
    rating: 4.7,
    reviews: 98,
  },
  {
    id: 'gingembre',
    name: 'Gingembre Frais',
    unit: '500 g',
    price: 1500,
    image: require('../assets/images/catalog/gingembre.png'),
    categoryId: 'epicerie',
  },
  {
    id: 'poulet',
    name: 'Poulet Entier',
    unit: '1.2 kg',
    price: 3500,
    image: require('../assets/images/catalog/poulet.png'),
    categoryId: 'viandes',
  },
  {
    id: 'miel',
    name: 'Miel Pur du Sénégal',
    unit: '500 ml',
    price: 4000,
    image: require('../assets/images/catalog/miel.png'),
    categoryId: 'epicerie',
  },
  {
    id: 'mangues',
    name: 'Mangues Kent Premium',
    unit: '1 kg',
    price: 2500,
    oldPrice: 3200,
    discount: '-22%',
    image: require('../assets/images/catalog/mangues-card.png'),
    categoryId: 'fruits-legumes',
    producer: 'Ferme du Soleil',
    description:
      'La mangue Kent est réputée pour sa chair fondante, extrêmement juteuse et totalement dépourvue de fibres. Cultivée avec passion sous le soleil de Casamance.',
    inStock: true,
    rating: 4.8,
    reviews: 120,
  },
  {
    id: 'gombo',
    name: 'Gombo Frais',
    unit: '500 g',
    price: 800,
    image: require('../assets/images/catalog/gombo.png'),
    categoryId: 'fruits-legumes',
  },
  {
    id: 'patates',
    name: 'Patates Douces',
    unit: '1 kg',
    price: 1100,
    image: require('../assets/images/catalog/patates.png'),
    categoryId: 'fruits-legumes',
  },
  {
    id: 'plantains',
    name: 'Bananes Plantains',
    unit: '1 kg',
    price: 1300,
    image: require('../assets/images/catalog/plantains.png'),
    categoryId: 'fruits-legumes',
  },
  {
    id: 'carottes',
    name: 'Carottes Fraîches',
    unit: '1 kg',
    price: 900,
    oldPrice: 1060,
    discount: '-15%',
    image: require('../assets/images/catalog/carottes.png'),
    categoryId: 'fruits-legumes',
  },
  {
    id: 'pommes',
    name: 'Pommes Vertes',
    unit: '500 g',
    price: 1200,
    image: require('../assets/images/catalog/pommes.png'),
    categoryId: 'fruits-legumes',
  },
  {
    id: 'papaye',
    name: 'Papaye Solo',
    unit: '1 pièce',
    price: 1800,
    image: require('../assets/images/catalog/papaye.png'),
    categoryId: 'fruits-legumes',
  },
  {
    id: 'ananas',
    name: 'Ananas Pain de Sucre',
    unit: '1 pièce',
    price: 1400,
    image: require('../assets/images/catalog/ananas.png'),
    categoryId: 'fruits-legumes',
  },
  {
    id: 'lait',
    name: 'Lait Frais Local',
    unit: '1 L',
    price: 800,
    image: require('../assets/images/catalog/cart-lait.png'),
    categoryId: 'laitiers',
  },
  {
    id: 'poulet-fermier',
    name: 'Poulet Fermier Entier',
    unit: '1.2 kg',
    price: 4500,
    image: require('../assets/images/catalog/cart-poulet.png'),
    categoryId: 'viandes',
  },
  {
    id: 'bissap',
    name: 'Bissap Maison',
    unit: '1 L',
    price: 1200,
    image: require('../assets/images/catalog/promo-boissons.png'),
    categoryId: 'boissons',
    producer: 'Teranga Drinks',
  },
  {
    id: 'jus-mangue',
    name: 'Jus de Mangue',
    unit: '1 L',
    price: 1800,
    oldPrice: 2100,
    discount: '-14%',
    image: require('../assets/images/catalog/mangues-card.png'),
    categoryId: 'boissons',
  },
  {
    id: 'eau-minerale',
    name: 'Eau Minérale',
    unit: '1.5 L',
    price: 500,
    image: require('../assets/images/catalog/cat-boissons.png'),
    categoryId: 'boissons',
  },
  {
    id: 'bouye',
    name: 'Jus de Bouye',
    unit: '1 L',
    price: 1500,
    image: require('../assets/images/catalog/promo-boissons.png'),
    categoryId: 'boissons',
    producer: 'Casamance',
  },
  {
    id: 'cola-local',
    name: 'Cola Local',
    unit: '33 cl',
    price: 600,
    image: require('../assets/images/catalog/cat-boissons.png'),
    categoryId: 'boissons',
  },
  {
    id: 'bissap-gingembre',
    name: 'Bissap Gingembre',
    unit: '1 L',
    price: 1400,
    oldPrice: 1600,
    discount: '-12%',
    image: require('../assets/images/catalog/gingembre.png'),
    categoryId: 'boissons',
  },
  {
    id: 'capitaine',
    name: 'Capitaine Frais',
    unit: '1 kg',
    price: 2800,
    image: require('../assets/images/catalog/cat-poissons.png'),
    categoryId: 'poissons',
    producer: 'Pêche Artisanale',
  },
  {
    id: 'dorade',
    name: 'Dorade Royale',
    unit: '800 g',
    price: 3200,
    oldPrice: 3800,
    discount: '-16%',
    image: require('../assets/images/catalog/cat-poissons.png'),
    categoryId: 'poissons',
  },
  {
    id: 'crevettes',
    name: 'Crevettes Roses',
    unit: '500 g',
    price: 4500,
    image: require('../assets/images/catalog/cat-poissons.png'),
    categoryId: 'poissons',
  },
  {
    id: 'sardines',
    name: 'Sardines Fraîches',
    unit: '1 kg',
    price: 1800,
    image: require('../assets/images/catalog/cat-poissons.png'),
    categoryId: 'poissons',
  },
  {
    id: 'yaourt',
    name: 'Yaourt Nature',
    unit: '4 × 125 g',
    price: 1200,
    image: require('../assets/images/catalog/cat-laitiers.png'),
    categoryId: 'laitiers',
  },
  {
    id: 'fromage',
    name: 'Fromage Frais',
    unit: '250 g',
    price: 2200,
    image: require('../assets/images/catalog/cat-laitiers.png'),
    categoryId: 'laitiers',
  },
];

export const popularIds = ['tomates', 'bananes', 'gingembre'];
export const recommendedIds = [
  'poulet',
  'miel',
  'mangues',
  'lait',
  'carottes',
  'ananas',
  'plantains',
  'gingembre',
];
function isFruitProduct(p: Product) {
  return /mangue|banane|pomme|papaye|ananas|plantain/i.test(p.name);
}

function isLegumeProduct(p: Product) {
  return /tomate|gombo|patate|carotte|gingembre/i.test(p.name);
}

export function similarProducts(productId: string, limit = 6) {
  const product = getProduct(productId);
  if (!product) return [];

  let pool = products.filter((p) => p.id !== productId && p.categoryId === product.categoryId);

  if (product.categoryId === 'fruits-legumes') {
    if (isFruitProduct(product)) {
      pool = pool.filter(isFruitProduct);
    } else if (isLegumeProduct(product)) {
      pool = pool.filter(isLegumeProduct);
    }
  }

  if (pool.length < limit) {
    const seen = new Set(pool.map((p) => p.id));
    for (const p of products) {
      if (p.id === productId || seen.has(p.id)) continue;
      if (p.categoryId !== product.categoryId) continue;
      pool.push(p);
      seen.add(p.id);
      if (pool.length >= limit) break;
    }
  }

  if (pool.length < 2) {
    pool = products.filter((p) => p.id !== productId);
  }

  return pool.slice(0, limit);
}

export function discoverProducts(productId: string, limit = 8) {
  const exclude = new Set([productId, ...similarProducts(productId).map((p) => p.id)]);
  const pool = products.filter((p) => !exclude.has(p.id));
  return shuffleProducts(pool).slice(0, limit);
}

export const chips = [
  { id: 'fruits', label: 'Fruits', emoji: '🥭', categoryId: 'fruits-legumes', filter: 'Fruits' },
  { id: 'legumes', label: 'Légumes', emoji: '🥬', categoryId: 'fruits-legumes', filter: 'Légumes' },
  { id: 'viandes', label: 'Viandes', emoji: '🥩', categoryId: 'viandes' },
  { id: 'poissons', label: 'Poissons', emoji: '🐟', categoryId: 'poissons' },
  { id: 'laitiers', label: 'Laitiers', emoji: '🧀', categoryId: 'laitiers' },
  { id: 'boissons', label: 'Boissons', emoji: '🥤', categoryId: 'boissons' },
] as const;

export type HomeChip = (typeof chips)[number];

export function chipRoute(chip: HomeChip) {
  const filter = 'filter' in chip ? chip.filter : undefined;
  return filter
    ? (`/category/${chip.categoryId}?filter=${encodeURIComponent(filter)}` as const)
    : (`/category/${chip.categoryId}` as const);
}

function filterProductsByLabel(list: Product[], filter?: string) {
  if (!filter) return list;
  if (filter === 'Fruits') {
    return list.filter((p) => /mangue|banane|pomme|papaye|ananas|plantain/i.test(p.name));
  }
  if (filter === 'Légumes') {
    return list.filter((p) => /tomate|gombo|patate|carotte|gingembre/i.test(p.name));
  }
  return list;
}

export function productsForChip(chipId: string) {
  const chip = chips.find((c) => c.id === chipId);
  if (!chip) return getProducts(popularIds);
  const base = productsInCategory(chip.categoryId);
  const pool = base.length ? base : products;
  const filtered = filterProductsByLabel(pool, 'filter' in chip ? chip.filter : undefined);
  return (filtered.length ? filtered : pool).slice(0, 8);
}

const homeCategoryImages: Record<HomeChip['id'], ImageSourcePropType> = {
  fruits: require('../assets/images/catalog/circle-fruits.png'),
  legumes: require('../assets/images/catalog/circle-legumes.png'),
  viandes: require('../assets/images/catalog/cat-viandes.png'),
  poissons: require('../assets/images/catalog/circle-poissons.png'),
  laitiers: require('../assets/images/catalog/cat-laitiers.png'),
  boissons: require('../assets/images/catalog/cat-boissons.png'),
};

export const homeCategories = chips.map((chip) => ({
  ...chip,
  image: homeCategoryImages[chip.id],
}));

export const exploreCategories: ExploreCategory[] = [
  { id: 'fruits-legumes', title: 'Fruits & Légumes', image: require('../assets/images/catalog/cat-fruits.png'), flex: 208, height: 140 },
  { id: 'viandes', title: 'Viandes & Volailles', image: require('../assets/images/catalog/cat-viandes.png'), flex: 138, height: 140 },
  { id: 'poissons', title: 'Poissons & Fruits de mer', image: require('../assets/images/catalog/cat-poissons.png'), flex: 138, height: 120 },
  { id: 'laitiers', title: 'Produits laitiers', image: require('../assets/images/catalog/cat-laitiers.png'), flex: 208, height: 120 },
  { id: 'boissons', title: 'Boissons', image: require('../assets/images/catalog/cat-boissons.png'), flex: 208, height: 130 },
  { id: 'boulangerie', title: 'Boulangerie & Pâtisserie', image: require('../assets/images/catalog/cat-boulangerie.png'), flex: 138, height: 130 },
  { id: 'epicerie', title: 'Épicerie', image: require('../assets/images/catalog/cat-epicerie.png'), flex: 138, height: 120 },
  { id: 'hygiene', title: 'Hygiène & Beauté', image: require('../assets/images/catalog/cat-hygiene.png'), flex: 208, height: 120 },
  { id: 'maison', title: 'Maison & Entretien', image: require('../assets/images/catalog/cat-maison.png'), flex: 208, height: 130 },
  { id: 'bebe', title: 'Bébé & Enfant', image: require('../assets/images/catalog/cat-bebe.png'), flex: 138, height: 130 },
];

export const categoryFilters: Record<string, string[]> = {
  'fruits-legumes': ['Tous', 'Fruits', 'Légumes', 'Bio', 'Locaux'],
};

export const popularSuggestions = ['Bissap', 'Plantain', 'Manioc', 'Café', 'Avocat', 'Épices'];

export const recentSearchesDefault = ['Mangues', 'Lait frais', 'Poulet', 'Riz basmati'];

export const searchCategories = [
  { id: 'fruits-legumes', label: 'Fruits', image: require('../assets/images/catalog/circle-fruits.png') },
  { id: 'fruits-legumes', label: 'Légumes', image: require('../assets/images/catalog/circle-legumes.png') },
  { id: 'poissons', label: 'Poissons', image: require('../assets/images/catalog/circle-poissons.png') },
  { id: 'epicerie', label: 'Épices', image: require('../assets/images/catalog/circle-epices.png') },
] as const;

export type SearchCategory = (typeof searchCategories)[number];

export function searchCategoryRoute(cat: SearchCategory) {
  const withFilter = cat.id === 'fruits-legumes' ? `?filter=${encodeURIComponent(cat.label)}` : '';
  return `/category/${cat.id}${withFilter}` as const;
}

export function productsForSearchCategory(label: string) {
  const cat = searchCategories.find((c) => c.label === label);
  if (!cat) return getProducts(popularIds);
  const base = productsInCategory(cat.id);
  const pool = base.length ? base : products;
  const filtered = filterProductsByLabel(pool, cat.label === 'Épices' ? undefined : cat.label);
  if (cat.label === 'Épices') {
    return pool.filter((p) => p.categoryId === 'epicerie').slice(0, 8);
  }
  return (filtered.length ? filtered : pool).slice(0, 8);
}

export function getProduct(id: string) {
  return products.find((p) => p.id === id);
}

export function productReviewStats(product: Pick<Product, 'id' | 'rating' | 'reviews'>) {
  if (product.rating != null && product.reviews != null) {
    return { rating: product.rating, reviews: product.reviews };
  }
  let seed = 0;
  for (const char of product.id) seed += char.charCodeAt(0);
  return {
    rating: Math.round((4.2 + (seed % 7) * 0.1) * 10) / 10,
    reviews: 24 + (seed % 156),
  };
}

export function getProducts(ids: string[]) {
  return ids.map(getProduct).filter(Boolean) as Product[];
}

export function productsInCategory(categoryId: string) {
  return products.filter((p) => p.categoryId === categoryId);
}

export function promoProducts() {
  return products.filter((p) => Boolean(p.discount || p.oldPrice));
}

export function shuffleProducts<T>(list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type SearchSort = 'price-asc' | 'price-desc' | 'rating';

export type SearchOptions = {
  sort?: SearchSort;
  inStockOnly?: boolean;
  promoOnly?: boolean;
};

export function searchProducts(query: string, options: SearchOptions = {}) {
  const q = query.trim().toLowerCase();
  let list = products;

  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.producer?.toLowerCase().includes(q) ||
        p.unit.toLowerCase().includes(q) ||
        p.categoryId.toLowerCase().includes(q),
    );
  }

  if (options.inStockOnly) {
    list = list.filter((p) => p.inStock !== false);
  }

  if (options.promoOnly) {
    list = list.filter((p) => Boolean(p.discount || p.oldPrice));
  }

  if (options.sort === 'price-asc') {
    list = [...list].sort((a, b) => a.price - b.price);
  } else if (options.sort === 'price-desc') {
    list = [...list].sort((a, b) => b.price - a.price);
  } else if (options.sort === 'rating') {
    list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  return list;
}

export function searchSuggestions(query: string, recents: string[] = [], limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const fromRecents = recents.filter((term) => term.toLowerCase().includes(q));
  const fromPopular = popularSuggestions.filter((term) => term.toLowerCase().includes(q));
  const fromProducts = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.producer?.toLowerCase().includes(q) ||
        p.categoryId.toLowerCase().includes(q),
    )
    .map((p) => p.name);

  return [...new Set([...fromRecents, ...fromPopular, ...fromProducts])].slice(0, limit);
}

export const mangoHero = require('../assets/images/catalog/mango-hero.png');
export const promoBanner = require('../assets/images/catalog/promo.png');
export const promoRentreeBanner = require('../assets/images/catalog/promo-rentree.png');
export const promoBoissonsBanner = require('../assets/images/catalog/promo-boissons.png');
export const avatar = require('../assets/images/catalog/avatar.png');

/** Product image gallery (main + extras from same category / catalog). */
export function productGallery(product: Product, maxExtras = 2): ImageSourcePropType[] {
  const main = product.id === 'mangues' ? mangoHero : product.image;
  const extras: ImageSourcePropType[] = [];
  const sameCat = products.filter((p) => p.id !== product.id && p.categoryId === product.categoryId);
  for (const p of sameCat) {
    if (extras.length >= maxExtras) break;
    if (p.image === main) continue;
    extras.push(p.image);
  }
  for (const p of products) {
    if (extras.length >= maxExtras) break;
    if (p.id === product.id) continue;
    if (extras.includes(p.image) || p.image === main) continue;
    extras.push(p.image);
  }
  return [main, ...extras];
}

export type HomePromoBanner = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  image: ImageSourcePropType;
  href: `/category/${string}` | `/category/${string}?filter=${string}`;
};

export const homePromoBanners: HomePromoBanner[] = [
  {
    id: 'semaine',
    title: 'Offres de la semaine',
    subtitle: '-30% sur les fruits frais',
    cta: 'Profiter',
    image: promoBanner,
    href: '/category/fruits-legumes?filter=Fruits',
  },
  {
    id: 'rentree',
    title: 'La rentrée',
    subtitle: 'Goûters, fournitures & essentiels',
    cta: 'Préparer',
    image: promoRentreeBanner,
    href: '/category/bebe',
  },
  {
    id: 'boissons',
    title: 'Boissons fraîches',
    subtitle: '-15% sur les jus & sodas',
    cta: 'Découvrir',
    image: promoBoissonsBanner,
    href: '/category/boissons',
  },
];
