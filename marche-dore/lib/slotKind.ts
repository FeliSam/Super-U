export type SlotKind = 'urgent' | 'express' | 'scheduled';

export function slotKind(slotId?: string | null, slotLabel?: string | null): SlotKind {
  const id = (slotId || '').trim().toLowerCase();
  const label = (slotLabel || '').trim().toLowerCase();
  if (id === 'urgent' || label.includes('urgent') || label === 'express' || label.includes('dès que')) {
    return 'urgent';
  }
  if (id === 'after-1-2' || label.includes('1h – 2h') || label.includes('1h-2h') || label.includes('1 h')) {
    return 'express';
  }
  return 'scheduled';
}

export function slotKindLabel(kind: SlotKind) {
  if (kind === 'urgent') return 'Urgent';
  if (kind === 'express') return 'Rapide · 1h–2h';
  return 'Planifiée';
}

export function slotKindRank(kind: SlotKind) {
  if (kind === 'urgent') return 0;
  if (kind === 'express') return 1;
  return 2;
}
