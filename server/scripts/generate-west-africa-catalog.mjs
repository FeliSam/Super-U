import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legacy = JSON.parse(readFileSync(join(root, 'data/catalog.json'), 'utf8'));

export const categoryCounts = {
  'fruits-legumes': 100,
  viandes: 50,
  charcuterie: 35,
  poissons: 50,
  surgeles: 45,
  laitiers: 60,
  oeufs: 20,
  boulangerie: 45,
  'petit-dej': 50,
  'cafe-the': 35,
  feculents: 80,
  huiles: 45,
  epices: 45,
  conserves: 50,
  epicerie: 65,
  snacking: 45,
  boissons: 80,
  alcools: 45,
  bio: 25,
  cuisine: 35,
  glaces: 30,
  hygiene: 55,
  maison: 50,
  bebe: 35,
  animalerie: 25,
};

const catalog = {
  'fruits-legumes': ['Tomate locale', 'Banane douce', 'Plantain', 'Mangue Kent', 'Ananas pain de sucre', 'Orange', 'Papaye', 'Avocat', 'Gombo frais', 'Aubergine africaine', 'Piment vert', 'Oignon violet', 'Carotte', 'Chou', 'Concombre', 'Patate douce', 'Igname', 'Manioc frais', 'Citron vert', 'Pastèque'],
  viandes: ['Poulet fermier', 'Poulet bicyclette', 'Escalope de poulet', 'Aile de poulet', 'Cuisse de poulet', 'Boeuf bourguignon', 'Steak de boeuf', 'Côte de boeuf', 'Viande hachée', 'Mouton avec os', 'Chèvre locale', 'Foie de boeuf'],
  charcuterie: ['Jambon de dinde', 'Saucisse de volaille', 'Saucisse de boeuf', 'Mortadelle de volaille', 'Pâté de campagne', 'Corned-beef', 'Salami de boeuf'],
  poissons: ['Tilapia entier', 'Capitaine entier', 'Dorade grise', 'Bar frais', 'Carpe', 'Maquereau', 'Sardine fraîche', 'Thon en tranche', 'Crevettes', 'Crabe', 'Filet de sole', 'Poisson fumé'],
  surgeles: ['Frites surgelées', 'Petits pois', 'Haricots verts', 'Épinards hachés', 'Mélange de légumes', 'Poulet surgelé', 'Filet de poisson', 'Crevettes décortiquées', 'Pizza margherita', 'Samoussa légumes'],
  laitiers: ['Lait entier UHT', 'Lait demi-écrémé', 'Lait en poudre', 'Lait concentré non sucré', 'Yaourt nature', 'Yaourt vanille', 'Yaourt ananas', 'Fromage fondu', 'Emmental', 'Beurre doux', 'Margarine', 'Crème fraîche'],
  oeufs: ['Oeufs frais calibre moyen', 'Oeufs frais gros calibre', 'Oeufs de caille', 'Oeufs fermiers'],
  boulangerie: ['Baguette', 'Pain de mie', 'Pain complet', 'Pain au lait', 'Croissant', 'Pain chocolat', 'Brioche', 'Galette locale', 'Chapelure'],
  'petit-dej': ['Céréales maïs', 'Flocons avoine', 'Muesli fruits', 'Pâte à tartiner cacao', 'Confiture mangue', 'Confiture fraise', 'Miel du Bénin', 'Beurre cacahuète', 'Biscuits petit déjeuner', 'Farine infantile'],
  'cafe-the': ['Café soluble', 'Café moulu', 'Café robusta', 'Thé noir', 'Thé vert', 'Thé gingembre', 'Thé menthe', 'Infusion citronnelle'],
  feculents: ['Riz parfumé', 'Riz brisé', 'Riz local', 'Maïs grain', 'Farine de maïs', 'Gari fin', 'Gari jaune', 'Attiéké', 'Couscous de mil', 'Fonio', 'Pâtes spaghetti', 'Macaroni', 'Semoule de blé', 'Farine de manioc', 'Haricot niébé', 'Lentilles'],
  huiles: ['Huile de palme rouge', 'Huile d’arachide', 'Huile de coton', 'Huile de soja', 'Huile de tournesol', 'Huile d’olive', 'Beurre de karité alimentaire', 'Huile de coco'],
  epices: ['Poivre noir', 'Piment séché', 'Gingembre moulu', 'Curcuma', 'Curry', 'Ail semoule', 'Cannelle', 'Muscade', 'Clou de girofle', 'Soumbala', 'Mélange poisson', 'Mélange poulet'],
  conserves: ['Tomate concentrée', 'Tomates pelées', 'Sardines huile', 'Thon naturel', 'Maquereau tomate', 'Petits pois conserve', 'Maïs doux', 'Haricots rouges', 'Champignons', 'Corned-beef'],
  epicerie: ['Sucre blanc', 'Sucre roux', 'Sel iodé', 'Bouillon légumes', 'Bouillon poulet', 'Mayonnaise', 'Ketchup', 'Moutarde', 'Vinaigre blanc', 'Vinaigre cidre', 'Sauce soja', 'Sauce piment', 'Levure boulangère'],
  snacking: ['Chips plantain salées', 'Chips plantain piment', 'Chips pomme de terre', 'Cacahuètes grillées', 'Noix de cajou', 'Pop-corn', 'Crackers salés', 'Biscuits chocolat', 'Barre céréales'],
  boissons: ['Eau minérale', 'Eau gazeuse', 'Jus ananas', 'Jus mangue', 'Jus orange', 'Jus bissap', 'Jus baobab', 'Nectar goyave', 'Boisson gingembre', 'Soda cola', 'Soda orange', 'Limonade', 'Malt sans alcool', 'Boisson énergisante', 'Sirop grenadine', 'Lait soja'],
  alcools: ['Bière blonde', 'Bière brune', 'Bière de mil', 'Cidre', 'Vin rouge', 'Vin blanc', 'Vin rosé', 'Mousseux', 'Gin', 'Rhum', 'Whisky'],
  bio: ['Moringa poudre bio', 'Fonio bio', 'Miel bio', 'Hibiscus bio', 'Gingembre bio', 'Curcuma bio', 'Sésame bio'],
  cuisine: ['Papier aluminium', 'Film alimentaire', 'Sachet congélation', 'Papier cuisson', 'Éponge cuisine', 'Boîte conservation', 'Gobelets carton'],
  glaces: ['Glace vanille', 'Glace chocolat', 'Glace fraise', 'Glace coco', 'Glace mangue', 'Sorbet bissap'],
  hygiene: ['Savon de toilette', 'Gel douche', 'Shampooing', 'Dentifrice', 'Brosse à dents', 'Déodorant', 'Papier toilette', 'Serviettes hygiéniques', 'Couches adultes', 'Rasoir jetable', 'Lotion corporelle'],
  maison: ['Lessive poudre', 'Lessive liquide', 'Liquide vaisselle', 'Eau de javel', 'Nettoyant sol', 'Désinfectant', 'Insecticide', 'Papier essuie-tout', 'Sac poubelle', 'Allumettes'],
  bebe: ['Couches bébé', 'Lingettes bébé', 'Lait infantile', 'Farine bébé', 'Petit pot légumes', 'Compote bébé', 'Savon bébé', 'Shampooing bébé'],
  animalerie: ['Croquettes chien', 'Croquettes chat', 'Pâtée chien', 'Pâtée chat', 'Litière chat', 'Friandise chien'],
};

