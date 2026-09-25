import { AppImage } from '@/components/AppImage';
import { FrostedTopBar, frostedBarClearance, IconCircle, Page, ProductCard, Screen, SmartNavbarChip, smartNavbarClearance } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { displayFont, floatingAboveTabBar, heroChrome, liquidIce, tabBarClearance, type AppColors, spacing } from '@/constants/theme';
import { useAddresses } from '@/context/AddressesContext';
import { useCatalog } from '@/context/CatalogContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import { CartLine, lineListTotal, lineProduct, lineTotal, useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useOrders } from '@/context/OrdersContext';
import { useStores } from '@/context/StoresContext';
import { useUiState } from '@/context/UiStateContext';
import { chipRoute, homeCategories } from '@/data/catalog';
import { formatDistanceKm, formatDurationMin } from '@/lib/deliveryRouting';
import { formatFcfa } from '@/lib/format';
import { softShadow } from '@/lib/shadow';
import { buildExplorePlan } from '@/lib/homeEngine';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { openSearchScreen } from '@/lib/searchNav';
import { useDeliveryEstimate } from '@/lib/useDeliveryEstimate';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  Easing,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const NAV_SPRING = { damping: 20, stiffness: 240, mass: 0.55, overshootClamping: false } as const;
const DELETE_WIDTH = 88;

