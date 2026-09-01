import { AppImage } from '@/components/AppImage';
import { CartTotalFab, CategoryTile, FrostedTopBar, FROST_ICON_BG, frostedBarClearance, IconCircle, ProductCard, Screen, SearchField, Page } from '@/components/ui';
import { PromoCarousel } from '@/components/PromoCarousel';
import { PressScale } from '@/components/motion';
import { bodyFont, displayFont, heroChrome, tabBarClearance, type AppColors, spacing } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useOrders } from '@/context/OrdersContext';
import { useUiState } from '@/context/UiStateContext';
import { useCatalog } from '@/context/CatalogContext';
import {
  bannerIsLive,
  categoryProductCounts,
  exploreCategories,
  homePromoBanners,
  searchCategoryRoute,
} from '@/data/catalog';
import { buildExplorePlan } from '@/lib/homeEngine';
import { openSearchScreen } from '@/lib/searchNav';
import { PlatformVirtualList } from '@/components/ProductFlashGrid';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EXPLORE_PRODUCT_ROW = {
  flexDirection: 'row' as const,
  columnGap: 3.6,
  gap: 3.6,
  paddingRight: 4,
};

function ExploreScreen() {
  const { version: catalogVersion, products } = useCatalog();
  const [visitSalt] = useState(() => Date.now());
  const { scheme } = useTheme();
  const colors = useColors();
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const promoWidth = Math.min(windowWidth, 430) - 40;
  const scrollY = useSharedValue(0);

  const { setSearchQuery, searchRecents, interests } = useUiState();
  const { lines } = useCart();
  const { ids: favoriteIds } = useFavorites();
  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;
  const { orders } = useOrders();
  const orderedIds = useMemo(
    () => orders.flatMap((order) => order.lines.map((line) => line.productId)).slice(0, 48),
    [orders],
  );

  const plan = useMemo(
    () =>
      buildExplorePlan({
        recents: searchRecents,
        favoriteIds: favoriteIdsRef.current,
        cartIds: lines.map((line) => line.productId),
        orderedIds,
        interests,
        hour: new Date().getHours(),
        sessionSalt: visitSalt,
      }),
    [searchRecents, lines, orderedIds, interests, catalogVersion, visitSalt],
  );

  const counts = useMemo(() => categoryProductCounts(), [catalogVersion]);
  const liveBanners = useMemo(() => homePromoBanners.filter(bannerIsLive), [catalogVersion]);
  const rows = plan.rayonRows;

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

  const heroClearance = frostedBarClearance(insets.top);

  return (
    <Screen>
      <Page style={styles.flex}>
        <FrostedTopBar
          right={
            <>
              <IconCircle
                name="search"
                variant="hero"
                bg={FROST_ICON_BG}
                color={chrome.ink}
                accessibilityLabel="Rechercher"
                onPress={() => openSearch()}
              />
              <IconCircle
                name="tag"
                variant="hero"
                bg={FROST_ICON_BG}
                color={chrome.ink}
                accessibilityLabel="Promotions"
                onPress={openPromos}
              />
            </>
          }>
          <Text style={[styles.heroTitle, { color: chrome.ink }]} numberOfLines={1}>
            Explorer
          </Text>
        </FrostedTopBar>

        <PlatformVirtualList
          data={rows}
          extraData={`${catalogVersion}-${visitSalt}`}
          keyExtractor={(_: unknown, index: number) => `rayon-${index}`}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
          style={styles.scrollLayer}
          contentContainerStyle={[styles.scrollContent, { paddingTop: heroClearance }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={
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

            <SearchField onPress={() => openSearch()} />

            <View style={styles.section}>
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
                {plan.quickCats.map((cat) => {
                  const count = counts[cat.id] ?? 0;
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
            </View>

            {liveBanners.length ? <PromoCarousel banners={liveBanners} width={promoWidth} /> : null}

            {plan.forYou.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionTitle}>{plan.forYouTitle}</Text>
                    <Text style={styles.sectionMeta}>{plan.forYouMeta}</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={EXPLORE_PRODUCT_ROW}>
                    {plan.forYou.map((product) => (
                      <ProductCard key={`you-${product.id}`} product={product} width={148} imageHeight={130} compact animate={false} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>Populaires</Text>
                  <Text style={styles.sectionMeta}>{plan.popularMeta}</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={EXPLORE_PRODUCT_ROW}>
                  {plan.popular.map((product) => (
                    <ProductCard key={`pop-${product.id}`} product={product} width={148} imageHeight={130} compact animate={false} />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.rayonsSection}>
              <View style={styles.rayonsHead}>
                <View style={styles.rayonsHeadText}>
                  <Text style={styles.sectionTitle}>Tous les rayons</Text>
                  <Text style={styles.sectionMeta}>Parcourez le marché</Text>
                </View>
                <View style={[styles.rayonsCount, { backgroundColor: colors.cream }]}>
                  <Text style={styles.rayonsCountText}>{exploreCategories.length}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
          }
          renderItem={({ item: row }: { item: (typeof exploreCategories)[number][] }) => (
            <View style={[styles.gridRow, { paddingHorizontal: spacing.screen }]}>
              {row.map((cat) => {
                const count = counts[cat.id] ?? 0;
                return (
                  <CategoryTile
                    key={cat.id}
                    title={cat.title}
                    image={cat.image}
                    height={Math.round(cat.height * 1.15)}
                    flex={cat.flex}
                    count={count || undefined}
                    onPress={() => router.push(`/category/${cat.id}`)}
                  />
                );
              })}
            </View>
          )}
        />
        <CartTotalFab aboveTabs />
      </Page>
    </Screen>
  );
}

export default memo(ExploreScreen);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    heroTitle: {
      ...bodyFont('800'),
      fontSize: 28,
      lineHeight: 34,
    },
    scrollLayer: {
      flex: 1,
      zIndex: 1 },
    scrollContent: { paddingBottom: tabBarClearance },
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
      paddingHorizontal: spacing.screen,
      paddingTop: 8,
      gap: 22,
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
    grid: { gap: 2 },
    gridRow: { flexDirection: 'row', gap: 2, alignItems: 'stretch' },
  });
}
