import { useAdminStream } from '@/lib/adminStream';

const LABELS = {
  live: 'Live',
  connecting: 'Connexion…',
  reconnecting: 'Reconnexion…',
  offline: 'Hors ligne',
} as const;

const HINTS = {
  live: 'Temps réel actif : les commandes, le terrain et les stocks se mettent à jour instantanément.',
  connecting: 'Ouverture du flux temps réel…',
  reconnecting: 'Flux temps réel coupé, reconnexion en cours. Les données sont rafraîchies toutes les 30 s.',
  offline: 'Hors ligne : le temps réel est indisponible. Les données sont rafraîchies toutes les 30 s dès que possible.',
} as const;

export function LiveBadge() {
  const { status } = useAdminStream();
  return (
    <span className={`live-badge live-${status}`} title={HINTS[status]} role="status" aria-live="polite">
      <span className="live-dot" aria-hidden />
      {LABELS[status]}
    </span>
  );
}
