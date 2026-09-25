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
import { expandInterestCategoryIds, interestLabels } from '@/lib/taste';
import { packRayonRowsBySpan } from '@/lib/categoryLocalArt';

export type HomeSignals = {
  recents: string[];
  favoriteIds: string[];
  cartIds: string[];
  orderedIds: string[];
  interests: string[];
  /** Fiches produit ouvertes récemment (plus récent en premier). */
  viewedIds?: string[];
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
  tasteProducts: Product[];
  tasteTitle: string;
  tasteMeta: string;
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
      meta: 'En-cas, jus, viennoiseries',
      chipId: 'epicerie',
      cats: ['epicerie', 'boissons', 'boulangerie'],
    };
  }
  if (hour >= 18 && hour < 23) {
    return {
      title: 'Pour ce soir',
      meta: 'Viandes, légumes, déjà cuisinés',
      chipId: 'cuisine',
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

/** Grille repas : petit-déj, déjeuner / goûter, dîner — jamais les glaces. */
export function mealSlotForHour(hour: number): {
  title: string;
  meta: string;
  categoryId: string;
  categoryIds: string[];
} {
  if (hour >= 5 && hour < 11) {
    return {
      title: 'Petit-déjeuner',
      meta: 'Pain, café, fruits du matin',
      categoryId: 'petit-dej',
      categoryIds: ['petit-dej', 'boulangerie', 'laitiers'],
    };
  }
  if (hour >= 11 && hour < 15) {
    return {
      title: 'Le déjeuner',
      meta: 'Plats du midi · à emporter',
      categoryId: 'cuisine',
      categoryIds: ['cuisine', 'feculents'],
    };
  }
  if (hour >= 15 && hour < 18) {
    return {
      title: 'Goûter',
      meta: 'En-cas, viennoiseries, boissons',
      categoryId: 'epicerie',
      categoryIds: ['epicerie', 'boulangerie', 'boissons', 'laitiers'],
    };
  }
  return {
    title: 'Dîner',
    meta: 'Plats du soir · prêts à réchauffer',
    categoryId: 'cuisine',
    categoryIds: ['cuisine', 'viandes', 'fruits-legumes', 'poissons'],
  };
}

const GLACE_FLAVORS = [
  'vanille',
  'chocolat',
  'mangue',
  'coco',
  'fraise',
  'pistache',
  'caramel',
  'café',
  'citron',
  'passion',
  'menthe',
  'cookie',
  'ananas',
  'tiramisu',
  'banane',
  'stracciatella',
  'bissap',
];

function glaceFlavor(name: string) {
  const n = name.toLowerCase();
  return GLACE_FLAVORS.find((k) => n.includes(k)) ?? n.replace(/[^a-z0-9]+/g, ' ').trim().split(' ')[1] ?? name;
}

/** Parfums de glaces qui tournent avec l’heure et la visite. */
export function dynamicGlaceRail(list: Product[], salt: number, limit = 6): Product[] {
  const stocked = list.filter((p) => p.inStock !== false);
  if (!stocked.length) return [];
  const byFlavor = new Map<string, Product[]>();
  for (const p of stocked) {
    const k = glaceFlavor(p.name);
    const arr = byFlavor.get(k) ?? [];
    arr.push(p);
    byFlavor.set(k, arr);
  }
  const flavorOrder = rotateRail(
    [...byFlavor.keys()].map((id) => ({ id })),
    salt + 29,
    byFlavor.size,
  ).map((x) => x.id);
  const out: Product[] = [];
  const used = new Set<string>();
  for (const k of flavorOrder) {
    const pick = rotateRail(byFlavor.get(k) ?? [], salt, 1)[0];
    if (pick && !used.has(pick.id)) {
      used.add(pick.id);
      out.push(pick);
    }
    if (out.length >= limit) break;
  }
  if (out.length < limit) {
    for (const p of rotateRail(stocked, salt + 5, stocked.length)) {
      if (used.has(p.id)) continue;
      used.add(p.id);
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function glaceRailMeta(items: Product[]) {
  const flavors = [...new Set(items.map((p) => glaceFlavor(p.name)))].slice(0, 3);
  if (!flavors.length) return 'Fraîches · à croquer';
  const pretty = flavors.map((f) => f.charAt(0).toUpperCase() + f.slice(1));
  return `${pretty.join(' · ')}`;
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
  if (ctx.interestCats.has(p.categoryId)) s += 36;
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
  const interestCats = new Set(expandInterestCategoryIds(signals.interests));
  const interestIds = new Set(signals.interests.filter(Boolean));
  const momentCats = new Set(moment.cats);

  const ctx = { recentKeys, favCats, cartCats, orderCats, interestCats, momentCats };

  const continueTerm = recents[0] ?? null;
  const continueProducts = continueTerm
    ? unique(searchProducts(continueTerm, { inStockOnly: true }), 8)
    : [];

  const salt = railSalt(signals);
  const tasteLabels = interestLabels(signals.interests);
  const tastePool = interestCats.size
    ? products.filter((p) => interestCats.has(p.categoryId) && p.inStock !== false)
    : [];
  const becauseSeed = [...favProducts, ...orderedProducts, ...cartProducts];
  const becauseCats = new Set(becauseSeed.map((p) => p.categoryId));
  const becausePool = unique(
    products.filter((p) => becauseCats.has(p.categoryId) && !signals.favoriteIds.includes(p.id)),
    32,
  );
  const becauseProducts = rotateRail(
    becausePool.length
      ? becausePool
      : tastePool.length
        ? unique(tastePool, 32)
        : products.filter((p) => p.inStock !== false).slice(0, 32),
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
      if (c.id === moment.chipId) n += 18;
      if (moment.cats.includes(c.categoryId)) n += 8;
      if (favCats.has(c.categoryId) || cartCats.has(c.categoryId) || orderCats.has(c.categoryId)) n += 14;
      if (interestCats.has(c.categoryId) || interestIds.has(c.id)) n += 42;
      for (const q of recentKeys) {
        if (c.label.toLowerCase().includes(q) || c.categoryId.includes(q)) n += 24;
      }
      return n;
    };
    return score(b) - score(a);
  });

  const tasteRanked = unique(
    [...tastePool].sort((a, b) => scoreProduct(b, ctx) - scoreProduct(a, ctx)),
    24,
  );
  const tasteProducts = rotateRail(tasteRanked, salt + 3, 10);
  const tasteTitle = tasteLabels.length ? 'Selon votre goût' : 'Pour commencer';
  const tasteMeta = tasteLabels.length ? tasteLabels.slice(0, 3).join(' · ') : 'Une sélection du jour';

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
    : tasteLabels.length
      ? `On commence par ${tasteLabels[0].toLowerCase()} — comme vous l’avez choisi.`
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
    tasteProducts,
    tasteTitle,
    tasteMeta,
    showGlaces: interestIds.has('glaces') || (hour >= 12 && hour < 22),
    showCuisine: true,
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
    interestCats: new Set(expandInterestCategoryIds(signals.interests)),
    momentCats: new Set(moment.cats),
    favIds: new Set(signals.favoriteIds),
    cartIds: new Set(signals.cartIds),
    orderedIds: new Set(signals.orderedIds),
    viewedIds: signals.viewedIds ?? [],
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
    const va = ctx.viewedIds.indexOf(a.id);
    const vb = ctx.viewedIds.indexOf(b.id);
    if (va >= 0) sa += 70 - Math.min(va, 16) * 3;
    if (vb >= 0) sb += 70 - Math.min(vb, 16) * 3;
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
  const interestCats = new Set(expandInterestCategoryIds(signals.interests));
  const salt = railSalt(signals);

  const ranked = [...list].sort((a, b) => {
    const score = (p: Product) =>
      (fav.has(p.id) ? 12 : 0) +
      (cart.has(p.id) ? 8 : 0) +
      (ordered.has(p.id) ? 6 : 0) +
      (interestCats.has(p.categoryId) ? 14 : 0) +
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
  /** Largeurs relatives /6 pour chaque tuile de chaque ligne (2/6, 3/6, 4/6, 5/6…). */
  rayonRowSpans: number[][];
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
    home.tasteProducts.length >= 4
      ? home.tasteProducts
      : home.becauseProducts.length >= 4
      ? home.becauseProducts
      : home.continueProducts.length
        ? home.continueProducts
        : rotateRail(home.rankedFeed, salt + 7, 8);

  const forYouTitle = home.tasteProducts.length
    ? home.tasteTitle
    : home.continueTerm
      ? `D’après « ${home.continueTerm} »`
      : signals.favoriteIds.length
        ? 'Dans votre veine'
        : 'Pour vous';
  const forYouMeta = home.tasteProducts.length
    ? home.tasteMeta
    : home.continueTerm
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
      if (signals.interests.includes(c.id) || expandInterestCategoryIds(signals.interests).includes(c.id)) n += 40;
      return n + (hashId(c.id, salt) % 7);
    };
    return score(b) - score(a);
  });
  const packed = packRayonRowsBySpan(rankedRayons);
  const rayonRows: (typeof exploreCategories)[] = packed.map((p) => p.row);
  /** Spans 1–4 (/5) alignés sur rayonRows — exposés pour Explorer. */
  const rayonRowSpans: number[][] = packed.map((p) => p.spans);

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
    rayonRowSpans,
  };
}