const formatGroups = {
  fresh: ['250 g', '500 g', '1 kg', '1,5 kg', '2 kg', 'pièce', 'botte', 'filet 1 kg'],
  grocery: ['100 g', '250 g', '400 g', '500 g', '750 g', '1 kg', '2 kg', '5 kg'],
  liquid: ['25 cl', '33 cl', '50 cl', '75 cl', '1 L', '1,5 L', 'pack 6 x 33 cl', 'pack 6 x 1,5 L'],
  household: ['250 ml', '500 ml', '750 ml', '1 L', '2 L', 'lot de 2', 'lot de 6', 'format familial'],
  unit: ['unité', 'lot de 2', 'lot de 4', 'lot de 6', 'lot de 10', 'petit format', 'grand format'],
};
const groupByCategory = {
  'fruits-legumes': 'fresh', viandes: 'fresh', poissons: 'fresh', boulangerie: 'unit',
  oeufs: 'unit', boissons: 'liquid', alcools: 'liquid', huiles: 'liquid', laitiers: 'grocery',
  glaces: 'grocery', hygiene: 'household', maison: 'household', cuisine: 'unit',
  bebe: 'grocery', animalerie: 'grocery',
};
const basePrices = {
  'fruits-legumes': 300, viandes: 2200, charcuterie: 1500, poissons: 1800, surgeles: 1200,
  laitiers: 500, oeufs: 700, boulangerie: 200, 'petit-dej': 900, 'cafe-the': 1000,
  feculents: 500, huiles: 900, epices: 300, conserves: 450, epicerie: 300,
  snacking: 250, boissons: 250, alcools: 700, bio: 1000, cuisine: 500, glaces: 500,
  hygiene: 500, maison: 600, bebe: 900, animalerie: 1000,
};
const origins = ['Bénin', 'Togo', 'Ghana', 'Côte d’Ivoire', 'Sénégal', 'Nigeria', 'Burkina Faso', 'UEMOA'];
const observedAt = '2026-08-01T00:00:00.000Z';
const safeId = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

if (legacy.products.length !== 122) {
  throw new Error(`Le catalogue historique doit contenir 122 produits, reçu: ${legacy.products.length}`);
}

