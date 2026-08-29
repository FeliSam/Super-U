import { ImageSourcePropType } from 'react-native';
import { aisleProducts } from './aisleProducts';

export type ProductBadge = 'nouveau' | 'local' | 'rupture';

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
  badge?: ProductBadge;
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
    categoryId: 'epices',
    inStock: false,
    badge: 'rupture',
  },
  {
    id: 'poulet',
    name: 'Poulet Entier',
    unit: '1.2 kg',
    price: 3500,
    image: require('../assets/images/catalog/poulet.png'),
    categoryId: 'viandes',
    badge: 'local',
  },
  {
    id: 'miel',
    name: 'Miel Pur du Bénin',
    unit: '500 ml',
    price: 4000,
    image: require('../assets/images/catalog/miel.png'),
    categoryId: 'epicerie',
    badge: 'nouveau',
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
    inStock: false,
    badge: 'rupture',
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
  // Plats déjà cuisinés — photos de plats prêts (URI) alignées sur les noms
  {
    id: 'poulet-roti',
    name: 'Poulet Rôti Maison',
    unit: '1/2 poulet',
    price: 2800,
    oldPrice: 3200,
    discount: '-12%',
    image: require('../assets/images/catalog/cuisine-poulet-roti.png'),
    categoryId: 'cuisine',
    producer: 'Cuisine Marché Doré',
    description:
      'Demi-poulet rôti doré, assaisonné aux herbes. Prêt à réchauffer 8 min au four ou à servir tiède.',
    badge: 'nouveau',
    rating: 4.7,
    reviews: 64,
  },
  {
    id: 'frites-maison',
    name: 'Frites Maison',
    unit: '400 g',
    price: 1200,
    image: require('../assets/images/catalog/cuisine-frites.png'),
    categoryId: 'cuisine',
    producer: 'Cuisine Marché Doré',
    description:
      'Frites croustillantes cuites à la commande. Accompagnement idéal pour poulet rôti ou poisson grillé.',
    badge: 'nouveau',
    rating: 4.5,
    reviews: 56,
  },
  {
    id: 'riz-saute',
    name: 'Riz Sauté Complet',
    unit: '1 barquette',
    price: 2200,
    image: require('../assets/images/catalog/cuisine-riz.png'),
    categoryId: 'cuisine',
    producer: 'Cuisine Marché Doré',
    description:
      'Riz sauté garni de légumes et protéines, cuit le jour même. Réchauffez 3 min au micro-ondes.',
    rating: 4.5,
    reviews: 41,
  },
  {
    id: 'poisson-grille',
    name: 'Poisson Grillé Assaisonné',
    unit: '1 filet',
    price: 3500,
    image: require('../assets/images/catalog/cuisine-poisson.png'),
    categoryId: 'cuisine',
    producer: 'Cuisine Marché Doré',
    description:
      'Filet de poisson grillé, citron et épices. Plateau prêt à emporter, à servir avec attiéké ou riz.',
    badge: 'local',
    rating: 4.8,
    reviews: 52,
  },
  {
    id: 'ragout-maison',
    name: 'Ragoût de Légumes Maison',
    unit: '750 ml',
    price: 1800,
    image: require('../assets/images/catalog/cuisine-ragout.png'),
    categoryId: 'cuisine',
    producer: 'Cuisine Marché Doré',
    description:
      'Ragoût mijoté de légumes de saison, prêt à accompagner riz, pâte ou pain. Conservez au frais 48 h.',
    rating: 4.4,
    reviews: 29,
  },
  {
    id: 'poulet-pane',
    name: 'Poulet Pané Croustillant',
    unit: '1 portion',
    price: 3200,
    oldPrice: 3600,
    discount: '-11%',
    image: require('../assets/images/catalog/cuisine-poulet-pane.png'),
    categoryId: 'cuisine',
    producer: 'Cuisine Marché Doré',
    description:
      'Morceaux de poulet panés, dorés et croustillants. Prêts à réchauffer au four 10 min à 180 °C.',
    badge: 'local',
    rating: 4.9,
    reviews: 73,
  },
  // Glaces & sorbets — images locales (assets/catalog)
  {
    id: 'glace-vanille',
    name: 'Glace Vanille Bourbon',
    unit: '500 ml',
    price: 2800,
    image: require('../assets/images/catalog/glace-vanille.png'),
    categoryId: 'glaces',
    producer: 'Crèmerie Cotonou',
    description: 'Glace à la vanille bourbon, onctueuse et crémeuse. Conservez au freezer.',
    badge: 'nouveau',
    rating: 4.8,
    reviews: 112,
  },
  {
    id: 'glace-chocolat',
    name: 'Glace Chocolat Intense',
    unit: '500 ml',
    price: 2900,
    oldPrice: 3400,
    discount: '-15%',
    image: require('../assets/images/catalog/glace-chocolat.png'),
    categoryId: 'glaces',
    producer: 'Crèmerie Cotonou',
    description: 'Glace au chocolat noir 70 %, intense et fondante.',
    rating: 4.7,
    reviews: 95,
  },
  {
    id: 'glace-mangue',
    name: 'Sorbet Mangue Kent',
    unit: '500 ml',
    price: 2600,
    image: require('../assets/images/catalog/glace-assortiment.png'),
    categoryId: 'glaces',
    producer: 'Fruits Glacés Bénin',
    description: 'Sorbet 100 % mangue Kent, sans lactose. Rafraîchissant et fruité.',
    badge: 'local',
    rating: 4.9,
    reviews: 78,
  },
  {
    id: 'glace-fraise',
    name: 'Glace Fraise des Bois',
    unit: '500 ml',
    price: 2700,
    image: require('../assets/images/catalog/glace-fraise.png'),
    categoryId: 'glaces',
    producer: 'Crèmerie Cotonou',
    description: 'Glace à la fraise, parsemée de morceaux de fruits.',
    rating: 4.6,
    reviews: 64,
  },
  {
    id: 'glace-pistache',
    name: 'Glace Pistache',
    unit: '500 ml',
    price: 3200,
    image: require('../assets/images/catalog/glace-pistache.png'),
    categoryId: 'glaces',
    producer: 'Crèmerie Cotonou',
    description: 'Glace à la pistache, texture onctueuse et goût authentique.',
    badge: 'nouveau',
    rating: 4.7,
    reviews: 51,
  },
  {
    id: 'glace-coco',
    name: 'Glace Noix de Coco',
    unit: '500 ml',
    price: 2500,
    image: require('../assets/images/catalog/glace-coco.png'),
    categoryId: 'glaces',
    producer: 'Fruits Glacés Bénin',
    description: 'Glace à la noix de coco fraîche, douce et lactée.',
    badge: 'local',
    rating: 4.8,
    reviews: 89,
  },
  {
    id: 'glace-caramel',
    name: 'Glace Caramel Beurre Salé',
    unit: '500 ml',
    price: 3000,
    oldPrice: 3500,
    discount: '-14%',
    image: require('../assets/images/catalog/glace-caramel.png'),
    categoryId: 'glaces',
    producer: 'Crèmerie Cotonou',
    description: 'Glace caramel au beurre salé, avec un filet de caramel.',
    rating: 4.8,
    reviews: 70,
  },
  {
    id: 'glace-cafe',
    name: 'Glace Café Expresso',
    unit: '500 ml',
    price: 2800,
    image: require('../assets/images/catalog/glace-cafe.png'),
    categoryId: 'glaces',
    producer: 'Crèmerie Cotonou',
    description: 'Glace au café expresso, pour les amateurs d’arômes corsés.',
    rating: 4.5,
    reviews: 43,
  },
  {
    id: 'sorbet-citron',
    name: 'Sorbet Citron Vert',
    unit: '500 ml',
    price: 2400,
    image: require('../assets/images/catalog/glace-citron.png'),
    categoryId: 'glaces',
    producer: 'Fruits Glacés Bénin',
    description: 'Sorbet acidulé au citron vert, parfait après un repas épicé.',
    badge: 'local',
    rating: 4.6,
    reviews: 55,
  },
  {
    id: 'sorbet-passion',
    name: 'Sorbet Fruit de la Passion',
    unit: '500 ml',
    price: 2700,
    image: require('../assets/images/catalog/glace-cone.png'),
    categoryId: 'glaces',
    producer: 'Fruits Glacés Bénin',
    description: 'Sorbet tropical au fruit de la passion, vif et parfumé.',
    rating: 4.7,
    reviews: 48,
  },
  {
    id: 'batonnet-vanille',
    name: 'Bâtonnet Vanille Enrobé',
    unit: '4 × 80 ml',
    price: 2200,
    image: require('../assets/images/catalog/glace-batonnet.png'),
    categoryId: 'glaces',
    producer: 'Glaces Express',
    description: 'Pack de 4 bâtonnets vanille enrobés de chocolat au lait.',
    badge: 'nouveau',
    rating: 4.4,
    reviews: 132,
  },
  {
    id: 'batonnet-chocolat',
    name: 'Bâtonnet Chocolat Double',
    unit: '4 × 80 ml',
    price: 2300,
    oldPrice: 2700,
    discount: '-15%',
    image: require('../assets/images/catalog/glace-sprinkles.png'),
    categoryId: 'glaces',
    producer: 'Glaces Express',
    description: 'Bâtonnets double chocolat, cœur fondant et coque croquante.',
    rating: 4.5,
    reviews: 98,
  },
  {
    id: 'cone-mix',
    name: 'Cônes Assortiment',
    unit: '6 cônes',
    price: 3500,
    image: require('../assets/images/catalog/glace-cones-trio.png'),
    categoryId: 'glaces',
    producer: 'Glaces Express',
    description: 'Assortiment de 6 cônes : vanille, chocolat, fraise.',
    rating: 4.6,
    reviews: 81,
  },
  {
    id: 'glace-stracciatella',
    name: 'Glace Stracciatella',
    unit: '500 ml',
    price: 3100,
    image: require('../assets/images/catalog/glace-boules.png'),
    categoryId: 'glaces',
    producer: 'Crèmerie Cotonou',
    description: 'Glace vanille parsemée d’éclats de chocolat noir.',
    rating: 4.7,
    reviews: 60,
  },
  {
    id: 'glace-banane',
    name: 'Glace Banane Caramélisée',
    unit: '500 ml',
    price: 2600,
    image: require('../assets/images/catalog/glace-sundae.png'),
    categoryId: 'glaces',
    producer: 'Fruits Glacés Bénin',
    description: 'Glace à la banane caramélisée, douce et parfumée.',
    badge: 'local',
    rating: 4.5,
    reviews: 47,
  },
  {
    id: 'pot-familial',
    name: 'Pot Familial 3 Parfums',
    unit: '1 L',
    price: 4500,
    oldPrice: 5200,
    discount: '-13%',
    image: require('../assets/images/catalog/glace-assortiment.png'),
    categoryId: 'glaces',
    producer: 'Crèmerie Cotonou',
    description: 'Grand pot 1 L : vanille, chocolat et fraise. Idéal pour partager.',
    badge: 'nouveau',
    rating: 4.8,
    reviews: 104,
  },
  {
    id: 'glace-menthe',
    name: 'Glace Menthe Chocolat',
    unit: '500 ml',
    price: 2900,
    image: require('../assets/images/catalog/glace-boules.png'),
    categoryId: 'glaces',
    producer: 'Crèmerie Cotonou',
    description: 'Glace menthe fraîche avec pépites de chocolat noir.',
    rating: 4.6,
    reviews: 58,
  },
  {
    id: 'glace-cookie',
    name: 'Glace Cookie Dough',
    unit: '500 ml',
    price: 3300,
    image: require('../assets/images/catalog/glace-caramel.png'),
    categoryId: 'glaces',
    producer: 'Glaces Express',
    description: 'Glace vanille généreusement garnie de morceaux de cookie.',
    badge: 'nouveau',
    rating: 4.7,
    reviews: 91,
  },
  {
    id: 'sorbet-ananas',
    name: 'Sorbet Ananas Victoria',
    unit: '500 ml',
    price: 2500,
    image: require('../assets/images/catalog/glace-cone.png'),
    categoryId: 'glaces',
    producer: 'Fruits Glacés Bénin',
    description: 'Sorbet ananas Victoria, acidulé et très rafraîchissant.',
    badge: 'local',
    rating: 4.8,
    reviews: 66,
  },
  {
    id: 'batonnet-fruit',
    name: 'Bâtonnets Fruits Mix',
    unit: '6 × 60 ml',
    price: 2100,
    oldPrice: 2500,
    discount: '-16%',
    image: require('../assets/images/catalog/glace-fraise.png'),
    categoryId: 'glaces',
    producer: 'Glaces Express',
    description: 'Pack de 6 bâtonnets aux fruits : fraise, mangue, citron.',
    rating: 4.4,
    reviews: 77,
  },
  {
    id: 'glace-tiramisu',
    name: 'Glace Tiramisu',
    unit: '500 ml',
    price: 3400,
    image: require('../assets/images/catalog/glace-cafe.png'),
    categoryId: 'glaces',
    producer: 'Crèmerie Cotonou',
    description: 'Glace inspirée du tiramisu : café, mascarpone et cacao.',
    rating: 4.9,
    reviews: 84,
  },
  ...aisleProducts,
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
  { id: 'cuisine', label: 'Cuisinés', emoji: '🍲', categoryId: 'cuisine' },
  { id: 'glaces', label: 'Glaces', emoji: '🍦', categoryId: 'glaces' },
  { id: 'epices', label: 'Épices', emoji: '🌶️', categoryId: 'epices' },
  { id: 'feculents', label: 'Riz & farines', emoji: '🍚', categoryId: 'feculents' },
  { id: 'petit-dej', label: 'Petit-déj', emoji: '🥣', categoryId: 'petit-dej' },
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
    return list.filter((p) => /tomate|gombo|patate|carotte|gingembre|légume|legume/i.test(p.name));
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
  boissons: require('../assets/images/catalog/promo-boissons.png'),
  cuisine: require('../assets/images/catalog/cuisine-poulet-roti.png'),
  glaces: require('../assets/images/catalog/cat-glaces.png'),
  epices: require('../assets/images/catalog/circle-epices.png'),
  feculents: require('../assets/images/catalog/cuisine-riz.png'),
  'petit-dej': require('../assets/images/catalog/miel.png'),
};

