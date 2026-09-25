import { AppImage } from '@/components/AppImage';
import {
  CartTotalFab,
  CategoryTile,
  IconCircle,
  MarcheRefresh,
  ProductCard,
  Screen,
  Page,
  SmartNavbar,
  SmartNavbarChip,
  smartNavbarClearance,
} from '@/components/ui';
import { PromoCarousel } from '@/components/PromoCarousel';
import { heroChrome, tabBarClearance, type AppColors, spacing } from '@/constants/theme';
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
import {
  categoryLocalArt,
  downloadCategoryLocalArt,
  pinExploreCategoriesLocalArt,
  RAYON_SPAN_TOTAL,
} from '@/lib/categoryLocalArt';
import { openSearchScreen } from '@/lib/searchNav';
import { PlatformVirtualList } from '@/components/ProductFlashGrid';
import { DEV_SAFE_HOME, logDev } from '@/lib/devBoot';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function ExploreScreen() {
  const { version: catalogVersion, products, refresh: refreshCatalog } = useCatalog();
  const [visitSalt, setVisitSalt] = useState(() => Date.now());
  const [listEpoch, setListEpoch] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const { scheme } = useTheme();
  const colors = useColors();
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const promoWidth = Math.min(windowWidth, 430) - spacing.screen * 2;

  useEffect(() => {
    if (DEV_SAFE_HOME) logDev('Explore: mode safe (pas de Reanimated)');
    pinExploreCategoriesLocalArt(exploreCategories);
    void downloadCategoryLocalArt();
  }, []);

  /** Au focus : recalcul layout FlatList (évite page blanche après navigation). */
  useFocusEffect(
    useCallback(() => {
      setListEpoch((n) => n + 1);
    }, []),
  );

  const { setSearchQuery, searchRecents, recentProductIds, interests } = useUiState();
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
        viewedIds: recentProductIds,
        hour: new Date().getHours(),
        sessionSalt: visitSalt,
      }),
    [searchRecents, recentProductIds, lines, orderedIds, interests, catalogVersion, visitSalt],
  );

  const counts = useMemo(() => categoryProductCounts(), [catalogVersion]);
  const liveBanners = useMemo(() => homePromoBanners.filter(bannerIsLive), [catalogVersion]);
  const rows = plan.rayonRows;
  const rowSpans = plan.rayonRowSpans;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const started = Date.now();
    try {
      await refreshCatalog();
      setVisitSalt(Date.now());
    } finally {
      const wait = 420 - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setRefreshing(false);
    }
  }, [refreshCatalog]);

  const openSearch = (term?: string) => {
    if (term) setSearchQuery(term);
    openSearchScreen();
  };

  const openPromos = () => {
    router.push('/promotions');
  };

  const heroClearance = smartNavbarClearance(insets.top);
  const List = DEV_SAFE_HOME ? FlatList : PlatformVirtualList;
  const [listW, setListW] = useState(0);
  const rowPad = Math.round(spacing.screen * 0.35);
  const rowGap = 8;

  return (
    <Screen>
      <Page style={styles.flex}>
        <SmartNavbar
          split
          left={
            <Pressable
              style={styles.navSearch}
              onPress={() => openSearch()}
              accessibilityRole="button"
              accessibilityLabel="Rechercher un produit">
              <Feather name="search" size={15} color={colors.gold} />
              <Text style={[styles.navSearchText, { color: colors.text }]} numberOfLines={1}>
                Rechercher…
              </Text>
            </Pressable>
          }
          right={
            <View style={styles.navActionsRow}>
              <SmartNavbarChip round>
                <IconCircle
                  name="tag"
                  variant="ghost"
                  size="lg"
                  accessibilityLabel="Promotions"
                  onPress={openPromos}
                />
              </SmartNavbarChip>
            </View>
          }
        />

        <List
          key={`explore-list-${listEpoch}`}
          data={rows}
          extraData={`${catalogVersion}-${visitSalt}-${listW}-${listEpoch}-${rowSpans.map((s) => s.join('')).join('|')}`}
          keyExtractor={(_: unknown, index: number) => `rayon-${index}`}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={9}
          removeClippedSubviews={false}
          style={styles.scrollLayer}
          contentContainerStyle={[styles.scrollContent, { paddingTop: heroClearance, flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onLayout={(e) => {
            const next = Math.round(e.nativeEvent.layout.width);
            if (next > 0 && next !== listW) setListW(next);
          }}
          {...(Platform.OS !== 'web'
            ? { refreshControl: <MarcheRefresh refreshing={refreshing} onRefresh={onRefresh} /> }
            : {})}
          ListHeaderComponent={
            <View style={styles.bodySheet}>
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

              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Accès rapide</Text>
                  <Pressable
                    onPress={() => openSearch()}
                    accessibilityRole="button"
                    accessibilityLabel="Voir la sélection">
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
                      <Pressable
                        key={cat.label}
                        style={styles.quickCard}
                        onPress={() => router.push(searchCategoryRoute(cat))}
                        accessibilityRole="button"
                        accessibilityLabel={`${cat.label}, ${count} produits`}>
                        <View style={styles.quickImageWrap}>
                          <AppImage source={cat.image} frameStyle={styles.quickImage} />
                        </View>
                        <Text style={styles.quickLabel}>{cat.label}</Text>
                        <Text style={styles.quickCount}>{count || '12+'} produits</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {liveBanners.length ? <PromoCarousel banners={liveBanners} width={promoWidth} /> : null}

              {plan.forYou.length ? (
                <View style={[styles.section, styles.sectionBleed]}>
                  <View style={[styles.sectionHead, styles.sectionBleedHead]}>
                    <View>
                      <Text style={styles.sectionTitle}>{plan.forYouTitle}</Text>
                      <Text style={styles.sectionMeta}>{plan.forYouMeta}</Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.productRail}>
                      {plan.forYou.map((product) => (
                        <ProductCard
                          key={`you-${product.id}`}
                          product={product}
                          width={148}
                          imageHeight={130}
                          compact
                          animate={false}
                        />
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ) : null}

              <View style={[styles.section, styles.sectionBleed]}>
                <View style={[styles.sectionHead, styles.sectionBleedHead]}>
                  <View>
                    <Text style={styles.sectionTitle}>Populaires</Text>
                    <Text style={styles.sectionMeta}>{plan.popularMeta}</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.productRail}>
                    {plan.popular.map((product) => (
                      <ProductCard
                        key={`pop-${product.id}`}
                        product={product}
                        width={148}
                        imageHeight={130}
                        compact
                        animate={false}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={[styles.rayonsSection, styles.sectionBleed]}>
                <View style={[styles.rayonsHead, styles.sectionBleedHead]}>
                  <View style={styles.rayonsHeadText}>
                    <Text style={styles.sectionTitle}>Tous les rayons</Text>
                    <Text style={styles.sectionMeta}>Parcourez le marché</Text>
                  </View>
                  <View style={[styles.rayonsCount, { backgroundColor: colors.cream }]}>
                    <Text style={styles.rayonsCountText}>{exploreCategories.length}</Text>
                  </View>
                </View>
              </View>
            </View>
          }
          renderItem={({ item: row, index: rowIndex }: { item: (typeof exploreCategories)[number][]; index: number }) => {
            const spans = rowSpans[rowIndex] ?? row.map(() => 2);
            const spanSum = spans.reduce((a, b) => a + b, 0) || RAYON_SPAN_TOTAL;
            const frame = listW > 0 ? listW : Math.min(windowWidth, 430);
            const gaps = rowGap * Math.max(0, row.length - 1);
            const inner = Math.max(200, frame - rowPad * 2 - gaps);
            const unit = inner / spanSum;
            // Hauteur uniforme (+20 %) basée sur 1/6 de la largeur utile
            const rowH = Math.max(142, Math.round((inner / RAYON_SPAN_TOTAL) * 1.55 * 1.2));
            const minTileW = 96; // 48 × 2
            let usedPx = 0;
            return (
              <View
                style={[
                  styles.gridRow,
                  {
                    paddingHorizontal: rowPad,
                    height: rowH,
                    marginBottom: 10,
                    gap: rowGap,
                  },
                ]}>
                {row.map((cat, i) => {
                  const count = counts[cat.id] ?? 0;
                  const span = spans[i] ?? 2;
                  const w =
                    i === row.length - 1
                      ? Math.max(minTileW, inner - usedPx)
                      : Math.max(minTileW, Math.floor(unit * span));
                  if (i < row.length - 1) usedPx += w;
                  return (
                    <CategoryTile
                      key={cat.id}
                      categoryId={cat.id}
                      title={cat.title}
                      image={categoryLocalArt(cat.id)}
                      height={rowH}
                      width={w}
                      dense
                      count={count || undefined}
                      onPress={() => router.push(`/category/${cat.id}`)}
                    />
                  );
                })}
              </View>
            );
          }}
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
    navSearch: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      minHeight: 42,
      paddingVertical: 4,
    },
    navSearchText: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '800',
    },
    navActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    scrollLayer: {
      flex: 1,
      minHeight: 0,
      zIndex: 1,
    },
    scrollContent: { paddingBottom: tabBarClearance, flexGrow: 1 },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth,
    },
    heroStat: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    heroStatText: { fontSize: 11, fontWeight: '700' },
    heroDivider: { width: 1, height: 24 },
    bodySheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: spacing.screen,
      paddingTop: 14,
      gap: 22,
      ...Platform.select({
        ios: {
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: -8 },
          shadowRadius: 18,
          shadowOpacity: 0.14,
        },
        android: { elevation: 8 },
        default: {},
      }),
    },
    section: { gap: 12 },
    sectionBleed: {
      marginHorizontal: -(spacing.screen - Math.round(spacing.screen * 0.35)),
    },
    sectionBleedHead: { paddingHorizontal: Math.round(spacing.screen * 0.35) },
    rayonsSection: { gap: 14 },
    rayonsHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    rayonsHeadText: { flex: 1, gap: 2 },
    rayonsCount: {
      minWidth: 32,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    rayonsCountText: {
      color: colors.gold,
      fontSize: 12,
      fontWeight: '800',
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    sectionMeta: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    sectionLink: { color: colors.gold, fontSize: 12, fontWeight: '700' },
    quickRow: { gap: 6, paddingRight: 4 },
    quickCard: {
      width: 108,
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 12,
      alignItems: 'center',
      gap: 8,
    },
    quickImageWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: colors.cream,
    },
    quickImage: { width: '100%', height: '100%' },
    quickLabel: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    quickCount: { color: colors.placeholder, fontSize: 10, fontWeight: '600' },
    productRail: {
      flexDirection: 'row',
      columnGap: 1,
      gap: 1,
      paddingRight: 8,
    },
    grid: { gap: 2 },
    gridRow: { flexDirection: 'row', alignItems: 'stretch' },
  });
}
