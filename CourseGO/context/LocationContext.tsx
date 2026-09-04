import { courierMapFallback, haversineMeters, nearCotonou, type LngLat } from '@/constants/map';
import { useBoard } from '@/context/BoardContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { postLocation } from '@/lib/api/ops';
import { useStaffPrefs } from '@/context/StaffPrefsContext';
import { clientCoord, courierAnchor, offsetBeside, pointAlongRoute, storeCoord } from '@/lib/courierTrack';
import { buildCourierTourPlan } from '@/lib/tourRoute';
import { isDeliveryActive } from '@/lib/opsModel';
import { fetchRoadRoute } from '@/lib/roadRoute';
import { asVehicleKind, headingDeg, travelSeconds, tripProgress } from '@/lib/vehicleMotion';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

type LocValue = {
  lastPosition: LngLat | null;
  mapPosition: LngLat;
  heading: number | null;
  /** Géométrie OSRM suivie par la simulation (même tracé à afficher sur la carte). */
  routeCoordinates: LngLat[] | null;
};

const Ctx = createContext<LocValue>({
  lastPosition: null,
  mapPosition: courierMapFallback,
  heading: null,
  routeCoordinates: null,
});

function sameSpot(a: LngLat | null, b: LngLat, meters = 10) {
  if (!a) return false;
  return haversineMeters(a, b) < meters;
}

