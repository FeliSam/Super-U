import { AppImage } from '@/components/AppImage';
import { CartTotalFab, CategoryTile, IconCircle, ProductCard, PromoBanner, Screen, SearchField, Page } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { bodyFont, displayFont, heroChrome, tabBarClearance, type AppColors } from '@/constants/theme';
import { useColors, useTheme } from '@/context/ThemeContext';
import { useUiState } from '@/context/UiStateContext';
import {
  exploreCategories,
  getProducts,
  homePromoBanners,
  popularIds,
  products,
  productsInCategory,
  promoProducts,
  searchCategories,
  searchCategoryRoute,
  trendingSearches } from '@/data/catalog';
import { openSearchScreen } from '@/lib/searchNav';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PROMO_WIDTH = Dimensions.get('window').width - 40;
const EXPLORE_PRODUCT_ROW = {
  flexDirection: 'row' as const,
  columnGap: 3.6,
  gap: 3.6,
  paddingRight: 4,
};
const explorePromo = homePromoBanners[1];
const TREND_LIMIT = 5;
/** Same height on every rayon tile; bento is width (`flex`) only. */
const RAYON_TILE_H = 140;

function ExploreScreen() {
  const { scheme } = useTheme();
  const colors = useColors();
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [trendTick, setTrendTick] = useState(() => Math.floor(Date.now() / 12_000));
  const scrollY = useSharedValue(0);

  const { setSearchQuery, searchRecents } = useUiState();

  useEffect(() => {
    const id = setInterval(() => {
      setTrendTick(Math.floor(Date.now() / 12_000));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const trends = useMemo(
    () => trendingSearches({ recents: searchRecents, limit: TREND_LIMIT, tick: trendTick }),
    [searchRecents, trendTick],
  );

  const rows = useMemo(() => {
    const result: (typeof exploreCategories)[] = [];
    for (let i = 0; i < exploreCategories.length; i += 2) {
      result.push(exploreCategories.slice(i, i + 2));
    }
    return result;
  }, []);

  const trending = useMemo(() => promoProducts().slice(0, 6), []);
  const popular = useMemo(() => getProducts(popularIds), []);

  const openSearch = (term?: string) => {
    if (term) setSearchQuery(term);
    openSearchScreen();
  };

  const openPromos = () => {
    router.push('/promotions');
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    } });

  const sheetAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      transform: [
        {
          translateY: interpolate(y, [0, 140], [0, -16], Extrapolation.CLAMP) },
      ],
      borderTopLeftRadius: interpolate(y, [0, 120], [28, 16], Extrapolation.CLAMP),
      borderTopRightRadius: interpolate(y, [0, 120], [28, 16], Extrapolation.CLAMP),
      ...Platform.select({
        ios: {
          shadowOpacity: interpolate(y, [0, 80], [0.14, 0.05], Extrapolation.CLAMP) },
        android: {
          elevation: interpolate(y, [0, 80], [8, 2], Extrapolation.CLAMP) },
        default: {} }) };
  });

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.hero} pointerEvents="box-none">
          <LinearGradient colors={chrome.gradient} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={[styles.heroBar, { paddingTop: Math.max(8, insets.top + 6) }]}>
            <View style={styles.heroTitleCol}>
              <Text style={[styles.heroTitle, { color: chrome.ink }]} numberOfLines={1}>
                Explorer
              </Text>
            </View>
            <View style={styles.actions}>
              <IconCircle
                name="search"
                variant="hero"
                accessibilityLabel="Rechercher"
                onPress={() => openSearch()}
              />
              <IconCircle
                name="tag"
                variant="hero"
                accessibilityLabel="Promotions"
                onPress={openPromos}
              />
            </View>
          </View>
        </View>

        <Animated.ScrollView
          style={styles.scrollLayer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}>
          <Animated.View style={[styles.bodySheet, sheetAnimStyle]}>
            <View
              style={[
                styles.heroStats,
                { backgroundColor: chrome.surface, borderColor: chrome.surfaceBorder },
              ]}>
              <View style={styles.heroStat}>
                <Feather name="grid" size={15} color={colors.gold} />
                <Text style={[styles.heroStatText, { color: colors.text }]}>
                  {exploreCategories.length} rayons
                </Text>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: chrome.divider }]} />
              <View style={styles.heroStat}>
                <Feather name="shopping-bag" size={15} color={colors.terracotta} />
                <Text style={[styles.heroStatText, { color: colors.text }]}>
                  {products.length}+ produits
                </Text>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: chrome.divider }]} />
              <View style={styles.heroStat}>
                <Feather name="truck" size={15} color={colors.green} />
                <Text style={[styles.heroStatText, { color: colors.text }]}>Livraison</Text>
              </View>
            </View>

            <MotionView delay={40} preset="up">
              <SearchField onPress={() => openSearch()} />
            </MotionView>

            <MotionView delay={80} preset="up" style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Accès rapide</Text>
                <Pressable onPress={() => openSearch()} accessibilityRole="button" accessibilityLabel="Voir la sélection">
                  <Text style={styles.sectionLink}>Sélection</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickRow}>
                {searchCategories.map((cat) => {
                  const count = productsInCategory(cat.id).length;
                  return (
                    <PressScale
                      key={cat.label}
                      style={styles.quickCard}
                      onPress={() => router.push(searchCategoryRoute(cat))}
                      scaleTo={0.96}
                      accessibilityRole="button"
                      accessibilityLabel={`${cat.label}, ${count} produits`}>
                      <View style={styles.quickImageWrap}>
                        <AppImage source={cat.image} frameStyle={styles.quickImage} />
                      </View>
                      <Text style={styles.quickLabel}>{cat.label}</Text>
                      <Text style={styles.quickCount}>{count || '12+'} produits</Text>
                    </PressScale>
                  );
                })}
              </ScrollView>
            </MotionView>

            <MotionView delay={110} preset="up">
              <PromoBanner
                title={explorePromo.title}
                subtitle={explorePromo.subtitle}
                cta={explorePromo.cta}
                image={explorePromo.image}
                width={PROMO_WIDTH}
                onPress={() => router.push(explorePromo.href)}
              />
            </MotionView>

            <MotionView delay={140} preset="up" style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>En promotion</Text>
                <Pressable onPress={openPromos}>
                  <Text style={styles.sectionLink}>Voir tout</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={EXPLORE_PRODUCT_ROW}>
                  {trending.map((product) => (
                    <ProductCard key={product.id} product={product} width={148} imageHeight={130} compact />
                  ))}
                </View>
              </ScrollView>
            </MotionView>

            <MotionView delay={170} preset="up" style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Populaires</Text>
                <Text style={styles.sectionMeta}>Les plus commandés</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={EXPLORE_PRODUCT_ROW}>
                  {popular.map((product) => (
                    <ProductCard key={product.id} product={product} width={148} imageHeight={130} compact />
                  ))}
                </View>
              </ScrollView>
            </MotionView>

            <MotionView delay={200} preset="up">
              <View style={styles.suggestCard}>
                <View style={styles.suggestHead}>
                  <View style={styles.suggestHeadLeft}>
                    <Feather name="trending-up" size={15} color={colors.terracotta} />
                    <Text style={styles.suggestTitle}>Recherches tendance</Text>
                  </View>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.trendMeta}>En direct</Text>
                  </View>
                </View>
                <View style={styles.tagWrap}>
                  {trends.map((item) => (
                    <PressScale
                      key={`${item.rank}-${item.term}`}
                      style={styles.tag}
                      onPress={() => openSearch(item.term)}
                      scaleTo={0.96}
                      accessibilityLabel={`Rechercher ${item.term}`}>
                      <Text style={styles.tagText}>{item.term}</Text>
                    </PressScale>
                  ))}
                </View>
              </View>
            </MotionView>

            <MotionView delay={230} preset="up" style={styles.rayonsSection}>
              <View style={styles.rayonsHead}>
                <View style={styles.rayonsHeadText}>
                  <Text style={styles.sectionTitle}>Tous les rayons</Text>
                  <Text style={styles.sectionMeta}>Parcourez le marché</Text>
                </View>
                <View style={[styles.rayonsCount, { backgroundColor: colors.cream }]}>
                  <Text style={styles.rayonsCountText}>{exploreCategories.length}</Text>
                </View>
              </View>
              <View style={styles.grid}>
                {rows.map((row, idx) => (
                  <View key={idx} style={styles.gridRow}>
                    {row.map((cat) => {
                      const count = productsInCategory(cat.id).length;
                      return (
                        <CategoryTile
                          key={cat.id}
                          title={cat.title}
                          image={cat.image}
                          height={RAYON_TILE_H}
                          flex={cat.flex}
                          count={count || undefined}
                          index={idx}
                          onPress={() => router.push(`/category/${cat.id}`)}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </MotionView>
          </Animated.View>
        </Animated.ScrollView>
        <CartTotalFab aboveTabs />
      </Page>
    </Screen>
  );
}

export default memo(ExploreScreen);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    hero: {
      zIndex: 10,
      overflow: 'hidden' },
    heroBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 10,
      gap: 12 },
    heroTitleCol: { flex: 1, minWidth: 0 },
    heroTitle: {
      ...bodyFont('800'),
      fontSize: 28,
      lineHeight: 34,
    },
    scrollLayer: {
      flex: 1,
      zIndex: 1 },
    scrollContent: { paddingBottom: tabBarClearance },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth },
    heroStat: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6 },
    heroStatText: { fontSize: 11, fontWeight: '700' },
    heroDivider: { width: 1, height: 24 },
    bodySheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 8,
      gap: 22,
      minHeight: Dimensions.get('window').height,
      ...Platform.select({
        ios: {
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: -8 },
          shadowRadius: 18,
          shadowOpacity: 0.14 },
        android: { elevation: 8 },
        default: {} }) },
    section: { gap: 12 },
    rayonsSection: { gap: 14 },
    rayonsHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12 },
    rayonsHeadText: { flex: 1, gap: 2 },
    rayonsCount: {
      minWidth: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10 },
    rayonsCountText: {
      color: colors.gold,
      fontSize: 14,
      fontWeight: '800' },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between' },
    sectionTitle: { color: colors.text, fontSize: 18, ...displayFont('700') },
    sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    sectionLink: { color: colors.gold, fontSize: 13, fontWeight: '700' },
    quickRow: { gap: 10, paddingRight: 4 },
    quickCard: {
      width: 108,
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 12,
      alignItems: 'center',
      gap: 8 },
    quickImageWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: colors.cream },
    quickImage: { width: '100%', height: '100%' },
    quickLabel: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    quickCount: { color: colors.placeholder, fontSize: 10, fontWeight: '600' },
    suggestCard: {
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14,
      gap: 12 },
    suggestHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12 },
    suggestHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    suggestTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
    livePill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.terracotta },
    trendMeta: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: {
      backgroundColor: colors.bg,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8 },
    tagText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    grid: { gap: 2 },
    gridRow: { flexDirection: 'row', gap: 2, alignItems: 'stretch' } });
}
