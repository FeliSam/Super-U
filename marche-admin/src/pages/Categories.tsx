import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Cat = { id: string; payload: { title?: string; flex?: number; height?: number } };
type Chip = {
  id: string;
  payload: { label?: string; emoji?: string; categoryId?: string; filter?: string };
};

const BOUTIQUE = 'http://127.0.0.1:8081';

export function CategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api<{ categories: Cat[] }>('/admin/categories').then((r) => setCats(r.categories));
    api<{ chips: Chip[] }>('/admin/chips').then((r) => setChips(r.chips));
  }, []);

  const catTitle = useMemo(() => {
    const map = new Map(cats.map((c) => [c.id, String(c.payload.title ?? c.id)]));
    return (id: string) => map.get(id) ?? id;
  }, [cats]);

  const visibleCats = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? cats.filter(
          (c) =>
            c.id.includes(needle) || String(c.payload.title ?? '').toLowerCase().includes(needle),
        )
      : cats;
    return [...list].sort((a, b) =>
      String(a.payload.title ?? a.id).localeCompare(String(b.payload.title ?? b.id), 'fr'),
    );
  }, [cats, q]);

  const visibleChips = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return chips;
    return chips.filter(
      (c) =>
        c.id.includes(needle) ||
        String(c.payload.label ?? '').toLowerCase().includes(needle) ||
        String(c.payload.emoji ?? '').includes(needle),
    );
  }, [chips, q]);

  const saveCat = async (c: Cat) => {
    setErr('');
    setSaving(`cat-${c.id}`);
    try {
      await api(`/admin/categories/${c.id}`, { method: 'PATCH', body: JSON.stringify({ title: c.payload.title }) });
      setMsg(`Rayon « ${c.payload.title} » publié — Explorer et les fiches produit l’affichent.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const saveChip = async (c: Chip) => {
    setErr('');
    setSaving(`chip-${c.id}`);
    try {
      await api(`/admin/chips/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          label: c.payload.label,
          emoji: c.payload.emoji,
          categoryId: c.payload.categoryId,
        }),
      });
      setMsg(`Puce « ${c.payload.label} » publiée — Accueil, sous le bandeau.`);
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
          <h2>Rayons & accès rapide</h2>
          <p>Noms affichés dans la boutique. Les identifiants techniques ne changent pas.</p>
        </div>
        <a className="btn ghost" href={`${BOUTIQUE}/explore`} target="_blank" rel="noreferrer">
          Voir Explorer
        </a>
      </div>

      <div className="card how-card">
        <h3>À quoi sert cette page</h3>
        <ol>
          <li>
            <strong>Rayons</strong> — titres des tuiles sur l’onglet Explorer (grille « Rayons ») et
            de l’écran catégorie. Un produit appartient à un rayon via son id (
            <code>fruits-legumes</code>, <code>viandes</code>…). On ne crée pas de rayon ici : on
            renomme ce que le client lit.
          </li>
          <li>
            <strong>Accès rapide</strong> — pastilles rondes sous le hero Accueil. Un tap ouvre un
            rayon (éventuellement filtré, ex. Fruits vs Légumes). L’emoji est un rappel admin ; en
            boutique le visuel reste la photo bundlée.
          </li>
        </ol>
        <p className="sku" style={{ margin: 0 }}>
          Après enregistrement : sync / rechargement de l’app client. Le catalogue admin (filtre
          Rayon) reprend les mêmes titres.
        </p>
      </div>

      <div className="card" style={{ margin: '16px 0' }}>
        <label className="field">
          Rechercher un rayon ou une puce
          <input value={q} placeholder="Épices, bebe, 🥭…" onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="aisle-board">
        <section className="card">
          <div className="banner-meta">
            <div>
              <h3>Rayons Explorer</h3>
              <p>{visibleCats.length} intitulés · tuiles de l’onglet Explorer</p>
            </div>
          </div>
          <ul className="aisle-list">
            {visibleCats.map((c) => (
              <li key={c.id} className="aisle-row">
                <code className="aisle-id">{c.id}</code>
                <label className="field" style={{ margin: 0, minWidth: 0 }}>
                  Nom affiché
                  <input
                    value={String(c.payload.title ?? '')}
                    onChange={(e) =>
                      setCats((all) =>
                        all.map((x) =>
                          x.id === c.id ? { ...x, payload: { ...x.payload, title: e.target.value } } : x,
                        ),
                      )
                    }
                    onKeyDown={(e) => e.key === 'Enter' && void saveCat(c)}
                  />
                </label>
                <button
                  className="btn gold sm"
                  type="button"
                  disabled={saving === `cat-${c.id}`}
                  onClick={() => void saveCat(c)}>
                  {saving === `cat-${c.id}` ? '…' : 'Enregistrer'}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="banner-meta">
            <div>
              <h3>Accès rapide Accueil</h3>
              <p>{visibleChips.length} pastilles · lien vers un rayon</p>
            </div>
            <a className="btn ghost sm" href={BOUTIQUE} target="_blank" rel="noreferrer">
              Voir Accueil
            </a>
          </div>
          <ul className="aisle-list">
            {visibleChips.map((c) => (
              <li key={c.id} className="chip-row">
                <span className="chip-preview" aria-hidden>
                  {c.payload.emoji || '•'}
                </span>
                <label className="field" style={{ margin: 0, minWidth: 56, flex: '0 0 56px' }}>
                  Emoji
                  <input
                    value={String(c.payload.emoji ?? '')}
                    onChange={(e) =>
                      setChips((all) =>
                        all.map((x) =>
                          x.id === c.id ? { ...x, payload: { ...x.payload, emoji: e.target.value } } : x,
                        ),
                      )
                    }
                  />
                </label>
                <label className="field" style={{ margin: 0, minWidth: 0 }}>
                  Libellé
                  <input
                    value={String(c.payload.label ?? '')}
                    onChange={(e) =>
                      setChips((all) =>
                        all.map((x) =>
                          x.id === c.id ? { ...x, payload: { ...x.payload, label: e.target.value } } : x,
                        ),
                      )
                    }
                    onKeyDown={(e) => e.key === 'Enter' && void saveChip(c)}
                  />
                </label>
                <label className="field" style={{ margin: 0, minWidth: 140 }}>
                  Ouvre le rayon
                  <select
                    value={String(c.payload.categoryId ?? '')}
                    onChange={(e) =>
                      setChips((all) =>
                        all.map((x) =>
                          x.id === c.id
                            ? { ...x, payload: { ...x.payload, categoryId: e.target.value } }
                            : x,
                        ),
                      )
                    }>
                    {cats.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {catTitle(cat.id)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn gold sm"
                  type="button"
                  disabled={saving === `chip-${c.id}`}
                  onClick={() => void saveChip(c)}>
                  {saving === `chip-${c.id}` ? '…' : 'Enregistrer'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {msg ? <p style={{ color: 'var(--ok)' }}>{msg}</p> : null}
      {err ? <p className="err">{err}</p> : null}
    </>
  );
}
