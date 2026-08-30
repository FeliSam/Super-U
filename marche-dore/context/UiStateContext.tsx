import { isDemoRecentList, type SearchSort } from '@/data/catalog';
import { apiGetAccountState, apiPatchAccountState, loadAccountJson, saveAccountJson, type AccountPrefs } from '@/lib/accountSync';
import { getAuthToken } from '@/lib/api/http';
import { useAuth } from '@/context/AuthContext';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.ui-prefs.v1';

type UiStateContextValue = {
  homeActiveChipId: string;
  setHomeActiveChipId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchRecents: string[];
  addRecentSearch: (term: string) => void;
  removeRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
  searchPriceSort: SearchSort;
  setSearchPriceSort: React.Dispatch<React.SetStateAction<SearchSort>>;
  searchInStockOnly: boolean;
  setSearchInStockOnly: React.Dispatch<React.SetStateAction<boolean>>;
  searchPromoOnly: boolean;
  setSearchPromoOnly: React.Dispatch<React.SetStateAction<boolean>>;
  pushEnabled: boolean;
  setPushEnabled: (v: boolean) => void;
  smsEnabled: boolean;
  setSmsEnabled: (v: boolean) => void;
  emailEnabled: boolean;
  setEmailEnabled: (v: boolean) => void;
  promoEnabled: boolean;
  setPromoEnabled: (v: boolean) => void;
  interests: string[];
  setInterests: (ids: string[]) => void;
  alertsOn: boolean;
  setAlertsOn: (v: boolean) => void;
  loyaltyBonusPts: number;
  addLoyaltyBonus: (pts: number) => void;
  redeemedRewardIds: string[];
  redeemReward: (id: string, cost: number) => boolean;
};

const UiStateContext = createContext<UiStateContextValue | null>(null);

const DEFAULT_PREFS = {
  homeActiveChipId: 'fruits',
  searchRecents: [] as string[],
  pushEnabled: true,
  smsEnabled: false,
  emailEnabled: true,
  promoEnabled: true,
  interests: [] as string[],
  alertsOn: true,
};

