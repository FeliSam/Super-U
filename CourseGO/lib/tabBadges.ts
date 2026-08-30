import type { DeliveryJob, PickJob } from '@/lib/api/ops';
import {
  isActivePickStatus,
  isDeliveryClaimable,
  isDeliveryHeld,
  isDeliveryStarted,
} from '@/lib/opsModel';

type StaffCaps = {
  id?: string | null;
  canPick?: boolean;
  canDeliver?: boolean;
};

/** Commandes actives sur Maintenant (ramassage + livraison démarrée). */
export function countNowTabBadge(jobs: PickJob[], deliveries: DeliveryJob[], staff: StaffCaps) {
  if (!staff.id) return 0;
  const picks = jobs.filter((j) => isActivePickStatus(j.pick_status) && j.picker_id === staff.id).length;
  const started = deliveries.filter((d) => isDeliveryStarted(d) && d.courier_id === staff.id).length;
  return picks + started;
}

/** File Courses : à préparer, sélectionnés, prêts à livrer. */
export function countCoursesTabBadge(jobs: PickJob[], deliveries: DeliveryJob[], staff: StaffCaps) {
  const pickAvailable = staff.canPick
    ? jobs.filter((j) => j.pick_status === 'queued' && !j.picker_id).length
    : 0;
  const readyDel = staff.canDeliver
    ? deliveries.filter((d) => isDeliveryClaimable(d) && !d.courier_id).length
    : 0;
  const held = staff.id
    ? deliveries.filter((d) => isDeliveryHeld(d) && d.courier_id === staff.id).length
    : 0;
  return pickAvailable + readyDel + held;
}

export function tabBadgeLabel(count: number) {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}
