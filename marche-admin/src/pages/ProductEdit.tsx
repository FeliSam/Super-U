import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatFcfa, mediaUrl } from '@/lib/api';
import { useAppSelector } from '@/app/hooks';

type Cat = { id: string; payload: { title?: string } };

export function ProductEditPage() {
  const { id } = useParams();
  const isNew = !id || id === 'nouveau';
  const nav = useNavigate();
  const staff = useAppSelector((s) => s.auth.staff);
  const [cats, setCats] = useState<Cat[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState({
    name: '',
    unit: '1 kg',
    price: '0',
    oldPrice: '',
    categoryId: 'fruits-legumes',
    producer: '',
    description: '',
    sku: '',
    barcode: '',
    badge: '',
    inStock: true,
  });
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    api<{ categories: Cat[] }>('/admin/categories').then((r) => setCats(r.categories));
  }, []);

  useEffect(() => {
    if (isNew) return;
    api<{ product: { id: string; categoryId: string; payload: Record<string, unknown>; imageUrl: string } }>(
      `/admin/products/${id}`,
    ).then((r) => {
      const p = r.product.payload;
      setImageUrl(r.product.imageUrl);
      setForm({
        name: String(p.name ?? ''),
        unit: String(p.unit ?? ''),
        price: String(p.price ?? 0),
        oldPrice: p.oldPrice != null ? String(p.oldPrice) : '',
        categoryId: r.product.categoryId,
        producer: String(p.producer ?? ''),
        description: String(p.description ?? ''),
        sku: String(p.sku ?? r.product.id),
        barcode: String(p.barcode ?? ''),
        badge: String(p.badge ?? ''),
        inStock: p.inStock !== false,
      });
    });
  }, [id, isNew]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setErr('');
    setOk('');
    try {
      const body = {
        name: form.name,
        unit: form.unit,
        price: Number(form.price),
        oldPrice: form.oldPrice === '' ? null : Number(form.oldPrice),
        categoryId: form.categoryId,
        producer: form.producer,
        description: form.description,
        sku: form.sku,
        barcode: form.barcode,
        badge: form.badge || null,
        inStock: form.inStock,
      };
      if (isNew) {
        const res = await api<{ product: { id: string } }>('/admin/products', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        nav(`/produits/${res.product.id}`);
        return;
      }
      await api(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setOk('Enregistré. La boutique hydratera au prochain chargement. Les commandes déjà payées gardent l’ancien prix.');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const upload = async (file: File) => {
    if (!id || isNew) {
      setErr('Enregistrez d’abord le produit, puis ajoutez l’image.');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api(`/admin/products/${id}/image`, { method: 'POST', body: fd });
      setOk('Image enregistrée dans le dossier catalogue. Relancer catalog:map pour CourseGO.');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2>{isNew ? 'Nouveau produit' : form.name || 'Fiche produit'}</h2>
          <p>Même identifiant que la boutique ({isNew ? 'slug kebab-case' : id}).</p>
        </div>
        <Link className="btn ghost" to="/produits">
          Retour
        </Link>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1.4fr 0.7fr', alignItems: 'start' }}>
        <div className="card form-grid">
          <label className="field">
            Nom
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="field">
            Unité
            <input value={form.unit} onChange={(e) => set('unit', e.target.value)} />
          </label>
          <label className="field">
            Prix FCFA
            <input
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              disabled={!staff?.canEditPrices && !isNew}
            />
          </label>
          <label className="field">
            Ancien prix (promo)
            <input
              value={form.oldPrice}
              placeholder="vide = pas de promo"
              onChange={(e) => set('oldPrice', e.target.value)}
              disabled={!staff?.canEditPrices && !isNew}
            />
          </label>
          <label className="field">
            Rayon
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {String(c.payload.title ?? c.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Badge
            <select value={form.badge} onChange={(e) => set('badge', e.target.value)}>
              <option value="">Aucun</option>
              <option value="nouveau">Nouveau</option>
              <option value="local">Local</option>
              <option value="rupture">Rupture</option>
            </select>
          </label>
          <label className="field">
            SKU / code
            <input value={form.sku} onChange={(e) => set('sku', e.target.value)} />
          </label>
          <label className="field">
            Code-barres
            <input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            Producteur
            <input value={form.producer} onChange={(e) => set('producer', e.target.value)} />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            Description
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={form.inStock} onChange={(e) => set('inStock', e.target.checked)} />
            En rayon (inStock)
          </label>
        </div>
        <div className="card">
          {imageUrl ? <img className="thumb" style={{ width: '100%', height: 180 }} src={mediaUrl(imageUrl)} alt="" /> : null}
          <p className="sku">Image bundlée : {id || '…'}.png — pas d’URL http dans le payload.</p>
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg"
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
          />
          <p style={{ marginTop: 16 }}>
            {form.oldPrice ? (
              <>
                Promo calculée : {formatFcfa(Number(form.price))}{' '}
                <span className="sku">au lieu de {formatFcfa(Number(form.oldPrice))}</span>
              </>
            ) : (
              formatFcfa(Number(form.price) || 0)
            )}
          </p>
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}
      {ok ? <p style={{ color: 'var(--ok)' }}>{ok}</p> : null}
      <button className="btn gold" style={{ marginTop: 16 }} type="button" onClick={() => void save()}>
        Enregistrer
      </button>
    </>
  );
}
