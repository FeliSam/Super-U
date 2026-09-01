import { AppImage } from '@/components/AppImage';
import { MotionView, PressScale, enterZoom } from '@/components/motion';
import { heroChrome, liquidIce, inkOnSurface, type AppColors, bodyFont, displayFont, floatingAboveTabBar, MOBILE_FRAME_MAX, screenEdge, spacing } from '@/constants/theme';
import { useColors, useTheme } from '@/context/ThemeContext';
import { Product, liveReviewStats } from '@/data/catalog';
import { useCart, useProductQty } from '@/context/CartContext';
import { useFavoriteId } from '@/context/FavoritesContext';
import { useReviews } from '@/context/ReviewsContext';
import { formatFcfa } from '@/lib/format';
import { productVisualSource } from '@/lib/productVisual';
import { transferWebKeyboard, pinWebKeyboard } from '@/lib/keepKeyboard';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { softShadow } from '@/lib/shadow';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
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
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Full-bleed screen shell. */
export function Screen({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View
      style={[
        styles.screenBase,
        { backgroundColor: colors.bg },
        Platform.OS === 'web' ? styles.screenWeb : null,
      ]}>
      {children}
    </View>
  );
}

/**
 * Immersive page shell (edge-to-edge).
 * `edgeToEdge` kept for call-site compatibility.
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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.page, style]}>{children}</View>;
}

const SMART_NAV_INNER = 50;

export function smartNavbarClearance(topInset: number) {
  return Math.max(8, topInset + 4) + SMART_NAV_INNER + 8;
}

/**
 * Barre haute flottante (77 % + flou) : le contenu défile dessous.
 */
export function SmartNavbar({
  left,
  right,
  style,
  hideProgress,
  hideOffset,
  bare = false,
  split = false,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: React.ComponentProps<typeof View>['style'];
  /** @deprecated 0–1 ; préférer hideOffset en px. */
  hideProgress?: SharedValue<number>;
  /** Décalage vers le haut en px (0 visible). */
  hideOffset?: SharedValue<number>;
  /** Sans pastille unique : 3 blocs (adresse / alerte / profil). */
  split?: boolean;
  /** Sans pastille : icônes seules. */
  bare?: boolean;
}) {
  const colors = useColors();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ice = liquidIce(scheme);
  const barBg = scheme === 'dark' ? 'rgba(30, 26, 23, 0.77)' : 'rgba(255, 255, 255, 0.77)';
  const padTop = Math.max(8, insets.top + 4);
  const hideDistance = padTop + SMART_NAV_INNER + 12;
  const splitOrBare = bare || split;

  const hideStyle = useAnimatedStyle(() => {
    const y = hideOffset
      ? hideOffset.value
      : hideProgress
        ? hideProgress.value * hideDistance
        : 0;
    const p = hideDistance > 0 ? Math.min(1, Math.max(0, y / hideDistance)) : 0;
    return {
      transform: [{ translateY: -y }, { scale: 1 - p * 0.04 }],
      opacity: 1 - p * 0.12,
    };
  });

  return (
    <Reanimated.View
      style={[styles.smartNavbarWrap, { paddingTop: padTop }, hideStyle, style]}
      pointerEvents="box-none">
      <View
        style={[
          styles.smartNavbarBar,
          splitOrBare ? styles.smartNavbarBarBare : { backgroundColor: barBg, borderColor: colors.border },
        ]}>
        {left ? (
          <View style={[styles.smartNavbarLeft, split && [styles.smartNavbarChip, { backgroundColor: ice.backgroundColor, borderColor: ice.borderColor }]]}>
            {left}
          </View>
        ) : (
          <View style={styles.smartNavbarLeft} />
        )}
        {right ? <View style={styles.smartNavbarRight}>{right}</View> : null}
      </View>
    </Reanimated.View>
  );
}

