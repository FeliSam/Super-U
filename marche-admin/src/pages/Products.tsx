import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from 'lucide-react';
import { api, formatFcfa, mediaUrl } from '@/lib/api';
import {
  preferredVariantId,
  productFamilyKey,
  productFamilyName,
  sortByUnit,
} from '@/lib/productFamily';

type Product = {
  id: string;
  categoryId: string;
  payload: {
    name?: string;
    unit?: string;
    price?: number;
    oldPrice?: number;
    discount?: string;
    inStock?: boolean;
    sku?: string;
    badge?: string;
  };
  imageUrl: string;
  stock: { available: number; alert: boolean; qty: number } | null;
  flags: { popular: boolean; promo: boolean; recommended: boolean };
};

type Cat = { id: string; payload: { title?: string } };

type FamilyRow = {
  key: string;
  name: string;
  categoryId: string;
  variants: Product[];
};

function groupFamilies(items: Product[]): FamilyRow[] {
  const groups = new Map<string, FamilyRow>();
  for (const item of items) {
    const name = String(item.payload.name ?? item.id);
    const key = productFamilyKey(name, item.payload.unit, item.categoryId);
    const existing = groups.get(key);
    if (existing) {
      existing.variants.push(item);
      continue;
    }
    groups.set(key, {
      key,
      name: productFamilyName(name, item.payload.unit),
      categoryId: item.categoryId,
      variants: [item],
    });
  }
  return [...groups.values()].map((row) => ({ ...row, variants: sortByUnit(row.variants) }));
}

type SortKey = 'name' | 'formats' | 'rayon' | 'price' | 'stock';
type SortDir = 'asc' | 'desc';

const COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Produit' },
  { key: 'formats', label: 'Formats', numeric: true },
  { key: 'rayon', label: 'Rayon' },
  { key: 'price', label: 'Prix', numeric: true },
  { key: 'stock', label: 'Stock', numeric: true },
];

