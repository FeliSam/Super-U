import {
  CartTotalFab,
  IconCircle,
  ProductCard,
  Screen,
  SearchField,
  Page,
  SmartNavbar,
  SmartNavbarChip,
  MarcheRefresh,
  smartNavbarClearance,
} from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { cotonouMap, mapStyles } from '@/constants/map';
import { displayFont, spacing, tabBarClearance, type AppColors, PRODUCT_FEED_IMAGE_H } from '@/constants/theme';
import { useAddresses } from '@/context/AddressesContext';
import { useCatalog } from '@/context/CatalogContext';
import { useColors } from '@/context/ThemeContext';
import { useCart } from '@/context/CartContext';
import { formatOrderId, useOrders } from '@/context/OrdersContext';
import { opsPhaseLabel } from '@/lib/orderOps';
import { useNotifications } from '@/context/NotificationsContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useUiState } from '@/context/UiStateContext';
import { useProfile } from '@/context/ProfileContext';
import { profilePhotoSource } from '@/lib/profilePhoto';
import {
  bannerIsLive,
  chipRoute,
  homeCategories,
  homePromoBanners,
  popularIds,
  shuffleProducts,
  getProducts,
  type Product } from '@/data/catalog';
import { buildHomePlan, dynamicGlaceRail, dynamicPromoRail, glaceRailMeta, mealSlotForHour, rotateRail } from '@/lib/homeEngine';
import { ProductFlashGrid } from '@/components/ProductFlashGrid';
import { PromoCarousel } from '@/components/PromoCarousel';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { openSearchScreen } from '@/lib/searchNav';
import { findNearestSuperU } from '@/lib/deliveryRouting';
import { useLiveLoyalty } from '@/lib/loyalty';
import { etaWindowLabel, useDeliveryEstimate } from '@/lib/useDeliveryEstimate';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GRID_IMAGE_HEIGHT = PRODUCT_FEED_IMAGE_H;
const CUISINE_COLS = 3;
const CUISINE_COL_GAP = 3;
const CUISINE_ROW_GAP = 6;
const CUISINE_ROWS = 2;
const GLACES_VISIBLE = 3.5;
const GLACES_GAP = 12;
const SHEET_EDGE = Math.round(spacing.screen * 0.2);

const NAV_SPRING = { damping: 20, stiffness: 240, mass: 0.55, overshootClamping: false } as const;

