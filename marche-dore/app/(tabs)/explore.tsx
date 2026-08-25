import { AppImage } from '@/components/AppImage';
import { CategoryTile, IconCircle, ProductCard, PromoBanner, Screen, SearchField, Page } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { displayFont, heroChrome, tabBarClearance, type AppColors } from '@/constants/theme';
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

const PROMO_WIDTH = Dimensions.get('window').width - 40;
const explorePromo = homePromoBanners[1];
const HERO_OVERLAP = 36;
const TREND_LIMIT = 5;

function ExploreScreen() {
  const { scheme } = useTheme();
  const colors = useColors();
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [heroHeight, setHeroHeight] = useState(220);
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

  const handleAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [1, 0.35], Extrapolation.CLAMP),
    transform: [
      {
        scaleX: interpolate(scrollY.value, [0, 80], [1, 0.7], Extrapolation.CLAMP) },
    ] }));

  return (
    <Screen>
      <Page style={styles.flex}>
        <View
          style={styles.heroBackdrop}
          onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
          pointerEvents="box-none">
          <LinearGradient colors={chrome.gradient} style={styles.hero}>
            <View style={[styles.heroOrb, { backgroundColor: chrome.orb }]} />

            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={[styles.eyebrow, { color: chrome.muted }]}>Marché Doré</Text>
                <Text style={[styles.hello, { color: chrome.ink }]}>Explorer</Text>
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

            <Text style={[styles.subtitle, { color: chrome.muted }]}>
              Parcourez nos rayons et découvrez les produits du marché.
            </Text>

            <View
              style={[
                styles.heroStats,
                { backgroundColor: chrome.surface, borderColor: chrome.surfaceBorder },
              ]}>
              <PressScale
                style={styles.heroStat}
                onPress={() => openSearch()}
                scaleTo={0.96}
                accessibilityLabel={`${exploreCategories.length} rayons`}>
                <Feather name="grid" size={15} color={colors.gold} />
                <Text style={[styles.heroStatText, { color: chrome.ink }]}>
                  {exploreCategories.length} rayons
                </Text>
              </PressScale>
              <View style={[styles.heroDivider, { backgroundColor: chrome.divider }]} />
              <PressScale
                style={styles.heroStat}
                onPress={() => openSearch()}
                scaleTo={0.96}
                accessibilityLabel={`${products.length} produits`}>
                <Feather name="shopping-bag" size={15} color={colors.terracotta} />
                <Text style={[styles.heroStatText, { color: chrome.ink }]}>
                  {products.length}+ produits
                </Text>
              </PressScale>
              <View style={[styles.heroDivider, { backgroundColor: chrome.divider }]} />
              <PressScale
                style={styles.heroStat}
                onPress={() => router.push('/tracking')}
                scaleTo={0.96}
                accessibilityLabel="Livraison rapide">
                <Feather name="truck" size={15} color={colors.green} />
                <Text style={[styles.heroStatText, { color: chrome.ink }]}>Livraison</Text>
              </PressScale>
            </View>
          </LinearGradient>
        </View>

        <Animated.ScrollView
          style={styles.scrollLayer}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(0, heroHeight - HERO_OVERLAP) },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}>
          <Animated.View style={[styles.bodySheet, sheetAnimStyle]}>
            <View style={styles.sheetHandle}>
              <Animated.View style={[styles.sheetHandleBar, handleAnimStyle]} />
            </View>

            <MotionView delay={40} preset="up">
              <SearchField onPress={() => openSearch()} />
            </MotionView>

            <MotionView delay={80} preset="up" style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Accès rapide</Text>
                <Text style={styles.sectionMeta}>Sélection</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickRow}>
                {searchCategories.map((cat) => {
                  const count = productsInCategory(cat.id).length;
                  return (
                    <Pressable
                      key={cat.label}
                      style={styles.quickCard}
                      onPress={() => router.push(searchCategoryRoute(cat))}>
                      <View style={styles.quickImageWrap}>
                        <AppImage source={cat.image} frameStyle={styles.quickImage} />
                      </View>
                      <Text style={styles.quickLabel}>{cat.label}</Text>
                      <Text style={styles.quickCount}>{count || '12+'} produits</Text>
                    </Pressable>
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.productRow}>
                {trending.map((product) => (
                  <ProductCard key={product.id} product={product} width={148} imageHeight={130} compact />
                ))}
              </ScrollView>
            </MotionView>

            <MotionView delay={170} preset="up" style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Populaires</Text>
                <Text style={styles.sectionMeta}>Les plus commandés</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.productRow}>
                {popular.map((product) => (
                  <ProductCard key={product.id} product={product} width={148} imageHeight={130} compact />
                ))}
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

            <MotionView delay={230} preset="up" style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Tous les rayons</Text>
                <Text style={styles.sectionMeta}>{exploreCategories.length} catégories</Text>
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
                          height={Math.round((cat.height + 8) * 1.2)}
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
      </Page>
    </Screen>
  );
}

export default memo(ExploreScreen);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    heroBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 0 },
    scrollLayer: {
      flex: 1,
      zIndex: 1 },
    scrollContent: { paddingBottom: tabBarClearance },
    hero: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 44,
      overflow: 'hidden' },
    heroOrb: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      top: -50,
      right: -40 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12 },
    headerText: { flex: 1, gap: 2 },
    eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
    hello: { fontSize: 28, letterSpacing: -0.4, ...displayFont('800') },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      maxWidth: '92%',
      marginTop: 10 },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginTop: 18 },
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
    sheetHandle: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8 },
    sheetHandleBar: {
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border },
    section: { gap: 12 },
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
    productRow: { gap: 12, paddingRight: 4 },
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
    grid: { gap: 6 },
    gridRow: { flexDirection: 'row', gap: 6, alignItems: 'stretch' } });
}
