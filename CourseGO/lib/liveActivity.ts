import type { DeliveryJob, PickJob } from '@/lib/api/ops';
import { isActivePickStatus, isDeliveryActive } from '@/lib/opsModel';

export type LiveActivitySnapshot = {
  id: string;
  title: string;
  subtitle: string;
  eta: string;
  progress: number;
  href: string;
  tone: 'live' | 'alert';
};

function pickSnapshot(pick: PickJob): LiveActivitySnapshot {
  const scan = pick.pick_status === 'picking';
  return {
    id: pick.id,
    title: `#${pick.order_id}`,
    subtitle: scan ? 'Scan en cours' : 'Ramassage assigné',
    eta: `${pick.item_count} art.`,
    progress: scan ? 0.45 : 0.22,
    href: `/job/${pick.id}`,
    tone: 'live',
  };
}

function deliverySnapshot(del: DeliveryJob): LiveActivitySnapshot {
  const st = del.delivery_status;
  const progress =
    st === 'arrived' ? 0.94 : st === 'en_route' ? 0.82 : st === 'picked_up' ? 0.7 : st === 'at_store' ? 0.55 : 0.3;
  const subtitle =
    st === 'arrived'
      ? 'À l’adresse'
      : st === 'en_route'
        ? 'En route client'
        : st === 'picked_up'
          ? 'Colis en main'
          : st === 'at_store'
            ? 'Au magasin'
            : 'Course prise';
  return {
    id: del.id,
    title: `#${del.order_id}`,
    subtitle,
    eta: del.address_label || 'Livraison',
    progress,
    href: `/run/${del.id}`,
    tone: st === 'failed' ? 'alert' : 'live',
  };
}

export function staffLiveSnapshots(
  staffId: string | undefined,
  jobs: PickJob[],
  deliveries: DeliveryJob[],
): LiveActivitySnapshot[] {
  if (!staffId) return [];
  const picks = jobs
    .filter((j) => j.picker_id === staffId && isActivePickStatus(j.pick_status))
    .map(pickSnapshot);
  const runs = deliveries.filter((d) => d.courier_id === staffId && isDeliveryActive(d)).map(deliverySnapshot);
  return [...picks, ...runs];
}

export function staffLiveSnapshot(
  staffId: string | undefined,
  jobs: PickJob[],
  deliveries: DeliveryJob[],
): LiveActivitySnapshot | null {
  return staffLiveSnapshots(staffId, jobs, deliveries)[0] ?? null;
}
