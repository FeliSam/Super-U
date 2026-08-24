import { recentSearchesDefault, type SearchSort } from '@/data/catalog';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

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
};

const UiStateContext = createContext<UiStateContextValue | null>(null);

export function UiStateProvider({ children }: { children: React.ReactNode }) {
  const [homeActiveChipId, setHomeActiveChipId] = useState('fruits');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRecents, setSearchRecents] = useState(recentSearchesDefault);
  const [searchPriceSort, setSearchPriceSort] = useState<SearchSort>('price-asc');
  const [searchInStockOnly, setSearchInStockOnly] = useState(false);
  const [searchPromoOnly, setSearchPromoOnly] = useState(false);

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
    }),
    [
      homeActiveChipId,
      searchQuery,
      searchRecents,
      addRecentSearch,
      removeRecentSearch,
      clearRecentSearches,
      searchPriceSort,
      searchInStockOnly,
      searchPromoOnly,
    ],
  );

  return <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>;
}

export function useUiState() {
  const ctx = useContext(UiStateContext);
  if (!ctx) throw new Error('useUiState must be used within UiStateProvider');
  return ctx;
}