const categories = new Map(legacy.categories.map((row) => [row.id, row]));
for (const id of Object.keys(categoryCounts)) {
  if (!categories.has(id)) categories.set(id, { id, payload: { id, name: id } });
}

const stores = legacy.stores;
const products = [];
const categoryIndexes = Object.fromEntries(Object.keys(categoryCounts).map((id) => [id, 0]));
const usedSkus = new Set();

function initialStocks(seed) {
  return stores.map((store, index) => ({
    storeId: store.id,
    qty: 12 + ((seed * 7 + index * 11) % 37),
    reserved: 0,
    minQty: 5 + (seed % 5),
  }));
}

for (const [legacyIndex, row] of legacy.products.entries()) {
  if (!(row.categoryId in categoryCounts)) throw new Error(`Catégorie historique inconnue: ${row.categoryId}`);
  categoryIndexes[row.categoryId]++;
  if (categoryIndexes[row.categoryId] > categoryCounts[row.categoryId]) {
    throw new Error(`Trop de produits historiques dans ${row.categoryId}`);
  }
  const sku = `LEGACY-${String(legacyIndex + 1).padStart(4, '0')}`;
  usedSkus.add(sku);
  const price = Number.isInteger(row.payload.price) && row.payload.price > 0 ? row.payload.price : 1000;
  products.push({
    id: row.id,
    sku,
    barcode: null,
    active: true,
    categoryId: row.categoryId,
    payload: {
      ...row.payload,
      id: row.id,
      categoryId: row.categoryId,
      price,
      unit: row.payload.unit || '1 unité',
      priceCurrency: 'XOF',
      priceSource: 'catalogue-historique-super-u-benin',
      priceStatus: 'seed-estimate',
      priceObservedAt: observedAt,
      provenance: { source: 'catalog.json historique', country: 'Bénin' },
      imageStatus: 'placeholder',
    },
    provenance: {
      source: 'server/data/catalog.json',
      country: 'Bénin',
      collectedAt: observedAt,
      notes: 'ID historique préservé; prix seed à vérifier en magasin.',
    },
    media: [{ kind: 'image', position: 0, placeholder: true, metadata: { reason: 'source-licencee-manquante' } }],
    initialStocks: initialStocks(legacyIndex + 1),
  });
}

let globalIndex = products.length;
for (const [categoryId, target] of Object.entries(categoryCounts)) {
  const names = catalog[categoryId];
  while (categoryIndexes[categoryId] < target) {
    const localIndex = categoryIndexes[categoryId]++;
    const base = names[localIndex % names.length];
    const cycle = Math.floor(localIndex / names.length);
    const formats = formatGroups[groupByCategory[categoryId] ?? 'grocery'];
    const format = formats[(localIndex + cycle) % formats.length];
    const origin = origins[(localIndex * 3 + cycle) % origins.length];
    const serial = String(localIndex + 1).padStart(3, '0');
    const id = `wa-${safeId(categoryId)}-${serial}`;
    const sku = `SUP-${safeId(categoryId).toUpperCase()}-${serial}`;
    if (usedSkus.has(sku)) throw new Error(`SKU dupliqué: ${sku}`);
    usedSkus.add(sku);
    const price = basePrices[categoryId] + (((globalIndex * 137 + localIndex * 53) % 41) * 50);
    products.push({
      id,
      sku,
      barcode: null,
      active: true,
      categoryId,
      payload: {
        id,
        name: `${base} ${format}`,
        unit: format,
        price,
        categoryId,
        origin,
        priceCurrency: 'XOF',
        priceSource: 'estimation-seed-marche-ouest-africain',
        priceStatus: 'seed-estimate',
        priceObservedAt: observedAt,
        provenance: { source: 'générateur déterministe', country: origin },
        imageStatus: 'placeholder',
      },
      provenance: {
        source: 'server/scripts/generate-west-africa-catalog.mjs',
        country: origin,
        collectedAt: observedAt,
        notes: 'Référence seed réaliste; disponibilité et prix à confirmer.',
      },
      media: [{ kind: 'image', position: 0, placeholder: true, metadata: { reason: 'source-licencee-manquante' } }],
      initialStocks: initialStocks(globalIndex + 1),
    });
    globalIndex++;
  }
}

const manifest = {
  version: 'west-africa-1.0.0',
  generatedAt: '2026-08-30T00:00:00.000Z',
  source: 'catalogue-super-u-ouest-africain',
  categories: [...categories.values()],
  banners: legacy.banners,
  chips: legacy.chips,
  stores,
  products,
};

if (products.length !== 1200) throw new Error(`1200 produits attendus, reçu: ${products.length}`);
writeFileSync(join(root, 'data/catalog-west-africa.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Écrit catalog-west-africa.json (${products.length} SKU actifs, ${legacy.products.length} IDs historiques)`);
