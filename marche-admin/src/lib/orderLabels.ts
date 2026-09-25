export const ORDER_STATUS: Record<string, string> = {
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  shipping: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export const PICK_STATUS: Record<string, string> = {
  queued: 'File ramassage',
  assigned: 'Ramasseur assigné',
  picking: 'En ramassage',
  packed: 'Colis prêt',
  cancelled: 'Ramassage annulé',
};

export const DELIVERY_STATUS: Record<string, string> = {
  unassigned: 'Livraison à pourvoir',
  offered: 'Proposées au coursier',
  assigned: 'Coursier assigné',
  at_store: 'Au magasin',
  picked_up: 'Colis pris',
  en_route: 'En route',
  arrived: 'Arrivé chez le client',
  delivered: 'Livrée',
  failed: 'Échouée',
  cancelled: 'Livraison annulée',
};

export const INCIDENT_REASON: Record<string, string> = {
  client_absent: 'Client absent',
  wrong_address: 'Adresse incorrecte',
  product_issue: 'Produit abîmé ou incomplet',
  network: 'Problème de réseau',
  access: 'Accès impossible',
  vehicle: 'Panne ou incident véhicule',
  other: 'Autre incident',
};

export const CLIENT_ACTION: Record<string, string> = {
  retry: 'Relancer la livraison',
  support: 'Contacter l’assistance',
  reorder: 'Commander à nouveau',
  refund: 'Demander un remboursement',
};

export function orderPillClass(status: string, deliveryStatus?: string | null) {
  if (deliveryStatus === 'failed' || status === 'cancelled') return 'out';
  if (status === 'delivered') return 'ok';
  if (deliveryStatus === 'en_route' || status === 'shipping') return 'warn';
  return '';
}

export function formatWhen(iso: string | Date) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const PAYMENT_STATUS: Record<string, string> = {
  paid: 'Payé (confirmé)',
  paid_cash: 'Payé en espèces',
  pending: 'En attente de paiement',
  cod_pending: 'À régler à la livraison',
  failed: 'Échoué',
  refunded: 'Remboursé',
  partially_refunded: 'Partiellement remboursé',
};

export function paymentPillClass(status: string | null | undefined) {
  if (status === 'paid' || status === 'paid_cash') return 'ok';
  if (status === 'refunded' || status === 'partially_refunded') return 'warn';
  if (status === 'failed') return 'out';
  return 'warn';
}

export const ORDER_ACTION: Record<string, string> = {
  packed: 'Marqué rassemblé',
  delivered: 'Marqué livré',
  failed: 'Livraison déclarée en échec',
  redispatch: 'Remis en livraison',
  cancel: 'Commande annulée',
  'reassign-picker': 'Ramasseur réassigné',
  'reassign-courier': 'Coursier réassigné',
  'release-picker': 'Ramasseur libéré',
  'release-courier': 'Coursier libéré',
  refund: 'Remboursement enregistré',
  'cash-collected': 'Espèces encaissées à la livraison',
  'cash-reverted': 'Encaissement espèces annulé',
};

export const ROLE_SHORT: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  magasinier: 'Magasinier',
  support: 'Support',
  recruteur: 'RH',
};