export function ProductsPage() {
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('all');
  const [merch, setMerch] = useState('');
  const [items, setItems] = useState<Product[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [busy, setBusy] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const families = useMemo(() => groupFamilies(items), [items]);
  const catTitle = useMemo(() => {
    const map = new Map(cats.map((c) => [c.id, String(c.payload.title ?? c.id)]));
    return (id: string) => map.get(id) ?? id;
  }, [cats]);

  const sortedFamilies = useMemo(() => {
    if (!sortKey) return families;
    return [...families].sort((a, b) => {
      const pricesA = a.variants.map((item) => Number(item.payload.price ?? 0));
      const pricesB = b.variants.map((item) => Number(item.payload.price ?? 0));
      const stockA = a.variants.reduce((sum, item) => sum + Number(item.stock?.available ?? 0), 0);
      const stockB = b.variants.reduce((sum, item) => sum + Number(item.stock?.available ?? 0), 0);
      let delta = 0;
      if (sortKey === 'name') delta = a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
      else if (sortKey === 'formats') delta = a.variants.length - b.variants.length;
      else if (sortKey === 'rayon') {
        delta = catTitle(a.categoryId).localeCompare(catTitle(b.categoryId), 'fr', { sensitivity: 'base' });
      } else if (sortKey === 'price') delta = Math.min(...pricesA) - Math.min(...pricesB);
      else delta = stockA - stockB;
      return sortDir === 'asc' ? delta : -delta;
    });
  }, [families, sortKey, sortDir, catTitle]);

  const toggleSort = (key: SortKey, numeric?: boolean) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(numeric ? 'desc' : 'asc');
  };

  const load = () => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (categoryId) p.set('categoryId', categoryId);
    if (stock !== 'all') p.set('stock', stock);
    if (merch) p.set('merch', merch);
    setBusy(true);
    api<{ products: Product[] }>(`/admin/products?${p}`)
      .then((r) => setItems(r.products))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    api<{ categories: Cat[] }>('/admin/categories').then((r) => setCats(r.categories));
  }, []);

  useEffect(() => {
    load();
  }, [categoryId, stock, merch]);

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Catalogue</h2>
          <p>Un produit par ligne. Les formats (1 kg, 400 g…) se gèrent dans la fiche.</p>
        </div>
        <Link className="btn gold" to="/produits/nouveau">
          <Plus size={16} strokeWidth={2.4} />
          Nouveau produit
        </Link>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filters">
          <label className="field">
            Recherche
            <input
              value={q}
              placeholder="Nom, SKU, producteur…"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </label>
          <label className="field">
            Rayon
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Tous</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {String(c.payload.title ?? c.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Stock
            <select value={stock} onChange={(e) => setStock(e.target.value)}>
              <option value="all">Tous</option>
              <option value="in">En rayon</option>
              <option value="out">Rupture</option>
              <option value="alert">Sous seuil</option>
            </select>
          </label>
          <label className="field">
            Vitrine
            <select value={merch} onChange={(e) => setMerch(e.target.value)}>
              <option value="">Tous</option>
              <option value="popular">Populaires</option>
              <option value="recommended">Recommandés</option>
              <option value="promo">Promos</option>
            </select>
          </label>
          <button className="btn ghost" type="button" onClick={load} disabled={busy}>
            {busy ? '…' : 'Filtrer'}
          </button>
        </div>
      </div>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              {COLS.map((c) => {
                const on = sortKey === c.key;
                const Icon = !on ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} aria-sort={on ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className={`th-sort${on ? ' on' : ''}`} onClick={() => toggleSort(c.key, c.numeric)}>
                      {c.label}
                      <Icon size={14} strokeWidth={2.2} aria-hidden />
                    </button>
                  </th>
                );
              })}
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedFamilies.map((family) => {
              const primary = family.variants.find((item) => item.id === preferredVariantId(family.variants)) ?? family.variants[0]!;
              const prices = family.variants.map((item) => Number(item.payload.price ?? 0));
              const minPrice = Math.min(...prices);
              const maxPrice = Math.max(...prices);
              const stockSum = family.variants.reduce((sum, item) => sum + Number(item.stock?.available ?? 0), 0);
              const allOut = family.variants.every((item) => item.payload.inStock === false);
              const units = family.variants.map((item) => String(item.payload.unit ?? '').trim()).filter(Boolean);
              const flags = [
                family.variants.length > 1 ? `${family.variants.length} formats` : null,
                primary.flags.popular ? 'populaire' : null,
                primary.flags.promo ? primary.payload.discount || 'promo' : null,
              ].filter(Boolean);
              return (
                <tr key={family.key}>
                  <td>
                    <div className="product-cell">
                      <img className="thumb" src={mediaUrl(primary.imageUrl)} alt="" />
                      <div>
                        <strong>{family.name}</strong>
                        {flags.length ? <div className="sku">{flags.join(' · ')}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="format-chips">
                      {(units.length ? units : ['—']).map((unit) => (
                        <span key={unit} className="format-chip">
                          {unit}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{catTitle(family.categoryId)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {minPrice === maxPrice
                      ? formatFcfa(minPrice)
                      : `${formatFcfa(minPrice)} – ${formatFcfa(maxPrice)}`}
                  </td>
                  <td>
                    <span className={`pill ${allOut ? 'out' : 'ok'}`}>
                      {allOut ? 'Rupture' : `${stockSum} u.`}
                    </span>
                  </td>
                  <td>
                    <Link className="btn ghost sm" to={`/produits/${primary.id}`}>
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="table-foot">
          {!sortedFamilies.length && !busy
            ? 'Aucun produit pour ce filtre.'
            : `${sortedFamilies.length} produit${sortedFamilies.length > 1 ? 's' : ''} · ${items.length} SKU`}
        </div>
      </div>
    </>
  );
}
