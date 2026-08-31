import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type BannerPayload = {
  title?: string;
  subtitle?: string;
  cta?: string;
  href?: string;
  enabled?: boolean;
};

type Banner = { id: string; payload: BannerPayload };
type Cat = { id: string; payload: { title?: string } };

const SLOTS: Record<
  string,
  { label: string; where: string; photo: string; boutiquePath: string }
> = {
  semaine: {
    label: 'Accueil',
    where: 'Onglet Accueil, sous les filtres (chips). Un tap ouvre le rayon du lien.',
    photo: 'promo.png',
    boutiquePath: '/',
  },
  rentree: {
    label: 'Explorer',
    where: 'Onglet Explorer, sous les raccourcis rayons.',
    photo: 'promo-rentree.png',
    boutiquePath: '/explore',
  },
  boissons: {
    label: 'Promotions',
    where: 'Écran Promotions uniquement (carrousel « Campagnes »), avec les deux autres.',
    photo: 'promo-boissons.png',
    boutiquePath: '/promotions',
  },
};

const BOUTIQUE = 'http://127.0.0.1:8081';

function categoryFromHref(href: string) {
  const path = href.split('?')[0] ?? '';
  return path.replace(/^\/category\//, '') || '';
}

function filterFromHref(href: string) {
  const qs = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  return new URLSearchParams(qs).get('filter') ?? '';
}

function buildHref(categoryId: string, filter: string) {
  const base = `/category/${categoryId || 'fruits-legumes'}`;
  const f = filter.trim();
  return f ? `${base}?filter=${encodeURIComponent(f)}` : base;
}

export function PromotionsPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => api<{ banners: Banner[] }>('/admin/banners').then((r) => setBanners(r.banners));

  useEffect(() => {
    void load();
    api<{ categories: Cat[] }>('/admin/categories').then((r) => setCats(r.categories));
  }, []);

  const patch = (id: string, payload: Partial<BannerPayload>) => {
    setBanners((all) =>
      all.map((x) => (x.id === id ? { ...x, payload: { ...x.payload, ...payload } } : x)),
    );
  };

  const save = async (b: Banner) => {
    setMsg('');
    setErr('');
    setSaving(b.id);
    try {
      await api(`/admin/banners/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: b.payload.title,
          subtitle: b.payload.subtitle,
          cta: b.payload.cta,
          href: b.payload.href,
          enabled: b.payload.enabled !== false,
        }),
      });
      setMsg(`« ${b.payload.title || b.id} » publié. La boutique le reprend au prochain sync catalogue.`);
      void load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Bannières boutique</h2>
          <p>
            Trois emplacements fixes dans l’app client. Ici vous changez le texte, le bouton et la
            destination — pas les photos.
          </p>
        </div>
        <a className="btn ghost" href={`${BOUTIQUE}/promotions`} target="_blank" rel="noreferrer">
          Voir l’écran Promotions
        </a>
      </div>

      <div className="card how-card">
        <h3>Comment ça marche</h3>
        <ol>
          <li>
            Vous enregistrez titre, sous-titre, libellé du bouton et lien vers un <strong>rayon</strong>.
          </li>
          <li>
            La boutique (Marché Doré) récupère ça via l’API catalogue, comme les prix. Après un
            refresh / sync, le texte change sans republier l’app.
          </li>
          <li>
            Le visuel reste bundlé dans l’app (
            <code>promo.png</code>, <code>promo-rentree.png</code>, <code>promo-boissons.png</code>
            ).
          </li>
          <li>
            Les vrais produits en promo (−15 %, prix barré) se gèrent dans{' '}
            <strong>Catalogue</strong> (ancien prix), pas ici. Cette page = campagnes d’accueil.
          </li>
        </ol>
        <p className="sku" style={{ marginBottom: 0 }}>
          Les trois cartes apparaissent ensemble dans Accueil → « En réduction / Voir tout » →
          écran Promotions, section Campagnes.
        </p>
      </div>

      <div className="banner-board">
        {[...banners]
          .sort((a, b) => {
            const order = ['semaine', 'rentree', 'boissons'];
            const ia = order.indexOf(a.id);
            const ib = order.indexOf(b.id);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          })
          .map((b) => {
          const slot = SLOTS[b.id] ?? {
            label: b.id,
            where: 'Emplacement catalogue.',
            photo: 'bundlé',
            boutiquePath: '/',
          };
          const live = b.payload.enabled !== false;
          const href = String(b.payload.href ?? '');
          const catId = categoryFromHref(href);
          const filter = filterFromHref(href);
          return (
            <article className={`card banner-editor${live ? '' : ' is-off'}`} key={b.id}>
              <div className="banner-preview" aria-hidden>
                <span className="banner-preview-slot">{slot.label}</span>
                <strong>{b.payload.title || 'Titre'}</strong>
                <span>{b.payload.subtitle || 'Sous-titre'}</span>
                <em>{b.payload.cta || 'Bouton'}</em>
              </div>
              <div className="banner-meta">
                <div>
                  <h3>{slot.label}</h3>
                  <p>{slot.where}</p>
                  <p className="sku">Photo : {slot.photo} · id {b.id}</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={live}
                    onChange={(e) => patch(b.id, { enabled: e.target.checked })}
                  />
                  {live ? 'Visible' : 'Masquée'}
                </label>
              </div>
              <div className="form-grid">
                <label className="field" style={{ gridColumn: '1 / -1' }}>
                  Titre (gros texte sur la photo)
                  <input
                    value={String(b.payload.title ?? '')}
                    onChange={(e) => patch(b.id, { title: e.target.value })}
                  />
                </label>
                <label className="field" style={{ gridColumn: '1 / -1' }}>
                  Sous-titre (offre, période…)
                  <input
                    value={String(b.payload.subtitle ?? '')}
                    onChange={(e) => patch(b.id, { subtitle: e.target.value })}
                  />
                </label>
                <label className="field">
                  Bouton
                  <input
                    value={String(b.payload.cta ?? '')}
                    onChange={(e) => patch(b.id, { cta: e.target.value })}
                  />
                </label>
                <label className="field">
                  Rayon ouvert au tap
                  <select
                    value={catId}
                    onChange={(e) => patch(b.id, { href: buildHref(e.target.value, filter) })}>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {String(c.payload.title ?? c.id)}
                      </option>
                    ))}
                    {catId && !cats.some((c) => c.id === catId) ? (
                      <option value={catId}>{catId}</option>
                    ) : null}
                  </select>
                </label>
                <label className="field" style={{ gridColumn: '1 / -1' }}>
                  Filtre rayon (optionnel, ex. Fruits)
                  <input
                    value={filter}
                    placeholder="vide = tout le rayon"
                    onChange={(e) => patch(b.id, { href: buildHref(catId, e.target.value) })}
                  />
                </label>
              </div>
              <p className="sku">Lien boutique : {href || '—'}</p>
              <div className="row">
                <button className="btn gold" type="button" disabled={saving === b.id} onClick={() => void save(b)}>
                  {saving === b.id ? 'Publication…' : 'Publier cette bannière'}
                </button>
                <a className="btn ghost" href={`${BOUTIQUE}${slot.boutiquePath}`} target="_blank" rel="noreferrer">
                  Voir l’emplacement
                </a>
              </div>
            </article>
          );
        })}
      </div>
      {msg ? <p style={{ color: 'var(--ok)' }}>{msg}</p> : null}
      {err ? <p className="err">{err}</p> : null}
    </>
  );
}
