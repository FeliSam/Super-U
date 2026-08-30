import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Cat = { id: string; payload: { title?: string; flex?: number; height?: number } };
type Chip = { id: string; payload: { label?: string; emoji?: string; categoryId?: string } };

export function CategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<{ categories: Cat[] }>('/admin/categories').then((r) => setCats(r.categories));
    api<{ chips: Chip[] }>('/admin/chips').then((r) => setChips(r.chips));
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Rayons & accès rapide</h2>
          <p>Les ids (fruits-legumes, viandes…) restent stables. Seuls titres et libellés bougent.</p>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <h3>Catégories</h3>
          {cats.map((c) => (
            <div key={c.id} className="row" style={{ marginBottom: 8 }}>
              <span className="sku" style={{ width: 140 }}>
                {c.id}
              </span>
              <input
                value={String(c.payload.title ?? '')}
                onChange={(e) =>
                  setCats((all) => all.map((x) => (x.id === c.id ? { ...x, payload: { ...x.payload, title: e.target.value } } : x)))
                }
              />
              <button
                className="btn ghost"
                type="button"
                onClick={async () => {
                  await api(`/admin/categories/${c.id}`, { method: 'PATCH', body: JSON.stringify({ title: c.payload.title }) });
                  setMsg('Rayon enregistré');
                }}>
                OK
              </button>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Puces home</h3>
          {chips.map((c) => (
            <div key={c.id} className="row" style={{ marginBottom: 8 }}>
              <input
                style={{ width: 48 }}
                value={String(c.payload.emoji ?? '')}
                onChange={(e) =>
                  setChips((all) => all.map((x) => (x.id === c.id ? { ...x, payload: { ...x.payload, emoji: e.target.value } } : x)))
                }
              />
              <input
                value={String(c.payload.label ?? '')}
                onChange={(e) =>
                  setChips((all) => all.map((x) => (x.id === c.id ? { ...x, payload: { ...x.payload, label: e.target.value } } : x)))
                }
              />
              <button
                className="btn ghost"
                type="button"
                onClick={async () => {
                  await api(`/admin/chips/${c.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ label: c.payload.label, emoji: c.payload.emoji }),
                  });
                  setMsg('Puce enregistrée');
                }}>
                OK
              </button>
            </div>
          ))}
        </div>
      </div>
      {msg ? <p style={{ color: 'var(--ok)' }}>{msg}</p> : null}
    </>
  );
}