function getDeviceLocationWeb(): Promise<LngLat> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      (err) => reject(err ?? new Error('Geolocation failed')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 8000 },
    );
  });
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useStaffAuth();
  const { deliveries } = useBoard();
  const { prefs } = useStaffPrefs();
  const [gpsPosition, setGpsPosition] = useState<LngLat | null>(null);
  const [simPosition, setSimPosition] = useState<LngLat | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<LngLat[] | null>(null);
  const gpsRef = useRef<LngLat | null>(null);
  const simRef = useRef<LngLat | null>(null);
  const lastSent = useRef(0);
  const lastGpsShift = useRef(0);
  const routeStartedRef = useRef<{ id: string; at: string } | null>(null);
  const tourPlan = useMemo(
    () => buildCourierTourPlan(deliveries, staff?.id),
    [deliveries, staff?.id],
  );
  const active =
    tourPlan?.focusDelivery ??
    deliveries.find(isDeliveryActive) ??
    deliveries.find((d) => d.courier_id === staff?.id);
  const status = active?.delivery_status ?? null;
  const store = storeCoord(active);
  const home = clientCoord(active);
  const vehicle = asVehicleKind(staff?.vehicle);

  const publish = (here: LngLat) => {
    const now = Date.now();
    if (!staff || now - lastSent.current < 2500) return;
    if (!prefs.shareLocation) return;
    lastSent.current = now;
    if (nearCotonou(here[0], here[1])) {
      void postLocation(here[0], here[1]).catch(() => undefined);
    }
  };

  const applyGps = (here: LngLat, course?: number | null) => {
    const prev = gpsRef.current;
    if (prev && haversineMeters(prev, here) >= 12) lastGpsShift.current = Date.now();
    if (Number.isFinite(course) && (course as number) >= 0) setHeading(course as number);
    else if (prev && haversineMeters(prev, here) >= 4) setHeading(headingDeg(prev, here));
    if (sameSpot(prev, here, 8)) {
      publish(here);
      return;
    }
    gpsRef.current = here;
    setGpsPosition(here);
    publish(here);
  };

  const gpsIsMoving = () => lastGpsShift.current > 0 && Date.now() - lastGpsShift.current < 20_000;

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    let nativeSub: { remove: () => void } | null = null;
    let webWatchId: number | null = null;

    const stopWatch = () => {
      if (nativeSub && typeof nativeSub.remove === 'function') {
        nativeSub.remove();
      }
      nativeSub = null;
      if (webWatchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(webWatchId);
      }
      webWatchId = null;
    };

    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return;
      void getDeviceLocationWeb()
        .then((here) => {
          if (!cancelled) applyGps(here);
        })
        .catch(() => undefined);
      webWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          applyGps([pos.coords.longitude, pos.coords.latitude], pos.coords.heading);
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 },
      );
      return () => {
        cancelled = true;
        stopWatch();
      };
    }

    void (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (cancelled || perm.status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (!cancelled && last?.coords) {
        applyGps([last.coords.longitude, last.coords.latitude]);
      }
      if (cancelled) return;
      nativeSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 8,
        },
        (loc) => {
          applyGps([loc.coords.longitude, loc.coords.latitude], loc.coords.heading);
        },
      );
    })();

    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [staff?.id]);

  useEffect(() => {
    if (!staff) return;
    const anchor = courierAnchor(status);
    let cancelled = false;
    let raf = 0;

    if (anchor === 'store') {
      setRouteCoordinates(null);
      if (!gpsIsMoving()) setSimPosition(offsetBeside(store, home, 12));
      return () => {
        cancelled = true;
      };
    }
    if (anchor === 'client') {
      setRouteCoordinates(null);
      // Chez le client : à quelques mètres du point de commande (pas 90 m à côté).
      if (!gpsIsMoving()) setSimPosition(offsetBeside(home, store, 8));
      return () => {
        cancelled = true;
      };
    }

    // Même jambe que la carte : départ tournée (magasin / dernière remise) → client courant.
    const origin = tourPlan?.routeFrom ?? store;
    const dest = tourPlan?.navTo ?? home;

    void fetchRoadRoute([origin, dest], vehicle).then((road) => {
      if (cancelled || !road) return;
      const coords = road.coordinates.length >= 2 ? road.coordinates : [origin, dest];
      setRouteCoordinates(coords);
      const dist = road.distanceMeters || haversineMeters(origin, dest);
      const durationSec = travelSeconds(dist, vehicle, road.durationSeconds);
      const jobId = active?.id ?? '';
      const stamp = active?.en_route_at || active?.picked_up_at;
      if (stamp) routeStartedRef.current = { id: jobId, at: stamp };
      else if (routeStartedRef.current?.id !== jobId) {
        routeStartedRef.current = { id: jobId, at: new Date().toISOString() };
      }
      const startedAt = stamp || routeStartedRef.current?.at || new Date().toISOString();
      let lastEmit = 0;
      const tick = (now: number) => {
        if (cancelled) return;
        if (gpsIsMoving()) {
          raf = requestAnimationFrame(tick);
          return;
        }
        const t = tripProgress(startedAt, durationSec) ?? 0.06;
        const here = pointAlongRoute(coords, t);
        if (now - lastEmit >= 180) {
          lastEmit = now;
          const prev = simRef.current;
          if (prev && haversineMeters(prev, here) >= 3) setHeading(headingDeg(prev, here));
          simRef.current = here;
          setSimPosition(here);
          publish(here);
        }
        if (t < 0.97) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    staff?.id,
    active?.id,
    status,
    store[0],
    store[1],
    home[0],
    home[1],
    vehicle,
    tourPlan?.routeFrom?.[0],
    tourPlan?.routeFrom?.[1],
    tourPlan?.navTo?.[0],
    tourPlan?.navTo?.[1],
  ]);

  const mapPosition = useMemo<LngLat>(() => {
    if (
      gpsPosition &&
      nearCotonou(gpsPosition[0], gpsPosition[1]) &&
      lastGpsShift.current > 0 &&
      Date.now() - lastGpsShift.current < 20_000
    ) {
      return gpsPosition;
    }
    return simPosition ?? gpsPosition ?? courierMapFallback;
  }, [gpsPosition, simPosition]);

  const lastPosition = gpsPosition ?? simPosition;
  const value = useMemo(
    () => ({ lastPosition, mapPosition, heading, routeCoordinates }),
    [lastPosition, mapPosition, heading, routeCoordinates],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocation() {
  return useContext(Ctx);
}
