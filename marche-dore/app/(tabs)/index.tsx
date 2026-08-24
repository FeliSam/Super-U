import { CartTotalFab, ProductCard, PromoBanner, Screen, SearchField, Page } from '@/components/ui';
import { colors, tabBarClearance } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
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
import { router } from 'expo-router';
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

function HomeScreen() {
  const { count } = useCart();
  const { homeActiveChipId, setHomeActiveChipId, setSearchPromoOnly } = useUiState();
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
    setFeedPages((pages) => pages + 1);
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
    setSearchPromoOnly(true);
    navigateTab(tabPaths.search);
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
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onMainScroll}>
            <LinearGradient colors={['#f8e4c4', colors.cream, colors.bg]} style={styles.hero}>
              <View style={styles.heroOrb} />

              <View style={styles.header}>
                <Pressable style={styles.location} onPress={() => router.push('/account/addresses')}>
                  <View style={styles.pin}>
                    <Feather name="map-pin" size={17} color={colors.gold} />
                  </View>
                  <View>
                    <Text style={styles.livrer}>Livrer à</Text>
                    <View style={styles.cityRow}>
                      <Text style={styles.city}>Dakar, Plateau</Text>
                      <Feather name="chevron-down" size={14} color={colors.muted} />
                    </View>
                  </View>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable style={styles.actionBtn} onPress={() => router.push('/notifications')}>
                    <Feather name="bell" size={19} color={colors.text} />
                    {unreadNotifications > 0 ? (
                      <View style={styles.notifBadge}>
                        <Text style={styles.notifBadgeText}>
                          {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable style={styles.avatarWrap} onPress={() => navigateTab(tabPaths.profile)}>
                    <Image source={avatar} style={styles.avatar} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.greeting}>
                <Text style={styles.hello}>Bonjour, Amina 👋</Text>
                <Text style={styles.subtitle}>Des produits frais et locaux, livrés chez vous.</Text>
              </View>

              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Feather name="clock" size={15} color={colors.gold} />
                  <Text style={styles.heroStatText}>30–45 min</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Feather name="percent" size={15} color={colors.terracotta} />
                  <Text style={styles.heroStatText}>Promos actives</Text>
                </View>
                <View style={styles.heroDivider} />
                <Pressable style={styles.heroStat} onPress={() => router.push('/account/loyalty')}>
                  <Feather name="award" size={15} color={colors.green} />
                  <Text style={styles.heroStatText}>{LOYALTY_POINTS} pts</Text>
                </Pressable>
              </View>
            </LinearGradient>

            <View style={styles.bodySheet}>
              <SearchField onPress={() => navigateTab(tabPaths.search)} />

              <Pressable style={styles.orderBanner} onPress={() => router.push('/tracking')}>
                <View style={styles.orderIcon}>
                  <Feather name="package" size={18} color={colors.gold} />
                </View>
                <View style={styles.orderText}>
                  <Text style={styles.orderTitle}>Commande en cours</Text>
                  <Text style={styles.orderSub}>#MD-2024-0847 · Livraison aujourd'hui 14h–16h</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.placeholder} />
              </Pressable>

              <View style={styles.quickGrid}>
                {quickActions.map((action) => (
                  <Pressable key={action.label} style={styles.quickTile} onPress={action.onPress}>
                    <View style={styles.quickIconWrap}>
                      <Feather name={action.icon} size={19} color={colors.gold} />
                      {action.badge && action.badge > 0 ? (
                        <View style={styles.quickBadge}>
                          <Text style={styles.quickBadgeText}>{action.badge > 99 ? '99+' : action.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.quickLabel}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>

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
                  {feedItems.map(({ product, key }) => (
                    <ProductCard key={key} product={product} width="47.5%" imageHeight={GRID_IMAGE_HEIGHT} compact />
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    backgroundColor: 'rgba(255,255,255,0.3)',
    top: -50,
    right: -40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  location: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  pin: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  livrer: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  city: { color: colors.text, fontSize: 15, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.cream,
  },
  notifBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  avatarWrap: {
    padding: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  greeting: { gap: 6, marginTop: 20 },
  hello: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, maxWidth: '92%' },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroStatText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  heroDivider: { width: 1, height: 24, backgroundColor: colors.border },
  bodySheet: {
    marginTop: -24,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
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
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
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
