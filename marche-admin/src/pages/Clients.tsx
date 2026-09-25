import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, ContactRound } from 'lucide-react';
import { formatFcfa } from '@/lib/api';
import { needleOf, textMatch, useCachedResource } from '@/lib/cachedApi';
import { formatWhen } from '@/lib/orderLabels';

export type ShopUserRow = {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  onboardingDone: boolean;
  orders: number;
  delivered: number;
  cancelled: number;
  spent: number;
  tips: number;
  lastOrderAt: string | null;
};

type SortKey = 'name' | 'orders' | 'spent' | 'tips' | 'last';

const COLS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Client' },
  { key: 'orders', label: 'Commandes' },
  { key: 'spent', label: 'Dépensé' },
  { key: 'tips', label: 'Pourboires' },
  { key: 'last', label: 'Dernière commande' },
];

export function ClientsPage() {
  const nav = useNavigate();
  const { data } = useCachedResource<{ users: ShopUserRow[]; total: number }>('shop-users', '/admin/shop-users', 'clients');
  const users = data?.users ?? [];
  const total = data?.total ?? users.length;
  const [q, setQ] = useState('');
  const err = '';
  const [sortKey, setSortKey] = useState<SortKey>('last');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    const needle = needleOf(q);
    return users.filter((u) => textMatch(needle, u.firstName, u.lastName, u.email, u.phone));
  }, [users, q]);

  const rows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let d = 0;
      if (sortKey === 'name') {
        d = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr', { sensitivity: 'base' });
      } else if (sortKey === 'orders') d = a.orders - b.orders;
      else if (sortKey === 'spent') d = a.spent - b.spent;
      else if (sortKey === 'tips') d = a.tips - b.tips;
      else d = new Date(a.lastOrderAt || 0).getTime() - new Date(b.lastOrderAt || 0).getTime();
      return d * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((x) => (x === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const withOrders = users.filter((u) => u.orders > 0).length;

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Clients Marché Doré</h2>
          <p>
            Comptes de l’app boutique (pas le staff CourseGO). Commandes, panier dépensé, pourboires laissés au
            coursier, annulations.
          </p>
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="k">Comptes</div>
          <div className="v">{total}</div>
          <small>Inscrits dans public.users.</small>
        </div>
        <div className="card stat">
          <div className="k">Ont commandé</div>
          <div className="v">{withOrders}</div>
          <small>Au moins une commande sur ce magasin.</small>
        </div>
        <div className="card stat">
          <div className="k">Annulations</div>
          <div className="v">{users.reduce((a, u) => a + u.cancelled, 0)}</div>
          <small>Commandes annulées (tous clients listés).</small>
        </div>
        <div className="card stat">
          <div className="k">Pourboires</div>
          <div className="v">{formatFcfa(users.reduce((a, u) => a + u.tips, 0))}</div>
          <small>Somme des pourboires laissés avec un avis.</small>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <label className="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, téléphone…" />
        </label>
      </div>

      <div className="card table-card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              {COLS.map((c) => {
                const on = sortKey === c.key;
                const Icon = !on ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key}>
                    <button type="button" className={`th-sort${on ? ' on' : ''}`} onClick={() => toggleSort(c.key)}>
                      {c.label}
                      <Icon size={14} strokeWidth={2.2} aria-hidden />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="row-link" onClick={() => nav(`/clients/${encodeURIComponent(u.id)}`)}>
                <td>
                  <strong>
                    {u.firstName} {u.lastName}
                  </strong>
                  <small>
                    {u.phone || u.email}
                    {!u.onboardingDone ? ' · onboarding incomplet' : ''}
                  </small>
                </td>
                <td>
                  {u.orders}
                  <small>
                    {u.delivered} livrées
                    {u.cancelled ? ` · ${u.cancelled} annulées` : ''}
                  </small>
                </td>
                <td>{u.spent ? formatFcfa(u.spent) : '—'}</td>
                <td>{u.tips ? formatFcfa(u.tips) : '—'}</td>
                <td>{u.lastOrderAt ? formatWhen(u.lastOrderAt) : 'Jamais'}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--muted)', padding: 24 }}>
                  <ContactRound size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  Aucun client boutique pour cette recherche.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
