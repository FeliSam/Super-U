import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatFcfa } from '@/lib/api';
import { DELIVERY_STATUS, ORDER_STATUS, formatWhen, orderPillClass } from '@/lib/orderLabels';

type Detail = {
  user: {
    id: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    createdAt: string;
    onboardingDone: boolean;
    birthDate: string;
    loyaltyBonusPts: number;
    addresses: { label?: string; line?: string; city?: string; phone?: string }[];
  };
  stats: {
    orders: number;
    delivered: number;
    cancelled: number;
    open: number;
    spent: number;
    tips: number;
    ratingAvg: number;
    ratingCount: number;
  };
  orders: {
    id: string;
    status: string;
    total: number;
    itemCount: number;
    storeName: string | null;
    createdAt: string;
    deliveryStatus: string | null;
    tip: number;
  }[];
  ratings: {
    id: string;
    orderId: string;
    rating: number;
    comment: string;
    tipAmount: number;
    createdAt: string;
  }[];
};

function stars(n: number) {
  const r = Math.round(n);
  return '★'.repeat(Math.max(0, Math.min(5, r))) + '☆'.repeat(Math.max(0, 5 - r));
}

export function ClientDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    api<Detail>(`/admin/shop-users/${encodeURIComponent(id)}`)
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, [id]);

  if (!data) return <p style={{ padding: 24 }}>{err || 'Chargement…'}</p>;
  const { user, stats } = data;

  return (
    <>
      <div className="topbar">
        <div>
          <p className="hint-line">
            <Link to="/clients">← Clients Marché Doré</Link>
          </p>
          <h2>
            {user.firstName} {user.lastName}
          </h2>
          <p>
            Compte boutique · inscrit {formatWhen(user.createdAt)}
            {user.onboardingDone ? '' : ' · onboarding incomplet'}
          </p>
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="k">Commandes</div>
          <div className="v">{stats.orders}</div>
          <small>
            {stats.open} en cours · {stats.delivered} livrées · {stats.cancelled} annulées
          </small>
        </div>
        <div className="card stat">
          <div className="k">Dépensé</div>
          <div className="v">{formatFcfa(stats.spent)}</div>
          <small>Hors commandes annulées.</small>
        </div>
        <div className="card stat">
          <div className="k">Pourboires</div>
          <div className="v">{formatFcfa(stats.tips)}</div>
          <small>Laissés au coursier avec l’avis.</small>
        </div>
        <div className="card stat">
          <div className="k">Avis donnés</div>
          <div className="v">{stats.ratingCount ? stats.ratingAvg.toFixed(1) : '—'}</div>
          <small>{stats.ratingCount ? `${stats.ratingCount} notes` : 'Aucun avis.'}</small>
        </div>
        <div className="card stat">
          <div className="k">Fidélité</div>
          <div className="v">{user.loyaltyBonusPts}</div>
          <small>Points bonus enregistrés sur le compte.</small>
        </div>
      </div>

      <div className="floor-split">
        <div className="card table-card" style={{ padding: 0 }}>
          <div className="dash-card-head" style={{ padding: '14px 14px 0' }}>
            <h3>Commandes</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Statut</th>
                <th>Articles</th>
                <th>Prix</th>
                <th>Pourboire</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/commandes/${encodeURIComponent(o.id)}`}>{formatWhen(o.createdAt)}</Link>
                    <small>{o.storeName || o.id.slice(0, 10)}</small>
                  </td>
                  <td>
                    <span className={`pill ${orderPillClass(o.status, o.deliveryStatus)}`}>
                      {o.deliveryStatus === 'failed'
                        ? 'Échouée'
                        : ORDER_STATUS[o.status] ?? o.status}
                    </span>
                    {o.deliveryStatus ? (
                      <small>{DELIVERY_STATUS[o.deliveryStatus] ?? o.deliveryStatus}</small>
                    ) : null}
                  </td>
                  <td>{o.itemCount}</td>
                  <td>{formatFcfa(o.total)}</td>
                  <td>{o.tip ? formatFcfa(o.tip) : '—'}</td>
                </tr>
              ))}
              {!data.orders.length ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--muted)', padding: 20 }}>
                    Aucune commande.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Coordonnées</h3>
            <p className="hint-line" style={{ marginBottom: 8 }}>
              {user.email}
              <br />
              {user.phone || 'Pas de téléphone'}
              {user.birthDate ? (
                <>
                  <br />
                  Né(e) le {user.birthDate}
                </>
              ) : null}
            </p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Adresses</h3>
            <ul className="dash-list">
              {user.addresses.map((a, i) => (
                <li key={i}>
                  <span>
                    {a.label || 'Adresse'}
                    <small>
                      {[a.line, a.city].filter(Boolean).join(', ') || '—'}
                      {a.phone ? ` · ${a.phone}` : ''}
                    </small>
                  </span>
                </li>
              ))}
              {!user.addresses.length ? <li style={{ color: 'var(--muted)' }}>Aucune adresse enregistrée.</li> : null}
            </ul>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Avis laissés</h3>
            <ul className="dash-list">
              {data.ratings.map((r) => (
                <li key={r.id} style={{ alignItems: 'flex-start' }}>
                  <span>
                    <strong>{stars(r.rating)}</strong>
                    <small>
                      {formatWhen(r.createdAt)} ·{' '}
                      <Link to={`/commandes/${encodeURIComponent(r.orderId)}`}>commande</Link>
                      {r.comment ? ` — ${r.comment}` : ''}
                    </small>
                  </span>
                  {r.tipAmount > 0 ? <strong>{formatFcfa(r.tipAmount)}</strong> : null}
                </li>
              ))}
              {!data.ratings.length ? <li style={{ color: 'var(--muted)' }}>Pas encore d’avis.</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
