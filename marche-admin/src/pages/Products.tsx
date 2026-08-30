import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatFcfa, mediaUrl } from '@/lib/api';

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

export function ProductsPage() {
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('all');
  const [merch, setMerch] = useState('');
  const [items, setItems] = useState<Product[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [busy, setBusy] = useState(false);

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
          <p>Noms, codes, prix, réductions — alignés sur la boutique Marché Doré.</p>
        </div>
        <Link className="btn gold" to="/produits/nouveau">
          Nouveau produit
        </Link>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
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
            Filtrer
          </button>
        </div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th />
              <th>Produit</th>
              <th>Code</th>
              <th>Rayon</th>
              <th>Prix</th>
              <th>Stock</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  <img className="thumb" src={mediaUrl(p.imageUrl)} alt="" />
                </td>
                <td>
                  <strong>{p.payload.name}</strong>
                  <div className="sku">
                    {p.payload.unit}
                    {p.flags.popular ? ' · populaire' : ''}
                    {p.flags.promo ? ` · ${p.payload.discount || 'promo'}` : ''}
                  </div>
                </td>
                <td className="sku">{p.payload.sku || p.id}</td>
                <td className="sku">{p.categoryId}</td>
                <td>
                  {formatFcfa(Number(p.payload.price ?? 0))}
                  {p.payload.oldPrice ? (
                    <div className="sku" style={{ textDecoration: 'line-through' }}>
                      {formatFcfa(Number(p.payload.oldPrice))}
                    </div>
                  ) : null}
                </td>
                <td>
                  <span className={`pill ${p.payload.inStock === false ? 'out' : 'ok'}`}>
                    {p.payload.inStock === false ? 'Rupture' : `${p.stock?.available ?? '—'} u.`}
                  </span>
                </td>
                <td>
                  <Link className="btn ghost" to={`/produits/${p.id}`}>
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && !busy ? <p style={{ color: 'var(--muted)' }}>Aucun produit pour ce filtre.</p> : null}
      </div>
    </>
  );
}
