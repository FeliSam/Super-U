import { AppImage } from '@/components/AppImage';
import { MotionView, PressScale, enterZoom } from '@/components/motion';
import { colors, displayFont } from '@/constants/theme';
import { Product, productReviewStats } from '@/data/catalog';
import { useCart, useProductQty } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { formatFcfa } from '@/lib/format';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { softShadow } from '@/lib/shadow';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useRef } from 'react';
import {
  Animated,
  type ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Full-bleed screen shell. */
export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

/**
 * Immersive page shell (no top status-bar gap).
 * Only side insets are applied; bottom home-indicator is handled by tabs/footers.
 * `edgeToEdge` kept for call-site compatibility (top is always flush).
 */
export function Page({
  children,
  style,
  edgeToEdge: _edgeToEdge = false,
}: {
  children: React.ReactNode;
  style?: React.ComponentProps<typeof View>['style'];
  edgeToEdge?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.page,
        {
          paddingTop: 0,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export const ProductCard = memo(function ProductCard({
  product,
  width = 140,
  imageHeight = 130,
  compact = false,
  index = 0,
  animate = true,
}: {
  product: Product;
  width?: number | `${number}%`;
  imageHeight?: number;
  compact?: boolean;
  index?: number;
  animate?: boolean;
}) {
  const { qty, increment, decrement } = useProductQty(product.id);
  const { isFavorite, toggle } = useFavorites();
  const liked = isFavorite(product.id);
  const scaleX = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const bump = (next: () => void) => {
    Animated.sequence([
      Animated.timing(scaleX, { toValue: 0.97, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleX, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 4 }),
    ]).start();
    next();
  };

  const toggleLike = () => {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.25, duration: 90, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 8 }),
    ]).start();
    toggle(product.id);
  };

  const openProduct = () => router.push(`/product/${product.id}`);
  const { rating, reviews } = productReviewStats(product);
  // Width must sit on the outermost wrapper: % widths inside MotionView
  // resolve against a shrink-wrapped parent and collapse the image (~70×168).
  const widthStyle = { width } as const;

  const body = (
    <View style={styles.card}>
      <View style={styles.cardInner}>
        <View style={[styles.imagePanel, { height: imageHeight }]}>
          <Pressable onPress={openProduct} style={StyleSheet.absoluteFill}>
            <AppImage source={product.image} frameStyle={StyleSheet.absoluteFill} />
          </Pressable>
          {product.discount ? (
            <View style={[styles.discount, { pointerEvents: 'none' }]}>
              <Text style={styles.discountText}>{product.discount}</Text>
            </View>
          ) : null}
          <Pressable
            style={styles.heart}
            onPress={(e) => {
              e.stopPropagation?.();
              toggleLike();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Feather
                name="heart"
                size={14}
                color={liked ? colors.terracotta : colors.text}
                style={liked ? undefined : { opacity: 0.45 }}
              />
            </Animated.View>
          </Pressable>
        </View>
        <View style={[styles.info, compact && styles.infoCompact]}>
          <Pressable style={styles.infoText} onPress={openProduct}>
            <Text style={styles.name} numberOfLines={1}>
              {product.name}
            </Text>
            <View style={[styles.metaRow, compact && styles.metaRowCompact]}>
              <Text style={[styles.unit, compact && styles.unitCompact]} numberOfLines={1}>
                {product.unit}
              </Text>
              <View style={[styles.ratingRow, compact && styles.ratingRowCompact]}>
                <Ionicons name="star" size={compact ? 11 : 12} color={colors.gold} />
                <Text style={[styles.ratingText, compact && styles.ratingTextCompact]} numberOfLines={1}>
                  {rating.toFixed(1)} ({reviews} avis)
                </Text>
              </View>
            </View>
          </Pressable>
          {qty > 0 ? (
            <Animated.View style={[styles.row, styles.rowAnimAnchor, { transform: [{ scaleX }] }]}>
              <Pressable style={styles.stepBtn} onPress={() => bump(decrement)}>
                <Text style={styles.stepSign}>–</Text>
              </Pressable>
              <Text style={styles.qtyVal}>{qty}</Text>
              <Pressable style={styles.stepBtn} onPress={() => bump(increment)}>
                <Feather name="plus" size={14} color={colors.white} />
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.rowAnimAnchor, { transform: [{ scaleX }] }]}>
              <Pressable style={styles.row} onPress={() => bump(increment)}>
                <Text style={styles.price} numberOfLines={1}>
                  {formatFcfa(product.price)}
                </Text>
                <View style={styles.add}>
                  <Feather name="plus" size={16} color={colors.white} />
                </View>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );

  if (!animate) return <View style={widthStyle}>{body}</View>;
  return (
    <MotionView index={index} preset="down" style={widthStyle}>
      {body}
    </MotionView>
  );
});

export function SearchField({
  placeholder = 'Rechercher un produit...',
  value,
  onChangeText,
  onSubmitEditing,
  onPress,
  active,
  showFilter = true,
}: {
  placeholder?: string;
  value?: string;
  onChangeText?: (t: string) => void;
  onSubmitEditing?: () => void;
  onPress?: () => void;
  active?: boolean;
  showFilter?: boolean;
}) {
  const box = (
    <View style={[styles.search, active && styles.searchActive]}>
      <Feather name="search" size={18} color={colors.placeholder} />
      {onChangeText ? (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          returnKeyType="search"
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
      ) : (
        <Text style={styles.searchPlaceholder}>{placeholder}</Text>
      )}
      {showFilter && !onChangeText ? <Feather name="sliders" size={18} color={colors.gold} /> : null}
      {onChangeText && value ? (
        <Pressable onPress={() => onChangeText('')}>
          <Feather name="x-circle" size={16} color={colors.placeholder} />
        </Pressable>
      ) : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{box}</Pressable>;
  }
  return box;
}

function CategoryTileOverlay() {
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.tileGradientWeb,
          { pointerEvents: 'none' },
        ]}
      />
    );
  }
  return (
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.78)']}
      locations={[0, 0.35, 1]}
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
    />
  );
}