/** Crop zoom inside circular chip thumbs (1 = none). Wider scenes need more. */
const homeCategoryZoom: Record<HomeChip['id'], number> = {
  fruits: 1.2,
  legumes: 1.25,
  viandes: 1.65,
  poissons: 1.3,
  laitiers: 1.45,
  boissons: 1.5,
  cuisine: 1.4,
  glaces: 1.35,
  epices: 1.4,
  feculents: 1.35,
  'petit-dej': 1.4,
};

export const homeCategories = chips.map((chip) => ({
  ...chip,
  image: homeCategoryImages[chip.id],
  imageZoom: homeCategoryZoom[chip.id],
}));

export const exploreCategories: ExploreCategory[] = [
  { id: 'fruits-legumes', title: 'Fruits & Légumes', image: require('../assets/images/catalog/cat-fruits.png'), flex: 208, height: 140 },
  { id: 'viandes', title: 'Viandes & Volailles', image: require('../assets/images/catalog/cat-viandes.png'), flex: 138, height: 140 },
  { id: 'charcuterie', title: 'Charcuterie', image: require('../assets/images/catalog/cat-viandes.png'), flex: 138, height: 120 },
  { id: 'poissons', title: 'Poissons & Fruits de mer', image: require('../assets/images/catalog/cat-poissons.png'), flex: 138, height: 120 },
  { id: 'surgeles', title: 'Surgelés', image: require('../assets/images/catalog/glace-assortiment.png'), flex: 208, height: 120 },
  { id: 'laitiers', title: 'Produits laitiers', image: require('../assets/images/catalog/cat-laitiers.png'), flex: 208, height: 120 },
  { id: 'oeufs', title: 'Œufs', image: require('../assets/images/catalog/poulet.png'), flex: 138, height: 120 },
  { id: 'boulangerie', title: 'Boulangerie & Pâtisserie', image: require('../assets/images/catalog/cat-boulangerie.png'), flex: 138, height: 130 },
  { id: 'petit-dej', title: 'Petit-déjeuner', image: require('../assets/images/catalog/miel.png'), flex: 208, height: 130 },
  { id: 'cafe-the', title: 'Café & Thé', image: require('../assets/images/catalog/glace-cafe.png'), flex: 138, height: 130 },
  { id: 'feculents', title: 'Riz, pâtes & farines', image: require('../assets/images/catalog/cuisine-riz.png'), flex: 208, height: 130 },
  { id: 'huiles', title: 'Huiles, sauces & cubes', image: require('../assets/images/catalog/cat-epicerie.png'), flex: 138, height: 120 },
  { id: 'epices', title: 'Épices', image: require('../assets/images/catalog/circle-epices.png'), flex: 138, height: 120 },
  { id: 'conserves', title: 'Conserves', image: require('../assets/images/catalog/cat-poissons.png'), flex: 208, height: 120 },
  { id: 'epicerie', title: 'Épicerie sucrée', image: require('../assets/images/catalog/cat-epicerie.png'), flex: 138, height: 120 },
  { id: 'snacking', title: 'Snacking', image: require('../assets/images/catalog/plantains.png'), flex: 208, height: 130 },
  { id: 'boissons', title: 'Boissons', image: require('../assets/images/catalog/cat-boissons.png'), flex: 208, height: 130 },
  { id: 'alcools', title: 'Bières & vins', image: require('../assets/images/catalog/cat-boissons.png'), flex: 138, height: 130 },
  { id: 'bio', title: 'Bio & diététique', image: require('../assets/images/catalog/cat-fruits.png'), flex: 208, height: 130 },
  { id: 'cuisine', title: 'Produits déjà cuisinés', image: require('../assets/images/catalog/cat-cuisine.png'), flex: 208, height: 140 },
  { id: 'glaces', title: 'Glaces & Sorbets', image: require('../assets/images/catalog/cat-glaces.png'), flex: 138, height: 140 },
  { id: 'hygiene', title: 'Hygiène & Beauté', image: require('../assets/images/catalog/cat-hygiene.png'), flex: 208, height: 120 },
  { id: 'maison', title: 'Maison & Entretien', image: require('../assets/images/catalog/cat-maison.png'), flex: 208, height: 130 },
  { id: 'bebe', title: 'Bébé & Enfant', image: require('../assets/images/catalog/cat-bebe.png'), flex: 138, height: 130 },
  { id: 'animalerie', title: 'Animalerie', image: require('../assets/images/catalog/cat-maison.png'), flex: 208, height: 130 },
];

