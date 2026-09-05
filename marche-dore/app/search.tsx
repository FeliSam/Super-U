import { AppImage } from '@/components/AppImage';
import { goBack } from '@/lib/navigation';
import { FrostedTopBar, frostedBarClearance, IconCircle, MarcheRefresh, ProductCard, Screen, SearchField, Page, SmartNavbarChip } from '@/components/ui';
import { displayFont, tabBarClearance, type AppColors, spacing } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useUiState } from '@/context/UiStateContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useCart } from '@/context/CartContext';
import { useCatalog } from '@/context/CatalogContext';
import { useOrders } from '@/context/OrdersContext';
import {
  popularTermsForAccount,
  searchCategories,
  searchCategoryRoute,
  searchSuggestions,
  type SearchSort } from '@/data/catalog';
import { rankProductsForShopper } from '@/lib/homeEngine';
import { ProductFlashGrid } from '@/components/ProductFlashGrid';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FilterKey = 'Prix' | 'Note' | 'Disponible' | 'Promo';

const filters: { key: FilterKey; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { key: 'Prix', icon: 'arrow-up' },
  { key: 'Note', icon: 'star' },
  { key: 'Disponible', icon: 'check-circle' },
  { key: 'Promo', icon: 'tag' },
];

function SearchScreen() {
  const { version: catalogVersion, products, searchProducts, refresh: refreshCatalog } = useCatalog();
  const [refreshing, setRefreshing] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const heroClearance = frostedBarClearance(insets.top);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const started = Date.now();
    try {
      await refreshCatalog();
    } finally {
      const wait = 420 - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setRefreshing(false);
    }
  }, [refreshCatalog]);

  const {
    searchQuery,
    setSearchQuery,
    searchRecents,
    recentProductIds,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    searchPriceSort,
    setSearchPriceSort,
    searchInStockOnly,
    setSearchInStockOnly,
    searchPromoOnly,
    setSearchPromoOnly,
    interests,
  } = useUiState();
  const { products: favoriteProducts, ids: favoriteIds } = useFavorites();
  const { orders } = useOrders();
  const { lines } = useCart();

  const trimmedQuery = searchQuery.trim();
  const hasQuery = trimmedQuery.length > 0;
  const hasFilters =
    searchInStockOnly ||
    searchPromoOnly ||
    searchPriceSort === 'price-desc' ||
    searchPriceSort === 'rating';

  const sort: SearchSort = searchPriceSort;

  const orderedIds = useMemo(
    () => orders.flatMap((order) => order.lines.map((line) => line.productId)).slice(0, 48),
    [orders],
  );

  const results = useMemo(() => {
    const list = searchProducts(searchQuery, {
      sort: hasQuery || hasFilters ? sort : undefined,
      inStockOnly: searchInStockOnly,
      promoOnly: searchPromoOnly,
    });
    if (hasQuery || hasFilters) return list;
    return rankProductsForShopper(list, {
      recents: searchRecents,
      favoriteIds,
      cartIds: lines.map((line) => line.productId),
      orderedIds,
      interests,
      viewedIds: recentProductIds,
    });
  }, [
    searchQuery,
    sort,
    hasQuery,
    hasFilters,
    searchInStockOnly,
    searchPromoOnly,
    catalogVersion,
    searchRecents,
    favoriteIds,
    lines,
    orderedIds,
    interests,
    recentProductIds,
  ]);

  const accountPopulars = useMemo(() => {
    const fromFavorites = favoriteProducts.map((p) => p.name);
    const fromOrders = orders.flatMap((o) => o.lines.map((l) => l.name));
    return popularTermsForAccount({ recents: searchRecents, names: [...fromFavorites, ...fromOrders] });
  }, [favoriteProducts, orders, searchRecents]);

  const liveSuggestions = useMemo(
    () => searchSuggestions(searchQuery, searchRecents, accountPopulars),
    [searchQuery, searchRecents, accountPopulars, catalogVersion],
  );

  const filteredRecents = useMemo(() => {
    if (!hasQuery) return searchRecents;
    const q = trimmedQuery.toLowerCase();
    return searchRecents.filter((term) => term.toLowerCase().includes(q));
  }, [hasQuery, searchRecents, trimmedQuery]);

  const filteredTags = useMemo(() => {
    if (!hasQuery) return accountPopulars;
    const q = trimmedQuery.toLowerCase();
    return accountPopulars.filter((term) => term.toLowerCase().includes(q));
  }, [hasQuery, trimmedQuery, accountPopulars]);

  const applySearch = (term: string) => {
    setSearchQuery(term);
    addRecentSearch(term);
  };

  const commitSearch = () => {
    if (trimmedQuery) addRecentSearch(trimmedQuery);
  };

  const onFilterPress = (filter: FilterKey) => {
    if (filter === 'Prix') {
      setSearchPriceSort((prev) => (prev === 'price-asc' ? 'price-desc' : 'price-asc'));
      return;
    }
    if (filter === 'Note') {
      setSearchPriceSort((prev) => (prev === 'rating' ? 'price-asc' : 'rating'));
      return;
    }
    if (filter === 'Disponible') {
      setSearchInStockOnly((v) => !v);
      return;
    }
    setSearchPromoOnly((v) => !v);
  };

  const isFilterActive = (filter: FilterKey) => {
    if (filter === 'Prix') return searchPriceSort === 'price-asc' || searchPriceSort === 'price-desc';
    if (filter === 'Note') return searchPriceSort === 'rating';
    if (filter === 'Disponible') return searchInStockOnly;
    return searchPromoOnly;
  };

  const openCategory = (categoryId: string, label: string) => {
    const cat = searchCategories.find((c) => c.id === categoryId && c.label === label);
    if (cat) router.push(searchCategoryRoute(cat));
    else router.push(`/category/${categoryId}`);
  };

  const personalized =
    !hasQuery && !hasFilters && (recentProductIds.length > 0 || searchRecents.length > 0);

  const resultsTitle = hasQuery
    ? `${results.length} résultat${results.length > 1 ? 's' : ''}`
    : hasFilters
      ? `${results.length} produit${results.length > 1 ? 's' : ''} filtré${results.length > 1 ? 's' : ''}`
      : personalized
        ? 'Selon votre activité'
        : 'Catalogue';

  const resultsSub = hasQuery
    ? `pour « ${trimmedQuery} »`
    : hasFilters
      ? 'Filtres actifs appliqués'
      : personalized
        ? 'Fiches ouvertes et recherches récentes'
        : `${products.length} produits disponibles`;

  const continueTerm = searchRecents[0] ?? null;
  const continueProducts = useMemo(
    () => (continueTerm ? searchProducts(continueTerm, { inStockOnly: true }).slice(0, 8) : []),
    [continueTerm, catalogVersion],
  );

  const showDiscovery = !hasQuery;

  return (
    <Screen>
      <Page style={styles.flex}>
        <FrostedTopBar
          right={
            <SmartNavbarChip round>
            <IconCircle
              name="tag"
              variant="ghost"
              size="lg"
              accessibilityLabel="Promotions"
              onPress={() => router.push('/promotions')}
            />
            </SmartNavbarChip>
          }>
          <IconCircle
            name="chevron-left"
            variant="ghost"
            size="lg"
            accessibilityLabel="Retour"
            onPress={() => goBack()}
          />
          <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>
            Rechercher
          </Text>
        </FrostedTopBar>

        <ProductFlashGrid
          plain
          products={results}
          extraData={catalogVersion}
          imageHeight={160}
          style={styles.scrollLayer}
          keyboardShouldPersistTaps="handled"
          {...(Platform.OS !== 'web'
            ? { refreshControl: <MarcheRefresh refreshing={refreshing} onRefresh={onRefresh} /> }
            : {})}
          contentContainerStyle={[styles.scrollContent, { paddingTop: heroClearance }]}
          empty={
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Feather name="search" size={28} color={colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>Aucun résultat</Text>
              <Text style={styles.emptyText}>
                Essayez un autre mot-clé, vérifiez l'orthographe ou retirez un filtre actif.
              </Text>
              {hasQuery ? (
                <Pressable style={styles.emptyBtn} onPress={() => setSearchQuery('')}>
                  <Text style={styles.emptyBtnText}>Effacer la recherche</Text>
                </Pressable>
              ) : null}
            </View>
          }
          header={
          <View style={styles.bodySheet}>
            <View style={styles.introPad}>
            <SearchField
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={commitSearch}
              active
              autoFocus
              placeholder="Tomates, mangues, lait…"
              showFilter={false}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}
              contentContainerStyle={styles.filters}
              keyboardShouldPersistTaps="handled">
              {filters.map(({ key, icon }) => {
                const active = isFilterActive(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => onFilterPress(key)}
                    style={[styles.filter, active && styles.filterOn]}>
                    <Feather name={icon} size={13} color={active ? colors.onAccent : colors.muted} />
                    <Text style={[styles.filterText, active && styles.filterTextOn]}>{key}</Text>
                    {key === 'Prix' ? (
                      <Feather
                        name={searchPriceSort === 'price-desc' ? 'chevron-up' : 'chevron-down'}
                        size={11}
                        color={active ? colors.onAccent : colors.muted}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            {hasQuery && liveSuggestions.length > 0 ? (
              <View style={styles.liveCard}>
                <View style={styles.liveHead}>
                  <Feather name="zap" size={15} color={colors.gold} />
                  <Text style={styles.liveLabel}>Suggestions instantanées</Text>
                </View>
                <View style={styles.liveWrap}>
                  {liveSuggestions.map((term) => (
                    <Pressable key={term} style={styles.liveChip} onPress={() => applySearch(term)}>
                      <Feather name="search" size={12} color={colors.gold} />
                      <Text style={styles.liveChipText}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            </View>

            {showDiscovery ? (
              <>
                {continueProducts.length && continueTerm ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHead}>
                      <View>
                        <Text style={styles.sectionTitle}>Continuer « {continueTerm} »</Text>
                        <Text style={styles.sectionMeta}>D’après votre recherche</Text>
                      </View>
                      <Pressable onPress={() => applySearch(continueTerm)}>
                        <Text style={styles.clear}>Voir tout</Text>
                      </Pressable>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                      <View style={styles.rowCards}>
                        {continueProducts.map((p) => (
                          <ProductCard key={`cont-${p.id}`} product={p} width={148} imageHeight={130} compact animate={false} />
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                ) : null}

                <View style={styles.introPad}>
                {filteredRecents.length > 0 ? (
                  <View style={styles.card}>
                    <View style={styles.sectionHead}>
                      <View style={styles.sectionHeadLeft}>
                        <Feather name="clock" size={15} color={colors.gold} />
                        <Text style={styles.sectionTitle}>Recherches récentes</Text>
                      </View>
                      <Pressable onPress={clearRecentSearches}>
                        <Text style={styles.clear}>Effacer</Text>
                      </Pressable>
                    </View>
                    {filteredRecents.map((item, index) => (
                      <View key={item}>
                        <View style={styles.recent}>
                          <Pressable style={styles.recentLeft} onPress={() => applySearch(item)}>
                            <View style={styles.recentIcon}>
                              <Feather name="rotate-ccw" size={14} color={colors.muted} />
                            </View>
                            <Text style={styles.recentText}>{item}</Text>
                          </Pressable>
                          <Pressable
                            style={styles.recentRemove}
                            onPress={() => removeRecentSearch(item)}
                            hitSlop={8}>
                            <Feather name="x" size={14} color={colors.placeholder} />
                          </Pressable>
                        </View>
                        {index < filteredRecents.length - 1 ? <View style={styles.separator} /> : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                {filteredTags.length > 0 ? (
                <View style={styles.card}>
                  <View style={styles.sectionHead}>
                    <View style={styles.sectionHeadLeft}>
                      <Feather name="trending-up" size={15} color={colors.terracotta} />
                      <Text style={styles.sectionTitle}>Populaires</Text>
                    </View>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tagRow}
                    keyboardShouldPersistTaps="handled">
                    {filteredTags.slice(0, 10).map((s) => (
                      <Pressable key={s} style={styles.tag} onPress={() => applySearch(s)}>
                        <Text style={styles.tagText} numberOfLines={1}>
                          {s}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                ) : null}

                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Par catégorie</Text>
                    <Text style={styles.sectionMeta}>Accès rapide</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.catRow}>
                    {searchCategories.map((c) => (
                      <Pressable
                        key={c.label}
                        style={styles.catCard}
                        onPress={() => openCategory(c.id, c.label)}>
                        <View style={styles.catImageWrap}>
                          <AppImage source={c.image} frameStyle={styles.catImage} />
                        </View>
                        <Text style={styles.catLabel}>{c.label}</Text>
                      </Pressable>
                    ))}
                    </View>
                  </ScrollView>
                </View>
                </View>
              </>
            ) : null}

            <View style={styles.resultsBlock}>
              <View style={styles.resultsHead}>
                <View>
                  <Text style={styles.resultsTitle}>{resultsTitle}</Text>
                  <Text style={styles.resultsSub}>{resultsSub}</Text>
                </View>
                {(hasQuery || hasFilters) && results.length > 0 ? (
                  <View style={styles.resultsBadge}>
                    <Text style={styles.resultsBadgeText}>{results.length}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          }
        />
      </Page>
    </Screen>
  );
}

export default memo(SearchScreen);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    heroTitle: {
      ...displayFont('800'),
      fontSize: 16,
      lineHeight: 20,
      letterSpacing: -0.3,
      flexShrink: 1,
    },
    scrollLayer: {
      flex: 1,
      zIndex: 1 },
    scrollContent: { paddingBottom: tabBarClearance, paddingHorizontal: 0 },
    bodySheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: Math.round(spacing.screen * 0.2),
      paddingTop: 8,
      gap: 18,
      ...Platform.select({
        ios: {
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: -8 },
          shadowRadius: 18,
          shadowOpacity: 0.14 },
        android: { elevation: 8 },
        default: {} }) },
    introPad: {
      gap: 18,
      paddingHorizontal: spacing.screen - Math.round(spacing.screen * 0.2),
    },
    filtersScroll: {
      flexGrow: 0,
      flexShrink: 0,
      maxHeight: 40 },
    filters: {
      gap: 8,
      paddingRight: 4,
      alignItems: 'center',
      flexGrow: 0 },
    filter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 14,
      backgroundColor: colors.white,
      borderRadius: 999,
      flexShrink: 0,
      alignSelf: 'center',
      ...Platform.select({
        ios: {
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3 },
        android: { elevation: 1 },
        default: {} }) },
    filterOn: {
      backgroundColor: colors.gold,
      borderColor: colors.gold },
    filterText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      includeFontPadding: false },
    filterTextOn: { color: colors.onAccent, fontWeight: '700' },
    liveCard: {
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14,
      gap: 10 },
    liveHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    liveLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
    liveWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    liveChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.cream,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8 },
    liveChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    card: {
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14,
      gap: 12 },
    section: { gap: 10 },
    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 26,
    },
    sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.45,
    },
    sectionMeta: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    rowCards: {
      flexDirection: 'row',
      gap: 1,
      paddingRight: 8,
    },
    clear: { color: colors.gold, fontSize: 11, fontWeight: '700' },
    recent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4 },
    recentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    recentIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center' },
    recentText: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1 },
    recentRemove: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center' },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 42 },
    tagRow: { gap: 8, paddingRight: 4, alignItems: 'center' },
    tag: {
      maxWidth: 200,
      backgroundColor: colors.bg,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8 },
    tagText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    catRow: { flexDirection: 'row', columnGap: 5, gap: 5, paddingRight: 4 },
    catCard: {
      width: 88,
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 12 },
    catImageWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: colors.cream },
    catImage: { width: '100%', height: '100%' },
    catLabel: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
    resultsBlock: { gap: 14 },
    resultsHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between' },
    resultsTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
    resultsSub: { color: colors.muted, fontSize: 12, fontWeight: '500', marginTop: 2 },
    resultsBadge: {
      minWidth: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8 },
    resultsBadgeText: { color: colors.gold, fontSize: 14, fontWeight: '800' },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      columnGap: 3,
      rowGap: 10,
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.white,
      borderRadius: 20,
      padding: 28,
      gap: 10 },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4 },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
    emptyText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
    emptyBtn: {
      marginTop: 6,
      backgroundColor: colors.gold,
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 10 },
    emptyBtnText: { color: colors.onAccent, fontSize: 13, fontWeight: '700' } });
}
