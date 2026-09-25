import type { Staff } from '@/lib/api/ops';

export const STORE_LABELS: Record<string, string> = {
  'su-aeroport': 'Super U Aéroport',
  'su-akpakpa': 'Super U Akpakpa',
  'su-ganhi': 'U Express Ganhi',
  'su-calavi': 'Super U Calavi',
};

export const AFFILIATE_STORES: {
  id: string;
  name: string;
  address: string;
  city: string;
  hours: string;
}[] = [
  {
    id: 'su-aeroport',
    name: 'Super U Aéroport',
    address: 'Centre commercial Erevan · Cadjehoun',
    city: 'Cotonou',
    hours: 'Lun–Jeu 09:00–21:30 · Ven–Sam 09:00–21:00 · Dim 09:00–14:00',
  },
  {
    id: 'su-akpakpa',
    name: 'Super U Akpakpa',
    address: 'RNIE 1 · PK3, route de Porto-Novo',
    city: 'Cotonou',
    hours: 'Lun–Jeu 09:00–20:30 · Ven–Sam 09:00–21:00 · Dim 09:00–14:00',
  },
  {
    id: 'su-ganhi',
    name: 'U Express Ganhi',
    address: 'Avenue du Gouverneur Gal Clozel, Ganhi',
    city: 'Cotonou',
    hours: 'Ouvert tous les jours',
  },
  {
    id: 'su-calavi',
    name: 'Super U Calavi',
    address: 'Route principale d’Akassato',
    city: 'Abomey-Calavi',
    hours: 'Ouvert tous les jours',
  },
];

export function staffJobLabel(staff: Pick<Staff, 'canPick' | 'canDeliver' | 'role'> | null | undefined) {
  if (!staff) return 'Staff';
  if (staff.canPick && staff.canDeliver) return 'Coursier · ramassage et livraison';
  if (staff.canPick) return 'Ramasseur';
  if (staff.canDeliver) return 'Livreur';
  return staff.role || 'Staff';
}

export function storeLabel(id: string) {
  return STORE_LABELS[id] ?? id;
}

export function vehicleLabel(kind: string | null | undefined) {
  switch (kind) {
    case 'voiture':
      return 'Voiture';
    case 'velo':
      return 'Vélo';
    case 'tricycle':
      return 'Tricycle';
    case 'pied':
      return 'À pied';
    default:
      return 'Moto';
  }
}
