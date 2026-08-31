import { useEffect, useMemo, useState } from 'react';
import { api, mediaUrl } from '@/lib/api';
import { productFamilyName } from '@/lib/productFamily';

type Product = {
  id: string;
  categoryId: string;
  payload: { name?: string; unit?: string };
  imageUrl: string;
};

type Cat = { id: string; payload: { title?: string } };

const BOUTIQUE = 'http://127.0.0.1:8081';

function PickerLane({
  title,
  role,
  screen,
  ids,
  max,
  catalog,
  onChange,
}: {
  title: string;
  role: string;
  screen: string;
  ids: string[];
  max: number;
  catalog: Product[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return catalog
      .filter((p) => {
        const name = String(p.payload.name ?? '').toLowerCase();
        return name.includes(needle) || p.id.toLowerCase().includes(needle);
      })
      .slice(0, 8);
  }, [catalog, q]);

  const add = (id: string) => {
    if (ids.includes(id) || ids.length >= max) return;
    onChange([...ids, id]);
    setQ('');
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...ids];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j]!, next[index]!];
    onChange(next);
  };

  return (
    <section className="card merch-lane">
      <div className="banner-meta">
        <div>
          <h3>{title}</h3>
          <p>{role}</p>
          <p className="sku">{screen}</p>
        </div>
        <span className="pill ok">
          {ids.length}/{max}
        </span>
      </div>
      <label className="field">
        Ajouter un produit
        <input
          value={q}
          placeholder="Tapez 2 lettres : ail, poulet…"
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {hits.length ? (
        <ul className="merch-hits">
          {hits.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => add(p.id)} disabled={ids.includes(p.id)}>
                <img className="thumb" src={mediaUrl(p.imageUrl)} alt="" />
                <span>
                  <strong>{productFamilyName(String(p.payload.name ?? p.id), p.payload.unit)}</strong>
                  <span className="sku">
                    {p.payload.unit} · {p.id}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <ol className="merch-picked">
        {ids.map((id, index) => {
          const p = byId.get(id);
          return (
            <li key={id}>
              {p ? <img className="thumb" src={mediaUrl(p.imageUrl)} alt="" /> : <span className="thumb" />}
              <div>
                <strong>
                  {p ? productFamilyName(String(p.payload.name ?? id), p.payload.unit) : id}
                </strong>
                <div className="sku">{p ? `${p.payload.unit} · ${id}` : 'introuvable dans le catalogue actuel'}</div>
              </div>
              <button className="chip-toggle" type="button" onClick={() => move(index, -1)} disabled={index === 0}>
                ↑
              </button>
              <button
                className="chip-toggle"
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === ids.length - 1}>
                ↓
              </button>
              <button className="btn ghost" type="button" onClick={() => onChange(ids.filter((x) => x !== id))}>
                Retirer
              </button>
            </li>
          );
        })}
      </ol>
      {!ids.length ? <p className="sku">Aucun produit — la boutique gardera sa sélection par défaut.</p> : null}
    </section>
  );
}

