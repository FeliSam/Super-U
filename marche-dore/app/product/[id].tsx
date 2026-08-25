import { CartTotalFab, IconCircle, Page, ProductCard, Screen } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { ImagePager, type ImagePagerHandle } from '@/components/ImagePager';
import { StarRating } from '@/components/StarRating';
import { colors, displayFont } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import {
  discoverProducts,
  getProduct,
  productGallery,
  productReviewStats,
  products,
  shuffleProducts,
  similarProducts,
  type Product,
} from '@/data/catalog';
import { formatFcfa } from '@/lib/format';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function NutriRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.nutriRow}>
      <Text style={styles.nutriLabel}>{label}</Text>
      <Text style={styles.nutriVal}>{value}</Text>
    </View>
  );
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = getProduct(id);
  const insets = useSafeAreaInsets();
  const { add, setQty: setCartQty, lines } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const liked = isFavorite(id ?? '');
  const [descOpen, setDescOpen] = useState(true);
  const [nutriOpen, setNutriOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroPagerRef = useRef<ImagePagerHandle>(null);
  const { width: windowWidth } = useWindowDimensions();
  const cartQty = lines.find((l) => l.productId === id)?.qty ?? 0;
  const inCart = cartQty > 0;
  const similar = useMemo(() => similarProducts(id ?? ''), [id]);
  const discoverSeed = useMemo(() => discoverProducts(id ?? ''), [id]);
  const discoverPool = useMemo(() => {
    const exclude = new Set([id, ...similar.map((p) => p.id)]);
    const pool = products.filter((p) => !exclude.has(p.id));
    return shuffleProducts(pool.length ? pool : products.filter((p) => p.id !== id));
  }, [id, similar]);
  const [discoverPages, setDiscoverPages] = useState(1);
  const loadingDiscover = useRef(false);
  const gallery = useMemo(() => (product ? productGallery(product) : []), [product]);
  const heroWidth = Math.min(windowWidth, 430);

  useEffect(() => {
    setDiscoverPages(1);
    setHeroIndex(0);
  }, [id]);

  const discoverItems = useMemo(() => {
    const items: { product: Product; key: string }[] = [];
    discoverSeed.forEach((p) => {
      items.push({ product: p, key: `seed-${p.id}` });
    });
    for (let page = 0; page < discoverPages; page++) {
      discoverPool.forEach((p, index) => {
        items.push({ product: p, key: `${p.id}-d${page}-${index}` });
      });
    }
    return items;
  }, [discoverPages, discoverPool, discoverSeed]);

  const loadMoreDiscover = useCallback(() => {
    setDiscoverPages((pages) => Math.min(pages + 1, 3));
  }, []);

  const onMainScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 320;
      if (!nearBottom || loadingDiscover.current) return;
      loadingDiscover.current = true;
      loadMoreDiscover();
      requestAnimationFrame(() => {
        loadingDiscover.current = false;
      });
    },
    [loadMoreDiscover],
  );

  if (!product) {
    return (
      <Screen>
        <Page style={styles.page} edgeToEdge>
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>Produit introuvable</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.missingLink}>Retour</Text>
            </Pressable>
          </View>
        </Page>
      </Screen>
    );
  }

  const activeQty = inCart ? cartQty : 1;
  const total = product.price * activeQty;
  const listTotal = (product.oldPrice ?? product.price) * activeQty;
  const showCompare = listTotal > total;
  const unitLabel = product.unit.replace(/^\d+(?:[.,]\d+)?\s*/, '') || 'kg';
  const { rating, reviews } = productReviewStats(product);
  const savings = product.oldPrice ? Math.max(0, product.oldPrice - product.price) : 0;

  const bumpQty = (next: number) => {
    if (!product) return;
    if (inCart) {
      setCartQty(product.id, next);
      return;
    }
    if (next >= 1) add(product.id, 1);
  };

  const addToCart = () => {
    if (!product || inCart) return;
    add(product.id, 1);
  };

  const goToSlide = (index: number) => {
    heroPagerRef.current?.goTo(index);
    setHeroIndex(index);
  };

  return (
    <Screen>
      <Page style={styles.page} edgeToEdge>
        <View style={[styles.heroBar, { top: insets.top + 8, pointerEvents: 'box-none' }]}>
          <IconCircle name="arrow-left" onPress={() => router.back()} bg="rgba(255,255,255,0.9)" />
          <View style={styles.heroActions}>
            <IconCircle name="share-2" bg="rgba(255,255,255,0.9)" />
            <IconCircle
              name="heart"
              bg="rgba(255,255,255,0.9)"
              color={liked ? colors.terracotta : colors.text}
              onPress={() => id && toggle(id)}
            />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onMainScroll}
          bounces>
          <View style={styles.heroBand}>
            <ImagePager
              ref={heroPagerRef}
              images={gallery}
              width={heroWidth}
              height={HERO_H}
              recyclingKeyPrefix={`product-${product.id}`}
              onIndexChange={setHeroIndex}
            />
            {product.discount ? (
              <View style={[styles.heroDiscount, { top: insets.top + 52, pointerEvents: 'none' }]}>
                <Text style={styles.heroDiscountText}>{product.discount}</Text>
              </View>
            ) : null}
            <View style={[styles.dots, { pointerEvents: 'box-none' }]}>
              {gallery.map((_, i) => (
                <Pressable key={i} onPress={() => goToSlide(i)} hitSlop={8}>
                  <View style={[styles.dot, i === heroIndex && styles.dotOn]} />
                </Pressable>
              ))}
            </View>
          </View>

          <MotionView preset="up" delay={60} style={styles.body}>
            <View style={styles.sheetHandle}>
              <View style={styles.sheetHandleBar} />
            </View>
            <View style={styles.brandRow}>
              <View style={styles.brandPill}>
                <Feather name="sun" size={12} color={colors.gold} />
                <Text style={styles.producer}>{(product.producer ?? 'Marché Doré').toUpperCase()}</Text>
              </View>
              <View style={styles.stock}>
                <View style={styles.stockDot} />
                <Text style={styles.stockText}>En stock</Text>
              </View>
            </View>

            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.unitLine}>{product.unit}</Text>

            <Pressable
              style={styles.ratingCard}
              onPress={() => router.push(`/product/reviews/${product.id}`)}>
              <StarRating rating={rating} size={15} />
              <Text style={styles.ratingText}>
                {rating.toFixed(1)} · {reviews} avis
              </Text>
              <Feather name="chevron-right" size={16} color={colors.placeholder} />
            </Pressable>

            <View style={styles.priceCard}>
              <View style={styles.priceMain}>
                <Text style={styles.price}>{formatFcfa(product.price)}</Text>
                <Text style={styles.per}>/ {unitLabel}</Text>
              </View>
              <View style={styles.priceMeta}>
                {product.oldPrice ? (
                  <Text style={styles.old}>{formatFcfa(product.oldPrice)}</Text>
                ) : null}
                {product.discount ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{product.discount}</Text>
                  </View>
                ) : null}
              </View>
              {savings > 0 ? (
                <Text style={styles.savings}>Vous économisez {formatFcfa(savings)} / unité</Text>
              ) : null}
            </View>

            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                <Feather name="truck" size={15} color={colors.gold} />
                <Text style={styles.trustText}>Livraison rapide</Text>
              </View>
              <View style={styles.trustItem}>
                <Feather name="shield" size={15} color={colors.green} />
                <Text style={styles.trustText}>Qualité garantie</Text>
              </View>
              <View style={styles.trustItem}>
                <Feather name="refresh-cw" size={15} color={colors.terracotta} />
                <Text style={styles.trustText}>Frais du jour</Text>
              </View>
            </View>

            <View style={styles.qtyCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.qtyLabel}>Quantité</Text>
                <Text style={styles.qtySub}>
                  {inCart ? 'Dans le panier · ' : 'Prix · '}
                  {formatFcfa(total)}
                  {showCompare ? `  ` : ''}
                </Text>
                {showCompare ? <Text style={styles.qtyOld}>{formatFcfa(listTotal)}</Text> : null}
              </View>
              {inCart ? (
                <View style={styles.qty}>
                  <Pressable style={styles.qtyBtn} onPress={() => bumpQty(cartQty - 1)} hitSlop={8}>
                    <Text style={styles.qtySign}>–</Text>
                  </Pressable>
                  <Text style={styles.qtyVal}>{cartQty}</Text>
                  <Pressable style={[styles.qtyBtn, styles.qtyPlus]} onPress={() => bumpQty(cartQty + 1)} hitSlop={8}>
                    <Feather name="plus" size={16} color={colors.white} />
                  </Pressable>
                </View>
              ) : (
                <PressScale style={styles.addInline} onPress={() => bumpQty(1)} scaleTo={0.96}>
                  <Feather name="shopping-bag" size={15} color={colors.white} />
                  <Text style={styles.addInlineText}>Ajouter</Text>
                </PressScale>
              )}
            </View>

            <View style={styles.accordion}>
              <Pressable style={styles.accHead} onPress={() => setDescOpen((v) => !v)}>
                <View style={styles.accLeft}>
                  <Feather name="file-text" size={16} color={colors.gold} />
                  <Text style={styles.accTitle}>Description</Text>
                </View>
                <Feather name={descOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </Pressable>
              {descOpen ? (
                <Text style={styles.desc}>
                  {product.description ??
                    `${product.name} sélectionné pour sa fraîcheur, issu des marchés locaux.`}
                </Text>
              ) : null}
            </View>

            <View style={styles.accordion}>
              <Pressable style={styles.accHead} onPress={() => setNutriOpen((v) => !v)}>
                <View style={styles.accLeft}>
                  <Feather name="activity" size={16} color={colors.gold} />
                  <Text style={styles.accTitle}>Informations nutritionnelles</Text>
                </View>
                <Feather name={nutriOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </Pressable>
              {nutriOpen ? (
                <View style={styles.nutri}>
                  <NutriRow label="Énergie" value="239 kcal" />
                  <NutriRow label="Protéines" value="27 g" />
                  <NutriRow label="Lipides" value="14 g" />
                  <NutriRow label="Glucides" value="8 g" />
                </View>
              ) : null}
            </View>

            {similar.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Produits similaires</Text>
                  <Text style={styles.sectionMeta}>{similar.length} suggestions</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
                  {similar.map((p) => (
                    <ProductCard key={p.id} product={p} width={140} imageHeight={120} compact />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>À découvrir</Text>
                <Text style={styles.sectionMeta}>Pour vous</Text>
              </View>
              <View style={styles.grid}>
                {discoverItems.map(({ product: p, key }, i) => (
                  <ProductCard
                    key={key}
                    product={p}
                    width="47.5%"
                    imageHeight={GRID_IMAGE_HEIGHT}
                    compact
                    index={i}
                    animate={i < 8}
                  />
                ))}
              </View>
              <Text style={styles.feedHint}>Faites défiler pour voir plus de produits…</Text>
            </View>
          </MotionView>
        </ScrollView>

        <CartTotalFab bottom={Math.max(96, insets.bottom + 88)} />

        <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom + 8) }]}>
          {inCart ? (
            <>
              <View style={styles.footerMeta}>
                <Text style={styles.footerLabel}>Dans le panier</Text>
                <View style={styles.footerPrices}>
                  <Text style={styles.footerTotal}>{formatFcfa(total)}</Text>
                  {showCompare ? <Text style={styles.footerOld}>{formatFcfa(listTotal)}</Text> : null}
                </View>
              </View>
              <View style={styles.footerActions}>
                <View style={styles.footerQty}>
                  <Pressable style={styles.footerQtyBtn} onPress={() => bumpQty(cartQty - 1)} hitSlop={8}>
                    <Text style={styles.footerQtySign}>–</Text>
                  </Pressable>
                  <Text style={styles.footerQtyVal}>{cartQty}</Text>
                  <Pressable
                    style={[styles.footerQtyBtn, styles.footerQtyPlus]}
                    onPress={() => bumpQty(cartQty + 1)}
                    hitSlop={8}>
                    <Feather name="plus" size={14} color={colors.white} />
                  </Pressable>
                </View>
                <Pressable style={styles.cta} onPress={() => navigateTab(tabPaths.cart)}>
                  <LinearGradient
                    colors={['#c84b31', '#a83c26']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaGradient}>
                    <Feather name="shopping-bag" size={17} color={colors.white} />
                    <Text style={styles.ctaText} numberOfLines={1}>
                      Voir le panier
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable style={styles.cta} onPress={addToCart}>
              <LinearGradient
                colors={['#c84b31', '#a83c26']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}>
                <Feather name="shopping-bag" size={17} color={colors.white} />
                <Text style={styles.ctaText}>Ajouter au panier</Text>
                <View style={styles.ctaPrices}>
                  <Text style={styles.ctaPrice}>{formatFcfa(total)}</Text>
                  {showCompare ? <Text style={styles.ctaOld}>{formatFcfa(listTotal)}</Text> : null}
                </View>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </Page>
    </Screen>
  );
}

const HERO_H = Math.round(432 * 1.08);
const SHEET_RADIUS = 28;
const SHEET_OVERLAP = 88;
const GRID_IMAGE_HEIGHT = 168;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: { flexGrow: 1, paddingBottom: 120 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  missingLink: { color: colors.gold, fontSize: 15, fontWeight: '700' },
  heroBand: {
    height: HERO_H,
    overflow: 'hidden',
    backgroundColor: colors.border,
    zIndex: 0,
  },
  heroDiscount: {
    position: 'absolute',
    left: 20,
    backgroundColor: colors.terracotta,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 1,
  },
  heroDiscountText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  dots: {
    position: 'absolute',
    bottom: SHEET_OVERLAP + 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotOn: {
    backgroundColor: colors.white,
    width: 18,
  },
  heroBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
  heroActions: { flexDirection: 'row', gap: 8 },
  body: {
    marginTop: -SHEET_OVERLAP,
    zIndex: 4,
    elevation: Platform.OS === 'web' ? undefined : 16,
    backgroundColor: colors.white,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 14,
    minHeight: 480,
    position: 'relative' as const,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -10px 28px rgba(28, 22, 19, 0.16)' }
      : {
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.14,
          shadowRadius: 18,
        }),
  },
  sheetHandle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginBottom: 2,
  },
  sheetHandleBar: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d9d0c7',
  },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cream,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  producer: { color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  stock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#edf7ef',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stockDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  stockText: { color: colors.green, fontWeight: '700', fontSize: 12 },
  name: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    ...displayFont('800'),
  },
  unitLine: { color: colors.muted, fontSize: 14, fontWeight: '500', marginTop: -6 },
  ratingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ratingText: { color: colors.muted, fontWeight: '600', fontSize: 13, flex: 1 },
  priceCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  priceMain: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  price: { color: colors.terracotta, fontSize: 28, fontWeight: '800' },
  per: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  priceMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  old: { color: colors.placeholder, fontSize: 14, textDecorationLine: 'line-through', fontWeight: '500' },
  badge: { backgroundColor: colors.blush, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: colors.terracotta, fontWeight: '800', fontSize: 12 },
  savings: { color: colors.green, fontSize: 12, fontWeight: '600', marginTop: 2 },
  trustRow: { flexDirection: 'row', gap: 8 },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  trustText: { color: colors.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  qtyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  qtyLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  qtySub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  qtyOld: {
    color: colors.placeholder,
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: 14,
    padding: 4,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyPlus: { backgroundColor: colors.gold, borderColor: colors.gold },
  qtySign: { fontSize: 18, fontWeight: '700', color: colors.text },
  qtyVal: { fontWeight: '800', fontSize: 16, color: colors.text, minWidth: 18, textAlign: 'center' },
  addInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addInlineText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  accordion: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  accHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  desc: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  nutri: { gap: 8, paddingTop: 4 },
  nutriRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nutriLabel: { color: colors.muted, fontSize: 13 },
  nutriVal: { color: colors.text, fontSize: 13, fontWeight: '700' },
  section: { gap: 12, marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { color: colors.text, fontSize: 18, ...displayFont('700') },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  similarRow: { gap: 12, paddingRight: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  feedHint: {
    color: colors.placeholder,
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 4,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  footerMeta: { minWidth: 64, flexShrink: 1 },
  footerLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  footerPrices: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  footerTotal: { color: colors.text, fontSize: 16, fontWeight: '800' },
  footerOld: {
    color: colors.placeholder,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  footerActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  footerQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    flexShrink: 0,
  },
  footerQtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerQtyPlus: { backgroundColor: colors.gold, borderColor: colors.gold },
  footerQtySign: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 18 },
  footerQtyVal: {
    minWidth: 20,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
    color: colors.text,
  },
  cta: { flex: 1, borderRadius: 16, overflow: 'hidden', minWidth: 0 },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 12,
    minHeight: 52,
  },
  ctaText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
    letterSpacing: 0.1,
  },
  ctaPrices: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaPrice: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  ctaOld: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
});
