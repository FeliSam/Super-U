/** Maps a SKU name to one existing catalog file (stem, no extension). */

const CAT: Record<string, string> = {
  'fruits-legumes': 'cat-fruits',
  viandes: 'cat-viandes',
  charcuterie: 'cat-viandes',
  poissons: 'cat-poissons',
  surgeles: 'glace-assortiment',
  laitiers: 'cat-laitiers',
  oeufs: 'poulet',
  boulangerie: 'cat-boulangerie',
  'petit-dej': 'miel',
  'cafe-the': 'glace-cafe',
  feculents: 'cuisine-riz',
  huiles: 'cat-epicerie',
  epices: 'circle-epices',
  conserves: 'cat-epicerie',
  epicerie: 'cat-epicerie',
  snacking: 'plantains',
  boissons: 'cat-boissons',
  alcools: 'cat-boissons',
  bio: 'cat-fruits',
  cuisine: 'cat-maison',
  glaces: 'cat-glaces',
  hygiene: 'cat-hygiene',
  maison: 'cat-maison',
  bebe: 'cat-bebe',
  animalerie: 'cat-maison',
};

type Rule = { keys: string[]; stem: string };

const RULES: Rule[] = [
  { keys: ['eponge', 'essuie', 'lessive', 'vaisselle', 'javel', 'nettoyant', 'desinfectant', 'insecticide', 'poubelle', 'allumette', 'aluminium', 'film alimentaire', 'sachet congel', 'papier cuisson', 'gobelet', 'boite conservation', 'conservation'], stem: 'cat-maison' },
  { keys: ['savon', 'shampoo', 'dentifrice', 'deodorant', 'rasoir', 'serviette hygien', 'papier toilette', 'gel douche', 'brosse a dent', 'lotion'], stem: 'cat-hygiene' },
  { keys: ['couche', 'lingette', 'lait infantile', 'petit pot', 'compote bebe', 'farine bebe', 'savon bebe'], stem: 'cat-bebe' },
  { keys: ['croquette', 'patee', 'litiere', 'friandise chien', 'chien', 'chat'], stem: 'cat-maison' },
  { keys: ['glace vanille'], stem: 'glace-vanille' },
  { keys: ['glace chocolat'], stem: 'glace-chocolat' },
  { keys: ['glace fraise', 'sorbet fraise'], stem: 'glace-fraise' },
  { keys: ['glace coco', 'sorbet coco'], stem: 'glace-coco' },
  { keys: ['glace cafe'], stem: 'glace-cafe' },
  { keys: ['glace caramel'], stem: 'glace-caramel' },
  { keys: ['glace pistache'], stem: 'glace-pistache' },
  { keys: ['glace citron', 'sorbet citron'], stem: 'glace-citron' },
  { keys: ['sundae'], stem: 'glace-sundae' },
  { keys: ['glace batonnet', 'batonnet'], stem: 'glace-batonnet' },
  { keys: ['glace cone', 'cornet'], stem: 'glace-cone' },
  { keys: ['glace', 'sorbet'], stem: 'cat-glaces' },
  { keys: ['poulet pane', 'pane'], stem: 'cuisine-poulet-pane' },
  { keys: ['poulet roti', 'roti'], stem: 'cuisine-poulet-roti' },
  { keys: ['frite'], stem: 'cuisine-frites' },
  { keys: ['ragout'], stem: 'cuisine-ragout' },
  { keys: ['escalope', 'aile de poulet', 'cuisse', 'poulet', 'volaille', 'dinde'], stem: 'poulet' },
  { keys: ['boeuf', 'steak', 'mouton', 'chevre', 'viande', 'hache', 'jambon', 'saucisse', 'salami', 'pate de', 'corned'], stem: 'cat-viandes' },
  { keys: ['tilapia', 'capitaine', 'dorade', 'maquereau', 'sardine', 'thon', 'crevette', 'crabe', 'poisson', 'filet de sole', 'bar frais', 'carpe'], stem: 'cat-poissons' },
  { keys: ['cuisine poisson', 'poisson braise'], stem: 'cuisine-poisson' },
  { keys: ['tomate'], stem: 'tomates' },
  { keys: ['plantain'], stem: 'plantains' },
  { keys: ['banane'], stem: 'bananes' },
  { keys: ['mangue'], stem: 'mangues-card' },
  { keys: ['ananas'], stem: 'ananas' },
  { keys: ['papaye'], stem: 'papaye' },
  { keys: ['carotte'], stem: 'carottes' },
  { keys: ['gombo'], stem: 'gombo' },
  { keys: ['patate', 'igname', 'manioc'], stem: 'patates' },
  { keys: ['pomme de terre'], stem: 'patates' },
  { keys: ['pomme'], stem: 'pommes' },
  { keys: ['gingembre'], stem: 'gingembre' },
  { keys: ['miel'], stem: 'miel' },
  { keys: ['pate a tartiner', 'confiture'], stem: 'miel' },
  { keys: ['cafe'], stem: 'glace-cafe' },
  { keys: ['yaourt', 'fromage', 'creme fraiche', 'margarine', 'emmental', 'lait'], stem: 'cat-laitiers' },
  { keys: ['riz', 'attieke', 'gari', 'fonio', 'couscous', 'pate', 'spaghetti', 'macaroni', 'semoule', 'farine'], stem: 'cuisine-riz' },
  { keys: ['pain', 'baguette', 'croissant', 'brioche', 'galette', 'chapelure'], stem: 'cat-boulangerie' },
  { keys: ['the ', 'thé', 'infusion'], stem: 'glace-cafe' },
  { keys: ['biere', 'vin ', 'rhum', 'whisky', 'gin', 'cidre', 'soda', 'jus ', 'eau minerale', 'eau gazeuse', 'limonade', 'nectar', 'boisson'], stem: 'cat-boissons' },
  { keys: ['huile', 'sucre', 'sel ', 'bouillon', 'mayonnaise', 'ketchup', 'moutarde', 'vinaigre', 'sauce'], stem: 'cat-epicerie' },
  { keys: ['poivre', 'piment', 'curcuma', 'curry', 'cannelle', 'muscade', 'girofle', 'soumbala', 'epice'], stem: 'circle-epices' },
  { keys: ['chips', 'cacahuete', 'cajou', 'pop-corn', 'cracker', 'biscuit', 'barre'], stem: 'plantains' },
];

export function foldText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function pickCatalogStem(productId: string, categoryId?: string | null, productName?: string | null) {
  const hay = foldText(`${productId} ${productName ?? ''}`);
  for (const rule of RULES) {
    if (rule.keys.some((k) => hay.includes(foldText(k)))) return rule.stem;
  }
  if (categoryId && CAT[categoryId]) return CAT[categoryId];
  return 'cat-epicerie';
}

export function pickCatalogFilename(
  productId: string,
  categoryId: string | null | undefined,
  productName: string | null | undefined,
  files: string[],
) {
  const id = productId.replace(/[^a-z0-9_-]/gi, '');
  for (const name of [`${id}.png`, `${id}.jpg`, `${id}.webp`]) {
    if (files.includes(name)) return name;
  }
  const prefixed = files.find((f) => f.startsWith(`${id}-`) || f.startsWith(`cart-${id}.`));
  if (prefixed) return prefixed;

  const stem = pickCatalogStem(productId, categoryId, productName);
  for (const ext of ['.png', '.jpg', '.webp']) {
    if (files.includes(`${stem}${ext}`)) return `${stem}${ext}`;
  }
  if (files.includes('cat-epicerie.png')) return 'cat-epicerie.png';
  return files[0] ?? null;
}
