import { courierMapFallback, nearCotonou, type LngLat } from '@/constants/map';
import { useBoard } from '@/context/BoardContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { postLocation } from '@/lib/api/ops';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

type LocValue = { lastPosition: LngLat | null; mapPosition: LngLat };

const Ctx = createContext<LocValue>({ lastPosition: null, mapPosition: courierMapFallback });

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useStaffAuth();
  const { deliveries, online } = useBoard();
  const [lastPosition, setLastPosition] = useState<LngLat | null>(null);
  const enRoute = deliveries.some((d) => d.delivery_status === 'en_route');
  const tracking = Boolean(staff) && (online || enRoute || deliveries.some((d) => !!d.courier_id));

  useEffect(() => {
    if (!tracking) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let watchId: number | undefined;

    const push = (lng: number, lat: number, heading?: number | null, speed?: number | null) => {
      const here: LngLat = [lng, lat];
      setLastPosition(here);
      if (nearCotonou(lng, lat) && enRoute) {
        void postLocation(lng, lat, heading ?? undefined, speed ?? undefined).catch(() => undefined);
      }
    };

    void (async () => {
      try {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const tick = async () => {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          push(pos.coords.longitude, pos.coords.latitude, pos.coords.heading, pos.coords.speed);
        };
        await tick();
        timer = setInterval(() => void tick(), 8000);
      } catch {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
          watchId = navigator.geolocation.watchPosition((pos) => {
            push(pos.coords.longitude, pos.coords.latitude, pos.coords.heading, pos.coords.speed);
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [tracking, enRoute]);

  const mapPosition = useMemo<LngLat>(() => {
    if (lastPosition && nearCotonou(lastPosition[0], lastPosition[1])) return lastPosition;
    return courierMapFallback;
  }, [lastPosition]);

  const value = useMemo(() => ({ lastPosition, mapPosition }), [lastPosition, mapPosition]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocation() {
  return useContext(Ctx);
}
