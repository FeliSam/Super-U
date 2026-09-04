import { type LngLat, haversineMeters } from '@/constants/map';
import { fetchRoadRoute, roundLngLat, type RoadRoute } from '@/lib/roadRoute';
import { asVehicleKind, travelSeconds, withLiveTravel, type VehicleKind } from '@/lib/vehicleMotion';
import { useEffect, useMemo, useRef, useState } from 'react';

function straightFallback(from: LngLat, to: LngLat, kind: VehicleKind): RoadRoute {
  const distanceMeters = haversineMeters(from, to) * 1.28;
  return {
    coordinates: [from, to],
    distanceMeters,
    durationSeconds: travelSeconds(distanceMeters, kind, null),
    approximated: true,
  };
}

/** Clé stable : origine ~100 m, destination ~10 m. */
function routingKey(from: LngLat, to: LngLat) {
  return `${roundLngLat(from, 3).join(',')}>${roundLngLat(to, 4).join(',')}`;
}

export function useRoadRoute(from: LngLat | null, to: LngLat | null, vehicle?: VehicleKind | string | null) {
  const kind = asVehicleKind(vehicle);
  const key = from && to ? `${kind}|${routingKey(from, to)}` : '';
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const fromRef = useRef(from);
  const toRef = useRef(to);
  const stickyRef = useRef<RoadRoute | null>(null);
  fromRef.current = from;
  toRef.current = to;

  useEffect(() => {
    if (!from || !to || !key) return;
    let live = true;
    setRoute((prev) => {
      const keep = prev && !prev.approximated ? prev : stickyRef.current;
      return keep ?? straightFallback(from, to, kind);
    });
    const timer = setTimeout(() => {
      const a = fromRef.current;
      const b = toRef.current;
      if (!a || !b) return;
      void fetchRoadRoute([a, b], kind).then((r) => {
        if (!live) return;
        if (r && r.coordinates.length >= 2) {
          stickyRef.current = r;
          setRoute(r);
          return;
        }
        // Échec OSRM : garder le dernier tracé routier, ne pas repasser en ligne droite.
        setRoute((prev) => {
          if (prev && !prev.approximated && prev.coordinates.length >= 2) return prev;
          if (stickyRef.current) return stickyRef.current;
          return straightFallback(a, b, kind);
        });
      });
    }, 320);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key, kind]);

  return useMemo(() => withLiveTravel(route, kind), [route, kind]);
}
