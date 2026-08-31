import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, ShoppingBag } from 'lucide-react';
import { api, formatFcfa } from '@/lib/api';
import { DELIVERY_STATUS, ORDER_STATUS, PICK_STATUS, formatWhen, orderPillClass } from '@/lib/orderLabels';

type Counts = {
  all: number;
  open: number;
  delivered: number;
  cancelled: number;
  failed: number;
  disputes: number;
  missing: number;
};

export type AdminOrderRow = {
  id: string;
  status: string;
  pickStatus: string | null;
  deliveryStatus: string | null;
  total: number | null;
  subtotal: number | null;
  deliveryFee: number | null;
  pickFee: number | null;
  itemCount: number;
  storeName: string | null;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  missingCount: number;
  notedCount: number;
  incidentCount: number;
};

type SortKey = 'client' | 'status' | 'subtotal' | 'pickFee' | 'deliveryFee' | 'total';
type SortDir = 'asc' | 'desc';

function statusLabel(o: AdminOrderRow) {
  if (o.deliveryStatus === 'failed') return 'Échouée';
  return ORDER_STATUS[o.status] ?? o.status;
}

function num(n: number | null | undefined) {
  return n == null || Number.isNaN(n) ? null : n;
}

function cmpNum(a: number | null, b: number | null, dir: SortDir) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === 'asc' ? a - b : b - a;
}

const COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'client', label: 'Client' },
  { key: 'status', label: 'Statut' },
  { key: 'subtotal', label: 'Panier', numeric: true },
  { key: 'pickFee', label: 'Ramassage', numeric: true },
  { key: 'deliveryFee', label: 'Livraison', numeric: true },
  { key: 'total', label: 'Total', numeric: true },
];

const TABS: { id: keyof Counts; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'open', label: 'En cours' },
  { id: 'delivered', label: 'Réussies' },
  { id: 'failed', label: 'Échouées' },
  { id: 'disputes', label: 'Litiges' },
  { id: 'missing', label: 'Manques' },
  { id: 'cancelled', label: 'Annulées' },
];

export function OrdersPage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<keyof Counts>('all');
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [showMoney, setShowMoney] = useState(false);
  const [err, setErr] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const load = (nextTab = tab, nextQ = q) => {
    const p = new URLSearchParams();
    if (nextQ.trim()) p.set('q', nextQ.trim());
    if (nextTab !== 'all') p.set('tab', nextTab);
    api<{ orders: AdminOrderRow[]; counts: Counts; showMoney?: boolean }>(`/admin/orders?${p}`)
      .then((r) => {
        setRows(r.orders);
        setCounts(r.counts);
        setShowMoney(Boolean(r.showMoney));
      })
      .catch((e: Error) => setErr(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const list = [...rows];
    list.sort((a, b) => {
      if (sortKey === 'client') {
        const byName = a.customerName.localeCompare(b.customerName, 'fr', { sensitivity: 'base' });
        if (byName) return sortDir === 'asc' ? byName : -byName;
        return sortDir === 'asc'
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortKey === 'status') {
        const by = statusLabel(a).localeCompare(statusLabel(b), 'fr', { sensitivity: 'base' });
        return sortDir === 'asc' ? by : -by;
      }
      const field =
        sortKey === 'subtotal' ? 'subtotal' : sortKey === 'pickFee' ? 'pickFee' : sortKey === 'deliveryFee' ? 'deliveryFee' : 'total';
      return cmpNum(num(a[field]), num(b[field]), sortDir);
    });
    return list;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey, numeric?: boolean) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(numeric ? 'desc' : 'asc');
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Commandes</h2>
          <p>Client, panier, ramassage CourseGO et livraison — cliquez une ligne pour le détail.</p>
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <label className="field" style={{ flex: 2 }}>
            Recherche
            <span className="row" style={{ gap: 8 }}>
              <Search size={16} style={{ opacity: 0.5 }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom client, téléphone, n° commande"
                onKeyDown={(e) => e.key === 'Enter' && load(tab, q)}
              />
            </span>
          </label>
          <button className="btn" type="button" onClick={() => load(tab, q)}>
            Filtrer
          </button>
        </div>
        <div className="seg" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'on' : ''}
              onClick={() => {
                setTab(t.id);
                load(t.id, q);
              }}>
              {t.label}
              {counts ? ` (${counts[t.id]})` : ''}
            </button>
          ))}
        </div>
      </div>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              {COLS.map((c) => {
                const on = sortKey === c.key;
                const Icon = !on ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} aria-sort={on ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className={`th-sort${on ? ' on' : ''}`} onClick={() => toggleSort(c.key, c.numeric)}>
                      {c.label}
                      <Icon size={14} strokeWidth={2.2} aria-hidden />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.id} className="row-link" onClick={() => nav(`/commandes/${encodeURIComponent(o.id)}`)}>
                <td>
                  <strong>{o.customerName}</strong>
                  <small>
                    {o.itemCount} article{o.itemCount > 1 ? 's' : ''} · {formatWhen(o.createdAt)}
                    {o.storeName ? ` · ${o.storeName}` : ''}
                  </small>
                </td>
                <td>
                  <span className={`pill ${orderPillClass(o.status, o.deliveryStatus)}`}>
                    {o.deliveryStatus === 'failed'
                      ? 'Échouée'
                      : ORDER_STATUS[o.status] ?? o.status}
                  </span>
                  <small>
                    {o.pickStatus ? PICK_STATUS[o.pickStatus] ?? o.pickStatus : 'Ramassage'}
                    {o.deliveryStatus ? ` · ${DELIVERY_STATUS[o.deliveryStatus] ?? o.deliveryStatus}` : ''}
                  </small>
                  {o.incidentCount || o.missingCount ? (
                    <small>
                      {o.incidentCount ? `${o.incidentCount} litige${o.incidentCount > 1 ? 's' : ''}` : ''}
                      {o.incidentCount && o.missingCount ? ' · ' : ''}
                      {o.missingCount ? `${o.missingCount} non trouvé${o.missingCount > 1 ? 's' : ''}` : ''}
                    </small>
                  ) : null}
                </td>
                <td>{showMoney && o.subtotal != null ? formatFcfa(o.subtotal) : '—'}</td>
                <td>{showMoney && o.pickFee != null ? formatFcfa(o.pickFee) : '—'}</td>
                <td>{showMoney && o.deliveryFee != null ? formatFcfa(o.deliveryFee) : '—'}</td>
                <td>
                  <strong>{showMoney && o.total != null ? formatFcfa(o.total) : '—'}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="dash-empty" style={{ padding: 24 }}>
            <ShoppingBag size={16} /> Aucune commande sur ce filtre.
          </p>
        ) : (
          <div className="table-foot">{rows.length} commande{rows.length > 1 ? 's' : ''}</div>
        )}
      </div>
      <p className="dash-empty" style={{ marginTop: 12 }}>
        Le ramassage (500 F) est le gain CourseGO magasin. La livraison est ce que le client a payé.
      </p>
    </>
  );
}
