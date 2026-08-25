import { cotonouMap, type LngLat } from '@/constants/map';
import { appLocation } from '@/constants/location';
import { deliveryAddresses as seedAddresses, type DeliveryAddress } from '@/data/account';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.addresses.v1';

export type AddressInput = {
  label: string;
  line: string;
  city: string;
  phone: string;
  coordinate: LngLat;
  makeDefault?: boolean;
};

type AddressesContextValue = {
  ready: boolean;
  addresses: DeliveryAddress[];
  selectedId: string;
  defaultAddress: DeliveryAddress;
  setSelectedId: (id: string) => void;
  setDefault: (id: string) => void;
  addAddress: (input: AddressInput) => DeliveryAddress;
  updateAddress: (id: string, input: AddressInput) => void;
  removeAddress: (id: string) => boolean;
};

const AddressesContext = createContext<AddressesContextValue | null>(null);

function withCoords(list: DeliveryAddress[]): DeliveryAddress[] {
  return list.map((a, i) => {
    if (a.coordinate) return a;
    // Seed defaults: domicile = Ganhi, bureau ≈ Cadjehoun marina
    const coordinate: LngLat =
      a.id === 'work' ? ([2.3905, 6.3558] as LngLat) : ([...cotonouMap.home] as LngLat);
    return { ...a, coordinate: i === 0 ? ([...cotonouMap.home] as LngLat) : coordinate };
  });
}

function sanitizeAddress(raw: unknown): DeliveryAddress | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<DeliveryAddress>;
  if (typeof a.id !== 'string' || typeof a.label !== 'string') return null;
  const coord = a.coordinate;
  const coordinate: LngLat =
    Array.isArray(coord) &&
    coord.length === 2 &&
    typeof coord[0] === 'number' &&
    typeof coord[1] === 'number'
      ? [coord[0], coord[1]]
      : [...cotonouMap.home];
  return {
    id: a.id,
    label: a.label.trim() || 'Adresse',
    line: (typeof a.line === 'string' && a.line.trim()) || appLocation.defaultLine,
    city: (typeof a.city === 'string' && a.city.trim()) || appLocation.city,
    phone: (typeof a.phone === 'string' && a.phone.trim()) || appLocation.phone,
    default: Boolean(a.default),
    coordinate,
  };
}

export function AddressesProvider({ children }: { children: React.ReactNode }) {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>(() => withCoords(seedAddresses));
  const [selectedId, setSelectedId] = useState(
    () => seedAddresses.find((a) => a.default)?.id ?? seedAddresses[0]?.id ?? 'home',
  );
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const parsed = JSON.parse(raw) as { addresses?: unknown; selectedId?: string };
          const list = Array.isArray(parsed.addresses)
            ? parsed.addresses.map(sanitizeAddress).filter((a): a is DeliveryAddress => Boolean(a))
            : [];
          if (list.length) {
            const normalized = list.map((a, i) => ({
              ...a,
              default: parsed.selectedId ? a.id === parsed.selectedId : i === 0 ? a.default : false,
            }));
            // Ensure exactly one default
            const defId =
              (typeof parsed.selectedId === 'string' &&
                normalized.some((a) => a.id === parsed.selectedId) &&
                parsed.selectedId) ||
              normalized.find((a) => a.default)?.id ||
              normalized[0].id;
            setAddresses(normalized.map((a) => ({ ...a, default: a.id === defId })));
            setSelectedId(defId);
          }
        }
      } catch {
        // keep seeds
      } finally {
        if (active) {
          hydrated.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ addresses, selectedId }),
    ).catch(() => undefined);
  }, [addresses, selectedId]);

  const setDefault = useCallback((id: string) => {
    setSelectedId(id);
    setAddresses((prev) => prev.map((a) => ({ ...a, default: a.id === id })));
  }, []);

  const addAddress = useCallback((input: AddressInput) => {
    const id = `addr-${Date.now()}`;
    const makeDefault = Boolean(input.makeDefault);
    const next: DeliveryAddress = {
      id,
      label: input.label.trim() || 'Nouveau lieu',
      line: input.line.trim() || appLocation.defaultLine,
      city: input.city.trim() || `${appLocation.city}, ${appLocation.country}`,
      phone: input.phone.trim() || appLocation.phone,
      coordinate: input.coordinate,
      default: makeDefault,
    };
    setAddresses((prev) => {
      const base = makeDefault ? prev.map((a) => ({ ...a, default: false })) : prev;
      return [...base, next];
    });
    if (makeDefault) setSelectedId(id);
    else setSelectedId((cur) => cur || id);
    return next;
  }, []);

  const updateAddress = useCallback((id: string, input: AddressInput) => {
    const makeDefault = Boolean(input.makeDefault);
    setAddresses((prev) =>
      prev.map((a) => {
        if (a.id !== id) {
          return makeDefault ? { ...a, default: false } : a;
        }
        return {
          ...a,
          label: input.label.trim() || a.label,
          line: input.line.trim() || a.line,
          city: input.city.trim() || a.city,
          phone: input.phone.trim() || a.phone,
          coordinate: input.coordinate,
          default: makeDefault ? true : a.default,
        };
      }),
    );
    if (makeDefault) setSelectedId(id);
  }, []);

  const removeAddress = useCallback((id: string) => {
    let didRemove = false;
    setAddresses((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((a) => a.id !== id);
      if (next.length === prev.length) return prev;
      didRemove = true;
      if (!next.some((a) => a.default) && next[0]) {
        return next.map((a, i) => ({ ...a, default: i === 0 }));
      }
      return next;
    });
    return didRemove;
  }, []);

  useEffect(() => {
    if (!addresses.length) return;
    if (addresses.some((a) => a.id === selectedId)) return;
    const fallback = addresses.find((a) => a.default)?.id ?? addresses[0].id;
    setSelectedId(fallback);
  }, [addresses, selectedId]);

  const defaultAddress = useMemo(() => {
    return (
      addresses.find((a) => a.id === selectedId) ??
      addresses.find((a) => a.default) ??
      addresses[0] ?? {
        id: 'home',
        label: 'Domicile',
        line: appLocation.defaultLine,
        city: appLocation.city,
        phone: appLocation.phone,
        default: true,
        coordinate: [...cotonouMap.home] as LngLat,
      }
    );
  }, [addresses, selectedId]);

  const value = useMemo(
    () => ({
      ready,
      addresses,
      selectedId,
      defaultAddress,
      setSelectedId,
      setDefault,
      addAddress,
      updateAddress,
      removeAddress,
    }),
    [ready, addresses, selectedId, defaultAddress, setDefault, addAddress, updateAddress, removeAddress],
  );

  return <AddressesContext.Provider value={value}>{children}</AddressesContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressesContext);
  if (!ctx) throw new Error('useAddresses must be used within AddressesProvider');
  return ctx;
}
