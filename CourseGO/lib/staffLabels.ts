import type { Staff } from '@/lib/api/ops';

export const STORE_LABELS: Record<string, string> = {
  'su-aeroport': 'Super U Aéroport',
  'su-akpakpa': 'Super U Akpakpa',
  'su-ganhi': 'U Express Ganhi',
  'su-calavi': 'Super U Calavi',
};

export const AFFILIATE_STORES = Object.entries(STORE_LABELS).map(([id, name]) => ({ id, name }));

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