export function UiStateProvider({ children }: { children: React.ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const accountId = session?.accountId ?? null;
  const [homeActiveChipId, setHomeActiveChipIdState] = useState(DEFAULT_PREFS.homeActiveChipId);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRecents, setSearchRecents] = useState<string[]>([]);
  const [searchPriceSort, setSearchPriceSort] = useState<SearchSort>('price-asc');
  const [searchInStockOnly, setSearchInStockOnly] = useState(false);
  const [searchPromoOnly, setSearchPromoOnly] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [promoEnabled, setPromoEnabled] = useState(true);
  const [interests, setInterests] = useState<string[]>([]);
  const [alertsOn, setAlertsOn] = useState(true);
  const [loyaltyBonusPts, setLoyaltyBonusPts] = useState(0);
  const [redeemedRewardIds, setRedeemedRewardIds] = useState<string[]>([]);
  const hydrated = useRef(false);
  const skipSave = useRef(true);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    skipSave.current = true;
    hydrated.current = false;
    (async () => {
      let prefs: AccountPrefs = {};
      let bonus = 0;
      let redeemed: string[] = [];
      if (accountId) {
        const local = await loadAccountJson<AccountPrefs & { loyaltyBonusPts?: number; redeemedRewardIds?: string[] }>(
          STORAGE_KEY,
          accountId,
        );
        if (local) {
          prefs = local;
          if (typeof local.loyaltyBonusPts === 'number') bonus = local.loyaltyBonusPts;
          if (Array.isArray(local.redeemedRewardIds)) {
            redeemed = local.redeemedRewardIds.filter((x): x is string => typeof x === 'string');
          }
        }
        if (getAuthToken()) {
          const state = await apiGetAccountState();
          if (state?.prefs) prefs = { ...prefs, ...state.prefs };
          if (typeof state?.loyaltyBonusPts === 'number') bonus = state.loyaltyBonusPts;
          if (Array.isArray(state?.redeemedRewardIds)) {
            redeemed = state.redeemedRewardIds.filter((x): x is string => typeof x === 'string');
          }
        }
      }
      if (!active) return;
      setHomeActiveChipIdState(prefs.homeActiveChipId || DEFAULT_PREFS.homeActiveChipId);
      setSearchRecents(
        Array.isArray(prefs.searchRecents) && !isDemoRecentList(prefs.searchRecents)
          ? prefs.searchRecents.slice(0, 8)
          : [],
      );
      setPushEnabled(prefs.pushEnabled ?? true);
      setSmsEnabled(prefs.smsEnabled ?? false);
      setEmailEnabled(prefs.emailEnabled ?? true);
      setPromoEnabled(prefs.promoEnabled ?? true);
      setInterests(Array.isArray(prefs.interests) ? prefs.interests : []);
      setAlertsOn(prefs.alertsOn ?? true);
      setLoyaltyBonusPts(Number.isFinite(bonus) ? bonus : 0);
      setRedeemedRewardIds(redeemed);
      hydrated.current = true;
      skipSave.current = false;
    })();
    return () => {
      active = false;
    };
  }, [authReady, accountId]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    const prefs: AccountPrefs = {
      homeActiveChipId,
      searchRecents,
      pushEnabled,
      smsEnabled,
      emailEnabled,
      promoEnabled,
      interests,
      alertsOn,
    };
    void saveAccountJson(STORAGE_KEY, accountId, {
      ...prefs,
      loyaltyBonusPts,
      redeemedRewardIds,
    });
    apiPatchAccountState({ prefs, loyaltyBonusPts, redeemedRewardIds });
  }, [
    homeActiveChipId,
    searchRecents,
    pushEnabled,
    smsEnabled,
    emailEnabled,
    promoEnabled,
    interests,
    alertsOn,
    loyaltyBonusPts,
    redeemedRewardIds,
    accountId,
  ]);

  const setHomeActiveChipId = useCallback((id: string) => setHomeActiveChipIdState(id), []);

  const addRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setSearchRecents((prev) =>
      [trimmed, ...prev.filter((x) => x.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8),
    );
  }, []);

  const removeRecentSearch = useCallback((term: string) => {
    setSearchRecents((prev) => prev.filter((x) => x !== term));
  }, []);

  const clearRecentSearches = useCallback(() => {
    setSearchRecents([]);
  }, []);

  const addLoyaltyBonus = useCallback((pts: number) => {
    if (pts <= 0) return;
    setLoyaltyBonusPts((prev) => prev + pts);
  }, []);

  const redeemReward = useCallback((id: string, cost: number) => {
    if (!id || cost < 0) return false;
    let ok = false;
    setRedeemedRewardIds((prev) => {
      if (prev.includes(id)) return prev;
      ok = true;
      return [...prev, id];
    });
    if (ok) setLoyaltyBonusPts((prev) => prev - cost);
    return ok;
  }, []);

  const value = useMemo(
    () => ({
      homeActiveChipId,
      setHomeActiveChipId,
      searchQuery,
      setSearchQuery,
      searchRecents,
      addRecentSearch,
      removeRecentSearch,
      clearRecentSearches,
      searchPriceSort,
      setSearchPriceSort,
      searchInStockOnly,
      setSearchInStockOnly,
      searchPromoOnly,
      setSearchPromoOnly,
      pushEnabled,
      setPushEnabled,
      smsEnabled,
      setSmsEnabled,
      emailEnabled,
      setEmailEnabled,
      promoEnabled,
      setPromoEnabled,
      interests,
      setInterests,
      alertsOn,
      setAlertsOn,
      loyaltyBonusPts,
      addLoyaltyBonus,
      redeemedRewardIds,
      redeemReward,
    }),
    [
      homeActiveChipId,
      setHomeActiveChipId,
      searchQuery,
      searchRecents,
      addRecentSearch,
      removeRecentSearch,
      clearRecentSearches,
      searchPriceSort,
      searchInStockOnly,
      searchPromoOnly,
      pushEnabled,
      smsEnabled,
      emailEnabled,
      promoEnabled,
      interests,
      alertsOn,
      loyaltyBonusPts,
      addLoyaltyBonus,
      redeemedRewardIds,
      redeemReward,
    ],
  );

  return <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>;
}

export function useUiState() {
  const ctx = useContext(UiStateContext);
  if (!ctx) throw new Error('useUiState must be used within UiStateProvider');
  return ctx;
}
