export const REASON_CODES = [
  'client_absent',
  'wrong_address',
  'product_issue',
  'network',
  'access',
  'vehicle',
  'other',
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const REASON_LABELS: Record<ReasonCode, string> = {
  client_absent: 'Client absent',
  wrong_address: 'Adresse incorrecte',
  product_issue: 'Produit abîmé ou incomplet',
  network: 'Problème de réseau',
  access: 'Accès impossible',
  vehicle: 'Panne ou incident véhicule',
  other: 'Autre incident',
};

export const CLIENT_ACTIONS = {
  retry: {
    id: 'retry',
    title: 'Relancer la livraison',
    hint: 'Nous tentons une nouvelle course dès que possible.',
  },
  support: {
    id: 'support',
    title: 'Contacter l’assistance',
    hint: 'Expliquez la situation à l’équipe Super U.',
  },
  reorder: {
    id: 'reorder',
    title: 'Commander à nouveau',
    hint: 'Remettez les mêmes articles au panier.',
  },
  refund: {
    id: 'refund',
    title: 'Demander un remboursement',
    hint: 'L’équipe traitera votre demande.',
  },
} as const;

export type ClientActionId = keyof typeof CLIENT_ACTIONS;

export function asReasonCode(raw: unknown): ReasonCode {
  const s = String(raw ?? '');
  return (REASON_CODES as readonly string[]).includes(s) ? (s as ReasonCode) : 'other';
}

export function asClientAction(raw: unknown): ClientActionId | null {
  const s = String(raw ?? '');
  return s in CLIENT_ACTIONS ? (s as ClientActionId) : null;
}

export function isPaidOrder(paymentId: string | null | undefined, paymentStatus: string | null | undefined) {
  if (paymentId === 'cod' || paymentStatus === 'cod_pending') return false;
  return paymentStatus === 'paid' || Boolean(paymentId && paymentId !== 'cod');
}

export function actionsForReason(
  code: string,
  opts: { paid: boolean },
): ClientActionId[] {
  const reason = asReasonCode(code);
  let ids: ClientActionId[];
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
  if (!opts.paid) ids = ids.filter((id) => id !== 'refund');
  return ids;
}

export function failedClientBody(reasonLabel: string, actions: ClientActionId[]) {
  const list = actions.map((id) => `• ${CLIENT_ACTIONS[id].title}`).join('\n');
  return `La livraison n’a pas pu aboutir (${reasonLabel}). Choisissez une action dans le suivi :\n${list}`;
}
