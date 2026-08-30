import { useEffect, useState } from 'react';
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

export function StockPage() {
  const [storeId, setStoreId] = useState('su-aeroport');
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState(0);
  const [pick, setPick] = useState<Item | null>(null);
  const [delta, setDelta] = useState('10');
  const [reason, setReason] = useState('receipt');
  const [note, setNote] = useState('');
  const [toStore, setToStore] = useState('su-ganhi');
  const [msg, setMsg] = useState('');

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
    load();
  }, [storeId]);

  const move = async () => {
    if (!pick) return;
    setMsg('');
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
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Stock par magasin</h2>
          <p>
            {alerts} alerte{alerts > 1 ? 's' : ''} sous le seuil. Entrée, sortie, ajustement, transfert.
          </p>
        </div>
        <select className="field" style={{ minWidth: 220 }} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {String(s.payload.name ?? s.id)}
            </option>
          ))}
        </select>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Dispo</th>
              <th>Réservé</th>
              <th>Seuil</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.productId}>
                <td>
                  <strong>{i.name}</strong>
                  <div className="sku">
                    {i.productId} · {i.unit}
                  </div>
                </td>
                <td>
                  <span className={`pill ${i.alert ? 'out' : 'ok'}`}>{i.available}</span>
                </td>
                <td>{i.reserved}</td>
                <td>{i.minQty}</td>
                <td>
                  <button className="btn ghost" type="button" onClick={() => setPick(i)}>
                    Mouvement
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pick ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>{pick.name}</h3>
          <div className="row">
            <label className="field">
              Quantité
              <input value={delta} onChange={(e) => setDelta(e.target.value)} />
            </label>
            <label className="field">
              Motif
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="receipt">Entrée (réception)</option>
                <option value="sale">Sortie vente</option>
                <option value="adjust">Ajustement</option>
                <option value="shrink">Casse / perte</option>
                <option value="transfer">Transfert magasin</option>
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
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn gold" type="button" onClick={() => void move()}>
              Valider
            </button>
            <button className="btn ghost" type="button" onClick={() => setPick(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}
      {msg ? <p>{msg}</p> : null}
    </>
  );
}
