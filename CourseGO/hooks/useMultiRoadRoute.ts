import { type LngLat, haversineMeters } from '@/constants/map';
import { fetchRoadRoute, roadWaypointsKey, type RoadRoute } from '@/lib/roadRoute';
import { asVehicleKind, travelSeconds, withLiveTravel, type VehicleKind } from '@/lib/vehicleMotion';
import { useEffect, useMemo, useRef, useState } from 'react';

function straightFallback(pts: LngLat[], kind: VehicleKind): RoadRoute {
  let air = 0;
  for (let i = 1; i < pts.length; i++) air += haversineMeters(pts[i - 1], pts[i]);
  const distanceMeters = air * 1.28;
  return {
    coordinates: pts,
    distanceMeters,
    durationSeconds: travelSeconds(distanceMeters, kind, null),
    approximated: true,
  };
}

export function useMultiRoadRoute(
  waypoints: LngLat[] | null | undefined,
  vehicle?: VehicleKind | string | null,
) {
  const kind = asVehicleKind(vehicle);
  const key = waypoints && waypoints.length >= 2 ? `${kind}|${roadWaypointsKey(waypoints, 3)}` : '';
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const ptsRef = useRef(waypoints);
  const stickyRef = useRef<RoadRoute | null>(null);
  ptsRef.current = waypoints;

  useEffect(() => {
    if (!waypoints || waypoints.length < 2 || !key) return;
    const snapshot = [...waypoints];
    let live = true;
    setRoute((prev) => {
      const keep = prev && !prev.approximated ? prev : stickyRef.current;
      return keep ?? straightFallback(snapshot, kind);
    });
    const timer = setTimeout(() => {
      const pts = ptsRef.current ? [...ptsRef.current] : snapshot;
      if (pts.length < 2) return;
      void fetchRoadRoute(pts, kind).then((r) => {
        if (!live) return;
        if (r && r.coordinates.length >= 2) {
          stickyRef.current = r;
          setRoute(r);
          return;
        }
        setRoute((prev) => {
          if (prev && !prev.approximated && prev.coordinates.length >= 2) return prev;
          if (stickyRef.current) return stickyRef.current;
          return straightFallback(pts, kind);
        });
      });
    }, 360);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key, kind]);

  return useMemo(() => withLiveTravel(route, kind), [route, kind]);
}
