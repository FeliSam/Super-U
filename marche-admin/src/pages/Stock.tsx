import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { api } from '@/lib/api';

type Item = {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  reserved: number;
  minQty: number;
  available: number;
  alert: boolean;
};

type Store = { id: string; payload: { name?: string } };

type StockFilter = 'all' | 'in' | 'out' | 'alert';
type SortKey = 'name' | 'available' | 'reserved' | 'minQty';
type SortDir = 'asc' | 'desc';

const COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Produit' },
  { key: 'available', label: 'Dispo', numeric: true },
  { key: 'reserved', label: 'Réservé', numeric: true },
  { key: 'minQty', label: 'Seuil', numeric: true },
];

const REASONS: { value: string; label: string }[] = [
  { value: 'receipt', label: 'Entrée (réception)' },
  { value: 'sale', label: 'Sortie vente' },
  { value: 'adjust', label: 'Ajustement' },
  { value: 'shrink', label: 'Casse / perte' },
  { value: 'transfer', label: 'Transfert magasin' },
];

export function StockPage() {
  const [storeId, setStoreId] = useState('su-aeroport');
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [pick, setPick] = useState<Item | null>(null);
  const [delta, setDelta] = useState('10');
  const [reason, setReason] = useState('receipt');
  const [note, setNote] = useState('');
  const [toStore, setToStore] = useState('su-ganhi');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const load = () => {
    api<{ items: Item[]; alerts: number }>(`/admin/stock?storeId=${storeId}`).then((r) => {
      setItems(r.items);
      setAlerts(r.alerts);
    });
  };

  useEffect(() => {
    api<{ stores: Store[] }>('/admin/stores').then((r) => setStores(r.stores));
  }, []);

  useEffect(() => {
    setPick(null);
    load();
  }, [storeId]);

  const outCount = useMemo(() => items.filter((i) => i.available <= 0).length, [items]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (filter === 'alert' && !i.alert) return false;
      if (filter === 'out' && i.available > 0) return false;
      if (filter === 'in' && i.available <= 0) return false;
      if (!needle) return true;
      return (
        i.name.toLowerCase().includes(needle) ||
        i.productId.toLowerCase().includes(needle) ||
        i.unit.toLowerCase().includes(needle)
      );
    });
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') {
        const by = a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
        return sortDir === 'asc' ? by : -by;
      }
      const delta = a[sortKey] - b[sortKey];
      return sortDir === 'asc' ? delta : -delta;
    });
  }, [items, q, filter, sortKey, sortDir]);

  const toggleSort = (key: SortKey, numeric?: boolean) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(numeric ? 'desc' : 'asc');
  };

  const move = async () => {
    if (!pick) return;
    setMsg('');
    setBusy(true);
    try {
      await api('/admin/stock/moves', {
        method: 'POST',
        body: JSON.stringify({
          productId: pick.productId,
          storeId,
          delta: Number(delta),
          reason,
          note,
          toStoreId: reason === 'transfer' ? toStore : undefined,
        }),
      });
      setMsg('Mouvement enregistré. inStock boutique synchronisé.');
      setPick(null);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openMove = (item: Item) => {
    setPick(item);
    setMsg('');
    setDelta('10');
    setNote('');
  };

  return (
    <div className={`stock-page${pick ? ' with-drawer' : ''}`}>
      <div className="stock-main">
        <div className="topbar">
          <div>
            <h2>Stock par magasin</h2>
            <p>
              {alerts} alerte{alerts > 1 ? 's' : ''} sous le seuil
              {outCount ? ` · ${outCount} rupture${outCount > 1 ? 's' : ''}` : ''}. Entrée, sortie,
              ajustement, transfert.
            </p>
          </div>
          <select
            className="field"
            style={{ minWidth: 220 }}
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {String(s.payload.name ?? s.id)}
              </option>
            ))}
          </select>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row">
            <label className="field">
              Recherche rapide
              <input
                value={q}
                placeholder="Nom, code, format…"
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <div className="field" style={{ flex: '0 0 auto' }}>
              Filtre
              <div className="row" style={{ gap: 6 }}>
                <button
                  type="button"
                  className={`chip-toggle${filter === 'all' ? ' on' : ''}`}
                  onClick={() => setFilter('all')}>
                  Tous ({items.length})
                </button>
                <button
                  type="button"
                  className={`chip-toggle${filter === 'in' ? ' on' : ''}`}
                  onClick={() => setFilter('in')}>
                  En rayon
                </button>
                <button
                  type="button"
                  className={`chip-toggle${filter === 'alert' ? ' on' : ''}`}
                  onClick={() => setFilter('alert')}>
                  Sous seuil ({alerts})
                </button>
                <button
                  type="button"
                  className={`chip-toggle${filter === 'out' ? ' on' : ''}`}
                  onClick={() => setFilter('out')}>
                  Rupture ({outCount})
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.productId} className={pick?.productId === i.productId ? 'row-active' : undefined}>
                  <td>
                    <strong>{i.name}</strong>
                    <div className="sku">
                      {i.productId} · {i.unit}
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${i.alert || i.available <= 0 ? 'out' : 'ok'}`}>{i.available}</span>
                  </td>
                  <td>{i.reserved}</td>
                  <td>{i.minQty}</td>
                  <td>
                    <button className="btn ghost" type="button" onClick={() => openMove(i)}>
                      Mouvement
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? (
            <p style={{ color: 'var(--muted)', margin: '8px 0 0' }}>Aucun SKU pour ce filtre.</p>
          ) : (
            <p className="sku" style={{ margin: '12px 0 0' }}>
              {visible.length} ligne{visible.length > 1 ? 's' : ''} affichée{visible.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {pick ? (
        <aside className="stock-drawer">
          <div className="stock-drawer-head">
            <div>
              <p className="sku" style={{ margin: 0 }}>
                Mouvement
              </p>
              <h3>{pick.name}</h3>
              <p className="sku" style={{ margin: 0 }}>
                {pick.productId} · {pick.unit}
              </p>
            </div>
            <button className="btn ghost" type="button" onClick={() => setPick(null)}>
              Fermer
            </button>
          </div>
          <div className="stock-drawer-stats">
            <span>
              Dispo <strong>{pick.available}</strong>
            </span>
            <span>
              Réservé <strong>{pick.reserved}</strong>
            </span>
            <span>
              Seuil <strong>{pick.minQty}</strong>
            </span>
          </div>
          <label className="field">
            Quantité
            <input value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="numeric" />
          </label>
          <label className="field">
            Motif
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {reason === 'transfer' ? (
            <label className="field">
              Destination
              <select value={toStore} onChange={(e) => setToStore(e.target.value)}>
                {stores
                  .filter((s) => s.id !== storeId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {String(s.payload.name ?? s.id)}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            Note
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="obligatoire si ajustement" />
          </label>
          {msg ? <p className={msg.startsWith('Mouvement') ? undefined : 'err'}>{msg}</p> : null}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn gold" type="button" disabled={busy} onClick={() => void move()}>
              Valider
            </button>
            <button className="btn ghost" type="button" onClick={() => setPick(null)}>
              Annuler
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
