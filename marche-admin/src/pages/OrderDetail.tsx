import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatFcfa } from '@/lib/api';
import {
  CLIENT_ACTION,
  DELIVERY_STATUS,
  INCIDENT_REASON,
  ORDER_STATUS,
  PICK_STATUS,
  formatWhen,
  orderPillClass,
} from '@/lib/orderLabels';

type Line = {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  pickedQty: number;
  unitPrice: number | null;
  lineTotal: number | null;
  unavailable: boolean;
  note: string;
  replaced: boolean;
};

type Incident = {
  id: string;
  reasonCode: string;
  reasonText: string;
  createdAt: string;
  clientAction: string | null;
  clientNote: string | null;
};

type Detail = {
  id: string;
  status: string;
  pickStatus: string | null;
  deliveryStatus: string | null;
  pickerName: string | null;
  courierName: string | null;
  failedReason: string | null;
  failedReasonCode: string | null;
  total: number | null;
  subtotal: number | null;
  deliveryFee: number | null;
  pickFee: number | null;
  deliverPayout: number | null;
  discount: number | null;
  itemCount: number;
  storeName: string | null;
  paymentLabel: string | null;
  paymentStatus: string | null;
  dayLabel: string | null;
  slotLabel: string | null;
  addressLabel: string | null;
  addressLine: string | null;
  addressCity: string | null;
  addressPhone: string | null;
  comment: string | null;
  createdAt: string;
  customerName: string;
  customerPhone: string;
};

