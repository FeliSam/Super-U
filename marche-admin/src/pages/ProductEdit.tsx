import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatFcfa, mediaUrl } from '@/lib/api';
import { useAppSelector } from '@/app/hooks';
import { productFamilyKey, productFamilyName, sortByUnit } from '@/lib/productFamily';

type Cat = { id: string; payload: { title?: string } };

type Sibling = {
  id: string;
  categoryId: string;
  payload: { name?: string; unit?: string; price?: number; sku?: string };
  stock: { available: number } | null;
  imageUrl?: string;
};

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
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [syncingFamily, setSyncingFamily] = useState(false);
  const [applyToFamily, setApplyToFamily] = useState(true);
  const previewRef = useRef<string | null>(null);
  const [siblings, setSiblings] = useState<Sibling[]>([]);

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

  useEffect(() => {
    if (isNew || !form.name || !form.categoryId) {
      setSiblings([]);
      return;
    }
    const familyKey = productFamilyKey(form.name, form.unit, form.categoryId);
    api<{ products: Sibling[] }>(`/admin/products?categoryId=${encodeURIComponent(form.categoryId)}`).then((r) => {
      const variants = r.products.filter(
        (item) => productFamilyKey(String(item.payload.name ?? ''), item.payload.unit, item.categoryId) === familyKey,
      );
      setSiblings(sortByUnit(variants));
    });
  }, [id, isNew, form.name, form.unit, form.categoryId]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const shownImage = previewUrl || (imageUrl ? mediaUrl(imageUrl) : '');

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
    setErr('');
    setOk('');
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const local = URL.createObjectURL(file);
    previewRef.current = local;
    setPreviewUrl(local);
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    if (applyToFamily) fd.append('applyFamily', '1');
    try {
      const res = await api<{ imageUrl?: string; checksum?: string; appliedTo?: string[]; hint?: string }>(
        `/admin/products/${id}/image`,
        {
          method: 'POST',
          body: fd,
        },
      );
      const next = res.imageUrl || `/catalog/media/${encodeURIComponent(id)}?v=${Date.now()}`;
      setImageUrl(next);
      const copied = res.appliedTo?.length ?? 0;
      setOk(
        copied
          ? `Image enregistrée et appliquée à ${copied} autre(s) format(s). La boutique se synchronise au prochain chargement.`
          : res.hint || 'Image enregistrée. Aperçu à jour — la boutique se synchronise au prochain chargement catalogue.',
      );
      if (copied) {
        setSiblings((list) =>
          list.map((item) => ({
            ...item,
            imageUrl: `/catalog/media/${encodeURIComponent(item.id)}?v=${Date.now()}`,
          })),
        );
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const applyCurrentImageToFamily = async () => {
    if (!id || isNew) return;
    setErr('');
    setOk('');
    setSyncingFamily(true);
    try {
      const res = await api<{ appliedTo?: string[]; hint?: string; imageUrl?: string }>(
        `/admin/products/${id}/image/family`,
        { method: 'POST' },
      );
      const copied = res.appliedTo?.length ?? 0;
      setOk(res.hint || (copied ? `Image copiée sur ${copied} format(s).` : 'Aucun autre format.'));
      setSiblings((list) =>
        list.map((item) => ({
          ...item,
          imageUrl: `/catalog/media/${encodeURIComponent(item.id)}?v=${Date.now()}`,
        })),
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSyncingFamily(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2>
            {isNew
              ? 'Nouveau produit'
              : productFamilyName(form.name, form.unit) || form.name || 'Fiche produit'}
          </h2>
          <p>
            {isNew
              ? 'Même identifiant que la boutique (slug kebab-case).'
              : siblings.length > 1
                ? `${siblings.length} formats de poids — chaque ligne reste un SKU distinct.`
                : `Identifiant boutique : ${id}`}
          </p>
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
          {shownImage ? (
            <img
              className="thumb"
              style={{ width: '100%', height: 180, objectFit: 'cover', background: '#f3f1ec' }}
              src={shownImage}
              alt={form.name || 'Aperçu produit'}
            />
          ) : (
            <div className="thumb" style={{ width: '100%', height: 180, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
              Aucune image
            </div>
          )}
          <p className="sku">
            {uploading
              ? 'Envoi en cours…'
              : previewUrl
                ? 'Aperçu local — synchronisation serveur…'
                : imageUrl.includes('?v=')
                  ? 'Image personnalisée (synchronisée boutique).'
                  : `Image catalogue : ${id || '…'}`}
          </p>
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg"
            disabled={uploading || isNew}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void upload(file);
            }}
          />
          {!isNew && siblings.length > 1 ? (
            <label className="field" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 }}>
              <input
                type="checkbox"
                checked={applyToFamily}
                onChange={(e) => setApplyToFamily(e.target.checked)}
              />
              <span>
                Appliquer cette image à tous les formats de poids
                <span className="sku" style={{ display: 'block', marginTop: 2 }}>
                  {siblings.length - 1} autre(s) SKU de la même famille.
                </span>
              </span>
            </label>
          ) : null}
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
      {!isNew && siblings.length > 1 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Formats de poids</h3>
              <p className="sku" style={{ margin: '6px 0 0' }}>
                Même photo pour toute la famille, ou ouvrez une fiche pour un visuel distinct.
              </p>
            </div>
            <button
              className="btn ghost"
              type="button"
              disabled={syncingFamily || uploading}
              onClick={() => void applyCurrentImageToFamily()}>
              {syncingFamily ? 'Copie…' : 'Appliquer l’image à tous'}
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Poids</th>
                <th>SKU</th>
                <th>Prix</th>
                <th>Stock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {siblings.map((item) => {
                const current = item.id === id;
                const thumb = mediaUrl(item.imageUrl || `/catalog/media/${encodeURIComponent(item.id)}`);
                return (
                  <tr key={item.id} style={current ? { background: 'rgba(47, 111, 176, 0.08)' } : undefined}>
                    <td>
                      <img
                        className="thumb"
                        src={thumb}
                        alt=""
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }}
                      />
                    </td>
                    <td>
                      <strong>{item.payload.unit || '—'}</strong>
                    </td>
                    <td className="sku">{item.payload.sku || item.id}</td>
                    <td>{formatFcfa(Number(item.payload.price ?? 0))}</td>
                    <td>
                      <span className={`pill ${(item.stock?.available ?? 0) > 0 ? 'ok' : 'out'}`}>
                        {item.stock?.available ?? 0} u.
                      </span>
                    </td>
                    <td>
                      {current ? (
                        <span className="sku">Fiche ouverte</span>
                      ) : (
                        <Link className="btn ghost" to={`/produits/${item.id}`}>
                          Ouvrir
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {err ? <p className="err">{err}</p> : null}
      {ok ? <p style={{ color: 'var(--ok)' }}>{ok}</p> : null}
      <button className="btn gold" style={{ marginTop: 16 }} type="button" onClick={() => void save()}>
        Enregistrer
      </button>
    </>
  );
}
