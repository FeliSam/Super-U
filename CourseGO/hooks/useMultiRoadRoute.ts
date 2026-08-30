import { type LngLat } from '@/constants/map';
import { fetchRoadRoute, roundLngLat, type RoadRoute } from '@/lib/roadRoute';
import { asVehicleKind, withLiveTravel, type VehicleKind } from '@/lib/vehicleMotion';
import { useEffect, useMemo, useState } from 'react';

export function useMultiRoadRoute(
  waypoints: LngLat[] | null | undefined,
  vehicle?: VehicleKind | string | null,
) {
  const kind = asVehicleKind(vehicle);
  const key = useMemo(() => {
    if (!waypoints || waypoints.length < 2) return '';
    return waypoints.map((p) => roundLngLat(p).join(',')).join('>');
  }, [waypoints]);

  const [route, setRoute] = useState<RoadRoute | null>(null);

  useEffect(() => {
    if (!waypoints || waypoints.length < 2 || !key) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    void fetchRoadRoute(waypoints).then((r) => {
      if (!cancelled) setRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [key, waypoints]);

  return useMemo(() => withLiveTravel(route, kind), [route, kind]);
}