export function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Detail | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<{ type: string; actor: string; at: string }[]>([]);
  const [showMoney, setShowMoney] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    api<{
      order: Detail;
      lines: Line[];
      incidents: Incident[];
      events: { type: string; actor: string; at: string }[];
      showMoney?: boolean;
    }>(`/admin/orders/${encodeURIComponent(id)}`)
      .then((r) => {
        setOrder(r.order);
        setLines(r.lines);
        setIncidents(r.incidents);
        setEvents(r.events);
        setShowMoney(Boolean(r.showMoney));
      })
      .catch((e: Error) => setErr(e.message));
  }, [id]);

  if (!order) return <p style={{ padding: 24 }}>{err || 'Chargement…'}</p>;

  const missing = lines.filter((l) => l.unavailable);
  const replaced = lines.filter((l) => l.replaced || (l.note && !l.unavailable));
  const money = (n: number | null | undefined) => (showMoney && n != null ? formatFcfa(n) : '—');
  const outcome =
    order.deliveryStatus === 'failed'
      ? 'Échouée'
      : order.status === 'delivered'
        ? 'Réussie'
        : order.status === 'cancelled'
          ? 'Annulée'
          : 'En cours';

  return (
    <>
      <div className="topbar">
        <div>
          <p style={{ margin: 0 }}>
            <Link to="/commandes">← Commandes</Link>
          </p>
          <h2>{order.customerName}</h2>
          <p>
            {order.id} · {formatWhen(order.createdAt)}
            {order.storeName ? ` · ${order.storeName}` : ''}
          </p>
        </div>
        <span className={`pill ${orderPillClass(order.status, order.deliveryStatus)}`}>{outcome}</span>
      </div>
      {err ? <p className="err">{err}</p> : null}

      <div className="dash-split" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="k">Panier</div>
          <div className="v">{money(order.subtotal)}</div>
        </div>
        <div className="card stat">
          <div className="k">Ramassage</div>
          <div className="v">{money(order.pickFee)}</div>
        </div>
        <div className="card stat">
          <div className="k">Livraison client</div>
          <div className="v">{money(order.deliveryFee)}</div>
        </div>
        <div className="card stat">
          <div className="k">Total payé</div>
          <div className="v">{money(order.total)}</div>
        </div>
      </div>

      <div className="dash-split">
        <div className="card">
          <div className="dash-card-head">
            <h3>Client</h3>
          </div>
          <ul className="dash-list">
            <li>
              <span>Nom</span>
              <strong>{order.customerName}</strong>
            </li>
            <li>
              <span>Téléphone</span>
              <strong>{order.customerPhone || '—'}</strong>
            </li>
            <li>
              <span>Adresse</span>
              <span>
                {order.addressLabel || order.addressLine || '—'}
                <small>
                  {[order.addressLine, order.addressCity].filter(Boolean).join(', ')}
                  {order.addressPhone ? ` · ${order.addressPhone}` : ''}
                </small>
              </span>
            </li>
            <li>
              <span>Créneau</span>
              <strong>
                {[order.dayLabel, order.slotLabel].filter(Boolean).join(' · ') || '—'}
              </strong>
            </li>
            <li>
              <span>Paiement</span>
              <strong>
                {order.paymentLabel || '—'}
                {order.paymentStatus ? ` · ${order.paymentStatus}` : ''}
              </strong>
            </li>
            {order.comment ? (
              <li>
                <span>Commentaire</span>
                <span>{order.comment}</span>
              </li>
            ) : null}
          </ul>
        </div>
        <div className="card">
          <div className="dash-card-head">
            <h3>CourseGO</h3>
          </div>
          <ul className="dash-list">
            <li>
              <span>Commande</span>
              <span className={`pill ${orderPillClass(order.status, order.deliveryStatus)}`}>
                {ORDER_STATUS[order.status] ?? order.status}
              </span>
            </li>
            <li>
              <span>Ramassage</span>
              <span>
                {order.pickStatus ? PICK_STATUS[order.pickStatus] ?? order.pickStatus : '—'}
                <small>{order.pickerName || 'Pas encore de ramasseur'}</small>
              </span>
            </li>
            <li>
              <span>Livraison</span>
              <span>
                {order.deliveryStatus ? DELIVERY_STATUS[order.deliveryStatus] ?? order.deliveryStatus : '—'}
                <small>{order.courierName || 'Pas encore de coursier'}</small>
              </span>
            </li>
            {order.deliverPayout != null && showMoney && order.deliverPayout > 0 ? (
              <li>
                <span>Gain livraison</span>
                <strong>{formatFcfa(order.deliverPayout)}</strong>
              </li>
            ) : null}
            {order.failedReason || order.failedReasonCode ? (
              <li>
                <span>Échec</span>
                <span>
                  {INCIDENT_REASON[order.failedReasonCode ?? ''] ?? order.failedReasonCode ?? 'Échec'}
                  <small>{order.failedReason}</small>
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="card table-card" style={{ marginTop: 16 }}>
        <div className="dash-card-head" style={{ padding: '14px 16px 0' }}>
          <h3>Articles</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Demandé</th>
              <th>Ramassé</th>
              <th>Prix</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.productId}>
                <td>
                  <strong>{l.name}</strong>
                  <small>{l.unit}</small>
                </td>
                <td>{l.qty}</td>
                <td>{l.pickedQty}</td>
                <td>{money(l.lineTotal)}</td>
                <td>
                  {l.unavailable ? <span className="pill out">Non trouvé</span> : null}
                  {l.replaced ? <span className="pill warn">Remplacé</span> : null}
                  {!l.unavailable && l.pickedQty >= l.qty ? <span className="pill ok">OK</span> : null}
                  {l.note ? <small>{l.note}</small> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {missing.length || replaced.length ? (
        <div className="dash-split" style={{ marginTop: 16 }}>
          {missing.length ? (
            <div className="card">
              <div className="dash-card-head">
                <h3>Non trouvés</h3>
              </div>
              <ul className="dash-list">
                {missing.map((l) => (
                  <li key={l.productId}>
                    <span>
                      {l.name}
                      <small>
                        {l.pickedQty}/{l.qty} {l.unit}
                        {l.note ? ` · ${l.note}` : ''}
                      </small>
                    </span>
                    <span className="pill out">Manque</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {replaced.length ? (
            <div className="card">
              <div className="dash-card-head">
                <h3>Remplacements & notes</h3>
              </div>
              <ul className="dash-list">
                {replaced.map((l) => (
                  <li key={l.productId}>
                    <span>
                      {l.name}
                      <small>{l.note}</small>
                    </span>
                    <span className="pill warn">{l.replaced ? 'Remplacé' : 'Note'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="dash-card-head">
          <h3>Litiges</h3>
        </div>
        {incidents.length ? (
          <ul className="dash-list">
            {incidents.map((i) => (
              <li key={i.id}>
                <span>
                  {INCIDENT_REASON[i.reasonCode] ?? i.reasonCode}
                  <small>
                    {formatWhen(i.createdAt)}
                    {i.reasonText ? ` · ${i.reasonText}` : ''}
                    {i.clientAction
                      ? ` · Client : ${CLIENT_ACTION[i.clientAction] ?? i.clientAction}`
                      : ''}
                    {i.clientNote ? ` — ${i.clientNote}` : ''}
                  </small>
                </span>
                <span className="pill out">Litige</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dash-empty">Aucun litige sur cette commande.</p>
        )}
      </div>

      {events.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="dash-card-head">
            <h3>Journal</h3>
          </div>
          <ul className="dash-list">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span>
                  {e.type}
                  <small>
                    {e.actor} · {formatWhen(e.at)}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
