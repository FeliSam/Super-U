import type { LngLat } from '@/constants/map';
import type { DeliveryJob } from '@/lib/api/ops';
import {
  buildCourierTourPlan,
  optimizeClientOrderByRoad,
  resolveTourOrigin,
  tourMembershipKey,
  type CourierTourPlan,
} from '@/lib/tourRoute';
import type { VehicleKind } from '@/lib/vehicleMotion';
import { useEffect, useMemo, useRef, useState } from 'react';

type TourOpts = {
  focusDeliveryId?: string;
  courierPosition?: LngLat;
  lastDrop?: LngLat | null;
  lastDropLabel?: string | null;
  lastDropStoreId?: string | null;
  vehicle?: VehicleKind | string | null;
};

/**
 * Plan sync (haversine) immédiat, puis refresh d’ordre via durées OSRM
 * sans bloquer la UI. Single-stop inchangé.
 */
export function useCourierTourPlan(
  deliveries: DeliveryJob[],
  courierId: string | undefined,
  options?: TourOpts,
): CourierTourPlan | null {
  const [roadOrderIds, setRoadOrderIds] = useState<string[] | null>(null);
  const genRef = useRef(0);

  const membership = tourMembershipKey(deliveries, courierId);
  const originMeta = useMemo(
    () =>
      resolveTourOrigin(deliveries, courierId, {
        lastDrop: options?.lastDrop,
        lastDropLabel: options?.lastDropLabel,
        lastDropStoreId: options?.lastDropStoreId,
      }),
    [
      membership,
      options?.lastDrop?.[0],
      options?.lastDrop?.[1],
      options?.lastDropStoreId,
      options?.lastDropLabel,
    ],
  );
  const originKey = originMeta
    ? `${originMeta.origin[0].toFixed(4)},${originMeta.origin[1].toFixed(4)}:${originMeta.tourStarted ? 1 : 0}`
    : '';

  useEffect(() => {
    setRoadOrderIds(null);
    if (!originMeta || !courierId) return;
    const mineCount = membership ? membership.split('|').filter(Boolean).length : 0;
    if (mineCount <= 1) return;

    const gen = ++genRef.current;
    const profile = options?.vehicle ?? 'driving';
    const mineIds = membership.split('|').map((p) => p.split(':')[0]!).filter(Boolean);
    const mine = deliveries.filter((d) => mineIds.includes(d.id));

    void optimizeClientOrderByRoad(originMeta.origin, mine, profile).then((ordered) => {
      if (gen !== genRef.current) return;
      setRoadOrderIds(ordered.map((d) => d.id));
    });
  }, [membership, originKey, courierId, options?.vehicle]);

  return useMemo(
    () =>
      buildCourierTourPlan(deliveries, courierId, {
        focusDeliveryId: options?.focusDeliveryId,
        courierPosition: options?.courierPosition,
        lastDrop: options?.lastDrop,
        lastDropLabel: options?.lastDropLabel,
        lastDropStoreId: options?.lastDropStoreId,
        orderedDeliveryIds: roadOrderIds,
      }),
    [
      deliveries,
      courierId,
      options?.focusDeliveryId,
      options?.courierPosition?.[0],
      options?.courierPosition?.[1],
      options?.lastDrop?.[0],
      options?.lastDrop?.[1],
      options?.lastDropLabel,
      options?.lastDropStoreId,
      roadOrderIds,
      membership,
    ],
  );
}
