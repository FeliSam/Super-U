import { CtaButton, IconCircle, ProductCard, Screen } from '@/components/ui';
import { StarRating } from '@/components/StarRating';
import { colors } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import {
  discoverProducts,
  getProduct,
  mangoHero,
  productReviewStats,
  products,
  shuffleProducts,
  similarProducts,
  type Product,
} from '@/data/catalog';
import { formatFcfa } from '@/lib/format';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
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

function galleryFor(product: Product): ImageSourcePropType[] {
  const main = product.id === 'mangues' ? mangoHero : product.image;
  const extras: ImageSourcePropType[] = [];
  const sameCat = products.filter((p) => p.id !== product.id && p.categoryId === product.categoryId);
  for (const p of sameCat) {
    if (extras.length >= 2) break;
    extras.push(p.image);
  }
  for (const p of products) {
    if (extras.length >= 2) break;
    if (p.id === product.id) continue;
    if (extras.includes(p.image) || p.image === main) continue;
    extras.push(p.image);
  }
  return [main, ...extras];
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = getProduct(id);
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [descOpen, setDescOpen] = useState(true);
  const [nutriOpen, setNutriOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const similar = useMemo(() => similarProducts(id ?? ''), [id]);
  const discoverSeed = useMemo(() => discoverProducts(id ?? ''), [id]);
  const discoverPool = useMemo(() => {
    const exclude = new Set([id, ...similar.map((p) => p.id)]);
    const pool = products.filter((p) => !exclude.has(p.id));
    return shuffleProducts(pool.length ? pool : products.filter((p) => p.id !== id));
  }, [id, similar]);
  const [discoverPages, setDiscoverPages] = useState(1);
  const loadingDiscover = useRef(false);
  const gallery = useMemo(() => (product ? galleryFor(product) : []), [product]);
  const heroWidth = Math.min(windowWidth, 430);

  useEffect(() => {
    setDiscoverPages(1);
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
    setDiscoverPages((pages) => pages + 1);
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
        <Text style={{ padding: 20, color: colors.text }}>Produit introuvable</Text>
      </Screen>
    );
  }

  const total = product.price * qty;
  const unitLabel = product.unit.replace(/^\d+(?:[.,]\d+)?\s*/, '') || 'kg';
  const { rating, reviews } = productReviewStats(product);
  const heroTopPad = 12;

  const onHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / Math.max(heroWidth, 1));
    if (next !== heroIndex) setHeroIndex(next);
  };

  const goToSlide = (index: number) => {
    heroRef.current?.scrollTo({ x: index * heroWidth, animated: true });
    setHeroIndex(index);
  };

  return (
    <Screen>
      <View style={styles.page}>
        <View style={[styles.heroBar, { paddingTop: heroTopPad }]} pointerEvents="box-none">
          <IconCircle name="arrow-left" onPress={() => router.back()} bg="rgba(255,255,255,0.82)" />
          <View style={styles.heroActions}>
            <IconCircle name="share-2" bg="rgba(255,255,255,0.82)" />
            <IconCircle name="heart" bg="rgba(255,255,255,0.82)" />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + Math.max(insets.bottom, 16) }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onMainScroll}
          nestedScrollEnabled>
          <View style={styles.hero}>
            <ScrollView
              ref={heroRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onHeroScroll}
              scrollEventThrottle={16}
              decelerationRate="fast"
              nestedScrollEnabled
              style={styles.heroPager}>
              {gallery.map((src, i) => (
                <Image key={i} source={src} style={[styles.heroImage, { width: heroWidth }]} resizeMode="cover" />
              ))}
            </ScrollView>
            <View style={styles.dots}>
              {gallery.map((_, i) => (
                <Pressable key={i} onPress={() => goToSlide(i)} hitSlop={8}>
                  <View style={[styles.dot, i === heroIndex && styles.dotOn]} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.row}>
              <Text style={styles.producer}>{(product.producer ?? 'Marché Doré').toUpperCase()}</Text>
              <View style={styles.stock}>
                <View style={styles.stockDot} />
                <Text style={styles.stockText}>En stock</Text>
              </View>
            </View>

            <Text style={styles.name}>{product.name}</Text>

            <Pressable
              style={styles.rating}
              onPress={() => router.push(`/product/reviews/${product.id}`)}>
              <StarRating rating={rating} size={14} />
              <Text style={styles.ratingText}>
                {rating.toFixed(1)} ({reviews} avis)
              </Text>
              <Feather name="chevron-right" size={16} color={colors.placeholder} />
            </Pressable>

            <View style={styles.row}>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatFcfa(product.price)}</Text>
                {product.oldPrice ? <Text style={styles.old}>{formatFcfa(product.oldPrice)}</Text> : null}
                <Text style={styles.per}>/ {unitLabel}</Text>
              </View>
              {product.discount ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{product.discount}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.hr} />

            <View style={styles.row}>
              <Text style={styles.h}>Quantité</Text>
              <View style={styles.qty}>
                <Pressable style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                  <Text style={styles.qtySign}>–</Text>
                </Pressable>
                <Text style={styles.qtyVal}>{qty}</Text>
                <Pressable style={[styles.qtyBtn, styles.qtyPlus]} onPress={() => setQty((q) => q + 1)}>
                  <Text style={[styles.qtySign, { color: colors.white }]}>+</Text>
                </Pressable>
              </View>
            </View>

            <View>
              <Pressable style={styles.accHead} onPress={() => setDescOpen((v) => !v)}>
                <Text style={styles.h}>Description</Text>
                <Ionicons name={descOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
              </Pressable>
              {descOpen ? (
                <Text style={styles.desc}>
                  {product.description ??
                    `${product.name} sélectionné pour sa fraîcheur, issu des marchés locaux.`}
                </Text>
              ) : null}
            </View>

            <View style={styles.hr} />

            <View>
              <Pressable style={styles.accHead} onPress={() => setNutriOpen((v) => !v)}>
                <Text style={styles.h}>Informations nutritionnelles</Text>
                <Ionicons name={nutriOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
              </Pressable>
              {nutriOpen ? (
                <View style={styles.nutri}>
                  <NutriRow label="Énergie" value="239 kcal" />
                  <NutriRow label="Protéines" value="27 g" />
                  <NutriRow label="Lipides" value="14 g" />
                </View>
              ) : null}
            </View>

            <View style={styles.similarBlock}>
              <Text style={styles.similarTitle}>Produits similaires</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
                {similar.map((p) => (
                  <ProductCard key={p.id} product={p} width={130} />
                ))}
              </ScrollView>
            </View>

            <Text style={styles.sectionTitle}>À découvrir</Text>
            <View style={styles.grid}>
              {discoverItems.map(({ product: p, key }) => (
                <ProductCard key={key} product={p} width="47.5%" imageHeight={GRID_IMAGE_HEIGHT} compact />
              ))}
            </View>
            <Text style={styles.feedHint}>Faites défiler pour voir plus de produits…</Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <CtaButton
            label={`Ajouter au panier — ${formatFcfa(total)}`}
            onPress={() => {
              add(product.id, qty);
              navigateTab(tabPaths.cart);
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

function NutriRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.nutriRow}>
      <Text style={styles.desc}>{label}</Text>
      <Text style={styles.nutriVal}>{value}</Text>
    </View>
  );
}

const HERO_H = Math.round(432 * 1.15); // ~497
const SHEET_RADIUS = 28;
const GRID_IMAGE_HEIGHT = 173;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1 },
  hero: {
    height: HERO_H,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  heroPager: { flex: 1 },
  heroImage: { height: HERO_H },
  dots: {
    position: 'absolute',
    bottom: SHEET_RADIUS + 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
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
    top: 0,
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
    marginTop: -SHEET_RADIUS,
    zIndex: 2,
    elevation: 8,
    backgroundColor: colors.bg,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
    minHeight: 520,
    ...(Platform.OS === 'web' ? { position: 'relative' as const } : {}),
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  producer: { color: colors.gold, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  stock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  stockText: { color: colors.green, fontWeight: '600', fontSize: 13 },
  name: { color: colors.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: { color: colors.muted, fontWeight: '600', fontSize: 13, flex: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  price: { color: colors.terracotta, fontSize: 24, fontWeight: '800' },
  old: { color: colors.placeholder, fontSize: 14, textDecorationLine: 'line-through' },
  per: { color: colors.muted, fontSize: 14 },
  badge: { backgroundColor: colors.blush, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: colors.terracotta, fontWeight: '700', fontSize: 12 },
  hr: { height: 1, backgroundColor: colors.border, width: '100%' },
  h: { color: colors.text, fontSize: 16, fontWeight: '700' },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 6,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyPlus: { backgroundColor: colors.gold },
  qtySign: { fontSize: 18, fontWeight: '600', color: colors.text },
  qtyVal: { fontWeight: '700', fontSize: 16, color: colors.text, minWidth: 16, textAlign: 'center' },
  accHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  desc: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  nutri: { marginTop: 8, gap: 8 },
  nutriRow: { flexDirection: 'row', justifyContent: 'space-between' },
  nutriVal: { color: colors.text, fontSize: 14, fontWeight: '600' },
  similarBlock: { gap: 16, marginTop: 8 },
  similarTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  similarRow: { gap: 12, paddingRight: 4 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 3,
  },
  feedHint: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: 8,
  },
  footer: {
    zIndex: 5,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
});
