import {
  getProduct,
  homeCategories,
  productFamilyName,
  products,
  promoProducts,
  searchProducts,
  type Product,
} from '@/data/catalog';

export type HomeSignals = {
  recents: string[];
  favoriteIds: string[];
  cartIds: string[];
  orderedIds: string[];
  interests: string[];
  firstName?: string;
  hour?: number;
};

export type HomePlan = {
  greeting: string;
  pitch: string;
  searchHint: string;
  promoCount: number;
  hour: number;
  momentTitle: string;
  momentMeta: string;
  momentChipId: string;
  momentProducts: Product[];
  continueTerm: string | null;
  continueProducts: Product[];
  becauseProducts: Product[];
  cartNudge: string | null;
  rankedChips: typeof homeCategories;
  rankedFeed: Product[];
  showGlaces: boolean;
  showCuisine: boolean;
};

function unique(list: Product[], cap: number, used?: Set<string>): Product[] {
  const seen = used ?? new Set<string>();
  const out: Product[] = [];
  for (const p of list) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= cap) break;
  }
  return out;
}

function momentForHour(hour: number): { title: string; meta: string; chipId: string; cats: string[] } {
  if (hour >= 5 && hour < 11) {
    return {
      title: 'Pour le petit-déj',
      meta: 'Pain, café, fruits du matin',
      chipId: 'petit-dej',
      cats: ['petit-dej', 'boulangerie', 'laitiers', 'fruits-legumes'],
    };
  }
  if (hour >= 11 && hour < 15) {
    return {
      title: 'Le déjeuner, sans attendre',
      meta: 'Plats prêts et féculents',
      chipId: 'cuisine',
      cats: ['cuisine', 'feculents', 'boissons'],
    };
  }
  if (hour >= 15 && hour < 18) {
    return {
      title: 'Un goûter frais',
      meta: 'Glaces, jus, en-cas',
      chipId: 'glaces',
      cats: ['glaces', 'boissons', 'epicerie-sucree'],
    };
  }
  if (hour >= 18 && hour < 23) {
    return {
      title: 'Pour ce soir',
      meta: 'Viandes, légumes, déjà cuisinés',
      chipId: 'viandes',
      cats: ['viandes', 'fruits-legumes', 'cuisine', 'poissons'],
    };
  }
  return {
    title: 'Envies du moment',
    meta: 'Sélection selon l’heure',
    chipId: 'fruits',
    cats: ['fruits-legumes', 'boissons'],
  };
}

function scoreProduct(
  p: Product,
  ctx: {
    recentKeys: string[];
    favCats: Set<string>;
    cartCats: Set<string>;
    orderCats: Set<string>;
    interestCats: Set<string>;
    momentCats: Set<string>;
  },
): number {
  let s = 0;
  const name = String(p.name ?? '').toLowerCase();
  const family = productFamilyName(p).toLowerCase();
  const categoryId = String(p.categoryId ?? '');
  for (const q of ctx.recentKeys) {
    if (name.includes(q) || family.includes(q) || categoryId.includes(q)) s += 40;
  }
  if (ctx.favCats.has(p.categoryId)) s += 18;
  if (ctx.cartCats.has(p.categoryId)) s += 14;
  if (ctx.orderCats.has(p.categoryId)) s += 16;
  if (ctx.interestCats.has(p.categoryId)) s += 12;
  if (ctx.momentCats.has(p.categoryId)) s += 10;
  if (p.oldPrice || p.discount) s += 8;
  if (p.inStock !== false) s += 4;
  return s;
}

export function buildHomePlan(signals: HomeSignals): HomePlan {
  const hour = signals.hour ?? new Date().getHours();
  const moment = momentForHour(hour);
  const recents = signals.recents
    .map((t) => String(t ?? '').trim())
    .filter((t) => t.length >= 2);
  const recentKeys = recents.map((t) => t.toLowerCase());
  const first = (signals.firstName ?? '').trim();
  const hello =
    hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const greeting = first ? `${hello} ${first}` : hello;

  const favProducts = signals.favoriteIds.map(getProduct).filter(Boolean) as Product[];
  const cartProducts = signals.cartIds.map(getProduct).filter(Boolean) as Product[];
  const orderedProducts = signals.orderedIds.map(getProduct).filter(Boolean) as Product[];

  const favCats = new Set(favProducts.map((p) => p.categoryId));
  const cartCats = new Set(cartProducts.map((p) => p.categoryId));
  const orderCats = new Set(orderedProducts.map((p) => p.categoryId));
  const interestCats = new Set(signals.interests.filter(Boolean));
  const momentCats = new Set(moment.cats);

  const ctx = { recentKeys, favCats, cartCats, orderCats, interestCats, momentCats };

  const continueTerm = recents[0] ?? null;
  const continueProducts = continueTerm
    ? unique(searchProducts(continueTerm, { inStockOnly: true }), 8)
    : [];

  const becauseSeed = [...favProducts, ...orderedProducts, ...cartProducts];
  const becauseCats = new Set(becauseSeed.map((p) => p.categoryId));
  const becauseProducts = unique(
    products.filter((p) => becauseCats.has(p.categoryId) && !signals.favoriteIds.includes(p.id)),
    8,
  );

  const momentPool = products.filter((p) => momentCats.has(p.categoryId));
  const momentProducts = unique(
    [...momentPool].sort((a, b) => scoreProduct(b, ctx) - scoreProduct(a, ctx)),
    8,
  );

  const rankedChips = [...homeCategories].sort((a, b) => {
    const score = (c: (typeof homeCategories)[number]) => {
      let n = 0;
      if (c.id === moment.chipId) n += 30;
      if (moment.cats.includes(c.categoryId)) n += 12;
      if (favCats.has(c.categoryId) || cartCats.has(c.categoryId) || orderCats.has(c.categoryId)) n += 20;
      if (interestCats.has(c.categoryId) || interestCats.has(c.id)) n += 16;
      for (const q of recentKeys) {
        if (c.label.toLowerCase().includes(q) || c.categoryId.includes(q)) n += 24;
      }
      return n;
    };
    return score(b) - score(a);
  });

  const rankedFeed = unique(
    [...products].sort((a, b) => scoreProduct(b, ctx) - scoreProduct(a, ctx)),
    24,
  );

  const promoCount = promoProducts().length;
  const pitchParts: string[] = [];
  if (continueTerm) pitchParts.push(`vous avez cherché « ${continueTerm} »`);
  if (cartProducts.length) pitchParts.push(`${cartProducts.length} article${cartProducts.length > 1 ? 's' : ''} dans le panier`);
  if (favProducts.length) pitchParts.push('vos favoris');
  const pitch = pitchParts.length
    ? `Aujourd’hui, on part de ${pitchParts[0]}.`
    : `${moment.meta} — une sélection qui bouge avec l’heure.`;

  const searchHint = continueTerm ? `Reprendre « ${continueTerm} »…` : 'Rechercher un produit...';
  const cartNudge =
    cartProducts.length > 0
      ? `Panier : ${cartProducts.length} article${cartProducts.length > 1 ? 's' : ''} à finaliser`
      : null;

  return {
    greeting,
    pitch,
    searchHint,
    promoCount,
    hour,
    momentTitle: moment.title,
    momentMeta: moment.meta,
    momentChipId: moment.chipId,
    momentProducts,
    continueTerm,
    continueProducts,
    becauseProducts,
    cartNudge,
    rankedChips,
    rankedFeed,
    showGlaces: hour >= 12 && hour < 21,
    showCuisine: hour >= 11 || hour < 4,
  };
}
