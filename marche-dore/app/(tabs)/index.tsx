import {
  CartTotalFab,
  IconCircle,
  ProductCard,
  PromoBanner,
  Screen,
  SearchField,
  SmartNavbar,
  Page,
  TabHero } from '@/components/ui';
import { warmLibreMap } from '@/components/LibreMap';
import { MotionView, PressScale } from '@/components/motion';
import { cotonouMap, mapStyles } from '@/constants/map';
import { displayFont, heroChrome, tabBarClearance, type AppColors } from '@/constants/theme';
import { useAddresses } from '@/context/AddressesContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import { useCart } from '@/context/CartContext';
import { formatOrderId, useOrders } from '@/context/OrdersContext';
import { useNotifications } from '@/context/NotificationsContext';
import { useUiState } from '@/context/UiStateContext';
import {
  avatar,
  chipRoute,
  getProducts,
  homeCategories,
  homePromoBanners,
  products,
  productsForChip,
  productsInCategory,
  promoProducts,
  recommendedIds,
  shuffleProducts,
  type Product } from '@/data/catalog';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { openSearchScreen } from '@/lib/searchNav';
import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
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
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GRID_IMAGE_HEIGHT = 173;
const GRID_HEAD_COUNT = 6; // 3 lignes × 2 colonnes
const CUISINE_COLS = 3;
const CUISINE_GAP = 6;
const CUISINE_ROWS = 2;
const GLACES_VISIBLE = 3.5;
const GLACES_GAP = 12;
const PROMO_WIDTH = Dimensions.get('window').width - 40;
const homePromo = homePromoBanners[0];
const LOYALTY_POINTS = 450;
const HERO_OVERLAP = 36;

