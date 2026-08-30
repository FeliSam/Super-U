import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

type Stats = { products: number; outOfStock: number; alerts: number; promotions: number };

export function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<{ stats: Stats }>('/admin/overview')
      .then((r) => setStats(r.stats))
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Le magasin, d’un coup d’œil</h2>
          <p>Ce qui manque, ce qui est en promo, ce qu’il faut réapprovisionner.</p>
        </div>
        <Link className="btn gold" to="/produits">
          Ouvrir le catalogue
        </Link>
      </div>
      {err ? <p className="err">{err}</p> : null}
      <div className="grid stats">
        <div className="card stat">
          <div className="k">Références</div>
          <div className="v">{stats?.products ?? '—'}</div>
        </div>
        <div className="card stat">
          <div className="k">Ruptures</div>
          <div className="v">{stats?.outOfStock ?? '—'}</div>
        </div>
        <div className="card stat">
          <div className="k">Alertes stock</div>
          <div className="v">{stats?.alerts ?? '—'}</div>
        </div>
        <div className="card stat">
          <div className="k">En promotion</div>
          <div className="v">{stats?.promotions ?? '—'}</div>
        </div>
      </div>
      <p style={{ color: 'var(--muted)', marginTop: 22, maxWidth: 640 }}>
        Les commandes déjà payées gardent le prix encaissé. Ici vous changez le rayon, le prix affiché en boutique, et le stock par magasin Super U.
      </p>
    </>
  );
}