export function CategoryTile({
  title,
  image,
  height,
  flex,
  onPress,
  count,
  index = 0,
}: {
  title: string;
  image: ImageSourcePropType;
  height: number;
  flex: number;
  onPress: () => void;
  count?: number;
  index?: number;
}) {
  return (
    <MotionView index={index} preset="down" style={{ flex, height }}>
      <PressScale style={[styles.tilePress, { flex: 1, height }]} onPress={onPress} scaleTo={0.96}>
        <View style={styles.tile}>
          <View style={[styles.tileFrame, { pointerEvents: 'none' }]}>
            <View style={styles.tileImageZoom}>
              <AppImage source={image} frameStyle={styles.tileImage} />
            </View>
            <CategoryTileOverlay />
          </View>
          <View style={styles.tileFooter}>
            <View style={styles.tileTextBlock}>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {title}
              </Text>
              {count != null ? <Text style={styles.tileCount}>{count} produits</Text> : null}
            </View>
            <View style={styles.tileArrow}>
              <Feather name="arrow-right" size={14} color={colors.white} />
            </View>
          </View>
        </View>
      </PressScale>
    </MotionView>
  );
}

export function CtaButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressScale style={styles.cta} onPress={onPress} scaleTo={0.98}>
      <Text style={styles.ctaText}>{label}</Text>
    </PressScale>
  );
}

export function IconCircle({
  name,
  onPress,
  bg = colors.white,
  color = colors.text,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  bg?: string;
  color?: string;
}) {
  return (
    <PressScale onPress={onPress} style={[styles.iconCircle, { backgroundColor: bg }]} scaleTo={0.92}>
      <Feather name={name} size={18} color={color} />
    </PressScale>
  );
}

export function PromoBanner({
  title,
  subtitle,
  cta,
  image,
  onPress,
  width = 320,
  index = 0,
}: {
  title: string;
  subtitle: string;
  cta: string;
  image: ImageSourcePropType;
  onPress: () => void;
  width?: number;
  index?: number;
}) {
  return (
    <MotionView index={index} preset="right">
      <PressScale style={[styles.promo, { width }]} onPress={onPress} scaleTo={0.985}>
        <AppImage source={image} style={styles.promoImg} frameStyle={StyleSheet.absoluteFill} />
        <View style={styles.promoDim} />
        <Text style={styles.promoTitle}>{title}</Text>
        <Text style={styles.promoSub}>{subtitle}</Text>
        <View style={styles.profiter}>
          <Text style={styles.profiterText}>{cta}</Text>
        </View>
      </PressScale>
    </MotionView>
  );
}