export function MerchPage() {
  const [popular, setPopular] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<string[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [termDraft, setTermDraft] = useState('');
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ merch: { popularIds?: string[]; recommendedIds?: string[]; trendingTerms?: string[] } }>('/admin/merch').then(
      (r) => {
        setPopular(r.merch.popularIds ?? []);
        setRecommended(r.merch.recommendedIds ?? []);
        setTrending(r.merch.trendingTerms ?? []);
      },
    );
    api<{ products: Product[] }>('/admin/products').then((r) => setCatalog(r.products));
    api<{ categories: Cat[] }>('/admin/categories').then((r) => setCats(r.categories));
  }, []);

  const save = async () => {
    setMsg('');
    setErr('');
    setBusy(true);
    try {
      await api('/admin/merch', {
        method: 'PUT',
        body: JSON.stringify({
          popularIds: popular,
          recommendedIds: recommended,
          trendingTerms: trending,
        }),
      });
      setMsg('Vitrine publiée. Accueil / Explorer / panier vide se mettent à jour au prochain sync boutique.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addTerm = () => {
    const t = termDraft.trim();
    if (!t || trending.some((x) => x.toLowerCase() === t.toLowerCase()) || trending.length >= 8) return;
    setTrending([...trending, t]);
    setTermDraft('');
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Vitrine boutique</h2>
          <p>
            Ce n’est pas le catalogue entier : ce sont les sélections éditoriales (mise en avant).
            Les prix et stocks restent dans Catalogue / Stocks.
          </p>
        </div>
        <button className="btn gold" type="button" disabled={busy} onClick={() => void save()}>
          {busy ? 'Publication…' : 'Publier la vitrine'}
        </button>
      </div>

      <div className="card how-card">
        <h3>Rôle réel dans l’app Marché Doré</h3>
        <ol>
          <li>
            <strong>Populaires</strong> — rail horizontal « Populaires / Les plus commandés » sur
            l’onglet <em>Explorer</em>. Aussi utilisé si un filtre accueil n’a pas de rayon. L’accueil
            « Produits populaires » suit le chip (Fruits, Viandes…) : ce n’est pas cette liste.
          </li>
          <li>
            <strong>Recommandés</strong> — grille « Recommandés pour vous » en haut du fil Accueil,
            et suggestions quand le panier est vide.
          </li>
          <li>
            <strong>Termes tendance</strong> — pastilles « Recherches tendance » sous Explorer (tap =
            recherche). Sans termes ici, l’app invente des suggestions depuis le catalogue.
          </li>
        </ol>
        <p className="sku" style={{ margin: 0 }}>
          Après publication, ouvrez la boutique puis tirez pour rafraîchir / relancer l’app : le
          hydrate catalogue remplace les ids par défaut ({cats.length ? `${cats.length} rayons` : '…'}).
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <a className="btn ghost" href={`${BOUTIQUE}/explore`} target="_blank" rel="noreferrer">
            Explorer
          </a>
          <a className="btn ghost" href={BOUTIQUE} target="_blank" rel="noreferrer">
            Accueil
          </a>
        </div>
      </div>

      <div className="merch-board">
        <PickerLane
          title="Populaires"
          role="Mise en avant Explorer."
          screen="Explorer → section Populaires"
          ids={popular}
          max={12}
          catalog={catalog}
          onChange={setPopular}
        />
        <PickerLane
          title="Recommandés"
          role="Fil Accueil + panier vide."
          screen="Accueil → Recommandés pour vous"
          ids={recommended}
          max={16}
          catalog={catalog}
          onChange={setRecommended}
        />
        <section className="card merch-lane">
          <div className="banner-meta">
            <div>
              <h3>Recherches tendance</h3>
              <p>Mots que l’on veut pousser dans la barre Explorer.</p>
              <p className="sku">Explorer → Recherches tendance</p>
            </div>
            <span className="pill ok">
              {trending.length}/8
            </span>
          </div>
          <label className="field">
            Ajouter un terme
            <input
              value={termDraft}
              placeholder="ex. Attiéké, Bissap…"
              onChange={(e) => setTermDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTerm()}
            />
          </label>
          <button className="btn ghost" type="button" onClick={addTerm} disabled={trending.length >= 8}>
            Ajouter
          </button>
          <div className="format-chips" style={{ marginTop: 12 }}>
            {trending.map((term) => (
              <button
                key={term}
                type="button"
                className="format-chip"
                onClick={() => setTrending(trending.filter((t) => t !== term))}
                title="Retirer">
                {term} ×
              </button>
            ))}
          </div>
        </section>
      </div>
      {msg ? <p style={{ color: 'var(--ok)' }}>{msg}</p> : null}
      {err ? <p className="err">{err}</p> : null}
    </>
  );
}
