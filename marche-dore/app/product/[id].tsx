import { CartTotalFab, IconCircle, Page, ProductCard, Screen, SmartNavbar } from '@/components/ui';
import { PressScale } from '@/components/motion';
import { ImagePager, type ImagePagerHandle } from '@/components/ImagePager';
import { ImageViewer } from '@/components/ImageViewer';
import { AppImage } from '@/components/AppImage';
import { StarRating } from '@/components/StarRating';
import { displayFont, type AppColors, spacing } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useCatalog } from '@/context/CatalogContext';
import { useCart } from '@/context/CartContext';
import { useFavoriteId } from '@/context/FavoritesContext';
import { useOrders } from '@/context/OrdersContext';
import { useReviews } from '@/context/ReviewsContext';
import { useStores } from '@/context/StoresContext';
import {
  discoverProducts,
  liveReviewStats,
  productAvailableQty,
  productFamilyName,
  productGallery,
  productVariants,
  similarProducts,
  type Product,
} from '@/data/catalog';
import { formatFcfa } from '@/lib/format';
import { softShadow } from '@/lib/shadow';
import { useExpandableSheet, SHEET_MIN_RATIO } from '@/lib/expandableSheet';
import { goBack, navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  InteractionManager,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureRoot } from '@/components/GestureRoot';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GRID_IMAGE_HEIGHT = 168;
/** Sheet top radius — photo tucks under the rounded edge so there is no gap. */
const SHEET_IMAGE_OVERLAP = 28;

function NutriRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.nutriRow}>
      <Text style={styles.nutriLabel}>{label}</Text>
      <Text style={styles.nutriVal}>{value}</Text>
    </View>
  );
}
export default function ProductScreen() {
  const { version: catalogVersion, getProduct, products } = useCatalog();
  const { selectedStore } = useStores();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = Array.isArray(id) ? id[0] : id;
  const variants = useMemo(() => productVariants(routeId ?? ''), [routeId, catalogVersion]);
  const [selectedId, setSelectedId] = useState(routeId);
  const product = getProduct(selectedId ?? '') ?? getProduct(routeId ?? '');
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const {
    sheetMin,
    sheetMax,
    sheetAnimStyle,
    sheetHandleGesture,
    sheetScrollGesture,
    sheetScrollRef,
    listScrollEnabled,
    onSheetScroll,
    onSheetScrollBeginDrag,
    onSheetScrollEndDrag,
    onFiltersScroll,
    onSheetWheel,
  } = useExpandableSheet({
    minRatio: SHEET_MIN_RATIO * 0.7,
    lockCollapseToHandle: true,
  });
  const { add, setQty: setCartQty, lines, count: cartCount, subtotal: cartSubtotal, listSubtotal: cartListSubtotal } =
    useCart();
  const { liked, toggle } = useFavoriteId(product?.id ?? routeId ?? '');
  const { reviewsForProduct, hasUserReviewedProduct } = useReviews();
  const { orders } = useOrders();
  const [descOpen, setDescOpen] = useState(true);
  const [nutriOpen, setNutriOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const [cartFlyHold, setCartFlyHold] = useState(false);
  const [flyText, setFlyText] = useState<string | null>(null);
  const [fabPulse, setFabPulse] = useState(0);
  const heroPagerRef = useRef<ImagePagerHandle>(null);
  const ctaPriceRef = useRef<View>(null);
  const fabAnchorRef = useRef<View>(null);
  const flyHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyX = useSharedValue(0);
  const flyY = useSharedValue(0);
  const flyOp = useSharedValue(0);
  const flyScale = useSharedValue(1);
  const ctaSlotL = useSharedValue(0);
  const ctaSlotP = useSharedValue(0);
  const ctaSlotO = useSharedValue(0);
  const flyBusy = useRef(false);
  const flyAnimStyle = useAnimatedStyle(() => ({
    opacity: flyOp.value,
    transform: [
      { translateX: flyX.value - 44 },
      { translateY: flyY.value - 14 },
      { scale: flyScale.value },
    ],
  }));
  const ctaLeftStyle = useAnimatedStyle(() => ({
    opacity: ctaSlotL.value,
    transform: [{ translateY: (1 - ctaSlotL.value) * 12 }],
  }));
  const ctaPriceSlotStyle = useAnimatedStyle(() => ({
    opacity: ctaSlotP.value,
    transform: [{ translateY: (1 - ctaSlotP.value) * 12 }],
  }));
  const ctaOldSlotStyle = useAnimatedStyle(() => ({
    opacity: ctaSlotO.value,
    transform: [{ translateY: (1 - ctaSlotO.value) * 10 }],
  }));
  const cartQty = lines.find((l) => l.productId === product?.id)?.qty ?? 0;
  const inCart = cartQty > 0;

  const playCtaSlots = useCallback(() => {
    ctaSlotL.value = withSpring(1, { damping: 16, stiffness: 220 });
    ctaSlotP.value = withDelay(90, withSpring(1, { damping: 16, stiffness: 220 }));
    ctaSlotO.value = withDelay(180, withSpring(1, { damping: 16, stiffness: 220 }));
  }, [ctaSlotL, ctaSlotO, ctaSlotP]);

  useEffect(() => {
    if (!product?.id || inCart) {
      ctaSlotL.value = 1;
      ctaSlotP.value = 1;
      ctaSlotO.value = 1;
      return;
    }
    ctaSlotL.value = 0;
    ctaSlotP.value = 0;
    ctaSlotO.value = 0;
    let cancelled = false;
    const measureView = (node: View | null) =>
      new Promise<{ x: number; y: number; w: number; h: number } | null>((resolve) => {
        if (!node) {
          resolve(null);
          return;
        }
        node.measureInWindow((x, y, w, h) => {
          resolve(w > 0 || h > 0 ? { x, y, w, h } : null);
        });
      });
    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled || flyBusy.current) {
          playCtaSlots();
          return;
        }
        const from = await measureView(fabAnchorRef.current);
        const to = await measureView(ctaPriceRef.current);
        if (cancelled || flyBusy.current) {
          playCtaSlots();
          return;
        }
        if (from && to && cartSubtotal > 0) {
          const ease = Easing.bezier(0.22, 1, 0.32, 1);
          flyX.value = from.x + from.w / 2;
          flyY.value = from.y + from.h / 2;
          flyScale.value = 1;
          flyOp.value = 1;
          setFlyText(formatFcfa(cartSubtotal));
          flyX.value = withTiming(to.x + to.w / 2, { duration: 560, easing: ease });
          flyY.value = withTiming(to.y + to.h / 2, { duration: 560, easing: ease });
          flyScale.value = withTiming(0.88, { duration: 560, easing: ease });
          flyOp.value = withDelay(470, withTiming(0, { duration: 140 }));
          setTimeout(() => {
            if (!cancelled) {
              setFlyText(null);
              playCtaSlots();
            }
          }, 560);
          return;
        }
        playCtaSlots();
      })();
    }, 360);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [product?.id, inCart, playCtaSlots]);
  const similar = useMemo(() => similarProducts(product?.id ?? routeId ?? ''), [product?.id, routeId, catalogVersion]);
  const discoverSeed = useMemo(
    () => discoverProducts(product?.id ?? routeId ?? '', 8),
    [product?.id, routeId, catalogVersion],
  );
  const extraDiscover = useMemo(() => {
    const currentId = product?.id ?? routeId ?? '';
    const exclude = new Set([
      currentId,
      ...variants.map((p) => p.id),
      ...similar.map((p) => p.id),
      ...discoverSeed.map((p) => p.id),
    ]);
    const out: Product[] = [];
    const n = products.length;
    if (!n) return out;
    const start = Math.floor(Math.random() * n);
    for (let i = 0; i < n && out.length < 18; i++) {
      const p = products[(start + i) % n];
      if (!exclude.has(p.id)) out.push(p);
    }
    return out;
  }, [product?.id, routeId, similar, variants, discoverSeed, catalogVersion]);
  const [discoverPages, setDiscoverPages] = useState(0);
  const [feedReady, setFeedReady] = useState(false);
  const loadingDiscover = useRef(false);
  const gallery = useMemo(
    () => (product ? productGallery(product, 4) : []),
    [product, catalogVersion],
  );
  const heroWidth = Math.min(windowWidth, 430);
  const ctaScale = useSharedValue(1);
  const ctaAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));
  const [viewerOpen, setViewerOpen] = useState(false);
  const heroHeight = Math.max(320, windowHeight - sheetMin + SHEET_IMAGE_OVERLAP);
  const dotsBottom = SHEET_IMAGE_OVERLAP + 12;

  useEffect(() => {
    setSelectedId(routeId);
    setDiscoverPages(0);
    setFeedReady(false);
    setHeroIndex(0);
    setJustAdded(false);
    setCartFlyHold(false);
    setFlyText(null);
    flyBusy.current = false;
    flyOp.value = 0;
    ctaSlotL.value = 0;
    ctaSlotP.value = 0;
    ctaSlotO.value = 0;
    const task = InteractionManager.runAfterInteractions(() => setFeedReady(true));
    return () => task.cancel();
  }, [routeId]);

  const discoverItems = useMemo(() => {
    if (!feedReady) return [];
    const extra = extraDiscover.slice(0, 6 + discoverPages * 6);
    return [...discoverSeed, ...extra].map((p, i) => ({ product: p, key: `${p.id}-${i}` }));
  }, [discoverPages, extraDiscover, discoverSeed, feedReady]);

  const loadMoreDiscover = useCallback(() => {
    setDiscoverPages((pages) => Math.min(pages + 1, 2));
  }, []);

  const onProductScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onSheetScroll(event);
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 320;
      if (!nearBottom || loadingDiscover.current) return;
      loadingDiscover.current = true;
      loadMoreDiscover();
      requestAnimationFrame(() => {
        loadingDiscover.current = false;
      });
    },
    [loadMoreDiscover, onSheetScroll],
  );

  const shareProduct = useCallback(async () => {
    if (!product) return;
    const url = Linking.createURL(`/product/${product.id}`);
    const priceLine = `${formatFcfa(product.price)}${product.unit ? ` / ${product.unit}` : ''}`;
    const blurb = `Découvre « ${product.name} » sur Marché Doré — ${priceLine}`;
    const message = `${blurb}\n${url}`;

    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav && typeof nav.share === 'function') {
          await nav.share({ title: product.name, text: blurb, url });
          return;
        }
        if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(message);
          Alert.alert('Lien copié', 'Le lien du produit a été copié dans le presse-papiers.');
          return;
        }
      }

      await Share.share(
        Platform.OS === 'ios'
          ? { message: blurb, url }
          : { message, title: product.name },
        { dialogTitle: 'Partager ce produit' },
      );
    } catch {
      // User dismissed the sheet or share is unavailable.
    }
  }, [product]);

  const footerPad = Math.max(14, insets.bottom + 8) + 84;

  if (!product) {
    return (
      <Screen>
        <Page style={styles.page} edgeToEdge>
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>Produit introuvable</Text>
            <Pressable onPress={() => goBack()}>
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
  const { rating, reviews } = liveReviewStats(product, reviewsForProduct(product.id));
  const savings = product.oldPrice ? Math.max(0, product.oldPrice - product.price) : 0;
  const availableQty = productAvailableQty(product);
  const outOfStock = product.inStock === false || availableQty === 0;
  const stockLabel = outOfStock
    ? 'Rupture de stock'
    : availableQty != null && availableQty < 20
      ? `${availableQty} disponible${availableQty > 1 ? 's' : ''} · ${selectedStore.name}`
      : `En stock · ${selectedStore.name}`;

  const bumpQty = (next: number) => {
    if (!product || outOfStock) return;
    if (inCart) {
      setCartQty(product.id, next);
      return;
    }
    if (next >= 1) add(product.id, 1);
  };

  const addToCart = () => {
    if (!product || inCart || outOfStock) return;
    flyBusy.current = true;
    ctaSlotL.value = 1;
    ctaSlotP.value = 1;
    ctaSlotO.value = 1;
    const label = formatFcfa(total);
    ctaScale.value = withSequence(
      withSpring(0.94, { damping: 14, stiffness: 280 }),
      withSpring(1.03, { damping: 12, stiffness: 220 }),
      withSpring(1, { damping: 16, stiffness: 200 }),
    );

    const measureView = (node: View | null) =>
      new Promise<{ x: number; y: number; w: number; h: number } | null>((resolve) => {
        if (!node) {
          resolve(null);
          return;
        }
        node.measureInWindow((x, y, w, h) => {
          resolve(w > 0 || h > 0 ? { x, y, w, h } : null);
        });
      });

    const finishHold = () => {
      if (flyHoldTimer.current) clearTimeout(flyHoldTimer.current);
      flyHoldTimer.current = setTimeout(() => {
        setFlyText(null);
        setCartFlyHold(false);
        flyOp.value = 0;
      }, 620);
    };

    void (async () => {
      const from = await measureView(ctaPriceRef.current);
      setJustAdded(true);
      setCartFlyHold(true);
      setTimeout(() => setJustAdded(false), 900);
      add(product.id, 1);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      let to = await measureView(fabAnchorRef.current);
      if (!to) {
        await new Promise((r) => setTimeout(r, 48));
        to = await measureView(fabAnchorRef.current);
      }
      if (!to) {
        to = {
          x: Math.max(12, windowWidth - 20 - 128),
          y: windowHeight - footerPad - 48,
          w: 121,
          h: 42,
        };
      }
      if (!from) {
        finishHold();
        return;
      }
      const sx = from.x + from.w / 2;
      const sy = from.y + from.h / 2;
      const tx = to.x + to.w / 2;
      const ty = to.y + to.h / 2;
      flyX.value = sx;
      flyY.value = sy;
      flyScale.value = 1;
      flyOp.value = 1;
      setFlyText(label);
      const ease = Easing.bezier(0.22, 1, 0.32, 1);
      flyX.value = withTiming(tx, { duration: 520, easing: ease });
      flyY.value = withTiming(ty, { duration: 520, easing: ease });
      flyScale.value = withTiming(0.62, { duration: 520, easing: ease });
      flyOp.value = withDelay(430, withTiming(0, { duration: 140 }));
      setTimeout(() => setFabPulse((n) => n + 1), 440);
      finishHold();
    })();
  };

  const goToSlide = (index: number) => {
    heroPagerRef.current?.goTo(index);
    setHeroIndex(index);
  };

  const openViewer = (index = heroIndex) => {
    setHeroIndex(index);
    setViewerOpen(true);
  };

  return (
    <Screen>
      <Page style={styles.page} edgeToEdge>
        <GestureRoot style={styles.flex}>
        <View style={[styles.heroBackdrop, { height: heroHeight }]} pointerEvents="box-none">
          <ImagePager
            ref={heroPagerRef}
            images={gallery}
            width={heroWidth}
            height={heroHeight}
            recyclingKeyPrefix={`product-${product.id}`}
            onIndexChange={setHeroIndex}
            onPress={() => openViewer(heroIndex)}
          />
          {product.discount ? (
            <View style={[styles.heroDiscount, { top: insets.top + 56, pointerEvents: 'none' }]}>
              <Text style={styles.heroDiscountText}>{product.discount}</Text>
            </View>
          ) : null}
          <View style={[styles.dots, { bottom: dotsBottom, pointerEvents: 'box-none' }]}>
            {gallery.map((_, i) => (
              <Pressable key={i} onPress={() => goToSlide(i)} hitSlop={8}>
                <View style={[styles.dot, i === heroIndex && styles.dotOn]} />
              </Pressable>
            ))}
          </View>
        </View>

          <SmartNavbar
            bare
            left={
              <IconCircle
                name="arrow-left"
                variant="ghost"
                accessibilityLabel="Retour"
                onPress={() => goBack()}
              />
            }
            right={
              <View style={styles.navActionsRow}>
                <IconCircle
                  name="maximize-2"
                  variant="ghost"
                  accessibilityLabel="Voir les photos"
                  onPress={() => openViewer(heroIndex)}
                />
                <IconCircle
                  name="share-2"
                  variant="ghost"
                  accessibilityLabel="Partager"
                  onPress={shareProduct}
                />
                <IconCircle
                  name="heart"
                  variant="ghost"
                  color={liked ? colors.terracotta : undefined}
                  accessibilityLabel={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  onPress={() => product?.id && toggle(product.id)}
                />
              </View>
            }
          />

        <Animated.View style={[styles.sheet, { height: sheetMax }, sheetAnimStyle]}>
          <GestureDetector gesture={sheetHandleGesture}>
            <Animated.View
              style={styles.sheetHandle}
              accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
              accessibilityLabel="Agrandir ou réduire la feuille"
              accessibilityHint="Glisser pour redimensionner, toucher pour basculer">
              <View style={styles.sheetHandleBar} />
            </Animated.View>
          </GestureDetector>

          <GestureDetector gesture={sheetScrollGesture}>
          <ScrollView
            ref={sheetScrollRef}
            style={styles.sheetScroll}
            contentContainerStyle={[
              styles.sheetScrollContent,
              { paddingBottom: !inCart && cartSubtotal > 0 ? footerPad + 60 : footerPad },
            ]}
            showsVerticalScrollIndicator={false}
            bounces
            overScrollMode="auto"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            scrollEnabled={listScrollEnabled}
            scrollEventThrottle={1}
            onScroll={onProductScroll}
            onScrollBeginDrag={onSheetScrollBeginDrag}
            onScrollEndDrag={onSheetScrollEndDrag}
            onWheel={onSheetWheel}>
            {gallery.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}
                style={styles.thumbScroll}
                bounces={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={onFiltersScroll}
                onScrollBeginDrag={onSheetScrollBeginDrag}
                onMomentumScrollBegin={onSheetScrollBeginDrag}>
                {gallery.map((src, i) => {
                  const on = i === heroIndex;
                  return (
                    <PressScale
                      key={`sheet-thumb-${product.id}-${i}`}
                      onPress={() => {
                        goToSlide(i);
                        if (gallery.length === 1) openViewer(i);
                      }}
                      onLongPress={() => openViewer(i)}
                      scaleTo={0.94}
                      style={[styles.thumb, on && styles.thumbOn]}
                      accessibilityLabel={`Miniature ${i + 1}`}>
                      <AppImage
                        source={src}
                        recyclingKey={`product-thumb-${product.id}-${i}`}
                        frameStyle={styles.thumbImg}
                      />
                      {on ? <View style={styles.thumbActiveMark} /> : null}
                    </PressScale>
                  );
                })}
                <PressScale
                  onPress={() => openViewer(heroIndex)}
                  scaleTo={0.94}
                  style={styles.thumbMore}
                  accessibilityLabel="Ouvrir le viewer d’images">
                  <Feather name="maximize-2" size={16} color={colors.gold} />
                  <Text style={styles.thumbMoreText}>Voir</Text>
                </PressScale>
              </ScrollView>
            ) : null}

            <View style={styles.brandRow}>
              <View style={styles.brandPill}>
                <Feather name="sun" size={12} color={colors.gold} />
                <Text style={styles.producer}>{(product.producer ?? 'Marché Doré').toUpperCase()}</Text>
              </View>
              {outOfStock ? (
                <View style={[styles.stock, styles.stockOut]}>
                  <View style={[styles.stockDot, styles.stockDotOut]} />
                  <Text style={[styles.stockText, styles.stockTextOut]} numberOfLines={2}>
                    Rupture de stock
                  </Text>
                </View>
              ) : (
                <View style={styles.stock}>
                  <View style={styles.stockDot} />
                  <Text style={styles.stockText} numberOfLines={2}>
                    {stockLabel}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.name}>{productFamilyName(product)}</Text>
            <Text style={styles.unitLine}>{product.unit}</Text>

            {variants.length > 1 ? (
              <View style={styles.formats}>
                <Text style={styles.formatsTitle}>Quantités</Text>
                <Text style={styles.formatsHint}>Le prix change selon le format choisi.</Text>
                <View style={styles.formatChips}>
                  {variants.map((variant) => {
                    const on = variant.id === product.id;
                    const unavailable = variant.inStock === false;
                    return (
                      <Pressable
                        key={variant.id}
                        onPress={() => {
                          setSelectedId(variant.id);
                          router.setParams({ id: variant.id });
                        }}
                        style={[
                          styles.formatChip,
                          on && styles.formatChipOn,
                          unavailable && styles.formatChipOut,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on, disabled: unavailable }}
                        accessibilityLabel={`${variant.unit}, ${formatFcfa(variant.price)}`}>
                        <Text style={[styles.formatUnit, on && styles.formatUnitOn]}>{variant.unit}</Text>
                        <Text style={[styles.formatPrice, on && styles.formatPriceOn]}>
                          {formatFcfa(variant.price)}
                        </Text>
                        {unavailable ? <Text style={styles.formatOut}>Rupture</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Pressable
              style={styles.ratingCard}
              onPress={() => {
                const write =
                  hasPurchasedProduct(orders, product.id) && !hasUserReviewedProduct(product.id);
                router.push(
                  write
                    ? (`/product/reviews/${product.id}?write=1` as Href)
                    : (`/product/reviews/${product.id}` as Href),
                );
              }}>
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
                    <Feather name="plus" size={16} color={colors.onAccent} />
                  </Pressable>
                </View>
              ) : product.inStock === false ? (
                <View style={[styles.addInline, styles.addInlineDisabled]}>
                  <Feather name="x-circle" size={15} color={colors.onAccent} />
                  <Text style={styles.addInlineText}>Indisponible</Text>
                </View>
              ) : (
                <PressScale style={styles.addInline} onPress={() => bumpQty(1)} scaleTo={0.96}>
                  <Feather name="shopping-bag" size={15} color={colors.onAccent} />
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

            {product.nutrition ? (
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
                  <NutriRow label="Énergie" value={product.nutrition.energy} />
                  <NutriRow label="Protéines" value={product.nutrition.protein} />
                  <NutriRow label="Lipides" value={product.nutrition.fat} />
                  <NutriRow label="Glucides" value={product.nutrition.carbs} />
                </View>
              ) : null}
            </View>
            ) : null}

            {feedReady && similar.length > 0 ? (
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

            {feedReady ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>À découvrir</Text>
                <Text style={styles.sectionMeta}>Pour vous</Text>
              </View>
              <View style={styles.grid}>
                {discoverItems.map(({ product: p, key }) => (
                  <ProductCard
                    key={key}
                    product={p}
                    width="49.6%"
                    imageHeight={GRID_IMAGE_HEIGHT}
                    compact
                    animate={false}
                  />
                ))}
              </View>
              <Text style={styles.feedHint}>Faites défiler pour voir plus de produits…</Text>
            </View>
            ) : null}
          </ScrollView>
          </GestureDetector>
        </Animated.View>

        {viewerOpen ? (
        <ImageViewer
          visible
          images={gallery}
          initialIndex={heroIndex}
          onClose={() => setViewerOpen(false)}
          onIndexChange={(i) => {
            setHeroIndex(i);
            heroPagerRef.current?.goTo(i);
          }}
        />
        ) : null}

        <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom + 8) }]}>
          {inCart && !cartFlyHold ? (
            <View style={styles.footerActions}>
              <View
                style={styles.footerLinePrices}
                accessibilityLabel="Prix unitaire initial">
                <Text
                  style={product.oldPrice ? styles.footerLineOld : styles.footerLineNow}
                  numberOfLines={1}>
                  {formatFcfa(product.oldPrice ?? product.price)}
                </Text>
                {product.oldPrice ? (
                  <Text style={styles.footerLineNow} numberOfLines={1}>
                    {formatFcfa(product.price)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.footerQty}>
                <Pressable style={styles.footerQtyBtn} onPress={() => bumpQty(cartQty - 1)} hitSlop={8}>
                  <Text style={styles.footerQtySign}>–</Text>
                </Pressable>
                <Text style={styles.footerQtyVal}>{cartQty}</Text>
                <Pressable
                  style={[styles.footerQtyBtn, styles.footerQtyPlus]}
                  onPress={() => bumpQty(cartQty + 1)}
                  hitSlop={8}>
                  <Feather name="plus" size={16} color={colors.onAccent} />
                </Pressable>
              </View>
              <PressScale style={styles.cta} onPress={() => navigateTab(tabPaths.cart)} scaleTo={0.97}>
                <LinearGradient
                  colors={['#c84b31', '#a83c26']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradientCart}>
                  <View style={styles.ctaBagIcon}>
                    <Feather name="shopping-bag" size={15} color="#ffffff" />
                    {cartCount > 0 ? (
                      <View style={styles.ctaBagBadge}>
                        <Text style={styles.ctaBagBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.ctaBagPrices}>
                    <Text style={styles.ctaBagTotal} numberOfLines={1}>
                      {formatFcfa(cartSubtotal)}
                    </Text>
                    {cartListSubtotal > cartSubtotal ? (
                      <Text style={styles.ctaBagOld} numberOfLines={1}>
                        {formatFcfa(cartListSubtotal)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.ctaBagChevron}>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.85)" />
                  </View>
                </LinearGradient>
              </PressScale>
            </View>
          ) : product.inStock === false ? (
            <View style={[styles.cta, styles.ctaDisabled]}>
              <View style={styles.ctaGradient}>
                <View style={styles.ctaAddLeft}>
                  <Feather name="x-circle" size={17} color="#ffffff" />
                  <Text style={styles.ctaText}>Rupture de stock</Text>
                </View>
              </View>
            </View>
          ) : (
            <Animated.View style={[styles.cta, ctaAnimStyle]}>
              <PressScale style={styles.ctaFill} onPress={addToCart} scaleTo={0.97}>
                <LinearGradient
                  colors={justAdded ? ['#498c53', '#3a7344'] : ['#c84b31', '#a83c26']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}>
                  <Animated.View style={[styles.ctaAddLeft, ctaLeftStyle]}>
                    <Feather name={justAdded ? 'check' : 'shopping-bag'} size={17} color="#ffffff" />
                    <Text style={styles.ctaText}>{justAdded ? 'Ajouté !' : 'Ajouter au panier'}</Text>
                  </Animated.View>
                  {!justAdded ? (
                    <View ref={ctaPriceRef} collapsable={false} style={styles.ctaPrices}>
                      <Animated.View style={ctaPriceSlotStyle}>
                        <Text style={styles.ctaPrice} numberOfLines={1}>
                          {formatFcfa(total)}
                        </Text>
                      </Animated.View>
                      {showCompare ? (
                        <Animated.View style={ctaOldSlotStyle}>
                          <Text style={styles.ctaOld} numberOfLines={1}>
                            {formatFcfa(listTotal)}
                          </Text>
                        </Animated.View>
                      ) : null}
                    </View>
                  ) : null}
                </LinearGradient>
              </PressScale>
            </Animated.View>
          )}
        </View>

        {!inCart || cartFlyHold ? (
          <CartTotalFab
            bottom={Math.max(14, insets.bottom + 8) + 84}
            pulse={fabPulse}
            measureRef={fabAnchorRef}
          />
        ) : null}
        {flyText ? (
          <Animated.View pointerEvents="none" style={[styles.flyChip, flyAnimStyle]}>
            <Text style={styles.flyChipText}>{flyText}</Text>
          </Animated.View>
        ) : null}
        </GestureRoot>
      </Page>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  const barH = 50;
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  missingLink: { color: colors.gold, fontSize: 15, fontWeight: '700' },
  heroDiscount: {
    position: 'absolute',
    left: 20,
    backgroundColor: colors.terracotta,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 1,
  },
  heroDiscountText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  dots: {
    position: 'absolute',
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
    backgroundColor: '#ffffff',
    width: 18,
  },
  navbarFloat: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.screen,
  },
  navActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 -12px 40px rgba(0,0,0,0.28)',
      },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: -6 },
      },
    }),
  },
  sheetHandle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    zIndex: 8,
    ...(Platform.OS === 'web'
      ? ({ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'grab' } as object)
      : {}),
  },
  sheetHandleBar: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.grabber,
  },
  sheetScroll: {
    flex: 1,
    minHeight: 0,
    ...(Platform.OS === 'web'
      ? ({ touchAction: 'pan-y', overscrollBehavior: 'contain' } as object)
      : {}),
  },
  sheetScrollContent: {
    flexGrow: 1,
    gap: 14,
    paddingHorizontal: spacing.screen,
    paddingBottom: 20,
  },
  thumbScroll: { marginHorizontal: -4 },
  thumbRow: {
    gap: 4,
    paddingHorizontal: 4,
    paddingBottom: 2,
    alignItems: 'center' },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.white },
  thumbOn: {
    borderColor: colors.gold },
  thumbImg: {
    width: '100%',
    height: '100%' },
  thumbActiveMark: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.gold },
  thumbMore: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderStyle: 'dashed',
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2 },
  thumbMoreText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700' },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cream,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5 },
  producer: { color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  stock: {
    flexShrink: 1,
    maxWidth: '62%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5 },
  stockDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  stockText: { flexShrink: 1, color: colors.green, fontWeight: '700', fontSize: 12 },
  stockOut: { backgroundColor: colors.blush },
  stockDotOut: { backgroundColor: colors.terracotta },
  stockTextOut: { color: colors.terracotta },
  name: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    ...displayFont('800') },
  unitLine: { color: colors.muted, fontSize: 14, fontWeight: '500', marginTop: -6 },
  formats: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  formatsTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  formatsHint: { color: colors.muted, fontSize: 12, marginTop: -2 },
  formatChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formatChip: {
    minWidth: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  formatChipOn: {
    borderColor: colors.terracotta,
    backgroundColor: colors.blush,
  },
  formatChipOut: { opacity: 0.7 },
  formatUnit: { color: colors.text, fontSize: 13, fontWeight: '800' },
  formatUnitOn: { color: colors.terracotta },
  formatPrice: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  formatPriceOn: { color: colors.terracotta },
  formatOut: { color: colors.terracotta, fontSize: 10, fontWeight: '700' },
  ratingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10 },
  ratingText: { color: colors.muted, fontWeight: '600', fontSize: 13, flex: 1 },
  priceCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    gap: 6 },
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
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6 },
  trustText: { color: colors.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  qtyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14 },
  qtyLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  qtySub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  qtyOld: {
    color: colors.placeholder,
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    marginTop: 2 },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: 14,
    padding: 4 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center' },
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
    paddingVertical: 12 },
  addInlineText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  addInlineDisabled: { backgroundColor: colors.muted },
  accordion: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 8 },
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
    paddingVertical: 10 },
  nutriLabel: { color: colors.muted, fontSize: 13 },
  nutriVal: { color: colors.text, fontSize: 13, fontWeight: '700' },
  section: { gap: 12, marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { color: colors.text, fontSize: 18, ...displayFont('700') },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  similarRow: { gap: 3.6, paddingRight: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    columnGap: 2.4,
    rowGap: 8,
  },
  feedHint: {
    color: colors.placeholder,
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 4 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    ...softShadow({ y: -6, blur: 20, opacity: 0.14 }),
    ...Platform.select({
      web: { boxShadow: '0 -8px 28px rgba(28,22,19,0.12)' },
      default: {},
    }),
  },
  footerActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    minWidth: 0,
    height: barH,
  },
  footerLinePrices: {
    flex: 2,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    height: barH,
    backgroundColor: colors.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
  },
  footerLineNow: {
    color: colors.terracotta,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  footerLineOld: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    lineHeight: 13,
  },
  footerQty: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
    height: barH,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  footerQtyBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerQtyPlus: { backgroundColor: colors.gold, borderColor: colors.gold },
  footerQtySign: { fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 20 },
  footerQtyVal: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
    color: colors.text,
  },
  cta: { flex: 5, height: barH, borderRadius: 14, overflow: 'hidden', minWidth: 0 },
  ctaDisabled: { backgroundColor: colors.muted },
  ctaFill: { flex: 1, height: barH, borderRadius: 14, overflow: 'hidden' },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  ctaAddLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  ctaGradientCart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 0,
    paddingLeft: 10,
    paddingRight: 10,
    height: barH,
    minHeight: barH,
  },
  ctaBagIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  ctaBagBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  ctaBagBadgeText: {
    color: '#c84b31',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  ctaBagPrices: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 0,
    minWidth: 0,
  },
  ctaBagTotal: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.1,
    flexShrink: 0,
  },
  ctaBagOld: {
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 13,
    textDecorationLine: 'line-through',
    flexShrink: 1,
  },
  ctaBagChevron: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  ctaPrices: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  ctaPrice: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  ctaOld: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  flyChip: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 50,
    backgroundColor: colors.terracotta,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  flyChipText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
}