function HomeScreen() {
  const { version: catalogVersion, products, productsInCategory, refresh: refreshCatalog } = useCatalog();
  const [visitSalt, setVisitSalt] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navMax = smartNavbarClearance(insets.top);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const navOffset = useSharedValue(0);

  const { count, lines } = useCart();
  const { activeOrders, orders } = useOrders();
  const orderCardWidth = useMemo(() => {
    const frame = Math.min(windowWidth, 430) - 40;
    return activeOrders.length > 1 ? Math.round(frame * 0.86) : frame;
  }, [windowWidth, activeOrders.length]);
  const { defaultAddress } = useAddresses();
  const dest = defaultAddress?.coordinate ?? null;
  const storeFrom = dest ? findNearestSuperU(dest).store.coordinate : null;
  const deliveryEta = useDeliveryEstimate(storeFrom, dest ?? null);
  const etaLabel = deliveryEta.loading
    ? 'Calcul…'
    : deliveryEta.unavailable || !deliveryEta.durationSeconds
      ? 'Livraison locale'
      : etaWindowLabel(deliveryEta.durationSeconds);
  const { unreadCount } = useNotifications();
  const { homeActiveChipId, searchRecents, recentProductIds, interests, setSearchQuery } = useUiState();
  const { ids: favoriteIds, count: favCount } = useFavorites();
  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;
  const { profile } = useProfile();
  const { points: loyaltyPoints } = useLiveLoyalty();
  const orderedIds = useMemo(
    () => orders.flatMap((order) => order.lines.map((line) => line.productId)).slice(0, 48),
    [orders],
  );
  const plan = useMemo(
    () =>
      buildHomePlan({
        recents: searchRecents,
        favoriteIds: favoriteIdsRef.current,
        cartIds: lines.map((line) => line.productId),
        orderedIds,
        interests,
        viewedIds: recentProductIds,
        firstName: profile.firstName,
        hour: new Date().getHours(),
        sessionSalt: visitSalt,
      }),
    [searchRecents, recentProductIds, lines, orderedIds, interests, profile.firstName, catalogVersion, visitSalt],
  );
  const activeChip =
    plan.rankedChips.find((c) => c.id === homeActiveChipId) ?? plan.rankedChips[0] ?? homeCategories[0];
  const contentW = Math.min(windowWidth, 430) - SHEET_EDGE * 2;
  const liveBanners = useMemo(
    () => homePromoBanners.filter(bannerIsLive),
    [catalogVersion],
  );
  const onSale = useMemo(
    () =>
      dynamicPromoRail({
        recents: searchRecents,
        favoriteIds: favoriteIdsRef.current,
        cartIds: lines.map((line) => line.productId),
        orderedIds,
        interests,
        hour: plan.hour,
        sessionSalt: visitSalt,
      }).slice(0, 6),
    [searchRecents, lines, orderedIds, interests, plan.hour, visitSalt, catalogVersion],
  );
  const mealSlot = useMemo(() => mealSlotForHour(plan.hour), [plan.hour]);
  const recommended = plan.rankedFeed;
  const cuisineReady = useMemo(() => {
    const seen = new Set<string>();
    const pool = mealSlot.categoryIds.flatMap((id) => productsInCategory(id));
    const unique = pool.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return p.inStock !== false;
    });
    return rotateRail(unique, visitSalt + 7, CUISINE_COLS * CUISINE_ROWS);
  }, [catalogVersion, visitSalt, mealSlot, productsInCategory]);
  const popularRail = useMemo(() => {
    const skip = new Set(cuisineReady.map((p) => p.id));
    const seen = new Set<string>();
    const pool = [...getProducts(popularIds), ...plan.rankedFeed].filter((p) => {
      if (skip.has(p.id) || seen.has(p.id) || p.inStock === false) return false;
      seen.add(p.id);
      return true;
    });
    return rotateRail(pool, visitSalt + 19, 6);
  }, [catalogVersion, visitSalt, cuisineReady, plan.rankedFeed]);
  const cuisineCardWidth = useMemo(() => {
    const contentW = Math.min(windowWidth, 430) - SHEET_EDGE * 2;
    return Math.floor((contentW - CUISINE_COL_GAP * (CUISINE_COLS - 1)) / CUISINE_COLS);
  }, [windowWidth]);
  const glaces = useMemo(
    () => dynamicGlaceRail(productsInCategory('glaces'), visitSalt + plan.hour * 31, 6),
    [catalogVersion, visitSalt, plan.hour, productsInCategory],
  );
  const glaceMeta = useMemo(() => glaceRailMeta(glaces), [glaces]);
  const glaceCardWidth = useMemo(() => {
    const contentW = Math.min(windowWidth, 430) - SHEET_EDGE * 2;
    return Math.floor((contentW - GLACES_GAP * Math.floor(GLACES_VISIBLE)) / GLACES_VISIBLE);
  }, [windowWidth]);
  const shuffledPool = useMemo(
    () =>
      shuffleProducts(
        products.filter((p) => p.categoryId !== 'cuisine' && p.categoryId !== 'glaces'),
      ).slice(0, 24),
    [catalogVersion],
  );
  const feedItems = useMemo(() => {
    const seen = new Set<string>();
    const items: Product[] = [];
    for (const product of [...recommended, ...shuffledPool]) {
      if (product.categoryId === 'cuisine' || seen.has(product.id)) continue;
      seen.add(product.id);
      items.push(product);
    }
    return items;
  }, [recommended, shuffledPool]);

  const unreadNotifications = unreadCount;
  const firstName = profile.firstName.trim();
  const helloLabel =
    firstName && plan.greeting.toLowerCase().endsWith(firstName.toLowerCase())
      ? plan.greeting.slice(0, -firstName.length).trim()
      : plan.greeting;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = Math.max(0, event.contentOffset.y);
      const dy = y - lastScrollY.value;
      lastScrollY.value = y;
      scrollY.value = y;
      if (y < 10) {
        navOffset.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
        return;
      }
      navOffset.value = Math.min(navMax, Math.max(0, navOffset.value + dy));
    },
    onEndDrag: (event) => {
      const y = event.contentOffset.y;
      const v = event.velocity?.y ?? 0;
      if (y < 10) {
        navOffset.value = withSpring(0, NAV_SPRING);
        return;
      }
      navOffset.value = withSpring(v > 0.35 || navOffset.value > navMax * 0.38 ? navMax : 0, NAV_SPRING);
    },
    onMomentumEnd: (event) => {
      const y = event.contentOffset.y;
      const v = event.velocity?.y ?? 0;
      if (y < 10) {
        navOffset.value = withSpring(0, NAV_SPRING);
        return;
      }
      navOffset.value = withSpring(v > 0.15 || navOffset.value > navMax * 0.38 ? navMax : 0, NAV_SPRING);
    },
  });

  const sheetAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      transform: [
        {
          translateY: interpolate(y, [0, 140], [0, -16], Extrapolation.CLAMP) },
      ],
      ...Platform.select({
        ios: {
          shadowOpacity: interpolate(y, [0, 80], [0.14, 0.05], Extrapolation.CLAMP) },
        android: {
          elevation: interpolate(y, [0, 80], [8, 2], Extrapolation.CLAMP) },
        default: {} }) };
  });

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

  const openPromos = () => {
    router.push('/promotions');
  };

  const openAddresses = () => {
    void import('@/components/LibreMap')
      .then((m) => m.warmLibreMap?.(mapStyles.light, cotonouMap.home, 14.6))
      .catch(() => undefined);
    router.push('/account/addresses');
  };

  const quickActions = [
    { icon: 'grid' as const, label: 'Rayons', onPress: () => navigateTab(tabPaths.explore) },
    { icon: 'tag' as const, label: 'Promos', onPress: openPromos },
    { icon: 'shopping-bag' as const, label: 'Panier', onPress: () => navigateTab(tabPaths.cart), badge: count },
    activeOrders.length > 0
      ? { icon: 'truck' as const, label: 'Suivi', onPress: () => router.push('/tracking') }
      : {
          icon: 'heart' as const,
          label: 'Favoris',
          onPress: () => router.push('/account/favorites'),
          badge: favCount,
        },
  ];

  return (
    <Screen>
      <Page style={styles.flex}>
        <SmartNavbar
          split
          hideOffset={navOffset}
          left={
            <PressScale
              style={styles.heroLocation}
              onPress={openAddresses}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel="Choisir une adresse de livraison">
              <Feather name="map-pin" size={14} color={colors.gold} />
              <Text style={[styles.heroLocationText, { color: colors.text }]} numberOfLines={1}>
                {defaultAddress?.line ?? 'Choisir une adresse'}
              </Text>
              <Feather name="chevron-down" size={13} color={colors.muted} />
            </PressScale>
          }
          right={
            <View style={styles.navActionsRow}>
              <IconCircle
                name="bell"
                variant="ghost"
                size="lg"
                badge={unreadNotifications}
                accessibilityLabel="Notifications"
                onPress={() => router.push('/notifications')}
              />
              <SmartNavbarChip round>
                <PressScale
                  style={styles.avatarWrap}
                  onPress={() => navigateTab(tabPaths.profile)}
                  scaleTo={0.94}
                  accessibilityRole="button"
                  accessibilityLabel="Ouvrir le profil">
                  <Image source={profilePhotoSource(profile.photoUri)} style={styles.avatar} />
                </PressScale>
              </SmartNavbarChip>
            </View>
          }
        />

        <ProductFlashGrid
          products={feedItems}
          extraData={catalogVersion}
          imageHeight={GRID_IMAGE_HEIGHT}
          style={styles.scrollLayer}
          onScroll={onScroll as (event: unknown) => void}
          {...(Platform.OS !== 'web'
            ? { refreshControl: <MarcheRefresh refreshing={refreshing} onRefresh={onRefresh} /> }
            : {})}
          contentContainerStyle={styles.scrollContent}
          header={
          <Animated.View style={[styles.bodySheet, sheetAnimStyle]}>
            <LinearGradient
              colors={[colors.cream, colors.white, colors.cream]}
              locations={[0, 0.38, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.introChrome, { paddingTop: smartNavbarClearance(insets.top) }]}>
            <Text style={styles.sheetHello} numberOfLines={1}>
              <Text style={styles.sheetHelloKicker}>
                {helloLabel}
                {firstName ? ', ' : ''}
              </Text>
              {firstName ? <Text style={styles.sheetHelloName}>{firstName}</Text> : null}
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Feather name="clock" size={14} color={colors.gold} />
                <Text style={styles.heroStatText}>{etaLabel}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Feather name="percent" size={14} color={colors.terracotta} />
                <Text style={styles.heroStatText}>{plan.promoCount} promos</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Feather name="award" size={14} color={colors.green} />
                <Text style={styles.heroStatText}>{loyaltyPoints} pts</Text>
              </View>
            </View>

            <MotionView delay={80} preset="down">
              <SearchField
                compact
                onPress={() => {
                  if (plan.continueTerm) setSearchQuery(plan.continueTerm);
                  openSearchScreen();
                }}
                placeholder={plan.searchHint}
              />
            </MotionView>

            <MotionView delay={90} preset="down">
              <View style={styles.quickGrid}>
                {quickActions.map((action) => (
                  <PressScale key={action.label} style={styles.quickTile} onPress={action.onPress} scaleTo={0.95}>
                    <View style={styles.quickIconWrap}>
                      <Feather name={action.icon} size={16} color={colors.gold} />
                      {action.badge && action.badge > 0 ? (
                        <View style={styles.quickBadge}>
                          <Text style={styles.quickBadgeText}>
                            {action.badge > 99 ? '99+' : action.badge}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.quickLabel}>{action.label}</Text>
                  </PressScale>
                ))}
              </View>
            </MotionView>

            {plan.cartNudge ? (
              <PressScale style={styles.cartNudge} onPress={() => navigateTab(tabPaths.cart)} scaleTo={0.98}>
                <Feather name="shopping-bag" size={13} color={colors.gold} />
                <Text style={styles.cartNudgeText} numberOfLines={1}>{plan.cartNudge}</Text>
                <Feather name="chevron-right" size={14} color={colors.gold} />
              </PressScale>
            ) : null}

            {activeOrders.length ? (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={orderCardWidth + 10}
                snapToAlignment="start"
                contentContainerStyle={styles.orderRow}>
                {activeOrders.map((order, index) => (
                  <PressScale
                    key={order.id}
                    style={[styles.orderBanner, { width: orderCardWidth }]}
                    onPress={() => router.push(`/tracking?id=${order.id}` as Href)}
                    scaleTo={0.985}>
                    <LinearGradient
                      colors={[colors.cream, colors.white]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.orderIcon}>
                      <Feather name="package" size={18} color={colors.gold} />
                    </View>
                    <View style={styles.orderText}>
                      <View style={styles.orderTitleRow}>
                        <View style={styles.orderLiveDot} />
                        <Text style={styles.orderTitle}>
                          {activeOrders.length > 1
                            ? `En cours · ${index + 1}/${activeOrders.length}`
                            : 'Commande en cours'}
                        </Text>
                      </View>
                      <Text style={styles.orderSub} numberOfLines={1}>
                        {formatOrderId(order.id)} · {order.dayLabel} {order.slotLabel}
                      </Text>
                      <Text style={styles.orderPhase} numberOfLines={1}>
                        {opsPhaseLabel(order)}
                      </Text>
                    </View>
                    <View style={styles.orderChevron}>
                      <Feather name="chevron-right" size={18} color={colors.gold} />
                    </View>
                  </PressScale>
                ))}
              </ScrollView>
            ) : null}
            </LinearGradient>

            {plan.tasteProducts.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionTitle}>{plan.tasteTitle}</Text>
                    <Text style={styles.sectionMeta}>{plan.tasteMeta}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      const chip = plan.rankedChips[0] ?? activeChip;
                      router.push(chipRoute(chip));
                    }}>
                    <Text style={styles.seeAll}>Voir tout</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.rowCards}>
                    {plan.tasteProducts.slice(0, 6).map((p) => (
                      <ProductCard key={`taste-${p.id}`} product={p} width={148} imageHeight={130} compact animate={false} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : plan.becauseProducts.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionTitle}>Dans la même veine</Text>
                    <Text style={styles.sectionMeta}>Favoris, commandes, panier</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.rowCards}>
                    {plan.becauseProducts.slice(0, 6).map((p) => (
                      <ProductCard key={`bec-${p.id}`} product={p} width={148} imageHeight={130} compact animate={false} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.chipsWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                contentContainerStyle={styles.chips}>
                {plan.rankedChips.map((cat, i) => {
                  const active = cat.id === homeActiveChipId;
                  return (
                    <MotionView key={cat.id} index={i} preset="zoom" delay={Math.min(i * 18, 90)}>
                      <PressScale
                        style={styles.chipHit}
                        onPress={() => router.push(chipRoute(cat))}
                        scaleTo={0.94}
                        accessibilityRole="button"
                        accessibilityLabel={`Ouvrir ${cat.label}`}>
                        <View style={[styles.chipRing, active && styles.chipRingActive]}>
                          <View style={[styles.chipThumb, active && styles.chipThumbActive]}>
                            <Image
                              source={cat.image}
                              resizeMode="cover"
                              style={[
                                styles.chipImage,
                                { transform: [{ scale: cat.imageZoom ?? 1.35 }] },
                              ]}
                            />
                          </View>
                          {active ? (
                            <View style={styles.chipActiveDot}>
                              <Feather name="check" size={10} color={colors.onAccent} />
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
                          {cat.label}
                        </Text>
                      </PressScale>
                    </MotionView>
                  );
                })}
              </ScrollView>
            </View>

            {liveBanners.length ? <PromoCarousel banners={liveBanners} width={contentW} /> : null}

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>En réduction</Text>
                <Pressable onPress={openPromos}>
                  <Text style={styles.seeAll}>Voir tout</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.rowCards}>
                  {onSale.map((p) => (
                    <ProductCard key={`sale-${p.id}`} product={p} width={148} imageHeight={130} compact animate={false} />
                  ))}
                </View>
              </ScrollView>
            </View>

            {plan.showGlaces && glaces.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionTitle}>Glaces & Sorbets</Text>
                    <Text style={styles.sectionMeta}>{glaceMeta}</Text>
                  </View>
                  <Pressable onPress={() => router.push('/category/glaces')}>
                    <Text style={styles.seeAll}>Voir tout</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.rowCards, { gap: GLACES_GAP }]}>
                  {glaces.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      width={glaceCardWidth}
                      imageHeight={glaceCardWidth}
                      compact
                      circleImage
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {cuisineReady.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionTitle}>{mealSlot.title}</Text>
                    <Text style={styles.sectionMeta}>{mealSlot.meta}</Text>
                  </View>
                  <Pressable onPress={() => router.push(`/category/${mealSlot.categoryId}` as Href)}>
                    <Text style={styles.seeAll}>Voir tout</Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.gridCuisine,
                    { columnGap: CUISINE_COL_GAP, rowGap: CUISINE_ROW_GAP },
                  ]}>
                  {cuisineReady.map((product, i) => (
                    <ProductCard
                      key={`meal-${product.id}`}
                      product={product}
                      width={cuisineCardWidth}
                      imageHeight={128}
                      compact
                      index={i}
                      animate={false}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>Populaires</Text>
                  <Text style={styles.sectionMeta}>Les plus demandés du moment</Text>
                </View>
                <Pressable onPress={() => navigateTab(tabPaths.explore)}>
                  <Text style={styles.seeAll}>Voir tout</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.rowCards}>
                  {popularRail.map((p) => (
                    <ProductCard key={`pop-${p.id}`} product={p} width={148} imageHeight={130} compact animate={false} />
                  ))}
                </View>
              </ScrollView>
            </View>
          </Animated.View>
          }
          footer={<Text style={styles.feedHint}>Faites défiler pour voir plus de produits…</Text>}
        />
        <CartTotalFab aboveTabs />
      </Page>
    </Screen>
  );
}

export default memo(HomeScreen);

function createStyles(colors: AppColors) {
  const chrome = {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  };
  return StyleSheet.create({
    flex: { flex: 1 },
    heroLocation: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      minHeight: 42,
      paddingVertical: 4,
    },
    heroLocationText: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '800' },
    navActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    scrollLayer: {
      flex: 1,
      zIndex: 1 },
    scrollContent: { paddingBottom: tabBarClearance, paddingHorizontal: 0, flexGrow: 1 },
    avatarWrap: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
    },
    avatar: { width: 42, height: 42, borderRadius: 21 },
    introChrome: {
      gap: 10,
      paddingHorizontal: spacing.screen - SHEET_EDGE,
      paddingBottom: 18,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      overflow: 'hidden',
    },
    sheetHello: {
      paddingTop: 10,
      paddingBottom: 2,
      paddingHorizontal: 2,
      marginLeft: 0,
      marginTop: 6,
    },
    sheetHelloKicker: {
      ...displayFont('600'),
      fontSize: 18,
      lineHeight: 22,
      letterSpacing: -0.25,
      color: colors.muted,
    },
    sheetHelloName: {
      ...displayFont('800'),
      fontSize: 20,
      lineHeight: 22,
      letterSpacing: -0.35,
      color: colors.gold,
    },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 12,
      ...chrome,
    },
    heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    heroStatText: {
      color: colors.text,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.2,
    },
    heroDivider: { width: 1, height: 20, backgroundColor: colors.border },
    bodySheet: {
      backgroundColor: colors.bg,
      paddingHorizontal: SHEET_EDGE,
      paddingTop: 0,
      gap: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.14,
          shadowRadius: 16 },
        android: { elevation: 8 },
        default: {} }) },
    orderBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.cream,
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 14,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: 'rgba(226, 147, 29, 0.35)',
      ...Platform.select({
        ios: {
          shadowColor: '#c84b31',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.14,
          shadowRadius: 12,
        },
        android: { elevation: 4 },
        default: {},
      }),
    },
    orderRow: { gap: 10, paddingRight: 4 },
    orderPhase: { color: colors.terracotta, fontSize: 12, fontWeight: '700' },
    orderIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(226, 147, 29, 0.22)',
      zIndex: 1,
    },
    orderText: { flex: 1, gap: 3, zIndex: 1 },
    orderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    orderLiveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.green,
    },
    orderTitle: { color: colors.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
    orderSub: { color: colors.muted, fontSize: 12 },
    orderChevron: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    cartNudge: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 14,
      paddingHorizontal: 12,
      backgroundColor: colors.blush,
    },
    cartNudgeText: {
      flex: 1,
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.2,
    },
    quickGrid: { flexDirection: 'row', gap: 8 },
    quickTile: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 14,
      paddingVertical: 14,
      minHeight: 76,
      ...chrome,
    },
    quickIconWrap: { position: 'relative' },
    quickLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.25,
    },
    quickBadge: {
      position: 'absolute',
      top: -6,
      right: -10,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.terracotta,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3 },
    quickBadgeText: { color: colors.onAccent, fontSize: 9, fontWeight: '700' },
    chipsWrap: { marginHorizontal: -SHEET_EDGE },
    chips: {
      gap: 14,
      paddingVertical: 6,
      paddingHorizontal: SHEET_EDGE,
      paddingRight: 28,
      alignItems: 'flex-start',
    },
    chipHit: {
      width: 76,
      alignItems: 'center',
      gap: 8,
    },
    chipRing: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    },
    chipRingActive: {
      borderColor: colors.gold,
      backgroundColor: colors.cream,
      ...Platform.select({
        ios: {
          shadowColor: colors.gold,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.28,
          shadowRadius: 10,
        },
        android: { elevation: 4 },
        default: {},
      }),
    },
    chipThumb: {
      width: 58,
      height: 58,
      borderRadius: 29,
      overflow: 'hidden',
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipThumbActive: {
      borderColor: colors.gold,
      borderWidth: 0,
    },
    chipImage: {
      width: '100%',
      height: '100%',
    },
    chipActiveDot: {
      position: 'absolute',
      right: 2,
      bottom: 2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bg,
    },
    chipLabel: {
      color: colors.muted,
      fontSize: 12,
      textAlign: 'center',
      width: '100%',
      ...displayFont('600'),
    },
    chipLabelActive: {
      color: colors.text,
      ...displayFont('700'),
    },
    section: { gap: 10 },
    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 40,
      paddingHorizontal: spacing.screen - SHEET_EDGE,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      lineHeight: 20,
    },
    sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '500', marginTop: 1 },
    seeAll: { color: colors.gold, fontSize: 13, fontWeight: '700' },
    rowCards: {
      flexDirection: 'row',
      columnGap: 1,
      gap: 1,
      paddingRight: 8,
    },
    gridCuisine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: '100%',
      alignSelf: 'stretch',
    },
    feedHint: {
      color: colors.placeholder,
      fontSize: 12,
      textAlign: 'center',
      paddingTop: 4,
      paddingBottom: 8 } });
}
