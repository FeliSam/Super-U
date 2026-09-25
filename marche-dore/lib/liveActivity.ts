import { formatOrderId, type Order } from '@/context/OrdersContext';
import { formatDurationMin } from '@/lib/deliveryRouting';
import {
  fulfillmentPhase,
  opsPhaseLabel,
  opsProgressPercent,
  remainingEnRouteSeconds,
} from '@/lib/orderOps';

export type LiveActivitySnapshot = {
  id: string;
  title: string;
  subtitle: string;
  eta: string;
  progress: number;
  href: string;
  tone: 'live' | 'alert';
};

export function shopLiveSnapshot(order: Order, now = Date.now()): LiveActivitySnapshot {
  const phase = fulfillmentPhase(order);
  const sec = remainingEnRouteSeconds(order, now);
  const eta =
    phase === 'arrived'
      ? 'À la porte'
      : sec != null && sec < 50
        ? 'Imminent'
        : sec != null
          ? formatDurationMin(sec)
          : opsPhaseLabel(order);
  return {
    id: order.id,
    title: formatOrderId(order.id),
    subtitle: opsPhaseLabel(order),
    eta,
    progress: opsProgressPercent(order) / 100,
    href: `/tracking?id=${order.id}`,
    tone: phase === 'failed' ? 'alert' : 'live',
  };
}
