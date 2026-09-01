import {
  bannerIsLive,
  exploreCategories,
  getProduct,
  getProducts,
  homeCategories,
  homePromoBanners,
  popularIds,
  productFamilyName,
  products,
  promoProducts,
  searchCategories,
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
  sessionSalt?: number;
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

  const salt = railSalt(signals);
  const becauseSeed = [...favProducts, ...orderedProducts, ...cartProducts];
  const becauseCats = new Set(becauseSeed.map((p) => p.categoryId));
  const becausePool = unique(
    products.filter((p) => becauseCats.has(p.categoryId) && !signals.favoriteIds.includes(p.id)),
    32,
  );
  const becauseProducts = rotateRail(
    becausePool.length ? becausePool : products.filter((p) => p.inStock !== false).slice(0, 32),
    salt + 11,
    8,
  );

  const momentPool = products.filter((p) => momentCats.has(p.categoryId));
  const momentRanked = unique(
    [...momentPool].sort((a, b) => scoreProduct(b, ctx) - scoreProduct(a, ctx)),
    28,
  );
  const momentProducts = rotateRail(momentRanked, salt + 23, 8);

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

  const rankedFeed = rotateRail(
    unique(
      [...products].sort((a, b) => scoreProduct(b, ctx) - scoreProduct(a, ctx)),
      48,
    ),
    salt + 41,
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

function hashId(id: string, salt: number) {
  let h = salt >>> 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return h;
}

function scoringContext(signals: HomeSignals) {
  const hour = signals.hour ?? new Date().getHours();
  const moment = momentForHour(hour);
  const recents = signals.recents
    .map((t) => String(t ?? '').trim())
    .filter((t) => t.length >= 2);
  const recentKeys = recents.map((t) => t.toLowerCase());
  const favProducts = signals.favoriteIds.map(getProduct).filter(Boolean) as Product[];
  const cartProducts = signals.cartIds.map(getProduct).filter(Boolean) as Product[];
  const orderedProducts = signals.orderedIds.map(getProduct).filter(Boolean) as Product[];
  return {
    recentKeys,
    favCats: new Set(favProducts.map((p) => p.categoryId)),
    cartCats: new Set(cartProducts.map((p) => p.categoryId)),
    orderCats: new Set(orderedProducts.map((p) => p.categoryId)),
    interestCats: new Set(signals.interests.filter(Boolean)),
    momentCats: new Set(moment.cats),
    favIds: new Set(signals.favoriteIds),
    cartIds: new Set(signals.cartIds),
    orderedIds: new Set(signals.orderedIds),
  };
}

/** Ordre rayon : favoris, panier, commandes, recherches, heure — différent par compte. */
export function rankProductsForShopper(list: Product[], signals: HomeSignals): Product[] {
  const ctx = scoringContext(signals);
  const salt = railSalt(signals);
  return [...list].sort((a, b) => {
    let sa = scoreProduct(a, ctx);
    let sb = scoreProduct(b, ctx);
    if (ctx.favIds.has(a.id)) sa += 50;
    if (ctx.favIds.has(b.id)) sb += 50;
    if (ctx.cartIds.has(a.id)) sa += 36;
    if (ctx.cartIds.has(b.id)) sb += 36;
    if (ctx.orderedIds.has(a.id)) sa += 28;
    if (ctx.orderedIds.has(b.id)) sb += 28;
    if (sb !== sa) return sb - sa;
    return hashId(a.id, salt) - hashId(b.id, salt);
  });
}

function railSalt(signals: HomeSignals, extra = 0) {
  const hour = signals.hour ?? new Date().getHours();
  return (signals.sessionSalt ?? 0) + hour * 17 + new Date().getDate() + extra;
}

export function rotateRail<T extends { id: string }>(list: T[], salt: number, limit: number): T[] {
  if (!list.length) return [];
  const ranked = [...list].sort((a, b) => hashId(a.id, salt) - hashId(b.id, salt));
  const start = salt % ranked.length;
  return [...ranked.slice(start), ...ranked.slice(0, start)].slice(0, limit);
}

function promoDepth(p: Product) {
  if (p.oldPrice && p.oldPrice > p.price) return (p.oldPrice - p.price) / p.oldPrice;
  return 0;
}

/** Rail « En réduction » : ordre qui change avec l’heure, la visite et le profil. */
export function dynamicPromoRail(signals: HomeSignals, limit = 10): Product[] {
  const list = promoProducts();
  if (!list.length) return [];
  const fav = new Set(signals.favoriteIds);
  const cart = new Set(signals.cartIds);
  const ordered = new Set(signals.orderedIds);
  const salt = railSalt(signals);

  const ranked = [...list].sort((a, b) => {
    const score = (p: Product) =>
      (fav.has(p.id) ? 12 : 0) +
      (cart.has(p.id) ? 8 : 0) +
      (ordered.has(p.id) ? 6 : 0) +
      promoDepth(p) * 10;
    const d = score(b) - score(a);
    if (Math.abs(d) > 0.05) return d;
    return hashId(a.id, salt) - hashId(b.id, salt);
  });

  const start = salt % ranked.length;
  return [...ranked.slice(start), ...ranked.slice(0, start)].slice(0, limit);
}

export type ExplorePlan = {
  quickCats: (typeof searchCategories)[number][];
  promoRail: Product[];
  forYou: Product[];
  forYouTitle: string;
  forYouMeta: string;
  popular: Product[];
  popularMeta: string;
  momentTitle: string;
  momentMeta: string;
  momentProducts: Product[];
  banner: (typeof homePromoBanners)[number] | null;
  rayonRows: (typeof exploreCategories)[];
};

export function buildExplorePlan(signals: HomeSignals): ExplorePlan {
  const home = buildHomePlan(signals);
  const salt = railSalt(signals);

  const quickCats = rotateRail([...searchCategories], salt + 3, searchCategories.length);
  const promoRail = dynamicPromoRail(signals, 8);
  const popularPool = unique(
    [...getProducts(popularIds), ...home.rankedFeed, ...home.momentProducts],
    24,
  );
  const popular = rotateRail(popularPool, salt + 19, 8);

  const forYou =
    home.becauseProducts.length >= 4
      ? home.becauseProducts
      : home.continueProducts.length
        ? home.continueProducts
        : rotateRail(home.rankedFeed, salt + 7, 8);

  const forYouTitle = home.continueTerm
    ? `D’après « ${home.continueTerm} »`
    : signals.favoriteIds.length
      ? 'Dans votre veine'
      : 'Pour vous';
  const forYouMeta = home.continueTerm
    ? 'Suite de vos recherches'
    : signals.orderedIds.length
      ? 'Inspiré de vos commandes'
      : 'Selon vos envies du moment';

  const live = homePromoBanners.filter(bannerIsLive);
  const banner = live.length ? rotateRail(live, salt + 5, 1)[0] ?? null : null;

  const favCats = new Set(
    signals.favoriteIds.map(getProduct).filter(Boolean).map((p) => (p as Product).categoryId),
  );
  const cartCats = new Set(
    signals.cartIds.map(getProduct).filter(Boolean).map((p) => (p as Product).categoryId),
  );
  const orderCats = new Set(
    signals.orderedIds.map(getProduct).filter(Boolean).map((p) => (p as Product).categoryId),
  );
  const rankedRayons = [...exploreCategories].sort((a, b) => {
    const score = (c: (typeof exploreCategories)[number]) => {
      let n = 0;
      if (c.id === home.momentChipId) n += 28;
      if (favCats.has(c.id) || cartCats.has(c.id) || orderCats.has(c.id)) n += 22;
      if (signals.interests.includes(c.id)) n += 16;
      return n + (hashId(c.id, salt) % 7);
    };
    return score(b) - score(a);
  });
  const rayonRows: (typeof exploreCategories)[] = [];
  for (let i = 0; i < rankedRayons.length; i += 2) {
    rayonRows.push(rankedRayons.slice(i, i + 2));
  }

  return {
    quickCats,
    promoRail,
    forYou,
    forYouTitle,
    forYouMeta,
    popular,
    popularMeta:
      home.hour >= 11 && home.hour < 15 ? 'Ce midi, les plus demandés' : 'Remixés selon votre profil',
    momentTitle: home.momentTitle,
    momentMeta: home.momentMeta,
    momentProducts: home.momentProducts,
    banner,
    rayonRows,
  };
}