export const CartTotalFab = memo(function CartTotalFab({ bottom = 20 }: { bottom?: number }) {
  const { subtotal, listSubtotal, count } = useCart();
  if (subtotal <= 0) return null;

  const showCompare = listSubtotal > subtotal;

  return (
    <Reanimated.View entering={enterZoom(80)} style={[styles.totalFab, { bottom }]}>
      <PressScale style={styles.totalFabInner} onPress={() => navigateTab(tabPaths.cart)} scaleTo={0.96}>
        <View style={styles.totalFabIcon}>
          <Feather name="shopping-bag" size={15} color={colors.white} />
          {count > 0 ? (
            <View style={styles.totalFabBadge}>
              <Text style={styles.totalFabBadgeText}>{count > 99 ? '99+' : count}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.totalFabPrices}>
          <Text style={styles.totalFabText}>{formatFcfa(subtotal)}</Text>
          {showCompare ? <Text style={styles.totalFabOld}>{formatFcfa(listSubtotal)}</Text> : null}
        </View>
        <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.85)" />
      </PressScale>
    </Reanimated.View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    ...(Platform.OS === 'web' ? { maxWidth: 430, width: '100%', alignSelf: 'center' as const } : {}),
  },
  page: {
    flex: 1,
  },
  card: {
    width: '100%',
  },
  cardInner: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  imagePanel: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 16,
    position: 'relative',
    backgroundColor: colors.border,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  discount: {
    position: 'absolute',
    left: 12,
    top: 12,
    backgroundColor: colors.terracotta,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },
  discountText: { color: colors.white, fontWeight: '700', fontSize: 11 },
  heart: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  info: { paddingHorizontal: 4, paddingTop: 10, paddingBottom: 10, gap: 8 },
  infoCompact: { paddingTop: 8, paddingBottom: 8, gap: 6 },
  infoText: { gap: 4 },
  name: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    ...displayFont('700'),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  metaRowCompact: {},
  unit: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  unitCompact: { fontSize: 11 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  ratingRowCompact: { gap: 2 },
  ratingText: { color: colors.muted, fontSize: 11, fontWeight: '600', flexShrink: 1 },
  ratingTextCompact: { fontSize: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
    minHeight: 36,
  },
  rowAnimAnchor: {
    alignSelf: 'flex-start',
    transformOrigin: 'left center',
  },
  price: { color: colors.white, fontWeight: '700', fontSize: 11, flexShrink: 0, opacity: 1 },
  add: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
    opacity: 1,
  },
  stepBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { color: colors.white, fontWeight: '700', fontSize: 16, lineHeight: 18 },
  qtyVal: { color: colors.white, fontWeight: '700', fontSize: 13, minWidth: 16, textAlign: 'center' },
  search: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    height: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchActive: { borderColor: colors.gold, borderWidth: 1.5 },
  searchPlaceholder: { flex: 1, color: colors.placeholder, fontSize: 14 },
  input: { flex: 1, fontSize: 14, color: colors.text, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  tilePress: { minWidth: 0 },
  tilePressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  tile: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    ...Platform.select({
      ios: {
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  tileFrame: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: 18,
  },
  tileImageZoom: {
    position: 'absolute',
    width: '155%',
    height: '155%',
    top: '-27.5%',
    left: '-27.5%',
  },
  tileImage: {
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web' ? { objectFit: 'cover' as const } : {}),
  },
  tileGradientWeb: {
    backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%)',
  } as object,
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    padding: 12,
    zIndex: 1,
    width: '100%',
  },
  tileTextBlock: { flex: 1, gap: 3 },
  tileTitle: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 19,
  },
  tileCount: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '600',
  },
  tileArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    backgroundColor: colors.terracotta,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalFab: {
    position: 'absolute',
    right: 20,
    zIndex: 20,
  },
  totalFabInner: {
    backgroundColor: colors.terracotta,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 10,
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    ...softShadow({ y: 8, blur: 28, opacity: 0.2, elevation: 10 }),
  },
  totalFabIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  totalFabBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  totalFabBadgeText: {
    color: colors.terracotta,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  totalFabPrices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalFabText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  totalFabOld: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  promo: {
    height: 150,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    padding: 20,
  },
  promoImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  promoDim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  promoTitle: { color: colors.white, fontSize: 20, ...displayFont('800') },
  promoSub: { color: colors.cream, fontSize: 14, marginTop: 4 },
  profiter: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
  },
  profiterText: { color: colors.white, fontWeight: '700', fontSize: 12 },
});
