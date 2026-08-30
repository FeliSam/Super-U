import { cotonouMap, type LngLat } from '@/constants/map';
import { appLocation } from '@/constants/location';
import { type DeliveryAddress } from '@/data/account';
import { loadAccountJson, saveAccountJson, apiGetAccountState, apiPatchAccountState } from '@/lib/accountSync';
import { getAuthToken } from '@/lib/api/http';
import { useAuth } from '@/context/AuthContext';
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
  defaultAddress: DeliveryAddress | null;
  hasAddress: boolean;
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
  const line = typeof a.line === 'string' ? a.line.trim() : '';
  if (!line) return null;
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
    line,
    city: (typeof a.city === 'string' && a.city.trim()) || appLocation.city,
    phone: (typeof a.phone === 'string' && a.phone.trim()) || '',
    default: Boolean(a.default),
    coordinate,
  };
}

export function AddressesProvider({ children }: { children: React.ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const accountId = session?.accountId ?? null;
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const skipSave = useRef(true);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    skipSave.current = true;
    hydrated.current = false;
    (async () => {
      if (!accountId) {
        setAddresses([]);
        setSelectedId('');
        hydrated.current = true;
        setReady(true);
        return;
      }
      const local = await loadAccountJson<{ addresses?: unknown; selectedId?: string }>(STORAGE_KEY, accountId);
      let list = Array.isArray(local?.addresses)
        ? local.addresses.map(sanitizeAddress).filter((a): a is DeliveryAddress => Boolean(a))
        : [];
      let selected = typeof local?.selectedId === 'string' ? local.selectedId : '';
      if (getAuthToken()) {
        const state = await apiGetAccountState();
        const remote = state?.addresses;
        if (remote && Array.isArray(remote.list)) {
          list = remote.list.map(sanitizeAddress).filter((a): a is DeliveryAddress => Boolean(a));
          if (typeof remote.selectedId === 'string') selected = remote.selectedId;
        }
      }
      if (!active) return;
      setAddresses(withCoords(list));
      setSelectedId(selected);
      hydrated.current = true;
      setReady(true);
      skipSave.current = false;
    })();
    return () => {
      active = false;
    };
  }, [authReady, accountId]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    const payload = { addresses, selectedId };
    void saveAccountJson(STORAGE_KEY, accountId, payload);
    apiPatchAccountState({ addresses: { list: addresses, selectedId } });
  }, [addresses, selectedId, accountId]);

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
      line: input.line.trim(),
      city: input.city.trim() || `${appLocation.city}, ${appLocation.country}`,
      phone: input.phone.trim(),
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
      const next = prev.filter((a) => a.id !== id);
      if (next.length === prev.length) return prev;
      didRemove = true;
      if (!next.length) return next;
      if (!next.some((a) => a.default) && next[0]) {
        return next.map((a, i) => ({ ...a, default: i === 0 }));
      }
      return next;
    });
    return didRemove;
  }, []);

  useEffect(() => {
    if (!addresses.length) {
      if (selectedId) setSelectedId('');
      return;
    }
    if (addresses.some((a) => a.id === selectedId)) return;
    const fallback = addresses.find((a) => a.default)?.id ?? addresses[0].id;
    setSelectedId(fallback);
  }, [addresses, selectedId]);

  const defaultAddress = useMemo(() => {
    return (
      addresses.find((a) => a.id === selectedId) ??
      addresses.find((a) => a.default) ??
      addresses[0] ??
      null
    );
  }, [addresses, selectedId]);

  const value = useMemo(
    () => ({
      ready,
      addresses,
      selectedId,
      defaultAddress,
      hasAddress: addresses.length > 0,
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