export const categoryFilters: Record<string, string[]> = {
  'fruits-legumes': ['Tous', 'Fruits', 'Légumes', 'Promo', 'Locaux', 'Bio'],
  viandes: ['Tous', 'Promo', 'Locaux', 'Nouveautés'],
  charcuterie: ['Tous', 'Promo', 'Nouveautés'],
  poissons: ['Tous', 'Promo', 'Nouveautés'],
  surgeles: ['Tous', 'Légumes', 'Plats', 'Promo'],
  laitiers: ['Tous', 'Promo', 'Nouveautés'],
  oeufs: ['Tous', 'Promo', 'Locaux', 'Nouveautés'],
  boulangerie: ['Tous', 'Pain', 'Viennoiserie', 'Promo', 'Nouveautés'],
  'petit-dej': ['Tous', 'Promo', 'Nouveautés', 'Locaux'],
  'cafe-the': ['Tous', 'Café', 'Thé', 'Promo', 'Locaux'],
  feculents: ['Tous', 'Riz', 'Attiéké', 'Farines', 'Promo', 'Locaux'],
  huiles: ['Tous', 'Huiles', 'Sauces', 'Promo', 'Locaux'],
  epices: ['Tous', 'Promo', 'Locaux', 'Nouveautés'],
  conserves: ['Tous', 'Poisson', 'Promo'],
  epicerie: ['Tous', 'Promo', 'Locaux', 'Nouveautés'],
  snacking: ['Tous', 'Salé', 'Sucré', 'Promo', 'Locaux'],
  boissons: ['Tous', 'Promo', 'Locaux', 'Nouveautés'],
  alcools: ['Tous', 'Bière', 'Vin', 'Promo', 'Locaux'],
  bio: ['Tous', 'Promo', 'Locaux', 'Nouveautés'],
  cuisine: ['Tous', 'Promo', 'Locaux', 'Nouveautés'],
  glaces: ['Tous', 'Promo', 'Nouveautés', 'Sorbets', 'Bâtonnets'],
  hygiene: ['Tous', 'Corps', 'Oral', 'Promo'],
  maison: ['Tous', 'Entretien', 'Promo'],
  bebe: ['Tous', 'Couches', 'Repas', 'Promo', 'Nouveautés'],
  animalerie: ['Tous', 'Chien', 'Chat', 'Promo'],
};

