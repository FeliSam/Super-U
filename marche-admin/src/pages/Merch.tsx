import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function MerchPage() {
  const [popular, setPopular] = useState('');
  const [recommended, setRecommended] = useState('');
  const [trending, setTrending] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<{ merch: { popularIds?: string[]; recommendedIds?: string[]; trendingTerms?: string[] } }>('/admin/merch').then(
      (r) => {
        setPopular((r.merch.popularIds ?? []).join(', '));
        setRecommended((r.merch.recommendedIds ?? []).join(', '));
        setTrending((r.merch.trendingTerms ?? []).join(', '));
      },
    );
  }, []);

  const parse = (s: string) =>
    s
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const save = async () => {
    setMsg('');
    await api('/admin/merch', {
      method: 'PUT',
      body: JSON.stringify({
        popularIds: parse(popular),
        recommendedIds: parse(recommended),
        trendingTerms: parse(trending),
      }),
    });
    setMsg('Vitrine enregistrée. La boutique lit popular / recommandés au hydrate /catalog.');
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Populaires, reco, tendances</h2>
          <p>Identifiants produits (tomates, bananes…) séparés par des virgules — les mêmes ids que le catalogue.</p>
        </div>
      </div>
      <div className="card" style={{ display: 'grid', gap: 14 }}>
        <label className="field">
          Populaires (home)
          <textarea value={popular} onChange={(e) => setPopular(e.target.value)} />
        </label>
        <label className="field">
          Recommandés
          <textarea value={recommended} onChange={(e) => setRecommended(e.target.value)} />
        </label>
        <label className="field">
          Termes tendance (Explorer)
          <textarea value={trending} onChange={(e) => setTrending(e.target.value)} />
        </label>
        <button className="btn gold" type="button" onClick={() => void save()}>
          Publier la vitrine
        </button>
        {msg ? <p style={{ color: 'var(--ok)' }}>{msg}</p> : null}
      </div>
    </>
  );
}
