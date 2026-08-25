import { AppImage } from '@/components/AppImage';
import { IconCircle, ProductCard, Screen, SearchField, Page } from '@/components/ui';
import { tabBarClearance, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useUiState } from '@/context/UiStateContext';
import {
  popularSuggestions,
  products,
  searchCategories,
  searchCategoryRoute,
  searchProducts,
  searchSuggestions,
  type SearchSort } from '@/data/catalog';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type FilterKey = 'Prix' | 'Note' | 'Disponible' | 'Promo';

const filters: { key: FilterKey; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { key: 'Prix', icon: 'arrow-up' },
  { key: 'Note', icon: 'star' },
  { key: 'Disponible', icon: 'check-circle' },
  { key: 'Promo', icon: 'tag' },
];

const ENTER = { duration: 420, easing: Easing.out(Easing.cubic) };

function SearchScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const heroProgress = useSharedValue(0);
  const sheetProgress = useSharedValue(0);
  const fieldProgress = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      heroProgress.value = 0;
      sheetProgress.value = 0;
      fieldProgress.value = 0;
      heroProgress.value = withTiming(1, ENTER);
      sheetProgress.value = withDelay(60, withTiming(1, ENTER));
      fieldProgress.value = withDelay(120, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
      return () => {
        heroProgress.value = 0;
        sheetProgress.value = 0;
        fieldProgress.value = 0;
      };
    }, [fieldProgress, heroProgress, sheetProgress]),
  );

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroProgress.value,
    transform: [{ translateY: (1 - heroProgress.value) * -16 }],
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetProgress.value,
    transform: [{ translateY: (1 - sheetProgress.value) * 36 }],
  }));

  const fieldStyle = useAnimatedStyle(() => ({
    opacity: fieldProgress.value,
    transform: [
      { translateY: (1 - fieldProgress.value) * 18 },
      { scale: 0.96 + fieldProgress.value * 0.04 },
    ],
  }));

  const {
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
    setSearchPromoOnly } = useUiState();

  const trimmedQuery = searchQuery.trim();
  const hasQuery = trimmedQuery.length > 0;
  const hasFilters =
    searchInStockOnly ||
    searchPromoOnly ||
    searchPriceSort === 'price-desc' ||
    searchPriceSort === 'rating';

  const sort: SearchSort = searchPriceSort;

  const results = useMemo(
    () =>
      searchProducts(searchQuery, {
        sort,
        inStockOnly: searchInStockOnly,
        promoOnly: searchPromoOnly }),
    [searchQuery, sort, searchInStockOnly, searchPromoOnly],
  );

  const liveSuggestions = useMemo(
    () => searchSuggestions(searchQuery, searchRecents),
    [searchQuery, searchRecents],
  );

  const filteredRecents = useMemo(() => {
    if (!hasQuery) return searchRecents;
    const q = trimmedQuery.toLowerCase();
    return searchRecents.filter((term) => term.toLowerCase().includes(q));
  }, [hasQuery, searchRecents, trimmedQuery]);

  const filteredTags = useMemo(() => {
    if (!hasQuery) return popularSuggestions;
    const q = trimmedQuery.toLowerCase();
    return popularSuggestions.filter((term) => term.toLowerCase().includes(q));
  }, [hasQuery, trimmedQuery]);

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

  const resultsTitle = hasQuery
    ? `${results.length} résultat${results.length > 1 ? 's' : ''}`
    : hasFilters
      ? `${results.length} produit${results.length > 1 ? 's' : ''} filtré${results.length > 1 ? 's' : ''}`
      : 'Catalogue complet';

  const resultsSub = hasQuery
    ? `pour « ${trimmedQuery} »`
    : hasFilters
      ? 'Filtres actifs appliqués'
      : `${products.length} produits disponibles`;

  const showDiscovery = !hasQuery;

  return (
    <Screen>
      <Page style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Animated.View style={heroStyle}>
            <LinearGradient colors={['#f8e4c4', colors.cream, colors.bg]} style={styles.hero}>
              <View style={styles.heroOrb} />
              <View style={styles.heroBar}>
                <IconCircle name="chevron-left" onPress={() => router.back()} bg="rgba(255,255,255,0.88)" color="#1c1613" />
                <Text style={styles.heroTitle}>Rechercher</Text>
                <View style={styles.heroSpacer} />
              </View>
              <Text style={styles.heroSub}>Trouvez vos produits frais, locaux et en promotion.</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[styles.bodySheet, sheetStyle]}>
            <Animated.View style={fieldStyle}>
              <SearchField
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={commitSearch}
                active
                placeholder="Tomates, mangues, lait…"
                showFilter={false}
              />
            </Animated.View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}>
              {filters.map(({ key, icon }) => {
                const active = isFilterActive(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => onFilterPress(key)}
                    style={[styles.filter, active && styles.filterOn]}>
                    <Feather name={icon} size={13} color={active ? colors.white : colors.muted} />
                    <Text style={[styles.filterText, active && styles.filterTextOn]}>{key}</Text>
                    {key === 'Prix' ? (
                      <Feather
                        name={searchPriceSort === 'price-desc' ? 'chevron-up' : 'chevron-down'}
                        size={11}
                        color={active ? colors.white : colors.muted}
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

            {showDiscovery ? (
              <>
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
                          <Pressable style={styles.recentRemove} onPress={() => removeRecentSearch(item)} hitSlop={8}>
                            <Feather name="x" size={14} color={colors.placeholder} />
                          </Pressable>
                        </View>
                        {index < filteredRecents.length - 1 ? <View style={styles.separator} /> : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.card}>
                  <View style={styles.sectionHeadLeft}>
                    <Feather name="trending-up" size={15} color={colors.terracotta} />
                    <Text style={styles.sectionTitle}>Populaires</Text>
                  </View>
                  <View style={styles.tagWrap}>
                    {filteredTags.map((s) => (
                      <Pressable key={s} style={styles.tag} onPress={() => applySearch(s)}>
                        <Text style={styles.tagText}>{s}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Par catégorie</Text>
                    <Text style={styles.sectionMeta}>Accès rapide</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.catRow}>
                    {searchCategories.map((c) => (
                      <Pressable key={c.label} style={styles.catCard} onPress={() => openCategory(c.id, c.label)}>
                        <View style={styles.catImageWrap}>
                          <AppImage source={c.image} frameStyle={styles.catImage} />
                        </View>
                        <Text style={styles.catLabel}>{c.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
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

              {results.length > 0 ? (
                <View style={styles.grid}>
                  {results.map((p) => (
                    <ProductCard key={p.id} product={p} width="47.5%" imageHeight={160} compact />
                  ))}
                </View>
              ) : (
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
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </Page>
    </Screen>
  );
}

export default memo(SearchScreen);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: tabBarClearance },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
    overflow: 'hidden' },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8 },
  heroSpacer: { width: 40 },
  heroOrb: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.35)',
    top: -30,
    right: -20 },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5 },
  heroSub: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    maxWidth: '90%' },
  bodySheet: {
    marginTop: -20,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 18 },
  filters: { gap: 8, paddingRight: 4 },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,

    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...Platform.select({
      ios: {
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3 },
      android: { elevation: 1 },
      default: {} }) },
  filterOn: { backgroundColor: colors.gold },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  filterTextOn: { color: colors.white, fontWeight: '700' },
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
  section: { gap: 12 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center' },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  clear: { color: colors.gold, fontSize: 13, fontWeight: '700' },
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
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: colors.bg,

    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8 },
  tagText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  catRow: { gap: 10, paddingRight: 4 },
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
    justifyContent: 'space-between',
    gap: 10 },
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
  emptyBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' } });
}
