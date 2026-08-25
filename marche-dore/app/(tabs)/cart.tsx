import { AppImage } from '@/components/AppImage';
import { Page, ProductCard, Screen } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { colors, displayFont, tabBarClearance } from '@/constants/theme';
import { CartLine, lineListTotal, lineProduct, lineTotal, useCart } from '@/context/CartContext';
import { chipRoute, getProducts, homeCategories, recommendedIds } from '@/data/catalog';
import { formatFcfa } from '@/lib/format';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const DELETE_WIDTH = 88;
const OPEN_X = -DELETE_WIDTH;
const OVERSWIPE = 28;
const FREE_DELIVERY_THRESHOLD = 15000;
const AUTO_DISCOUNT_THRESHOLD = 10000;
const SUGGESTED_PROMOS = ['FRAIS20', 'MARCHE10', 'SUPERU'] as const;

function SwipeCartItem({
  line,
  onRemove,
  onSetQty,
}: {
  line: CartLine;
  onRemove: () => void;
  onSetQty: (qty: number) => void;
}) {
  const p = lineProduct(line);
  const translateX = useRef(new Animated.Value(0)).current;
  const rowOpacity = useRef(new Animated.Value(1)).current;
  const offset = useRef(0);
  const removing = useRef(false);

  const deleteProgress = translateX.interpolate({
    inputRange: [OPEN_X, OPEN_X / 2, 0],
    outputRange: [1, 0.55, 0],
    extrapolate: 'clamp',
  });
  const deleteScale = translateX.interpolate({
    inputRange: [OPEN_X - OVERSWIPE, OPEN_X, OPEN_X / 2, 0],
    outputRange: [1.18, 1, 0.72, 0.45],
    extrapolate: 'clamp',
  });
  const deleteRotate = translateX.interpolate({
    inputRange: [OPEN_X, 0],
    outputRange: ['0deg', '-18deg'],
    extrapolate: 'clamp',
  });
  const railOpacity = translateX.interpolate({
    inputRange: [OPEN_X, 0],
    outputRange: [1, 0.35],
    extrapolate: 'clamp',
  });
  const itemScale = translateX.interpolate({
    inputRange: [OPEN_X, 0],
    outputRange: [0.985, 1],
    extrapolate: 'clamp',
  });

  const snapTo = (toValue: number) => {
    offset.current = toValue;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 68,
    }).start();
  };

  const animateRemove = () => {
    if (removing.current) return;
    removing.current = true;
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -420,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(rowOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onRemove();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateX.stopAnimation((v) => {
          offset.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        if (removing.current) return;
        const raw = offset.current + g.dx;
        let next = raw;
        if (raw < OPEN_X) {
          const overflow = OPEN_X - raw;
          next = OPEN_X - overflow * 0.35;
        } else if (raw > 0) {
          next = raw * 0.2;
        }
        translateX.setValue(Math.max(OPEN_X - OVERSWIPE, Math.min(12, next)));
      },
      onPanResponderRelease: (_, g) => {
        if (removing.current) return;
        const projected = offset.current + g.dx + g.vx * 40;
        if (projected < OPEN_X - OVERSWIPE * 0.6 || g.vx < -1.1) {
          animateRemove();
          return;
        }
        const open = projected < OPEN_X / 2 || g.vx < -0.35;
        snapTo(open ? OPEN_X : 0);
      },
    }),
  ).current;

  if (!p) return null;

  const total = lineTotal(line);
  const listTotal = lineListTotal(line);
  const hasDiscount = Boolean(p.oldPrice && listTotal > total);

  return (
    <Animated.View style={[styles.swipeWrap, { opacity: rowOpacity }]}>
      <Animated.View style={[styles.deleteRail, { opacity: railOpacity }]}>
        <Pressable style={styles.deleteBtn} onPress={animateRemove}>
          <Animated.View
            style={[
              styles.deleteIconWrap,
              {
                opacity: deleteProgress,
                transform: [{ scale: deleteScale }, { rotate: deleteRotate }],
              },
            ]}>
            <Feather name="trash-2" size={20} color={colors.white} />
          </Animated.View>
          <Animated.Text style={[styles.deleteLabel, { opacity: deleteProgress }]}>Retirer</Animated.Text>
        </Pressable>
      </Animated.View>
      <Animated.View
        style={[styles.item, { transform: [{ translateX }, { scale: itemScale }] }]}
        {...panResponder.panHandlers}>
        <Pressable style={styles.itemLink} onPress={() => router.push(`/product/${p.id}`)}>
          <View style={styles.thumbWrap}>
            <AppImage source={p.image} frameStyle={styles.thumb} />
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
            <Feather name="plus" size={13} color={colors.white} />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function SummaryRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumVal, green && styles.sumValGreen]}>{value}</Text>
    </View>
  );
}

