export const ISSUE_REASON_LABELS: Record<string, string> = {
  client_absent: 'Client absent',
  wrong_address: 'Adresse incorrecte',
  product_issue: 'Produit abîmé ou incomplet',
  network: 'Problème de réseau',
  access: 'Accès impossible',
  vehicle: 'Panne ou incident véhicule',
  other: 'Autre incident',
};

export const CLIENT_ISSUE_ACTIONS = {
  retry: {
    id: 'retry' as const,
    title: 'Relancer la livraison',
    hint: 'Nous tentons une nouvelle course dès que possible.',
    icon: 'refresh-cw' as const,
  },
  support: {
    id: 'support' as const,
    title: 'Contacter l’assistance',
    hint: 'Expliquez la situation à l’équipe Super U.',
    icon: 'message-circle' as const,
  },
  reorder: {
    id: 'reorder' as const,
    title: 'Commander à nouveau',
    hint: 'Remettez les mêmes articles au panier.',
    icon: 'shopping-bag' as const,
  },
  refund: {
    id: 'refund' as const,
    title: 'Demander un remboursement',
    hint: 'L’équipe traitera votre demande.',
    icon: 'credit-card' as const,
  },
};

export type ClientIssueActionId = keyof typeof CLIENT_ISSUE_ACTIONS;

const ALL_IDS = Object.keys(CLIENT_ISSUE_ACTIONS) as ClientIssueActionId[];

export function asClientIssueAction(raw: unknown): ClientIssueActionId | null {
  const s = String(raw ?? '');
  return ALL_IDS.includes(s as ClientIssueActionId) ? (s as ClientIssueActionId) : null;
}

function isPaid(paymentId?: string | null, paymentStatus?: string | null) {
  if (paymentId === 'cod' || paymentStatus === 'cod_pending') return false;
  return paymentStatus === 'paid' || Boolean(paymentId && paymentId !== 'cod');
}

export function issueActionsFor(
  code: string | null | undefined,
  opts: { paymentId?: string | null; paymentStatus?: string | null },
): ClientIssueActionId[] {
  const reason = String(code || 'other');
  let ids: ClientIssueActionId[];
  switch (reason) {
    case 'product_issue':
      ids = ['reorder', 'refund', 'support'];
      break;
    case 'wrong_address':
      ids = ['support', 'retry'];
      break;
    case 'client_absent':
      ids = ['retry', 'support', 'reorder'];
      break;
    case 'network':
    case 'access':
    case 'vehicle':
      ids = ['retry', 'support'];
      break;
    default:
      ids = ['retry', 'support', 'reorder'];
  }
  if (!isPaid(opts.paymentId, opts.paymentStatus)) ids = ids.filter((id) => id !== 'refund');
  return ids;
}

export function issueReasonLabel(code?: string | null, fallback?: string | null) {
  if (code && ISSUE_REASON_LABELS[code]) return ISSUE_REASON_LABELS[code];
  const text = (fallback ?? '').trim();
  return text || 'Incident de livraison';
}