/** Pastille 77 % pour un bloc de SmartNavbar (alerte, profil). */
export function SmartNavbarChip({
  children,
  round,
  style,
}: {
  children: React.ReactNode;
  round?: boolean;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  const colors = useColors();
  const { scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ice = liquidIce(scheme);
  return (
    <View
      style={[
        round ? styles.smartNavbarChipRound : styles.smartNavbarChip,
        { backgroundColor: ice.backgroundColor, borderColor: ice.borderColor },
        style,
      ]}>
      {children}
    </View>
  );
}

export const FROST_ICON_BG = 'rgba(255,255,255,0.2)';
const FROST_BAR_INNER = 44;

export function frostedBarClearance(topInset: number) {
  return Math.max(8, topInset + 6) + FROST_BAR_INNER;
}

/** Entête overlay verre (Explorer, Panier, Messages, Recherche). */
export function FrostedTopBar({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const padTop = Math.max(8, insets.top + 6);
  const barBg = scheme === 'dark' ? 'rgba(30, 26, 23, 0.2)' : 'rgba(255, 255, 255, 0.2)';
  return (
    <View style={[styles.frostedWrap, { height: padTop + FROST_BAR_INNER }]} pointerEvents="box-none">
      <View style={[styles.frostedBar, { paddingTop: padTop, backgroundColor: barBg }]}>
        <View style={styles.frostedLeft}>{children}</View>
        {right ? <View style={styles.frostedRight}>{right}</View> : null}
      </View>
    </View>
  );
}

/** Shared warm-gradient header for main tab screens (Accueil, Explorer, Panier, Chat, Profil). */
export function TabHero({
  title,
  subtitle,
  left,
  right,
  navbar,
  children,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Optional smart top bar (e.g. Livrer à + actions) above the title. */
  navbar?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { scheme } = useTheme();
  const colors = useColors();
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <LinearGradient colors={chrome.gradient} style={styles.tabHero}>
      <View style={[styles.tabHeroOrb, { backgroundColor: chrome.orb }]} />
      {navbar ? <View style={styles.tabHeroNavbar}>{navbar}</View> : null}
      <View style={styles.tabHeroTitleRow}>
        {left ? <View style={styles.tabHeroRight}>{left}</View> : null}
        <Text style={[styles.tabHeroTitle, { color: chrome.ink }]}>{title}</Text>
        {right ? <View style={styles.tabHeroRight}>{right}</View> : null}
      </View>
      {subtitle ? <Text style={[styles.tabHeroSub, { color: chrome.muted }]}>{subtitle}</Text> : null}
      {children}
    </LinearGradient>
  );
}

const BADGE_LABEL: Record<NonNullable<Product['badge']>, string> = {
  nouveau: 'Nouveau',
  local: 'Local',
  rupture: 'Rupture',
};

export const ProductCard = memo(function ProductCard({
  product,
  width = 140,
  imageHeight = 130,
  compact = false,
  circleImage = false,
  index = 0,
  animate = false,
}: {
  product: Product;
  width?: number | `${number}%`;
  imageHeight?: number;
  compact?: boolean;
  /** Circular product photo (50% radius); info stays below. */
  circleImage?: boolean;
  index?: number;
  animate?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { qty, increment, decrement } = useProductQty(product.id);
  const { liked, toggle } = useFavoriteId(product.id);
  const { reviewsForProduct } = useReviews();
  const outOfStock = product.inStock === false;
  const badge = outOfStock ? ('rupture' as const) : product.badge;
  const scaleX = useRef(new Animated.Value(1)).current;
  const heartScale = useSharedValue(1);
  const heartAnim = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  const bump = (next: () => void) => {
    if (outOfStock) return;
    Animated.sequence([
      Animated.timing(scaleX, { toValue: 0.97, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleX, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 4 }),
    ]).start();
    next();
  };

  const toggleLike = () => {
    heartScale.value = withSequence(
      withSpring(1.42, { damping: 8, stiffness: 480, mass: 0.32 }),
      withSpring(1, { damping: 11, stiffness: 260, mass: 0.4 }),
    );
    toggle();
  };

  const openProduct = () => router.push(`/product/${product.id}`);
  const { rating, reviews } = liveReviewStats(product, reviewsForProduct(product.id));
  const hasDeal = Boolean(product.oldPrice && product.oldPrice > product.price);
  const unitPrice = product.price;
  const unitOld = product.oldPrice;
  // Width must sit on the outermost wrapper: % widths inside MotionView
  // resolve against a shrink-wrapped parent and collapse the image (~70×168).
  const widthStyle = { width } as const;

  const priceBlock = (showReduction = true) => (
    <View style={[styles.priceStack, compact && styles.priceStackCompact]}>
      <Text style={[styles.price, compact && styles.priceCompact]} numberOfLines={1}>
        {formatFcfa(unitPrice)}
      </Text>
      {showReduction && hasDeal && unitOld ? (
        <Text style={[styles.priceOld, compact && styles.priceOldCompact]} numberOfLines={1}>
          {formatFcfa(unitOld)}
        </Text>
      ) : null}
    </View>
  );

  const circleR = circleImage ? imageHeight / 2 : undefined;

  const body = (
    <View
      style={styles.card}
      accessibilityLabel={`${product.name}, ${formatFcfa(product.price)}${
        outOfStock ? ', en rupture' : hasDeal && unitOld ? `, au lieu de ${formatFcfa(unitOld)}` : ''
      }`}>
      <View style={[styles.cardInner, circleImage && styles.cardInnerCircle]}>
        <View
          style={[
            styles.imagePanel,
            compact && styles.imagePanelCompact,
            { height: imageHeight },
            circleImage && [
              styles.imagePanelCircle,
              {
                width: imageHeight,
                alignSelf: 'center',
              },
            ],
          ]}>
          <Pressable
            onPress={openProduct}
            style={[
              StyleSheet.absoluteFill,
              circleImage && { borderRadius: circleR, overflow: 'hidden' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Voir ${product.name}`}>
            <AppImage
              recyclingKey={`${product.id}-${product.imageUrl ?? ''}`}
              source={
                product.image && typeof product.image === 'object' && 'uri' in product.image
                  ? product.image
                  : productVisualSource(product.id, product.categoryId, product.name)
              }
              frameStyle={[StyleSheet.absoluteFill, circleImage && { borderRadius: circleR, overflow: 'hidden' }]}
              style={circleImage ? ({ transform: [{ scale: 1.14 }] } as const) : undefined}
            />
            {outOfStock ? (
              <View style={[styles.stockOverlay, circleImage && { borderRadius: circleR }]} />
            ) : null}
          </Pressable>
          {product.discount && !outOfStock ? (
            <View
              style={[
                styles.discount,
                compact && styles.discountCompact,
                circleImage && styles.overlayCircle,
                { pointerEvents: 'none' },
              ]}>
              <Text style={[styles.discountText, compact && styles.discountTextCompact]}>{product.discount}</Text>
            </View>
          ) : null}
          {badge && (!product.discount || outOfStock) ? (
            <View
              style={[
                styles.cardBadge,
                compact && styles.discountCompact,
                badge === 'rupture' && styles.cardBadgeRupture,
                badge === 'local' && styles.cardBadgeLocal,
                badge === 'nouveau' && styles.cardBadgeNouveau,
                circleImage && styles.overlayCircle,
                { pointerEvents: 'none' },
              ]}>
              <Text style={[styles.cardBadgeText, compact && styles.discountTextCompact]}>{BADGE_LABEL[badge]}</Text>
            </View>
          ) : null}
          <Pressable
            style={[styles.heart, compact && styles.heartCompact, circleImage && styles.heartCircle]}
            onPress={(e) => {
              e.stopPropagation?.();
              toggleLike();
            }}
            hitSlop={compact ? 8 : 12}
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            <Reanimated.View style={heartAnim}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={compact ? 13 : 15}
                color={liked ? colors.terracotta : colors.text}
              />
            </Reanimated.View>
          </Pressable>
          {qty > 0 && !outOfStock ? (
            <View
              style={[
                styles.qtyOverlay,
                circleImage && { borderRadius: circleR },
                { pointerEvents: 'none' },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <Text style={[styles.qtyOverlayText, compact && styles.qtyOverlayTextCompact]}>{qty}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.info, compact && styles.infoCompact]}>
          <Pressable
            style={styles.infoText}
            onPress={openProduct}
            accessibilityRole="button"
            accessibilityLabel={`Voir ${product.name}`}>
            <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
              {product.name}
            </Text>
            <View style={[styles.metaRow, compact && styles.metaRowCompact]}>
              <Text style={[styles.unit, compact && styles.unitCompact]} numberOfLines={1}>
                {product.unit}
              </Text>
              <View style={[styles.ratingRow, compact && styles.ratingRowCompact]}>
                <Ionicons name="star" size={compact ? 10 : 12} color={colors.gold} />
                <Text style={[styles.ratingText, compact && styles.ratingTextCompact]} numberOfLines={1}>
                  {compact ? rating.toFixed(1) : `${rating.toFixed(1)} (${reviews} avis)`}
                </Text>
              </View>
            </View>
          </Pressable>
          {outOfStock ? (
            <View
              style={[styles.row, compact && styles.rowCompact, styles.rowDisabled]}
              accessibilityLabel="Produit en rupture">
              <Text style={[styles.price, compact && styles.priceCompact]} numberOfLines={1}>
                Indisponible
              </Text>
            </View>
          ) : qty > 0 ? (
            <Animated.View
              style={[
                styles.rowAnimAnchor,
                compact && styles.rowAnimAnchorCompact,
                { transform: [{ scaleX }] },
              ]}>
              <View style={[styles.row, styles.rowInCart, compact && styles.rowCompact]}>
                <Pressable
                  style={[styles.stepBtn, compact && styles.stepBtnCompact]}
                  onPress={() => bump(decrement)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Diminuer la quantité">
                  <Text style={styles.stepSign}>–</Text>
                </Pressable>
                <View
                  style={[styles.qtyPriceMid, compact && styles.qtyPriceMidCompact]}
                  accessibilityLabel={`Quantité ${qty}, ${formatFcfa(unitPrice)} l’unité`}>
                  {priceBlock(false)}
                </View>
                <Pressable
                  style={[styles.stepBtn, compact && styles.stepBtnCompact]}
                  onPress={() => bump(increment)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Augmenter la quantité">
                  <Feather name="plus" size={compact ? 12 : 14} color={colors.onAccent} />
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <Animated.View
              style={[styles.rowAnimAnchor, compact && styles.rowAnimAnchorCompact, { transform: [{ scaleX }] }]}>
              <Pressable
                style={[styles.row, compact && styles.rowCompact, hasDeal && styles.rowDeal]}
                onPress={() => bump(increment)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter ${product.name} au panier`}>
                {priceBlock(!circleImage)}
                <View style={[styles.add, compact && styles.addCompact]}>
                  <Feather name="plus" size={compact ? 14 : 16} color={colors.onAccent} />
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
  autoFocus = false,
}: {
  placeholder?: string;
  value?: string;
  onChangeText?: (t: string) => void;
  onSubmitEditing?: () => void;
  onPress?: () => void;
  active?: boolean;
  showFilter?: boolean;
  /** Focus the real input after mount / screen focus (search page). */
  autoFocus?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const inputRef = useRef<TextInput>(null);

  const focusNow = useCallback(() => {
    const node = inputRef.current;
    if (!node) return;
    transferWebKeyboard(node);
    node.focus();
  }, []);

  // Only focus when THIS screen is focused. Mount-time autoFocus would open the
  // keyboard on load because the hidden search tab is kept mounted (`lazy: false`).
  useFocusEffect(
    useCallback(() => {
      if (!autoFocus || !onChangeText) return;
      focusNow();
      const id = requestAnimationFrame(() => focusNow());
      const t = setTimeout(focusNow, Platform.OS === 'web' ? 50 : 280);
      return () => {
        cancelAnimationFrame(id);
        clearTimeout(t);
      };
    }, [autoFocus, onChangeText, focusNow]),
  );

  const box = (
    <View style={[styles.search, active && styles.searchActive]}>
      <Feather name="search" size={18} color={colors.placeholder} />
      {onChangeText ? (
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          returnKeyType="search"
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          showSoftInputOnFocus
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="default"
          inputMode="search"
          // ≥16px avoids iOS Safari auto-zoom on focus (inline styles override +html CSS).
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
    return (
      <PressScale
        onPress={() => {
          pinWebKeyboard();
          onPress();
        }}
        scaleTo={0.985}>
        {box}
      </PressScale>
    );
  }
  return box;
}

function CategoryTileOverlay() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.78)']}
      locations={[0.35, 0.7, 1]}
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
    />
  );
}

export const CategoryTile = memo(function CategoryTile({
  title,
  image,
  height,
  flex,
  onPress,
  count,
}: {
  title: string;
  image: ImageSourcePropType;
  height: number;
  flex: number;
  onPress: () => void;
  count?: number;
  index?: number;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={{ flex, height }}>
      <PressScale style={[styles.tilePress, { flex: 1, height }]} onPress={onPress} scaleTo={0.96}>
        <View style={styles.tile}>
          <View style={[styles.tileFrame, { pointerEvents: 'none' }]}>
            <View style={styles.tileImageZoom}>
              <AppImage source={image} frameStyle={styles.tileImage} priority="low" />
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
              <Feather name="arrow-right" size={14} color="#ffffff" />
            </View>
          </View>
        </View>
      </PressScale>
    </View>
  );
});

export function CtaButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <PressScale style={styles.cta} onPress={onPress} scaleTo={0.98}>
      <Text style={styles.ctaText}>{label}</Text>
    </PressScale>
  );
}

export function IconCircle({
  name,
  onPress,
  bg,
  color,
  variant = 'default',
  badge,
  accessibilityLabel,
  size = 'md',
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  bg?: string;
  color?: string;
  /** Frosted on gradients (`hero`), solid chip on photos (`onPhoto`), icône seule (`ghost`). */
  variant?: 'default' | 'hero' | 'onPhoto' | 'ghost';
  badge?: number;
  accessibilityLabel?: string;
  size?: 'md' | 'sm' | 'lg';
}) {
  const { scheme } = useTheme();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const ice = useMemo(() => liquidIce(scheme), [scheme]);
  const isHero = variant === 'hero';
  const isOnPhoto = variant === 'onPhoto';
  const isGhost = variant === 'ghost';
  const resolvedBg = bg ?? (isGhost ? ice.backgroundColor : isOnPhoto ? '#ffffff' : isHero ? chrome.iconBg : colors.white);
  const resolvedColor = color ?? (isGhost || isOnPhoto ? colors.text : inkOnSurface(resolvedBg));
  const resolvedBorder = isGhost
    ? ice.borderColor
    : isOnPhoto
      ? 'rgba(28,22,19,0.16)'
      : isHero
        ? chrome.iconBorder
        : colors.border;

  const sm = size === 'sm';
  const lg = size === 'lg';

  return (
    <PressScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.iconCircle,
        sm && styles.iconCircleSm,
        lg && styles.iconCircleLg,
        isOnPhoto && styles.iconCircleOnPhoto,
        isGhost && styles.iconCircleGhost,
        { backgroundColor: resolvedBg, borderColor: resolvedBorder },
      ]}
      scaleTo={0.92}>
      <Feather name={name} size={lg ? 20 : sm ? 16 : 18} color={resolvedColor} />
      {badge != null && badge > 0 ? (
        <View style={styles.iconCircleBadge}>
          <Text style={styles.iconCircleBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </PressScale>
  );
}

export function PromoBanner({
  title,
  subtitle,
  cta,
  image,
  onPress,
  width,
  index = 0,
}: {
  title: string;
  subtitle: string;
  cta: string;
  image: ImageSourcePropType;
  onPress: () => void;
  /** Column width of the mobile frame. Omit to stretch 100% of parent. */
  width?: number;
  index?: number;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const frame = width != null ? { width, maxWidth: '100%' as const } : { width: '100%' as const, maxWidth: '100%' as const };
  return (
    <MotionView index={index} preset="right" style={frame}>
      <PressScale style={styles.promo} onPress={onPress} scaleTo={0.985}>
        <AppImage source={image} style={styles.promoImg} frameStyle={StyleSheet.absoluteFill} />
        <View style={styles.promoDim} pointerEvents="none" />
        <Text style={styles.promoTitle}>{title}</Text>
        <Text style={styles.promoSub}>{subtitle}</Text>
        <View style={styles.profiter}>
          <Text style={styles.profiterText}>{cta}</Text>
        </View>
      </PressScale>
    </MotionView>
  );
}

export const CartTotalFab = memo(function CartTotalFab({
  bottom,
  aboveTabs = false,
  pulse = 0,
  measureRef,
}: {
  /** Explicit bottom offset. When omitted with `aboveTabs`, sits above the floating tab bar. */
  bottom?: number;
  /** Position above the floating tab bar (safe-area aware — iPhone home indicator). */
  aboveTabs?: boolean;
  /** Increment to bounce the chip when a price lands on it. */
  pulse?: number;
  measureRef?: RefObject<View | null>;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { subtotal, listSubtotal, count } = useCart();
  const bump = useSharedValue(1);
  useEffect(() => {
    if (!pulse) return;
    bump.value = withSequence(
      withSpring(1.14, { damping: 11, stiffness: 320 }),
      withSpring(1, { damping: 16, stiffness: 240 }),
    );
  }, [bump, pulse]);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  if (subtotal <= 0) return null;

  const showCompare = listSubtotal > subtotal;
  const resolvedBottom =
    bottom ?? (aboveTabs ? floatingAboveTabBar(insets.bottom) : Math.max(20, insets.bottom + 12));

  return (
    <Reanimated.View entering={enterZoom(80)} style={[styles.totalFab, { bottom: resolvedBottom }, bumpStyle]}>
      <View ref={measureRef} collapsable={false}>
      <PressScale style={styles.totalFabInner} onPress={() => navigateTab(tabPaths.cart)} scaleTo={0.96}>
        <View style={styles.totalFabIcon}>
          <Feather name="shopping-bag" size={13} color={colors.onAccent} />
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
        <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.85)" />
      </PressScale>
      </View>
    </Reanimated.View>
  );
});

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screenBase: {
      flex: 1,
      width: '100%',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    },
    screenWeb: {
      maxWidth: MOBILE_FRAME_MAX,
      width: '100%',
      alignSelf: 'center' as const,
      overflow: 'hidden',
    },
    page: {
      flex: 1,
      width: '100%',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
    },
    tabHero: {
      paddingHorizontal: spacing.screen,
      paddingTop: 8,
      paddingBottom: 40,
      overflow: 'hidden',
    },
    tabHeroOrb: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      top: -40,
      right: -30,
    },
    smartNavbarWrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 40,
      paddingHorizontal: screenEdge(14),
      overflow: 'visible',
    },
    smartNavbarBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      minHeight: SMART_NAV_INNER,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 28,
      borderWidth: 1,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? {
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 24px rgba(28, 22, 19, 0.12)',
          }
        : {
            shadowColor: '#1c1613',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 12,
          }),
    },
    smartNavbarBarBare: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      overflow: 'visible',
      paddingHorizontal: 4,
      paddingVertical: 0,
      ...(Platform.OS === 'web'
        ? { backdropFilter: 'none', WebkitBackdropFilter: 'none', boxShadow: 'none' }
        : { shadowOpacity: 0, elevation: 0 }),
    },
    smartNavbarLeft: {
      flex: 1,
      minWidth: 0,
    },
    smartNavbarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    smartNavbarChip: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: SMART_NAV_INNER,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 28,
      borderWidth: 1,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? {
            backdropFilter: 'blur(22px) saturate(170%)',
            WebkitBackdropFilter: 'blur(22px) saturate(170%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 22px rgba(80, 150, 175, 0.14)',
          }
        : {
            shadowColor: '#4a90a4',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 8,
          }),
    },
    smartNavbarChipRound: {
      width: SMART_NAV_INNER,
      height: SMART_NAV_INNER,
      borderRadius: SMART_NAV_INNER / 2,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? {
            backdropFilter: 'blur(22px) saturate(170%)',
            WebkitBackdropFilter: 'blur(22px) saturate(170%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 22px rgba(80, 150, 175, 0.14)',
          }
        : {
            shadowColor: '#1c1613',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 8,
          }),
    },
    frostedWrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
    },
    frostedBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screenMd,
      paddingBottom: 10,
      gap: 12,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? {
            backdropFilter: 'blur(18px) saturate(140%)',
            WebkitBackdropFilter: 'blur(18px) saturate(140%)',
          }
        : {}),
    },
    frostedLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
    frostedRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
    tabHeroNavbar: {
      marginBottom: 16,
    },
    tabHeroTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    tabHeroTitle: {
      flex: 1,
      fontSize: 30,
      ...bodyFont('800'),
    },
    tabHeroRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    tabHeroSub: {
      fontSize: 14,
      lineHeight: 21,
      marginTop: 6,
      maxWidth: '92%',
    },
    card: {
      width: '100%',
    },
    cardInner: {
      backgroundColor: 'transparent',
      borderRadius: 20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      overflow: 'hidden',
    },
    cardInnerCircle: {
      overflow: 'visible',
      borderRadius: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
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
      zIndex: 5,
    },
    discountCompact: {
      left: 6,
      top: 6,
      borderRadius: 6,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    discountText: { color: colors.onAccent, fontWeight: '700', fontSize: 11 },
    discountTextCompact: { fontSize: 9 },
    cardBadge: {
      position: 'absolute',
      left: 12,
      top: 12,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      zIndex: 5,
      backgroundColor: colors.gold,
    },
    cardBadgeNouveau: { backgroundColor: colors.gold },
    cardBadgeLocal: { backgroundColor: colors.green },
    cardBadgeRupture: { backgroundColor: colors.muted },
    cardBadgeText: { color: colors.onAccent, fontWeight: '700', fontSize: 11 },
    stockOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(28,22,19,0.38)',
      borderRadius: 16,
    },
    imagePanelCompact: {
      borderRadius: 12,
    },
    imagePanelCircle: {
      overflow: 'visible',
      borderRadius: 0,
      backgroundColor: 'transparent',
    },
    overlayCircle: {
      left: 0,
      top: 0,
      zIndex: 5,
      elevation: 5,
    },
    heartCircle: {
      right: -2,
      top: -2,
      zIndex: 6,
      elevation: 6,
    },
    heart: {
      position: 'absolute',
      right: 10,
      top: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 6,
      opacity: 0.92,
    },
    heartCompact: {
      right: 6,
      top: 6,
      width: 26,
      height: 26,
      borderRadius: 13,
    },
    rowDisabled: {
      backgroundColor: colors.muted,
      opacity: 0.85,
      paddingRight: 10,
    },
    info: { paddingHorizontal: 4, paddingTop: 10, paddingBottom: 10, gap: 8 },
    infoCompact: { paddingTop: 6, paddingBottom: 4, gap: 5, paddingHorizontal: 2 },
    infoText: { gap: 4 },
    name: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      ...displayFont('700'),
    },
    nameCompact: { fontSize: 12, lineHeight: 16 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    metaRowCompact: { gap: 2 },
    unit: { color: colors.muted, fontSize: 12, flexShrink: 1 },
    unitCompact: { fontSize: 10 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
    ratingRowCompact: { gap: 2, flexShrink: 0 },
    ratingText: { color: colors.muted, fontSize: 11, fontWeight: '600', flexShrink: 1 },
    ratingTextCompact: { fontSize: 9 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      alignSelf: 'flex-end',
      gap: 6,
      backgroundColor: colors.gold,
      borderRadius: 12,
      paddingLeft: 10,
      paddingRight: 8,
      paddingVertical: 6,
      minHeight: 36,
      maxWidth: '100%',
    },
    rowCompact: {
      alignSelf: 'flex-end',
      justifyContent: 'flex-start',
      gap: 4,
      borderRadius: 10,
      paddingLeft: 7,
      paddingRight: 5,
      paddingVertical: 4,
      minHeight: 30,
    },
    rowInCart: {
      paddingRight: 8,
      paddingLeft: 6,
      gap: 2,
    },
    rowDeal: {
      paddingVertical: 5,
    },
    rowAnimAnchor: {
      alignSelf: 'flex-end',
      transformOrigin: 'right center',
      maxWidth: '100%',
    },
    rowAnimAnchorCompact: {
      alignSelf: 'flex-end',
      maxWidth: '100%',
    },
    qtyPriceMid: {
      minWidth: 52,
      maxWidth: 88,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    qtyPriceMidCompact: {
      minWidth: 44,
      maxWidth: 72,
      paddingHorizontal: 2,
    },
    qtyOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(28, 22, 19, 0.48)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 4,
    },
    qtyOverlayText: {
      color: colors.onAccent,
      fontSize: 34,
      lineHeight: 38,
      ...displayFont('800'),
      textShadowColor: 'rgba(0,0,0,0.25)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    qtyOverlayTextCompact: {
      fontSize: 28,
      lineHeight: 32,
    },
    priceStack: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 5,
      flexShrink: 1,
      minWidth: 0,
    },
    priceStackCompact: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 4,
      flexShrink: 1,
    },
    price: { color: colors.onAccent, fontWeight: '700', fontSize: 13, flexShrink: 1, opacity: 1 },
    priceCompact: { fontSize: 11 },
    priceOld: {
      color: 'rgba(255,255,255,0.72)',
      fontWeight: '600',
      fontSize: 12,
      textDecorationLine: 'line-through',
      flexShrink: 1,
    },
    priceOldCompact: { fontSize: 10 },
    add: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      backgroundColor: 'transparent',
      opacity: 1,
    },
    addCompact: { width: 16, height: 16 },
    stepBtn: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    stepBtnCompact: { width: 18, height: 18 },
    stepSign: { color: colors.onAccent, fontWeight: '700', fontSize: 16, lineHeight: 18 },
    qtyVal: {
      color: colors.onAccent,
      fontWeight: '700',
      fontSize: 13,
      minWidth: 16,
      textAlign: 'center',
      flexShrink: 0,
    },
    qtyValCompact: { fontSize: 11, minWidth: 12 },
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
    searchPlaceholder: { flex: 1, color: colors.placeholder, fontSize: 15 },
    input: {
      flex: 1,
      // Keep ≥16 so mobile browsers don't zoom the page when the field focuses.
      fontSize: 16,
      color: colors.text,
      padding: 0,
      margin: 0,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}),
    },
    tilePress: { minWidth: 0 },
    tilePressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
    tile: {
      flex: 1,
      borderRadius: 20,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      backgroundColor: colors.border,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
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
      borderRadius: 20,
    },
    tileImageZoom: {
      position: 'absolute',
      width: '118%',
      height: '118%',
      top: '-9%',
      left: '-9%',
    },
    tileImage: {
      width: '100%',
      height: '100%',
      ...(Platform.OS === 'web' ? { objectFit: 'cover' as const } : {}),
    },
    tileGradientWeb: {
      backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 38%, rgba(0,0,0,0.42) 72%, rgba(0,0,0,0.78) 100%)',
    } as object,
    tileFooter: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 8,
      padding: 12,
      paddingRight: 10,
      zIndex: 1,
      width: '100%',
    },
    tileTextBlock: { flex: 1, gap: 2 },
    tileTitle: {
      color: '#ffffff',
      fontSize: 14,
      lineHeight: 18,
      ...displayFont('700'),
      textShadowColor: 'rgba(0,0,0,0.55)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    tileCount: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 11,
      fontWeight: '600',
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    tileArrow: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cta: {
      backgroundColor: colors.terracotta,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { color: colors.onAccent, fontWeight: '700', fontSize: 16 },
    iconCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'visible',
    },
    iconCircleSm: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    iconCircleLg: {
      width: SMART_NAV_INNER,
      height: SMART_NAV_INNER,
      borderRadius: SMART_NAV_INNER / 2,
    },
    iconCircleGhost: {
      borderWidth: 1,
      ...(Platform.OS === 'web'
        ? {
            backdropFilter: 'blur(22px) saturate(170%)',
            WebkitBackdropFilter: 'blur(22px) saturate(170%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 22px rgba(80, 150, 175, 0.14)',
          }
        : {}),
    },
    iconCircleOnPhoto: Platform.select({
      web: { boxShadow: '0 4px 14px rgba(28,22,19,0.22)' },
      default: {
        shadowColor: '#1c1613',
        shadowOpacity: 0.22,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      },
    }),
    iconCircleBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: colors.terracotta,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: '#ffffff',
    },
    iconCircleBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
    totalFab: {
      position: 'absolute',
      right: spacing.screen,
      zIndex: 20,
      maxWidth: '72%',
    },
    totalFabInner: {
      backgroundColor: colors.terracotta,
      borderRadius: 999,
      paddingLeft: 8,
      paddingRight: 10,
      paddingVertical: 6,
      minHeight: 42,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      ...softShadow({ y: 8, blur: 28, opacity: 0.2, elevation: 10 }),
    },
    totalFabIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
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
      color: colors.onAccent,
      fontWeight: '800',
      fontSize: 13,
      letterSpacing: 0.2,
    },
    totalFabOld: {
      color: 'rgba(255,255,255,0.55)',
      fontWeight: '600',
      fontSize: 12,
      textDecorationLine: 'line-through',
    },
    promo: {
      width: '100%',
      maxWidth: '100%',
      height: 150,
      borderRadius: 24,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      padding: 18,
    },
    promoImg: StyleSheet.absoluteFillObject,
    promoDim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    // Always light text: banner sits on a dimmed photo (theme white/cream flip in dark mode).
    promoTitle: { color: '#ffffff', fontSize: 20, ...displayFont('800') },
    promoSub: { color: 'rgba(253,240,213,0.92)', fontSize: 14, marginTop: 4 },
    profiter: {
      alignSelf: 'flex-start',
      backgroundColor: colors.gold,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginTop: 12,
    },
    profiterText: { color: '#1c1613', fontWeight: '700', fontSize: 12 },
  });
}
