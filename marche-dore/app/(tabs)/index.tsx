import { CartTotalFab, IconCircle, ProductCard, PromoBanner, Screen, SearchField, Page } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { displayFont, heroChrome, tabBarClearance, type AppColors } from '@/constants/theme';
import { useColors, useTheme } from '@/context/ThemeContext';
import { useCart } from '@/context/CartContext';
import { formatOrderId, useOrders } from '@/context/OrdersContext';
import { useUiState } from '@/context/UiStateContext';
import {
  avatar,
  chipRoute,
  getProducts,
  homeCategories,
  homePromoBanners,
  products,
  productsForChip,
  promoProducts,
  recommendedIds,
  shuffleProducts,
  type Product,
} from '@/data/catalog';
import { notifications } from '@/data/notifications';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const GRID_IMAGE_HEIGHT = 173;
const PROMO_WIDTH = Dimensions.get('window').width - 40;
const homePromo = homePromoBanners[0];
const LOYALTY_POINTS = 450;
const HERO_OVERLAP = 28;

function HomeScreen() {
  const { scheme } = useTheme();
  const colors = useColors();
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [heroHeight, setHeroHeight] = useState(240);

  const { count } = useCart();
  const { activeOrder } = useOrders();
  const { homeActiveChipId, setHomeActiveChipId } = useUiState();
  const activeChip = homeCategories.find((c) => c.id === homeActiveChipId) ?? homeCategories[0];
  const onSale = useMemo(() => promoProducts(), []);
  const popular = useMemo(() => productsForChip(homeActiveChipId), [homeActiveChipId]);
  const recommended = useMemo(() => getProducts(recommendedIds), []);
  const shuffledPool = useMemo(() => shuffleProducts(products), []);
  const [feedPages, setFeedPages] = useState(1);
  const loadingFeed = useRef(false);

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const feedItems = useMemo(() => {
    const items: { product: Product; key: string }[] = [];
    recommended.forEach((product) => {
      items.push({ product, key: `rec-${product.id}` });
    });
    for (let page = 0; page < feedPages; page++) {
      shuffledPool.forEach((product, index) => {
        items.push({ product, key: `${product.id}-${page}-${index}` });
      });
    }
    return items;
  }, [feedPages, recommended, shuffledPool]);

  const loadMoreFeed = useCallback(() => {
    setFeedPages((pages) => Math.min(pages + 1, 3));
  }, []);

  const onMainScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 280;
      if (!nearBottom || loadingFeed.current) return;
      loadingFeed.current = true;
      loadMoreFeed();
      requestAnimationFrame(() => {
        loadingFeed.current = false;
      });
    },
    [loadMoreFeed],
  );

  const openPromos = () => {
    router.push('/promotions');
  };

  const quickActions = [
    { icon: 'grid' as const, label: 'Rayons', onPress: () => navigateTab(tabPaths.explore) },
    { icon: 'tag' as const, label: 'Promos', onPress: openPromos },
    { icon: 'shopping-bag' as const, label: 'Panier', onPress: () => navigateTab(tabPaths.cart), badge: count },
    { icon: 'truck' as const, label: 'Suivi', onPress: () => router.push('/tracking') },
  ];

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.flex}>
          <View
            style={styles.heroBackdrop}
            onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
            pointerEvents="box-none">
            <LinearGradient colors={chrome.gradient} style={styles.hero}>
              <View style={[styles.heroOrb, { backgroundColor: chrome.orb }]} />

              <View style={styles.header}>
                <PressScale
                  style={styles.location}
                  onPress={() => router.push('/account/addresses')}
                  scaleTo={0.98}
                  accessibilityLabel="Changer l’adresse de livraison">
                  <View
                    style={[
                      styles.pin,
                      { backgroundColor: chrome.iconBg, borderColor: chrome.iconBorder },
                    ]}>
                    <Feather name="map-pin" size={17} color={colors.gold} />
                  </View>
                  <View style={styles.locationText}>
                    <Text style={[styles.livrer, { color: chrome.muted }]}>Livrer à</Text>
                    <View style={styles.cityRow}>
                      <Text style={[styles.city, { color: chrome.ink }]}>Cotonou, Ganhi</Text>
                      <Feather name="chevron-down" size={14} color={chrome.muted} />
                    </View>
                  </View>
                </PressScale>
                <View style={styles.actions}>
                  <IconCircle
                    name="bell"
                    variant="hero"
                    badge={unreadNotifications}
                    accessibilityLabel="Notifications"
                    onPress={() => router.push('/notifications')}
                  />
                  <PressScale
                    style={[
                      styles.avatarWrap,
                      { backgroundColor: chrome.iconBg, borderColor: chrome.iconBorder },
                    ]}
                    onPress={() => navigateTab(tabPaths.profile)}
                    scaleTo={0.94}
                    accessibilityLabel="Ouvrir le profil">
                    <Image source={avatar} style={styles.avatar} />
                  </PressScale>
                </View>
              </View>

              <View style={styles.greeting}>
                <Text style={[styles.hello, { color: chrome.ink }]}>Bonjour, Amina 👋</Text>
                <Text style={[styles.subtitle, { color: chrome.muted }]}>
                  Des produits frais et locaux, livrés chez vous.
                </Text>
              </View>

              <View
                style={[
                  styles.heroStats,
                  { backgroundColor: chrome.surface, borderColor: chrome.surfaceBorder },
                ]}>
                <PressScale
                  style={styles.heroStat}
                  onPress={() => router.push('/tracking')}
                  scaleTo={0.96}
                  accessibilityLabel="Délai de livraison">
                  <Feather name="clock" size={15} color={colors.gold} />
                  <Text style={[styles.heroStatText, { color: chrome.ink }]}>30–45 min</Text>
                </PressScale>
                <View style={[styles.heroDivider, { backgroundColor: chrome.divider }]} />
                <PressScale
                  style={styles.heroStat}
                  onPress={openPromos}
                  scaleTo={0.96}
                  accessibilityLabel="Voir les promotions">
                  <Feather name="percent" size={15} color={colors.terracotta} />
                  <Text style={[styles.heroStatText, { color: chrome.ink }]}>Promos actives</Text>
                </PressScale>
                <View style={[styles.heroDivider, { backgroundColor: chrome.divider }]} />
                <PressScale
                  style={styles.heroStat}
                  onPress={() => router.push('/account/loyalty')}
                  scaleTo={0.96}
                  accessibilityLabel="Points fidélité">
                  <Feather name="award" size={15} color={colors.green} />
                  <Text style={[styles.heroStatText, { color: chrome.ink }]}>{LOYALTY_POINTS} pts</Text>
                </PressScale>
              </View>
            </LinearGradient>
          </View>

          <ScrollView
            style={styles.scrollLayer}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: Math.max(0, heroHeight - HERO_OVERLAP) },
            ]}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onMainScroll}>
            <View style={styles.bodySheet}>
              <MotionView delay={40} preset="down">
                <SearchField onPress={() => router.push('/search')} />
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
                  {quickActions.map((action, i) => (
                    <PressScale key={action.label} style={styles.quickTile} onPress={action.onPress} scaleTo={0.95}>
                      <View style={styles.quickIconWrap}>
                        <Feather name={action.icon} size={19} color={colors.gold} />
                        {action.badge && action.badge > 0 ? (
                          <View style={styles.quickBadge}>
                            <Text style={styles.quickBadgeText}>{action.badge > 99 ? '99+' : action.badge}</Text>
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
                  {homeCategories.map((cat) => {
                    const active = cat.id === homeActiveChipId;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setHomeActiveChipId(cat.id)}>
                        <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                        <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{cat.label}</Text>
                      </Pressable>
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

              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Recommandés pour vous</Text>
                  <Text style={styles.sectionMeta}>Basé sur vos goûts</Text>
                </View>
                <View style={styles.grid}>
                  {feedItems.map(({ product, key }, i) => (
                    <ProductCard
                      key={key}
                      product={product}
                      width="47.5%"
                      imageHeight={GRID_IMAGE_HEIGHT}
                      compact
                      index={i}
                      animate={i < 10}
                    />
                  ))}
                </View>
                <Text style={styles.feedHint}>Faites défiler pour voir plus de produits…</Text>
              </View>
            </View>
          </ScrollView>
          <CartTotalFab bottom={96} />
        </View>
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
    zIndex: 0,
  },
  scrollLayer: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: { paddingBottom: tabBarClearance },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -50,
    right: -40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  location: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  locationText: { flex: 1, gap: 1 },
  pin: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  livrer: { fontSize: 11, fontWeight: '600' },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  city: { fontSize: 15, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarWrap: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  greeting: { gap: 6, marginTop: 20 },
  hello: { fontSize: 28, letterSpacing: -0.4, ...displayFont('800') },
  subtitle: { fontSize: 14, lineHeight: 20, maxWidth: '92%' },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 18,
    borderWidth: 1,
  },
  heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroStatText: { fontSize: 11, fontWeight: '700' },
  heroDivider: { width: 1, height: 24 },
  bodySheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
    minHeight: Dimensions.get('window').height,
  },
  orderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  orderIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: { flex: 1, gap: 3 },
  orderTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  orderSub: { color: colors.muted, fontSize: 12 },
  quickGrid: { flexDirection: 'row', gap: 10 },
  quickTile: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 14,
  },
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
    paddingHorizontal: 3,
  },
  quickBadgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  chipsWrap: { marginHorizontal: -20 },
  chips: { gap: 10, paddingVertical: 2, paddingHorizontal: 20, paddingRight: 28 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...Platform.select({
      ios: {
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  chipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
    ...Platform.select({
      ios: {
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  chipEmoji: { fontSize: 15, lineHeight: 18 },
  chipLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipLabelActive: { color: colors.white, fontWeight: '700' },
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
    gap: 3,
  },
  feedHint: {
    color: colors.placeholder,
    fontSize: 12,
    textAlign: 'center',
    paddingTop: 4,
    paddingBottom: 8,
  },
});
}
