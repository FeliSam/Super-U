import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeAdminEvents, type AdminEvent } from '@/lib/adminStream';
import { formatFcfa } from '@/lib/api';

type Toast = { key: number; tone: 'info' | 'warn' | 'danger'; title: string; body: string; to?: string };

const MAX_TOASTS = 4;
const TOAST_MS = 7000;

function str(v: unknown) {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

/** Événements importants → notification discrète (jamais pour les événements rejoués au backfill). */
function toToast(ev: AdminEvent): Omit<Toast, 'key'> | null {
  const p = ev.payload ?? {};
  const orderId = str(p.orderId || ev.entityId);
  const orderTo = orderId ? `/commandes/${encodeURIComponent(orderId)}` : undefined;
  switch (ev.type) {
    case 'order.created': {
      const total = typeof p.money?.total === 'number' ? ` · ${formatFcfa(p.money.total as number)}` : '';
      return { tone: 'info', title: 'Nouvelle commande', body: `${orderId} · ${str(p.storeName) || str(ev.storeId)}${total}`, to: orderTo };
    }
    case 'delivery.failed':
      return {
        tone: 'danger',
        title: 'Livraison échouée',
        body: `${orderId}${p.failedReason ? ` · ${str(p.failedReason)}` : ''}`,
        to: orderTo,
      };
    case 'incident.created':
      return { tone: 'danger', title: 'Incident signalé', body: `${orderId}${p.reasonText ? ` · ${str(p.reasonText)}` : ''}`, to: orderTo };
    case 'call.missed':
      return { tone: 'warn', title: 'Appel manqué', body: orderId ? `Commande ${orderId}` : 'Appel sans réponse', to: orderTo };
    case 'support.message':
      if (p.senderKind !== 'customer') return null;
      return { tone: 'info', title: 'Nouveau message support', body: str(p.pii?.body) || 'Un client a écrit au support.' };
    case 'alert.raised': {
      const sev = str(p.severity);
      if (sev === 'info') return null;
      const kind = str(p.kind);
      const to =
        kind === 'low_stock' ? '/stock' : kind === 'support_unanswered' ? '/support' : p.orderId ? `/commandes/${encodeURIComponent(str(p.orderId))}` : undefined;
      return { tone: sev === 'critical' ? 'danger' : 'warn', title: str(p.title) || 'Alerte', body: str(p.detail), to };
    }
    case 'staff.pending':
      return {
        tone: 'warn',
        title: 'Coursier en attente de validation',
        body: str(p.name) || 'Nouvelle inscription CourseGO',
        to: '/personnel/recrutement',
      };
    default:
      return null;
  }
}

export function LiveToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nav = useNavigate();
  const seq = useRef(0);

  useEffect(
    () =>
      subscribeAdminEvents((ev) => {
        if (ev.replay) return;
        const t = toToast(ev);
        if (!t) return;
        const key = ++seq.current;
        setToasts((list) => [...list, { ...t, key }].slice(-MAX_TOASTS));
        window.setTimeout(() => setToasts((list) => list.filter((x) => x.key !== key)), TOAST_MS);
      }),
    [],
  );

  if (!toasts.length) return null;
  return (
    <div className="live-toasts" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`live-toast tone-${t.tone}`}
          onClick={() => {
            setToasts((list) => list.filter((x) => x.key !== t.key));
            if (t.to) nav(t.to);
          }}>
          <strong>{t.title}</strong>
          <span>{t.body}</span>
        </button>
      ))}
    </div>
  );
}