function HomeScreen() {
  const { scheme } = useTheme();
  const colors = useColors();
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const [heroHeight, setHeroHeight] = useState(240);
  const [navInteractive, setNavInteractive] = useState(true);
  const scrollY = useSharedValue(0);

  const { count } = useCart();
  const { activeOrder } = useOrders();
  const { defaultAddress } = useAddresses();
  const { unreadCount } = useNotifications();
  const { homeActiveChipId, setHomeActiveChipId } = useUiState();
  const activeChip = homeCategories.find((c) => c.id === homeActiveChipId) ?? homeCategories[0];
  const onSale = useMemo(() => promoProducts(), []);
  const popular = useMemo(() => productsForChip(homeActiveChipId), [homeActiveChipId]);
  const recommended = useMemo(() => getProducts(recommendedIds), []);
  const cuisineReady = useMemo(
    () => productsInCategory('cuisine').slice(0, CUISINE_COLS * CUISINE_ROWS),
    [],
  );
  const cuisineCardWidth = useMemo(() => {
    const contentW = Math.min(windowWidth, 430) - 40;
    return Math.floor((contentW - CUISINE_GAP * (CUISINE_COLS - 1)) / CUISINE_COLS);
  }, [windowWidth]);
  const glaces = useMemo(() => productsInCategory('glaces'), []);
  const glaceCardWidth = useMemo(() => {
    const contentW = Math.min(windowWidth, 430) - 40;
    return Math.floor((contentW - GLACES_GAP * Math.floor(GLACES_VISIBLE)) / GLACES_VISIBLE);
  }, [windowWidth]);
  const shuffledPool = useMemo(
    () => shuffleProducts(products.filter((p) => p.categoryId !== 'cuisine' && p.categoryId !== 'glaces')),
    [],
  );
  const [feedPages, setFeedPages] = useState(1);
  const loadingFeed = useRef(false);

  const unreadNotifications = unreadCount;

  const feedItems = useMemo(() => {
    const items: { product: Product; key: string }[] = [];
    recommended.forEach((product) => {
      if (product.categoryId === 'cuisine') return;
      items.push({ product, key: `rec-${product.id}` });
    });
    for (let page = 0; page < feedPages; page++) {
      shuffledPool.forEach((product, index) => {
        items.push({ product, key: `${product.id}-${page}-${index}` });
      });
    }
    return items;
  }, [feedPages, recommended, shuffledPool]);

  const feedHead = useMemo(() => feedItems.slice(0, GRID_HEAD_COUNT), [feedItems]);
  const feedTail = useMemo(() => feedItems.slice(GRID_HEAD_COUNT), [feedItems]);

  const loadMoreFeed = useCallback(() => {
    setFeedPages((pages) => Math.min(pages + 1, 3));
  }, []);

  const maybeLoadMore = useCallback(
    (y: number, layoutH: number, contentH: number) => {
      const nearBottom = layoutH + y >= contentH - 280;
      if (!nearBottom || loadingFeed.current) return;
      loadingFeed.current = true;
      loadMoreFeed();
      requestAnimationFrame(() => {
        loadingFeed.current = false;
      });
    },
    [loadMoreFeed],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      runOnJS(maybeLoadMore)(
        event.contentOffset.y,
        event.layoutMeasurement.height,
        event.contentSize.height,
      );
    } });

  useAnimatedReaction(
    () => scrollY.value > 88,
    (collapsed, prev) => {
      if (collapsed !== prev) runOnJS(setNavInteractive)(!collapsed);
    },
  );

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

  /** Hero SmartNavbar — fades / lifts as the sheet rises. */
  const heroNavStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [0, 36, 96], [1, 0.72, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(y, [0, 110], [0, -22], Extrapolation.CLAMP) },
        { scale: interpolate(y, [0, 110], [1, 0.94], Extrapolation.CLAMP) },
      ] };
  });

  const locationAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [0, 28, 78], [1, 0.8, 0], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(y, [0, 96], [0, -18], Extrapolation.CLAMP) }] };
  });

  const actionsAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [0, 36, 88], [1, 0.75, 0], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(y, [0, 96], [0, 18], Extrapolation.CLAMP) }] };
  });

  /** Compact sticky bar — appears once the sheet covers the hero navbar. */
  const compactNavStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [72, 118], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(y, [72, 118], [-14, 0], Extrapolation.CLAMP) },
        { scale: interpolate(y, [72, 118], [0.96, 1], Extrapolation.CLAMP) },
      ] };
  });

  const openPromos = () => {
    router.push('/promotions');
  };

  const openAddresses = () => {
    void warmLibreMap(mapStyles.light, cotonouMap.home, 14.6);
    router.push('/account/addresses');
  };

  const quickActions = [
    { icon: 'grid' as const, label: 'Rayons', onPress: () => navigateTab(tabPaths.explore) },
    { icon: 'tag' as const, label: 'Promos', onPress: openPromos },
    { icon: 'shopping-bag' as const, label: 'Panier', onPress: () => navigateTab(tabPaths.cart), badge: count },
    { icon: 'truck' as const, label: 'Suivi', onPress: () => router.push('/tracking') },
  ];

  const renderLocation = (compact = false) =>
    compact ? (
      <PressScale
        style={styles.compactLocation}
        onPress={openAddresses}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel="Changer l’adresse de livraison">
        <Feather name="map-pin" size={15} color={colors.gold} />
        <Text style={[styles.compactCity, { color: chrome.ink }]} numberOfLines={1}>
          {defaultAddress.line}
        </Text>
        <Feather name="chevron-down" size={13} color={chrome.muted} />
      </PressScale>
    ) : (
      <PressScale
        style={styles.location}
        onPress={openAddresses}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel="Changer l’adresse de livraison">
        <View
          style={[styles.pin, { backgroundColor: chrome.iconBg, borderColor: chrome.iconBorder }]}>
          <Feather name="map-pin" size={17} color={colors.gold} />
        </View>
        <View style={styles.locationText}>
          <Text style={[styles.livrer, { color: chrome.muted }]}>Livrer à</Text>
          <View style={styles.cityRow}>
            <Text style={[styles.city, { color: chrome.ink }]} numberOfLines={1}>
              {defaultAddress.line}
            </Text>
            <Feather name="chevron-down" size={14} color={chrome.muted} />
          </View>
        </View>
      </PressScale>
    );

  const renderActions = () => (
    <>
      <IconCircle
        name="bell"
        variant="hero"
        badge={unreadNotifications}
        accessibilityLabel="Notifications"
        onPress={() => router.push('/notifications')}
      />
      <PressScale
        style={[styles.avatarWrap, { backgroundColor: chrome.iconBg, borderColor: chrome.iconBorder }]}
        onPress={() => navigateTab(tabPaths.profile)}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le profil">
        <Image source={avatar} style={styles.avatar} />
      </PressScale>
    </>
  );

  return (
    <Screen>
      <Page style={styles.flex}>
        <View
          style={styles.heroBackdrop}
          onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
          pointerEvents="none">
          <TabHero
            title="Bonjour, Amina 👋"
            subtitle="Des produits frais et locaux, livrés chez vous."
            navbar={<View style={styles.navbarSpacer} />}>
            <View
              style={[
                styles.heroStats,
                { backgroundColor: chrome.surface, borderColor: chrome.surfaceBorder },
              ]}>
              <View style={styles.heroStat}>
                <Feather name="clock" size={15} color={colors.gold} />
                <Text style={[styles.heroStatText, { color: chrome.ink }]}>30–45 min</Text>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: chrome.divider }]} />
              <View style={styles.heroStat}>
                <Feather name="percent" size={15} color={colors.terracotta} />
                <Text style={[styles.heroStatText, { color: chrome.ink }]}>Promos actives</Text>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: chrome.divider }]} />
              <View style={styles.heroStat}>
                <Feather name="award" size={15} color={colors.green} />
                <Text style={[styles.heroStatText, { color: chrome.ink }]}>{LOYALTY_POINTS} pts</Text>
              </View>
            </View>
          </TabHero>
        </View>

        {/* Hero SmartNavbar — synced with bottom-sheet scroll */}
        <Animated.View
          style={[styles.navbarFloat, heroNavStyle]}
          pointerEvents={navInteractive ? 'box-none' : 'none'}>
          <SmartNavbar
            left={<Animated.View style={locationAnimStyle}>{renderLocation(false)}</Animated.View>}
            right={
              <Animated.View style={[styles.navActionsRow, actionsAnimStyle]}>
                {renderActions()}
              </Animated.View>
            }
          />
        </Animated.View>

        {/* Compact sticky SmartNavbar when sheet covers the hero */}
        <Animated.View
          style={[
            styles.compactNav,
            {
              paddingTop: Math.max(8, insets.top ? 6 : 8),
              backgroundColor: scheme === 'dark' ? 'rgba(30,26,23,0.92)' : 'rgba(253,240,213,0.92)',
              borderBottomColor: chrome.surfaceBorder },
            compactNavStyle,
          ]}
          pointerEvents={navInteractive ? 'none' : 'box-none'}>
          <SmartNavbar left={renderLocation(true)} right={renderActions()} />
        </Animated.View>

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

            <MotionView delay={40} preset="down">
              <SearchField onPress={openSearchScreen} />
            </MotionView>

            <MotionView delay={90} preset="down">
              {activeOrder ? (
                <PressScale
                  style={styles.orderBanner}
                  onPress={() => router.push(`/tracking?id=${activeOrder.id}` as Href)}
                  scaleTo={0.985}>
                  <View style={styles.orderIcon}>
                    <Feather name="package" size={18} color={colors.gold} />
                  </View>
                  <View style={styles.orderText}>
                    <Text style={styles.orderTitle}>Commande en cours</Text>
                    <Text style={styles.orderSub}>
                      {formatOrderId(activeOrder.id)} · {activeOrder.dayLabel} {activeOrder.slotLabel}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.placeholder} />
                </PressScale>
              ) : null}
            </MotionView>

            <MotionView delay={130} preset="down">
              <View style={styles.quickGrid}>
                {quickActions.map((action) => (
                  <PressScale key={action.label} style={styles.quickTile} onPress={action.onPress} scaleTo={0.95}>
                    <View style={styles.quickIconWrap}>
                      <Feather name={action.icon} size={19} color={colors.gold} />
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

            <View style={styles.chipsWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                contentContainerStyle={styles.chips}>
                {homeCategories.map((cat, i) => {
                  const active = cat.id === homeActiveChipId;
                  return (
                    <MotionView key={cat.id} index={i} preset="zoom" delay={Math.min(i * 40, 200)}>
                      <PressScale
                        style={styles.chipHit}
                        onPress={() => setHomeActiveChipId(cat.id)}
                        scaleTo={0.94}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={cat.label}>
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

            <PromoBanner
              title={homePromo.title}
              subtitle={homePromo.subtitle}
              cta={homePromo.cta}
              image={homePromo.image}
              width={PROMO_WIDTH}
              onPress={() => router.push(homePromo.href)}
            />

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>En réduction</Text>
                <Pressable onPress={openPromos}>
                  <Text style={styles.seeAll}>Voir tout</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowCards}>
                {onSale.map((p) => (
                  <ProductCard key={p.id} product={p} width={148} imageHeight={130} compact />
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>Produits populaires</Text>
                  <Text style={styles.sectionMeta}>{activeChip.label} · Sélection du moment</Text>
                </View>
                <Pressable onPress={() => router.push(chipRoute(activeChip))}>
                  <Text style={styles.seeAll}>Voir tout</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowCards}>
                {popular.map((p) => (
                  <ProductCard key={p.id} product={p} width={148} imageHeight={130} compact />
                ))}
              </ScrollView>
            </View>

            {glaces.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionTitle}>Glaces & Sorbets</Text>
                    <Text style={styles.sectionMeta}>Fraîches · à croquer</Text>
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

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Recommandés pour vous</Text>
                <Text style={styles.sectionMeta}>Basé sur vos goûts</Text>
              </View>
              <View style={styles.grid}>
                {feedHead.map(({ product, key }, i) => (
                  <ProductCard
                    key={key}
                    product={product}
                    width="47.5%"
                    imageHeight={GRID_IMAGE_HEIGHT}
                    compact
                    index={i}
                    animate={i < 6}
                  />
                ))}
              </View>

              {cuisineReady.length > 0 ? (
                <View style={styles.cuisineBlock}>
                  <View style={styles.sectionHead}>
                    <View>
                      <Text style={styles.sectionTitle}>Déjà cuisinés</Text>
                      <Text style={styles.sectionMeta}>Prêts à réchauffer · du jour</Text>
                    </View>
                    <Pressable onPress={() => router.push('/category/cuisine')}>
                      <Text style={styles.seeAll}>Voir tout</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.gridCuisine, { gap: CUISINE_GAP }]}>
                    {cuisineReady.map((product, i) => (
                      <ProductCard
                        key={`cuisine-${product.id}`}
                        product={product}
                        width={cuisineCardWidth}
                        imageHeight={96}
                        compact
                        index={i}
                        animate={i < 6}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {feedTail.length > 0 ? (
                <View style={styles.grid}>
                  {feedTail.map(({ product, key }, i) => (
                    <ProductCard
                      key={key}
                      product={product}
                      width="47.5%"
                      imageHeight={GRID_IMAGE_HEIGHT}
                      compact
                      index={i}
                      animate={i < 8}
                    />
                  ))}
                </View>
              ) : null}
              <Text style={styles.feedHint}>Faites défiler pour voir plus de produits…</Text>
            </View>
          </Animated.View>
        </Animated.ScrollView>
        <CartTotalFab bottom={96} />
      </Page>
    </Screen>
  );
}

export default memo(HomeScreen);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    heroBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 0 },
    navbarFloat: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      paddingHorizontal: 20,
      paddingTop: 8 },
    navActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8 },
    compactNav: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 12,
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      ...Platform.select({
        ios: {
          shadowColor: '#140f0d',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 10 },
        android: { elevation: 6 },
        default: {} }) },
    compactLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 38 },
    compactCity: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '800' },
    navbarSpacer: {
      minHeight: 42,
      marginBottom: 16 },
    scrollLayer: {
      flex: 1,
      zIndex: 1 },
    scrollContent: { paddingBottom: tabBarClearance },
    location: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    locationText: { flex: 1, gap: 1, minWidth: 0 },
    pin: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center' },
    livrer: { fontSize: 11, fontWeight: '600' },
    cityRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    city: { fontSize: 15, fontWeight: '800' },
    avatarWrap: {
      padding: 2,
      borderRadius: 999 },
    avatar: { width: 38, height: 38, borderRadius: 19 },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginTop: 18 },
    heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    heroStatText: { fontSize: 11, fontWeight: '700' },
    heroDivider: { width: 1, height: 24 },
    bodySheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 8,
      gap: 20,
      minHeight: Dimensions.get('window').height,
      ...Platform.select({
        ios: {
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.14,
          shadowRadius: 16 },
        android: { elevation: 8 },
        default: {} }) },
    sheetHandle: { alignItems: 'center', paddingVertical: 8 },
    sheetHandleBar: {
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border },
    orderBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14 },
    orderIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center' },
    orderText: { flex: 1, gap: 3 },
    orderTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    orderSub: { color: colors.muted, fontSize: 12 },
    quickGrid: { flexDirection: 'row', gap: 10 },
    quickTile: {
      flex: 1,
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingVertical: 14 },
    quickIconWrap: { position: 'relative' },
    quickLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
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
    chipsWrap: { marginHorizontal: -20 },
    chips: {
      gap: 14,
      paddingVertical: 6,
      paddingHorizontal: 20,
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
    section: { gap: 12 },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    sectionTitle: { color: colors.text, fontSize: 18, ...displayFont('700') },
    sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '500', marginTop: 2 },
    seeAll: { color: colors.gold, fontSize: 13, fontWeight: '700' },
    rowCards: { gap: 12, paddingRight: 4 },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 3 },
    cuisineBlock: { gap: 12, marginTop: 8 },
    gridCuisine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    feedHint: {
      color: colors.placeholder,
      fontSize: 12,
      textAlign: 'center',
      paddingTop: 4,
      paddingBottom: 8 } });
}
