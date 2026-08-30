export function formatFcfa(amount: number) {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

export function shortOrderId(id: string) {
  const clean = id.replace(/^#/, '');
  return `#${clean.slice(-5)}`;
}

export function courierThreadId(orderId: string) {
  return `courier-${orderId.replace(/^#/, '')}`;
}

export function kmLabel(meters?: number | null) {
  if (meters == null || !Number.isFinite(meters)) return '—';
  return `${(meters / 1000).toFixed(1)} km`;
}

export function minLabel(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const m = Math.max(1, Math.round(seconds / 60));
  return `${m} min`;
}

export function formatChatClock(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