function CartScreen() {
  const {
    lines,
    count,
    setQty,
    remove,
    subtotal,
    listSubtotal,
    delivery,
    discount,
    total,
    applyPromo,
    clearPromo,
    promoCode,
    promoMessage,
  } = useCart();
  const [promo, setPromo] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(true);

  const savings = Math.max(0, listSubtotal - subtotal);
  const freeDeliveryLeft = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const autoDiscountLeft = Math.max(0, AUTO_DISCOUNT_THRESHOLD - subtotal);
  const freeDeliveryProgress = Math.min(1, subtotal / FREE_DELIVERY_THRESHOLD);

  const handleApplyPromo = (code?: string) => {
    const value = code ?? promo;
    if (applyPromo(value)) setPromo('');
  };

  const itemLabel = useMemo(() => {
    if (count === 0) return '0 article';
    return `${count} article${count > 1 ? 's' : ''}`;
  }, [count]);

  const emptySuggestions = useMemo(() => getProducts(recommendedIds).slice(0, 6), []);
  const emptyCategories = useMemo(() => homeCategories.slice(0, 6), []);

  return (
    <Screen>
      <Page style={styles.flex}>
        <LinearGradient colors={['#f8e4c4', colors.cream, colors.bg]} style={styles.hero}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Mon panier</Text>
              {count > 0 ? (
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{count}</Text>
                </View>
              ) : null}
            </View>
            <Pressable style={styles.continueBtn} onPress={() => navigateTab(tabPaths.home)}>
              <Text style={styles.continueText}>Continuer</Text>
              <Feather name="chevron-right" size={14} color={colors.gold} />
            </Pressable>
          </View>
          {count > 0 ? (
            <Text style={styles.heroSub}>{itemLabel} · Total {formatFcfa(total)}</Text>
          ) : (
            <Text style={styles.heroSub}>Ajoutez des produits pour démarrer votre commande.</Text>
          )}
        </LinearGradient>

        {lines.length === 0 ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.emptyScroll}
            showsVerticalScrollIndicator={false}>
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
              <PressScale style={styles.emptyCta} onPress={() => navigateTab(tabPaths.home)} scaleTo={0.97}>
                <LinearGradient
                  colors={['#c84b31', '#a83c26']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyCtaGradient}>
                  <Feather name="compass" size={16} color={colors.white} />
                  <Text style={styles.emptyCtaText}>Découvrir les produits</Text>
                </LinearGradient>
              </PressScale>
              <Pressable style={styles.emptySecondary} onPress={() => navigateTab(tabPaths.search)}>
                <Feather name="search" size={15} color={colors.gold} />
                <Text style={styles.emptySecondaryText}>Rechercher un produit</Text>
              </Pressable>
            </MotionView>

            <View style={styles.emptyPerks}>
              <View style={styles.emptyPerk}>
                <Feather name="truck" size={15} color={colors.gold} />
                <Text style={styles.emptyPerkText}>Livraison rapide</Text>
              </View>
              <View style={styles.emptyPerk}>
                <Feather name="shield" size={15} color={colors.green} />
                <Text style={styles.emptyPerkText}>Qualité garantie</Text>
              </View>
              <View style={styles.emptyPerk}>
                <Feather name="refresh-cw" size={15} color={colors.terracotta} />
                <Text style={styles.emptyPerkText}>Frais du jour</Text>
              </View>
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
                  <Pressable
                    key={cat.id}
                    style={styles.emptyCat}
                    onPress={() => router.push(chipRoute(cat))}>
                    <AppImage source={cat.image} frameStyle={styles.emptyCatImg} />
                    <Text style={styles.emptyCatLabel} numberOfLines={1}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.emptySection}>
              <View style={styles.emptySectionHead}>
                <Text style={styles.emptySectionTitle}>Idées pour démarrer</Text>
                <Text style={styles.emptySectionMeta}>Sélection du jour</Text>
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
          </ScrollView>
        ) : (
          <View style={styles.flex}>
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <View style={styles.bodySheet}>
                <Pressable style={styles.deliveryCard} onPress={() => router.push('/checkout')}>
                  <View style={styles.deliveryIcon}>
                    <Feather name="map-pin" size={17} color={colors.gold} />
                  </View>
                  <View style={styles.deliveryText}>
                    <Text style={styles.deliveryLabel}>Livraison à</Text>
                    <Text style={styles.deliveryAddress}>Rue 23, Dakar Plateau</Text>
                    <Text style={styles.deliveryEta}>Demain, 14h – 16h · {formatFcfa(delivery)}</Text>
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

                {!promoCode && autoDiscountLeft > 0 ? (
                  <View style={styles.progressCard}>
                    <View style={styles.progressHead}>
                      <Feather name="gift" size={14} color={colors.gold} />
                      <Text style={styles.progressTitle}>
                        Plus que {formatFcfa(autoDiscountLeft)} pour −{formatFcfa(2000)}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.min(1, subtotal / AUTO_DISCOUNT_THRESHOLD) * 100}%` },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}

                {freeDeliveryLeft > 0 ? (
                  <View style={styles.progressCard}>
                    <View style={styles.progressHead}>
                      <Feather name="truck" size={14} color={colors.green} />
                      <Text style={styles.progressTitle}>
                        Livraison offerte dès {formatFcfa(FREE_DELIVERY_THRESHOLD)}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFillGreen, { width: `${freeDeliveryProgress * 100}%` }]} />
                    </View>
                    <Text style={styles.progressSub}>Encore {formatFcfa(freeDeliveryLeft)}</Text>
                  </View>
                ) : null}

                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Vos articles</Text>
                  <Text style={styles.sectionMeta}>{itemLabel}</Text>
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

                <Text style={styles.swipeHint}>Glissez un article vers la gauche pour le retirer</Text>

                <View style={styles.promoCard}>
                  <View style={styles.promoHead}>
                    <View style={styles.promoIcon}>
                      <Feather name="tag" size={16} color={colors.gold} />
                    </View>
                    <Text style={styles.promoTitle}>Code promo</Text>
                  </View>
                  <View style={styles.promoRow}>
                    <TextInput
                      placeholder="Ex. FRAIS20"
                      placeholderTextColor={colors.placeholder}
                      value={promoCode ?? promo}
                      editable={!promoCode}
                      onChangeText={setPromo}
                      onSubmitEditing={() => handleApplyPromo()}
                      returnKeyType="done"
                      autoCapitalize="characters"
                      style={styles.promoInput}
                    />
                    {promoCode ? (
                      <Pressable style={styles.promoClear} onPress={clearPromo}>
                        <Feather name="x" size={15} color={colors.text} />
                      </Pressable>
                    ) : (
                      <Pressable style={styles.promoApply} onPress={() => handleApplyPromo()}>
                        <Text style={styles.promoApplyText}>Appliquer</Text>
                      </Pressable>
                    )}
                  </View>
                  {!promoCode ? (
                    <View style={styles.promoChips}>
                      {SUGGESTED_PROMOS.map((code) => (
                        <Pressable key={code} style={styles.promoChip} onPress={() => handleApplyPromo(code)}>
                          <Text style={styles.promoChipText}>{code}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {promoMessage ? <Text style={styles.promoError}>{promoMessage}</Text> : null}
                  {promoCode ? (
                    <View style={styles.promoOk}>
                      <Feather name="check-circle" size={14} color={colors.green} />
                      <Text style={styles.promoOkText}>
                        {promoCode} appliqué · −{formatFcfa(discount)}
                      </Text>
                    </View>
                  ) : null}
                </View>

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
              </View>
            </ScrollView>

            <View style={styles.checkoutBar}>
              <Pressable style={styles.checkoutSummary} onPress={() => setSummaryOpen((v) => !v)}>
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
                  <Feather name={summaryOpen ? 'chevron-down' : 'chevron-up'} size={15} color={colors.muted} />
                </View>
              </Pressable>
              <Pressable style={styles.checkoutBtn} onPress={() => router.push('/checkout')}>
                <LinearGradient
                  colors={['#e2931d', '#c98412']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.checkoutGradient}>
                  <Text style={styles.checkoutBtnText}>Commander</Text>
                  <Feather name="arrow-right" size={17} color={colors.white} />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}
      </Page>
    </Screen>
  );
}

export default memo(CartScreen);

const CHECKOUT_BAR_HEIGHT = 124;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: colors.text, fontSize: 28, letterSpacing: -0.4, ...displayFont('800') },
  countPill: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countPillText: { color: colors.gold, fontSize: 13, fontWeight: '800' },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  continueText: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  heroSub: { color: colors.muted, fontSize: 13, fontWeight: '500', marginTop: 8 },
  bodySheet: {
    marginTop: -14,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 12,
  },
  content: {
    paddingBottom: CHECKOUT_BAR_HEIGHT + tabBarClearance,
  },
  emptyScroll: {
    paddingBottom: tabBarClearance + 24,
    gap: 18,
  },
  emptyHeroCard: {
    marginHorizontal: 20,
    marginTop: -8,
    backgroundColor: colors.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 10,
  },
  emptyArt: {
    width: 160,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyBlobA: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: colors.cream,
    top: 0,
    left: 8,
  },
  emptyBlobB: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.blush,
    right: 6,
    bottom: 8,
  },
  emptyIconRing: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
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
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
  },
  emptyBadgeText: { color: colors.gold, fontSize: 11, fontWeight: '800' },
  emptyTitle: {
    color: colors.text,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 30,
    ...displayFont('800'),
  },
  emptySub: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 4,
    maxWidth: 300,
  },
  emptyCta: {
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  emptyCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    minHeight: 52,
  },
  emptyCtaText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  emptySecondary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  emptySecondaryText: { color: colors.gold, fontSize: 14, fontWeight: '600' },
  emptyPerks: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyPerk: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  emptyPerkText: { color: colors.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  emptySection: { gap: 12 },
  emptySectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  emptySectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  emptySectionLink: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  emptySectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  emptyCatsRow: { gap: 12, paddingHorizontal: 20 },
  emptyCat: { width: 76, alignItems: 'center', gap: 8 },
  emptyCatImg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  emptyCatLabel: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  emptyProductsRow: { gap: 12, paddingHorizontal: 20, paddingBottom: 4 },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  deliveryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryText: { flex: 1, gap: 2 },
  deliveryLabel: {
    color: colors.placeholder,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  deliveryAddress: { color: colors.text, fontSize: 15, fontWeight: '700' },
  deliveryEta: { color: colors.muted, fontSize: 12 },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#edf7ef',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  savingsText: { color: colors.green, fontSize: 13, fontWeight: '600', flex: 1 },
  progressCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 13,
    gap: 8,
  },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTitle: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.gold },
  progressFillGreen: { height: '100%', borderRadius: 3, backgroundColor: colors.green },
  progressSub: { color: colors.muted, fontSize: 11, fontWeight: '500' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  itemsCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  itemDivider: { height: 1, backgroundColor: colors.border, marginLeft: 96 },
  swipeHint: {
    color: colors.placeholder,
    fontSize: 11,
    textAlign: 'center',
    marginTop: -2,
  },
  swipeWrap: {
    backgroundColor: colors.terracotta,
    overflow: 'hidden',
  },
  deleteRail: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 18,
  },
  deleteBtn: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  deleteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: { color: colors.white, fontSize: 10, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    padding: 12,
  },
  itemLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: colors.bg },
  discountBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: colors.terracotta,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  discountText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  itemInfo: { flex: 1, gap: 3 },
  name: { color: colors.text, fontWeight: '700', fontSize: 14, lineHeight: 18 },
  unit: { color: colors.muted, fontSize: 12 },
  prices: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  price: { color: colors.terracotta, fontWeight: '800', fontSize: 15 },
  oldPrice: {
    color: colors.placeholder,
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyPlus: { backgroundColor: colors.gold, borderColor: colors.gold },
  qtySign: { color: colors.text, fontWeight: '700', fontSize: 15 },
  qtyVal: { color: colors.text, fontWeight: '800', fontSize: 14, minWidth: 16, textAlign: 'center' },
  promoCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  promoHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 14,
    paddingRight: 6,
    height: 48,
  },
  promoInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  promoApply: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  promoApplyText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  promoClear: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promoChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.cream,
  },
  promoChipText: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  promoError: { color: colors.terracotta, fontSize: 12, fontWeight: '600' },
  promoOk: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  promoOkText: { color: colors.green, fontSize: 13, fontWeight: '600' },
  inlineSummary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  sumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sumLabel: { color: colors.muted, fontSize: 14 },
  sumVal: { color: colors.text, fontWeight: '600', fontSize: 14 },
  sumValGreen: { color: colors.green },
  checkoutBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: tabBarClearance - 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  checkoutSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkoutLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  checkoutTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  checkoutTotal: { color: colors.text, fontSize: 22, fontWeight: '800' },
  checkoutOld: {
    color: colors.placeholder,
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  checkoutToggle: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  checkoutToggleText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  checkoutBtn: { borderRadius: 14, overflow: 'hidden' },
  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  checkoutBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
