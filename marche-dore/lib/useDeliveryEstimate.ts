import type { LngLat } from '@/constants/map';
import { fetchDrivingRoute } from '@/lib/deliveryRouting';
import { useEffect, useState } from 'react';

export type DeliveryEstimate = {
  loading: boolean;
  distanceMeters: number;
  durationSeconds: number;
  /** true when coords are missing */
  unavailable: boolean;
  /** true when OSRM failed — distance is haversine approximation */
  approximated: boolean;
};

const EMPTY: DeliveryEstimate = {
  loading: false,
  distanceMeters: 0,
  durationSeconds: 0,
  unavailable: true,
  approximated: false,
};

/**
 * Estimation routière live supermarché → adresse (OSRM).
 */
export function useDeliveryEstimate(from?: LngLat | null, to?: LngLat | null): DeliveryEstimate {
  const fromKey = from ? `${from[0].toFixed(5)},${from[1].toFixed(5)}` : '';
  const toKey = to ? `${to[0].toFixed(5)},${to[1].toFixed(5)}` : '';
  const [state, setState] = useState<DeliveryEstimate>(EMPTY);

  useEffect(() => {
    if (!from || !to) {
      setState(EMPTY);
      return;
    }
    let active = true;
    setState((prev) => ({ ...prev, loading: true, unavailable: false, approximated: false }));
    void fetchDrivingRoute(from, to, 'driving')
      .then((route) => {
        if (!active) return;
        setState({
          loading: false,
          unavailable: false,
          approximated: Boolean(route.approximated),
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
        });
      })
      .catch(() => {
        if (!active) return;
        setState({
          loading: false,
          unavailable: true,
          approximated: false,
          distanceMeters: 0,
          durationSeconds: 0,
        });
      });
    return () => {
      active = false;
    };
  }, [fromKey, toKey]);

  return state;
}
