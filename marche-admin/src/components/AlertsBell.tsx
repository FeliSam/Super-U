/**
 * Alertes opérationnelles (P2) : cloche + compteur dans la barre du panel, tiroir groupé par type,
 * acquittement unitaire / par groupe, liens vers la commande, le support, les appels ou le stock.
 * Données : GET /admin/alerts (filtré par rôle et magasin côté serveur), rafraîchi en direct (alert.*).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useStreamReload } from '@/lib/adminStream';
import { formatWhen } from '@/lib/orderLabels';

export type AlertRow = {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  entity: string;
  entityId: string;
  orderId: string | null;
  title: string;
  detail: string | null;
  data: Record<string, unknown>;
  status: 'open' | 'acked' | 'resolved';
  createdAt: string;
  lastSeenAt: string;
  ackedAt: string | null;
  ackedBy: string | null;
};

type AlertsResponse = {
  alerts: AlertRow[];
  counts: { open: number; acked: number; byKind: Record<string, { open: number; acked: number }> };
  kinds: string[];
  thresholds: Record<string, number>;
};

export const ALERT_KIND_LABEL: Record<string, string> = {
  courier_offline: 'Livreur sans signal',
  delivery_failed: 'Livraisons en échec',
  delivery_unclaimed: 'Livraisons sans livreur',
  order_not_picked: 'Commandes non préparées',
  support_unanswered: 'Support sans réponse',
  missed_call: 'Appels manqués',
  low_stock: 'Stock bas',
};
const KIND_ORDER = Object.keys(ALERT_KIND_LABEL);

function linkFor(a: AlertRow) {
  if (a.kind === 'low_stock') {
    const pid = String(a.data?.productId ?? '');
    return pid ? `/stock?q=${encodeURIComponent(pid)}` : '/stock';
  }
  if (a.kind === 'support_unanswered') return '/support';
  if (a.kind === 'missed_call') return a.orderId ? `/commandes/${encodeURIComponent(a.orderId)}` : '/appels';
  if (a.orderId) return `/commandes/${encodeURIComponent(a.orderId)}`;
  return null;
}

export function AlertsBell() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const nav = useNavigate();

  const load = useCallback(() => {
    api<AlertsResponse>('/admin/alerts?status=active')
      .then((r) => {
        setData(r);
        setErr('');
      })
      .catch((e: Error) => setErr(e.message));
  }, []);
  useEffect(load, [load]);
  useStreamReload(['alert.'], load);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const groups = useMemo(() => {
    const by = new Map<string, AlertRow[]>();
    for (const a of data?.alerts ?? []) {
      const list = by.get(a.kind) ?? [];
      list.push(a);
      by.set(a.kind, list);
    }
    return [...by.entries()].sort((a, b) => KIND_ORDER.indexOf(a[0]) - KIND_ORDER.indexOf(b[0]));
  }, [data]);

  const ack = async (body: { ids?: string[]; kind?: string }, key: string) => {
    setBusy(key);
    try {
      if (body.ids?.length === 1) await api(`/admin/alerts/${body.ids[0]}/ack`, { method: 'POST' });
      else await api('/admin/alerts/ack', { method: 'POST', body: JSON.stringify(body) });
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Le recruteur ne voit aucune alerte : pas de cloche.
  if (data && !data.kinds.length) return null;
  const openCount = data?.counts.open ?? 0;
  const critical = (data?.alerts ?? []).some((a) => a.status === 'open' && a.severity === 'critical');

  return (
    <>
      <button
        type="button"
        className={`alerts-bell${openCount ? ' has' : ''}${critical ? ' critical' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={`Alertes : ${openCount} non vue(s)`}
        title="Alertes opérationnelles"
        data-alerts-open={openCount}
      >
        <Bell size={17} />
        {openCount ? <span className="alerts-count">{openCount > 99 ? '99+' : openCount}</span> : null}
      </button>
      {open ? (
        <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <aside className="alerts-drawer card" role="dialog" aria-modal="true" aria-label="Alertes">
            <div className="alerts-head">
              <div>
                <h3>Alertes</h3>
                <small>
                  {openCount} nouvelle(s) · {data?.counts.acked ?? 0} vue(s), en cours
                </small>
              </div>
              <div className="alerts-head-actions">
                {openCount ? (
                  <button type="button" className="btn sm ghost" disabled={busy === 'all'} onClick={() => void ack({}, 'all')} data-ack="all">
                    <CheckCheck size={14} /> Tout marquer vu
                  </button>
                ) : null}
                <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Fermer">
                  <X size={16} />
                </button>
              </div>
            </div>
            {err ? <p className="err">{err}</p> : null}
            {!groups.length ? <p className="dash-empty">Aucune alerte en cours. Tout roule.</p> : null}
            {groups.map(([kind, list]) => {
              const unseen = list.filter((a) => a.status === 'open').length;
              return (
                <section key={kind} className="alerts-group" data-kind={kind}>
                  <div className="alerts-group-head">
                    <strong>
                      {ALERT_KIND_LABEL[kind] ?? kind} <span className="muted">({list.length})</span>
                    </strong>
                    {unseen > 1 ? (
                      <button type="button" className="btn sm ghost" disabled={busy === kind} onClick={() => void ack({ kind }, kind)}>
                        Tout vu
                      </button>
                    ) : null}
                  </div>
                  <ul>
                    {list.map((a) => {
                      const to = linkFor(a);
                      return (
                        <li key={a.id} className={`alert-item sev-${a.severity}${a.status === 'acked' ? ' acked' : ''}`} data-alert={a.id}>
                          <i className="alert-sev" aria-hidden />
                          <div>
                            <strong>{a.title}</strong>
                            {a.detail ? <small>{a.detail}</small> : null}
                            <small className="muted">
                              {formatWhen(a.createdAt)}
                              {a.status === 'acked' && a.ackedBy ? ` · vu par ${a.ackedBy}` : ''}
                            </small>
                          </div>
                          <div className="alert-actions">
                            {to ? (
                              <button
                                type="button"
                                className="btn sm ghost"
                                onClick={() => {
                                  setOpen(false);
                                  nav(to);
                                }}
                              >
                                Ouvrir
                              </button>
                            ) : null}
                            {a.status === 'open' ? (
                              <button type="button" className="icon-btn" title="Marquer vu" aria-label="Marquer vu" disabled={busy === a.id} onClick={() => void ack({ ids: [a.id] }, a.id)} data-ack={a.id}>
                                <Check size={15} />
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {data ? (
              <p className="hint-line alerts-foot">
                Seuils : préparation {data.thresholds.pickMin} min · livreur {data.thresholds.deliveryUnclaimedMin} min · signal GPS{' '}
                {data.thresholds.courierOfflineMin} min · support {data.thresholds.supportMin} min. Une alerte se ferme seule quand la
                situation est réglée.
              </p>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
