import { type LngLat } from '@/constants/map';
import { fetchRoadRoute, roundLngLat, type RoadRoute } from '@/lib/roadRoute';
import { asVehicleKind, withLiveTravel, type VehicleKind } from '@/lib/vehicleMotion';
import { useEffect, useMemo, useState } from 'react';

export function useRoadRoute(from: LngLat | null, to: LngLat | null, vehicle?: VehicleKind | string | null) {
  const kind = asVehicleKind(vehicle);
  const key = useMemo(() => {
    if (!from || !to) return '';
    const a = roundLngLat(from);
    const b = roundLngLat(to);
    return `${a[0]},${a[1]}>${b[0]},${b[1]}`;
  }, [from?.[0], from?.[1], to?.[0], to?.[1]]);

  const [route, setRoute] = useState<RoadRoute | null>(null);

  useEffect(() => {
    if (!from || !to || !key) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    void fetchRoadRoute([from, to]).then((r) => {
      if (!cancelled) setRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return useMemo(() => withLiveTravel(route, kind), [route, kind]);
}