function CartItemRow({
  line,
  onSetQty,
  showTrash,
  onRemove,
}: {
  line: CartLine;
  onSetQty: (qty: number) => void;
  showTrash?: boolean;
  onRemove?: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const p = lineProduct(line);
  if (!p) return null;

  const total = lineTotal(line);
  const listTotal = lineListTotal(line);
  const hasDiscount = Boolean(p.oldPrice && listTotal > total);

  return (
    <View style={styles.item}>
      <Pressable style={styles.itemLink} onPress={() => router.push(`/product/${p.id}`)}>
        <View style={styles.thumbWrap}>
          <AppImage source={p.image} frameStyle={styles.thumb} contentFit="cover" />
          {p.discount ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{p.discount}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.name} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={styles.unit}>{line.unitOverride ?? p.unit}</Text>
          <View style={styles.prices}>
            <Text style={styles.price}>{formatFcfa(total)}</Text>
            {hasDiscount ? <Text style={styles.oldPrice}>{formatFcfa(listTotal)}</Text> : null}
          </View>
        </View>
      </Pressable>
      <View style={styles.qty}>
        <Pressable style={styles.qtyBtn} onPress={() => onSetQty(line.qty - 1)} hitSlop={8}>
          <Text style={styles.qtySign}>–</Text>
        </Pressable>
        <Text style={styles.qtyVal}>{line.qty}</Text>
        <Pressable style={[styles.qtyBtn, styles.qtyPlus]} onPress={() => onSetQty(line.qty + 1)} hitSlop={8}>
          <Feather name="plus" size={13} color={colors.onAccent} />
        </Pressable>
      </View>
      {showTrash && onRemove ? (
        <Pressable
          style={styles.webTrash}
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${p.name}`}>
          <Feather name="trash-2" size={16} color={colors.terracotta} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Swipe-to-delete style iOS Mail via Gesture Handler (natif), pas PanResponder JS. */
function SwipeCartItem({
  line,
  onRemove,
  onSetQty,
}: {
  line: CartLine;
  onRemove: () => void;
  onSetQty: (qty: number) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const swipeRef = useRef<Swipeable>(null);
  const p = lineProduct(line);

  const closeAndRemove = useCallback(() => {
    swipeRef.current?.close();
    onRemove();
  }, [onRemove]);

  const renderRightActions = useCallback(
    () => (
      <RectButton
        style={styles.deleteAction}
        onPress={closeAndRemove}
        accessibilityRole="button"
        accessibilityLabel={p ? `Retirer ${p.name}` : 'Retirer'}>
        <View style={styles.deleteActionInner}>
          <Feather name="trash-2" size={20} color={colors.onAccent} />
          <Text style={styles.deleteActionLabel}>Retirer</Text>
        </View>
      </RectButton>
    ),
    [closeAndRemove, colors.onAccent, p, styles],
  );

  if (!p) return null;

  if (Platform.OS === 'web') {
    return <CartItemRow line={line} onSetQty={onSetQty} showTrash onRemove={onRemove} />;
  }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      enableTrackpadTwoFingerGesture
      renderRightActions={renderRightActions}
      childrenContainerStyle={styles.swipeChild}>
      <CartItemRow line={line} onSetQty={onSetQty} />
    </Swipeable>
  );
}

function SummaryRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumVal, green && styles.sumValGreen]}>{value}</Text>
    </View>
  );
}

function CartScreen() {
  const { version: catalogVersion } = useCatalog();
  const [visitSalt] = useState(() => Date.now());
  const { scheme } = useTheme();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navMax = smartNavbarClearance(insets.top);
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const navOffset = useSharedValue(0);
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const ice = useMemo(() => liquidIce(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dockBottom = floatingAboveTabBar(insets.bottom, 12);
  const { defaultAddress } = useAddresses();
  const { selectedStore } = useStores();
  const {
    lines,
    count,
    setQty,
    remove,
    clear,
    subtotal,
    listSubtotal,
    delivery,
    discount,
    total } = useCart();
  const routeEstimate = useDeliveryEstimate(
    selectedStore.coordinate,
    defaultAddress?.coordinate ?? null,
  );
  const etaText = routeEstimate.loading
    ? 'Calcul du trajet…'
    : routeEstimate.unavailable
      ? formatFcfa(delivery)
      : routeEstimate.approximated
        ? `Approx. ${formatDistanceKm(routeEstimate.distanceMeters)} · ~${formatDurationMin(routeEstimate.durationSeconds)} · ${selectedStore.name}`
        : `${formatDistanceKm(routeEstimate.distanceMeters)} · ~${formatDurationMin(routeEstimate.durationSeconds)} · ${selectedStore.name}`;
  const [summaryOpen, setSummaryOpen] = useState(false);

  const savings = Math.max(0, listSubtotal - subtotal);

  const itemLabel = useMemo(() => {
    if (count === 0) return '0 article';
    return `${count} article${count > 1 ? 's' : ''}`;
  }, [count]);

  const confirmClearCart = useCallback(() => {
    if (count < 1) return;
    Alert.alert(
      'Vider le panier',
      `Retirer ${itemLabel} de votre panier ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Vider', style: 'destructive', onPress: () => clear() },
      ],
    );
  }, [clear, count, itemLabel]);

  const { searchRecents, recentProductIds, interests } = useUiState();
  const { ids: favoriteIds } = useFavorites();
  const { orders } = useOrders();
  const orderedIds = useMemo(
    () => orders.flatMap((order) => order.lines.map((line) => line.productId)).slice(0, 48),
    [orders],
  );
  const emptyPlan = useMemo(
    () =>
      buildExplorePlan({
        recents: searchRecents,
        favoriteIds,
        cartIds: lines.map((line) => line.productId),
        orderedIds,
        interests,
        viewedIds: recentProductIds,
        hour: new Date().getHours(),
        sessionSalt: visitSalt,
      }),
    [searchRecents, recentProductIds, lines, orderedIds, interests, favoriteIds, catalogVersion, visitSalt],
  );
  const emptySuggestions = emptyPlan.forYou.slice(0, 8);
  const emptyCategories = useMemo(() => homeCategories.slice(0, 6), []);

  const heroClearance = frostedBarClearance(insets.top);

  const onNavScroll = useAnimatedScrollHandler({
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

  return (
    <Screen>
      <Page style={styles.flex}>
        <FrostedTopBar hideOffset={navOffset}
          right={
            <>
                {count > 0 ? (
                  <PressScale
                    style={[
                      styles.clearPill,
                      { backgroundColor: ice.backgroundColor, borderColor: ice.borderColor },
                    ]}
                    onPress={confirmClearCart}
                    scaleTo={0.94}
                    accessibilityLabel="Vider le panier">
                    <Feather name="trash-2" size={15} color={colors.terracotta} />
                  </PressScale>
                ) : null}
                {count > 0 ? (
                  <PressScale
                    style={[
                      styles.countPill,
                      { backgroundColor: ice.backgroundColor, borderColor: ice.borderColor },
                    ]}
                    onPress={() => router.push('/checkout')}
                    scaleTo={0.94}
                    accessibilityLabel={`${count} articles — passer commande`}>
                    <Text style={[styles.countPillText, { color: colors.gold }]}>{count}</Text>
                  </PressScale>
                ) : null}
                <SmartNavbarChip round>
                <IconCircle
                  name="search"
                  variant="ghost"
                  size="lg"
                  accessibilityLabel="Rechercher"
                  onPress={openSearchScreen}
                />
                </SmartNavbarChip>
                <SmartNavbarChip round>
                <IconCircle
                  name="tag"
                  variant="ghost"
                  size="lg"
                  accessibilityLabel="Promotions"
                  onPress={() => router.push('/promotions')}
                />
                </SmartNavbarChip>
                <PressScale
                  style={[
                    styles.continueBtn,
                    { backgroundColor: ice.backgroundColor, borderColor: ice.borderColor },
                  ]}
                  onPress={() => navigateTab(tabPaths.explore)}
                  scaleTo={0.96}
                  accessibilityLabel="Continuer les achats">
                  <Text style={[styles.continueText, { color: colors.text }]}>Continuer</Text>
                  <Feather name="chevron-right" size={14} color={colors.gold} />
                </PressScale>
            </>
          }>
          <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>
            Panier
          </Text>
        </FrostedTopBar>

        {lines.length === 0 ? (
          <Reanimated.ScrollView
            style={styles.scrollLayer}
            contentContainerStyle={[styles.emptyScroll, { paddingTop: heroClearance }]}
            showsVerticalScrollIndicator={false}
            onScroll={onNavScroll}
            scrollEventThrottle={16}>
            <View style={styles.bodySheet}>
              <MotionView preset="up" delay={40} style={styles.emptyHeroCard}>
                <View style={styles.emptyArt}>
                  <View style={styles.emptyBlobA} />
                  <View style={styles.emptyBlobB} />
                  <View style={styles.emptyIconRing}>
                    <Feather name="shopping-bag" size={34} color={colors.terracotta} />
                  </View>
                  <View style={styles.emptyBadge}>
                    <Feather name="sun" size={12} color={colors.gold} />
                    <Text style={styles.emptyBadgeText}>Marché Doré</Text>
                  </View>
                </View>
                <Text style={styles.emptyTitle}>Votre panier attend{'\n'}ses premiers frais</Text>
                <Text style={styles.emptySub}>
                  Composez une commande en quelques taps — fruits du jour, viandes, boissons et plus encore.
                </Text>
                <PressScale style={styles.emptyCta} onPress={() => navigateTab(tabPaths.explore)} scaleTo={0.97}>
                  <LinearGradient
                    colors={['#c84b31', '#a83c26']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.emptyCtaGradient}>
                    <Feather name="compass" size={16} color={colors.onAccent} />
                    <Text style={styles.emptyCtaText}>Découvrir les produits</Text>
                  </LinearGradient>
                </PressScale>
                <Pressable style={styles.emptySecondary} onPress={openSearchScreen}>
                  <Feather name="search" size={15} color={colors.gold} />
                  <Text style={styles.emptySecondaryText}>Rechercher un produit</Text>
                </Pressable>
              </MotionView>

              <View style={styles.emptyPerks}>
                <PressScale style={styles.emptyPerk} onPress={() => router.push('/tracking')} scaleTo={0.97}>
                  <Feather name="truck" size={15} color={colors.gold} />
                  <Text style={styles.emptyPerkText}>Livraison rapide</Text>
                </PressScale>
                <PressScale style={styles.emptyPerk} onPress={() => router.push('/about')} scaleTo={0.97}>
                  <Feather name="shield" size={15} color={colors.green} />
                  <Text style={styles.emptyPerkText}>Qualité garantie</Text>
                </PressScale>
                <PressScale
                  style={styles.emptyPerk}
                  onPress={() => router.push('/category/fruits-legumes')}
                  scaleTo={0.97}>
                  <Feather name="refresh-cw" size={15} color={colors.terracotta} />
                  <Text style={styles.emptyPerkText}>Frais du jour</Text>
                </PressScale>
              </View>

              <View style={styles.emptySection}>
                <View style={styles.emptySectionHead}>
                  <Text style={styles.emptySectionTitle}>Rayons du moment</Text>
                  <Pressable onPress={() => navigateTab(tabPaths.explore)}>
                    <Text style={styles.emptySectionLink}>Tout voir</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.emptyCatsRow}>
                  {emptyCategories.map((cat) => (
                    <PressScale
                      key={cat.id}
                      style={styles.emptyCat}
                      onPress={() => router.push(chipRoute(cat))}
                      scaleTo={0.96}
                      accessibilityRole="button"
                      accessibilityLabel={cat.label}>
                      <AppImage source={cat.image} frameStyle={styles.emptyCatImg} />
                      <Text style={styles.emptyCatLabel} numberOfLines={1}>
                        {cat.label}
                      </Text>
                    </PressScale>
                  ))}
                </ScrollView>
              </View>

              <View style={[styles.emptySection, styles.emptySectionBleed]}>
                <View style={[styles.emptySectionHead, styles.emptySectionBleedHead]}>
                  <Text style={styles.emptySectionTitle}>{emptyPlan.forYouTitle}</Text>
                  <Text style={styles.emptySectionMeta}>{emptyPlan.forYouMeta}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.emptyProductsRow}>
                  {emptySuggestions.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      width={148}
                      imageHeight={118}
                      compact
                      index={index}
                      animate={index < 4}
                    />
                  ))}
                </ScrollView>
              </View>
            </View>
          </Reanimated.ScrollView>
        ) : (
          <View style={styles.flex}>
            <Reanimated.ScrollView
              style={styles.scrollLayer}
              contentContainerStyle={[
                styles.content,
                {
                  paddingTop: heroClearance,
                  paddingBottom: dockBottom + 148,
                },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={onNavScroll}
              scrollEventThrottle={16}>
              <View style={styles.bodySheet}>
                <Pressable style={styles.deliveryCard} onPress={() => router.push('/account/addresses')}>
                  <View style={styles.deliveryIcon}>
                    <Feather name="map-pin" size={17} color={colors.gold} />
                  </View>
                  <View style={styles.deliveryText}>
                    <Text style={styles.deliveryLabel}>
                      {defaultAddress ? `Livraison · ${defaultAddress.label}` : 'Choisir une adresse'}
                    </Text>
                    <Text style={styles.deliveryEta}>{etaText}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.placeholder} />
                </Pressable>

                {savings > 0 ? (
                  <View style={styles.savingsBanner}>
                    <Feather name="trending-down" size={15} color={colors.green} />
                    <Text style={styles.savingsText}>
                      Vous économisez {formatFcfa(savings)} sur cette commande
                    </Text>
                  </View>
                ) : null}

                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Vos articles</Text>
                  <View style={styles.sectionHeadRight}>
                    <Text style={styles.sectionMeta}>{itemLabel}</Text>
                    <Pressable
                      style={styles.clearBtn}
                      onPress={confirmClearCart}
                      accessibilityRole="button"
                      accessibilityLabel="Vider le panier">
                      <Feather name="trash-2" size={13} color={colors.terracotta} />
                      <Text style={styles.clearBtnText}>Vider</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.itemsCard}>
                  {lines.map((line, index) => (
                    <View key={line.productId}>
                      <SwipeCartItem
                        line={line}
                        onRemove={() => remove(line.productId)}
                        onSetQty={(qty) => setQty(line.productId, qty)}
                      />
                      {index < lines.length - 1 ? <View style={styles.itemDivider} /> : null}
                    </View>
                  ))}
                </View>

                <Text style={styles.swipeHint}>
                  {Platform.OS === 'web'
                    ? 'Utilisez l’icône poubelle pour retirer un article'
                    : 'Glissez un article vers la gauche pour le retirer'}
                </Text>
              </View>
            </Reanimated.ScrollView>

            <View style={[styles.checkoutDock, { bottom: dockBottom }]} pointerEvents="box-none">
              <View style={styles.checkoutBar}>
                <Pressable
                  style={styles.checkoutSummary}
                  onPress={() => setSummaryOpen((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={summaryOpen ? 'Masquer le détail' : 'Voir le détail du total'}>
                  <View>
                    <Text style={styles.checkoutLabel}>Total à payer</Text>
                    <View style={styles.checkoutTotalRow}>
                      <Text style={styles.checkoutTotal}>{formatFcfa(total)}</Text>
                      {listSubtotal + delivery > total ? (
                        <Text style={styles.checkoutOld}>{formatFcfa(listSubtotal + delivery)}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.checkoutToggle}>
                    <Text style={styles.checkoutToggleText}>{summaryOpen ? 'Masquer' : 'Détails'}</Text>
                    <Feather
                      name={summaryOpen ? 'chevron-down' : 'chevron-up'}
                      size={15}
                      color={colors.muted}
                    />
                  </View>
                </Pressable>
                {summaryOpen ? (
                  <View style={styles.inlineSummary}>
                    <SummaryRow label="Sous-total" value={formatFcfa(subtotal)} />
                    <SummaryRow label="Livraison" value={formatFcfa(delivery)} />
                    {discount > 0 ? (
                      <SummaryRow label="Réduction" value={`−${formatFcfa(discount)}`} green />
                    ) : null}
                    {savings > 0 ? (
                      <SummaryRow label="Économies produits" value={`−${formatFcfa(savings)}`} green />
                    ) : null}
                  </View>
                ) : null}
                <PressScale
                  style={styles.checkoutBtn}
                  onPress={() => router.push('/checkout')}
                  scaleTo={0.98}
                  accessibilityLabel={`Commander pour ${formatFcfa(total)}`}>
                  <LinearGradient
                    colors={['#e2931d', '#c98412']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.checkoutGradient}>
                    <Text style={styles.checkoutBtnText}>Commander</Text>
                    <View style={styles.checkoutBtnRight}>
                      <Text style={styles.checkoutBtnPrice}>{formatFcfa(total)}</Text>
                      <Feather name="arrow-right" size={17} color="#ffffff" />
                    </View>
                  </LinearGradient>
                </PressScale>
              </View>
            </View>
          </View>
        )}
      </Page>
    </Screen>
  );
}

export default memo(CartScreen);

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
    countPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8 },
  countPillText: { fontSize: 13, fontWeight: '800' },
  clearPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8 },
  continueText: { fontSize: 13, fontWeight: '700' },
  bodySheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    gap: 12,
  },
  content: {
    paddingBottom: tabBarClearance + 132,
  },
  emptyScroll: {
    paddingBottom: tabBarClearance + 24,
  },
  checkoutDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: spacing.screenMd },
  checkoutBar: {
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
    ...softShadow({ y: 8, blur: 18, opacity: 0.14, elevation: 10 }),
  },
  checkoutSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between' },
  checkoutLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  checkoutTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  checkoutTotal: { color: colors.text, fontSize: 22, fontWeight: '800' },
  checkoutOld: {
    color: colors.placeholder,
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'line-through' },
  checkoutToggle: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  checkoutToggleText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  checkoutBtn: { borderRadius: 14, overflow: 'hidden' },
  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18 },
  checkoutBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  checkoutBtnRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkoutBtnPrice: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700' },
  emptyHeroCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 10 },
  emptyArt: {
    width: 160,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4 },
  emptyBlobA: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: colors.cream,
    top: 0,
    left: 8 },
  emptyBlobB: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.blush,
    right: 6,
    bottom: 8 },
  emptyIconRing: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1 },
  emptyBadge: {
    position: 'absolute',
    bottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.cream,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 2 },
  emptyBadgeText: { color: colors.gold, fontSize: 11, fontWeight: '800' },
  emptyTitle: {
    color: colors.text,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 30,
    ...displayFont('800') },
  emptySub: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 4,
    maxWidth: 300 },
  emptyCta: {
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4 },
  emptyCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    minHeight: 52 },
  emptyCtaText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  emptySecondary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  emptySecondaryText: { color: colors.gold, fontSize: 14, fontWeight: '600' },
  emptyPerks: {
    flexDirection: 'row',
    gap: 8 },
  emptyPerk: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6 },
  emptyPerkText: { color: colors.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  emptySection: { gap: 12 },
  emptySectionBleed: { marginHorizontal: -spacing.screen },
  emptySectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between' },
  emptySectionBleedHead: { paddingHorizontal: spacing.screen },
  emptySectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  emptySectionLink: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  emptySectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  emptyCatsRow: { flexDirection: 'row', gap: 3.6, paddingRight: 4 },
  emptyCat: { width: 76, alignItems: 'center', gap: 8 },
  emptyCatImg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.white },
  emptyCatLabel: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  emptyProductsRow: {
    flexDirection: 'row',
    gap: 3.6,
    paddingBottom: 4,
    paddingRight: spacing.screen,
  },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14 },
  deliveryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center' },
  deliveryText: { flex: 1, gap: 2 },
  deliveryLabel: {
    color: colors.placeholder,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4 },
  deliveryEta: { color: colors.text, fontSize: 14, fontWeight: '700' },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11 },
  savingsText: { color: colors.green, fontSize: 13, fontWeight: '600', flex: 1 },
  progressCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 13,
    gap: 8 },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTitle: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.gold },
  progressFillGreen: { height: '100%', borderRadius: 3, backgroundColor: colors.green },
  progressSub: { color: colors.muted, fontSize: 11, fontWeight: '500' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 10,
  },
  sectionHeadRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blush,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearBtnText: {
    color: colors.terracotta,
    fontSize: 12,
    fontWeight: '700',
  },
  itemsCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
  itemDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 96 },
  swipeHint: {
    color: colors.placeholder,
    fontSize: 11,
    textAlign: 'center',
    marginTop: -2,
  },
  swipeChild: {
    backgroundColor: colors.white,
  },
  deleteAction: {
    width: DELETE_WIDTH,
    backgroundColor: colors.terracotta,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionInner: {
    width: DELETE_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteActionLabel: {
    color: colors.onAccent,
    fontSize: 11,
    fontWeight: '700',
  },
  webTrash: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blush,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    padding: 12,
    minHeight: 96,
  },
  itemLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: colors.bg },
  discountBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: colors.terracotta,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2 },
  discountText: { color: colors.onAccent, fontSize: 9, fontWeight: '800' },
  itemInfo: { flex: 1, gap: 3 },
  name: { color: colors.text, fontWeight: '700', fontSize: 14, lineHeight: 18 },
  unit: { color: colors.muted, fontSize: 12 },
  prices: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  price: { color: colors.terracotta, fontWeight: '800', fontSize: 15 },
  oldPrice: {
    color: colors.placeholder,
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'line-through' },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 4 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center' },
  qtyPlus: { backgroundColor: colors.gold },
  qtySign: { color: colors.text, fontWeight: '700', fontSize: 15 },
  qtyVal: { color: colors.text, fontWeight: '800', fontSize: 14, minWidth: 16, textAlign: 'center' },
  promoCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    gap: 12 },
  promoHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center' },
  promoTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    height: 48 },
  promoInput: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  promoApply: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9 },
  promoApplyText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  promoClear: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center' },
  promoChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promoChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.cream },
  promoChipText: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  promoError: { color: colors.terracotta, fontSize: 12, fontWeight: '600' },
  promoOk: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  promoOkText: { color: colors.green, fontSize: 13, fontWeight: '600' },
  inlineSummary: {
    backgroundColor: colors.bg,
    borderRadius: 14,
    padding: 12,
    gap: 8 },
  sumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sumLabel: { color: colors.muted, fontSize: 14 },
  sumVal: { color: colors.text, fontWeight: '600', fontSize: 14 },
  sumValGreen: { color: colors.green } });
}