export const popularSuggestions = ['Bissap', 'Plantain', 'Manioc', 'Café', 'Avocat', 'Épices'];

export const recentSearchesDefault = ['Mangues', 'Lait frais', 'Poulet', 'Riz basmati'];

export type TrendingSearch = {
  term: string;
  rank: number;
  heat: number;
  delta: 'up' | 'down' | 'new' | 'stable';
  matches: number;
};

/** Live-ish trending search terms derived from catalog + recents (rotates over time). */
export function trendingSearches(options: { recents?: string[]; limit?: number; tick?: number } = {}): TrendingSearch[] {
  const limit = options.limit ?? 8;
  const recents = options.recents ?? [];
  const tick = options.tick ?? Math.floor(Date.now() / 12_000);

  const seedTerms = new Map<string, number>();
  const bump = (term: string, score: number) => {
    const key = term.trim();
    if (!key || key.length < 2) return;
    seedTerms.set(key, (seedTerms.get(key) ?? 0) + score);
  };

  for (const term of popularSuggestions) bump(term, 18);
  for (const term of recents) bump(term, 28);
  for (const chip of chips.slice(0, 8)) bump(chip.label, 12);
  for (const p of products) {
    const base = 8 + (p.rating ?? 4) * 4 + Math.min(12, Math.round((p.reviews ?? 0) / 40));
    const promoBoost = p.discount || p.oldPrice ? 14 : 0;
    bump(p.name.replace(/\s+(Bio|Frais|Nature|Entier).*$/i, '').trim(), base + promoBoost);
  }
  for (const p of promoProducts()) bump(p.name.split(' ')[0] ?? p.name, 22);

  const scored = [...seedTerms.entries()].map(([term, base], index) => {
    const wave = Math.sin((tick + index * 1.7) * 1.3) * 10 + Math.cos((tick * 0.6 + index) * 0.9) * 6;
    const recentBoost = recents.some((r) => r.toLowerCase() === term.toLowerCase()) ? 8 : 0;
    const heat = Math.max(12, Math.min(99, Math.round(base + wave + recentBoost)));
    const matches = searchProducts(term).length;
    const drift = Math.sin((tick + index) * 2.1);
    const delta: TrendingSearch['delta'] =
      index > seedTerms.size - 3 && drift > 0.55
        ? 'new'
        : drift > 0.25
          ? 'up'
          : drift < -0.35
            ? 'down'
            : 'stable';
    return { term, heat, matches, delta };
  });

  scored.sort((a, b) => b.heat - a.heat || b.matches - a.matches);
  return scored.slice(0, limit).map((item, i) => ({
    ...item,
    rank: i + 1,
  }));
}

export const searchCategories = [
  { id: 'fruits-legumes', label: 'Fruits', image: require('../assets/images/catalog/circle-fruits.png') },
  { id: 'fruits-legumes', label: 'Légumes', image: require('../assets/images/catalog/circle-legumes.png') },
  { id: 'poissons', label: 'Poissons', image: require('../assets/images/catalog/circle-poissons.png') },
  { id: 'epices', label: 'Épices', image: require('../assets/images/catalog/circle-epices.png') },
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
