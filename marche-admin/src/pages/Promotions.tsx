import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Banner = { id: string; payload: { title?: string; subtitle?: string; cta?: string; href?: string } };

export function PromotionsPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [msg, setMsg] = useState('');

  const load = () => api<{ banners: Banner[] }>('/admin/banners').then((r) => setBanners(r.banners));
  useEffect(() => {
    void load();
  }, []);

  const save = async (b: Banner) => {
    setMsg('');
    await api(`/admin/banners/${b.id}`, { method: 'PATCH', body: JSON.stringify(b.payload) });
    setMsg('Bannière enregistrée. Image bundlée — le texte part en boutique via hydrate.');
    void load();
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Promotions accueil</h2>
          <p>Titres des bannières (semaine, rentrée, boissons…). Les visuels restent bundlés.</p>
        </div>
      </div>
      <div className="grid">
        {banners.map((b) => (
          <div className="card form-grid" key={b.id}>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              {b.id} — titre
              <input
                value={String(b.payload.title ?? '')}
                onChange={(e) =>
                  setBanners((all) => all.map((x) => (x.id === b.id ? { ...x, payload: { ...x.payload, title: e.target.value } } : x)))
                }
              />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              Sous-titre
              <input
                value={String(b.payload.subtitle ?? '')}
                onChange={(e) =>
                  setBanners((all) =>
                    all.map((x) => (x.id === b.id ? { ...x, payload: { ...x.payload, subtitle: e.target.value } } : x)),
                  )
                }
              />
            </label>
            <label className="field">
              Bouton
              <input
                value={String(b.payload.cta ?? '')}
                onChange={(e) =>
                  setBanners((all) => all.map((x) => (x.id === b.id ? { ...x, payload: { ...x.payload, cta: e.target.value } } : x)))
                }
              />
            </label>
            <label className="field">
              Lien
              <input
                value={String(b.payload.href ?? '')}
                onChange={(e) =>
                  setBanners((all) => all.map((x) => (x.id === b.id ? { ...x, payload: { ...x.payload, href: e.target.value } } : x)))
                }
              />
            </label>
            <button className="btn gold" type="button" onClick={() => void save(b)}>
              Enregistrer
            </button>
          </div>
        ))}
      </div>
      {msg ? <p style={{ color: 'var(--ok)' }}>{msg}</p> : null}
    </>
  );
}
