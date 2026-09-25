import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatFcfa } from '@/lib/api';
import { useStreamReload } from '@/lib/adminStream';
import { useLiveSync } from '@/lib/live';
import { PAYMENT_STATUS, formatWhen, paymentPillClass } from '@/lib/orderLabels';

type PaymentRow = {
  id: string;
  providerId: string | null;
  amount: number;
  method: string;
  status: string;
  orderId: string | null;
  createdAt: string;
  customerName: string | null;
  orderStatus: string | null;
  refunded: number;
};

type FlagRow = {
  id: string;
  status: string;
  total: number;
  paymentId: string | null;
  paymentStatus: string | null;
  paymentRef: string | null;
  clientPaymentStatus: string | null;
  createdAt: string;
  storeName: string | null;
  customerName: string | null;
  flag: 'skip_ref' | 'paid_without_payment' | 'client_claimed_paid';
};

const FLAG: Record<FlagRow['flag'], string> = {
  skip_ref: 'Réf. « skip- » (app sans FedaPay)',
  paid_without_payment: 'Marquée payée sans paiement',
  client_claimed_paid: 'Déclarée payée par l’app',
};

const METHOD: Record<string, string> = { om: 'Orange Money', wave: 'MTN MoMo', card: 'Carte' };

export function PaymentsPage() {
  const [tab, setTab] = useState<'payments' | 'flagged'>('payments');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<{
    payments: PaymentRow[];
    flagged: FlagRow[];
    counts: { status: string; n: number; amount: number }[];
    fedapayConfigured: boolean;
    cod?: { toCollect: { n: number; amount: number }; collected: { n: number; amount: number }; collectedToday: { n: number; amount: number } };
  } | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    api<NonNullable<typeof data>>(`/admin/payments?${params}`)
      .then((r) => {
        setData(r);
        setErr('');
      })
      .catch((e: Error) => setErr(e.message));
  }, [status, q]);
  useEffect(() => {
    const t = window.setTimeout(load, q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);
  useStreamReload(['payment.'], load);
  useLiveSync(load, true, 'orders');

  const totalFor = (s: string) => data?.counts.find((c) => c.status === s);

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Paiements</h2>
          <p>
            Paiement à la livraison (espèces) et transactions FedaPay. Une commande « à la livraison » passe en « Payé en espèces »
            quand le coursier valide la remise avec le code client ; elle n’est jamais signalée « à vérifier ».{' '}
            {data && !data.fedapayConfigured ? 'FedaPay n’est pas configuré sur cette API (paiement à la livraison uniquement).' : ''} Les
            remboursements sont enregistrés ici puis exécutés à la main.
          </p>
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}
      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat cod-stat" data-cod="to-collect">
          <div className="k">Espèces à encaisser</div>
          <div className="v">{data?.cod?.toCollect.n ?? '—'}</div>
          <small>{formatFcfa(data?.cod?.toCollect.amount ?? 0)} · commandes à la livraison en cours.</small>
        </div>
        <div className="card stat cod-stat" data-cod="collected-today">
          <div className="k">Espèces encaissées aujourd’hui</div>
          <div className="v">{data?.cod?.collectedToday.n ?? '—'}</div>
          <small>
            {formatFcfa(data?.cod?.collectedToday.amount ?? 0)} · total {data?.cod?.collected.n ?? 0} ({formatFcfa(data?.cod?.collected.amount ?? 0)})
          </small>
        </div>
        {['paid', 'pending', 'failed', 'refunded', 'partially_refunded'].map((s) => (
          <div className="card stat" key={s}>
            <div className="k">{PAYMENT_STATUS[s]}</div>
            <div className="v">{totalFor(s)?.n ?? 0}</div>
            <small>{formatFcfa(totalFor(s)?.amount ?? 0)}</small>
          </div>
        ))}
        <div className="card stat flag-stat">
          <div className="k">Payées non confirmées</div>
          <div className="v">{data?.flagged.length ?? '—'}</div>
          <small>Hors paiement à la livraison : déclarées payées sans paiement FedaPay reçu.</small>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="seg">
          <button type="button" className={tab === 'payments' ? 'on' : ''} onClick={() => setTab('payments')}>
            Transactions ({data?.payments.length ?? 0})
          </button>
          <button type="button" className={tab === 'flagged' ? 'on' : ''} onClick={() => setTab('flagged')}>
            À vérifier ({data?.flagged.length ?? 0})
          </button>
        </div>
        {tab === 'payments' ? (
          <>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Statut">
              <option value="">Tous les statuts</option>
              {Object.entries(PAYMENT_STATUS)
                .filter(([k]) => k !== 'cod_pending')
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Réf. FedaPay, commande, client…" aria-label="Recherche" />
          </>
        ) : null}
      </div>

      {tab === 'payments' ? (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Commande</th>
                <th>Moyen</th>
                <th>Réf. FedaPay</th>
                <th>Montant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {data?.payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatWhen(p.createdAt)}</td>
                  <td>{p.customerName ?? '—'}</td>
                  <td>{p.orderId ? <Link to={`/commandes/${encodeURIComponent(p.orderId)}`}>{p.orderId}</Link> : <small>non liée</small>}</td>
                  <td>{METHOD[p.method] ?? p.method}</td>
                  <td>
                    <code>{p.providerId ?? '—'}</code>
                  </td>
                  <td>
                    <strong>{formatFcfa(p.amount)}</strong>
                    {p.refunded ? <small>−{formatFcfa(p.refunded)} remboursé</small> : null}
                  </td>
                  <td>
                    <span className={`pill ${paymentPillClass(p.status)}`}>{PAYMENT_STATUS[p.status] ?? p.status}</span>
                  </td>
                </tr>
              ))}
              {data && !data.payments.length ? (
                <tr>
                  <td colSpan={7} className="dash-empty">
                    Aucune transaction.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Commande</th>
                <th>Client</th>
                <th>Paiement déclaré</th>
                <th>Réf.</th>
                <th>Total</th>
                <th>Alerte</th>
              </tr>
            </thead>
            <tbody>
              {data?.flagged.map((f) => (
                <tr key={f.id}>
                  <td>{formatWhen(f.createdAt)}</td>
                  <td>
                    <Link to={`/commandes/${encodeURIComponent(f.id)}`}>{f.id}</Link>
                    <small>{f.storeName}</small>
                  </td>
                  <td>{f.customerName ?? '—'}</td>
                  <td>
                    {METHOD[f.paymentId ?? ''] ?? f.paymentId ?? '—'}
                    <small>
                      App : {f.clientPaymentStatus ?? f.paymentStatus ?? '—'} · serveur :{' '}
                      {f.paymentStatus === 'paid' ? 'marquée payée, sans paiement confirmé' : PAYMENT_STATUS[f.paymentStatus ?? ''] ?? f.paymentStatus}
                    </small>
                  </td>
                  <td>
                    <code>{f.paymentRef ?? '—'}</code>
                  </td>
                  <td>{formatFcfa(Number(f.total) || 0)}</td>
                  <td>
                    <span className="pill out">{FLAG[f.flag]}</span>
                  </td>
                </tr>
              ))}
              {data && !data.flagged.length ? (
                <tr>
                  <td colSpan={7} className="dash-empty">
                    Rien à vérifier.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
