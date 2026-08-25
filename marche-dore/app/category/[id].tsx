import { AppImage } from '@/components/AppImage';
import { EmptyStateHero } from '@/components/EmptyStateHero';
import { MotionView, PressScale } from '@/components/motion';
import {
  CartTotalFab,
  IconCircle,
  Page,
  ProductCard,
  Screen,
} from '@/components/ui';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import {
  categoryFilters,
  exploreCategories,
  productReviewStats,
  products,
  productsInCategory,
  type Product,
} from '@/data/catalog';
import { openSearchScreen } from '@/lib/searchNav';
import { softShadow } from '@/lib/shadow';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SortKey = 'pertinence' | 'price-asc' | 'price-desc' | 'rating' | 'promo';

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { key: 'pertinence', label: 'Pertinence', icon: 'zap' },
  { key: 'price-asc', label: 'Prix croissant', icon: 'arrow-up' },
  { key: 'price-desc', label: 'Prix décroissant', icon: 'arrow-down' },
  { key: 'rating', label: 'Mieux notés', icon: 'star' },
  { key: 'promo', label: 'Promotions', icon: 'tag' },
];

const GRID_IMAGE_H = 148;
const WINDOW_H = Dimensions.get('window').height;
const SHEET_MIN = Math.round(WINDOW_H * 0.58);

const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView);

function filterCategoryList(list: Product[], active: string) {
  if (!active || active === 'Tous') return list;
  if (active === 'Fruits') {
    return list.filter((p) => /mangue|banane|pomme|papaye|ananas|plantain/i.test(p.name));
  }
  if (active === 'Légumes') {
    return list.filter((p) => /tomate|gombo|patate|carotte|gingembre/i.test(p.name));
  }
  if (active === 'Locaux') {
    return list.filter((p) => p.badge === 'local' || /bénin|local|ferme/i.test(p.producer ?? ''));
  }
  if (active === 'Bio') {
    return list.filter((p) => /bio/i.test(p.name) || /bio/i.test(p.description ?? ''));
  }
  if (active === 'Promo') {
    return list.filter((p) => Boolean(p.discount || p.oldPrice));
  }
  if (active === 'Nouveautés') {
    return list.filter((p) => p.badge === 'nouveau');
  }
  if (active === 'Sorbets') {
    return list.filter((p) => /sorbet/i.test(p.name));
  }
  if (active === 'Bâtonnets') {
    return list.filter((p) => /bâtonnet|batonnet/i.test(p.name));
  }
  return list;
}

function sortCategoryList(list: Product[], sort: SortKey) {
  if (sort === 'price-asc') return [...list].sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') return [...list].sort((a, b) => b.price - a.price);
  if (sort === 'rating') {
    return [...list].sort(
      (a, b) => productReviewStats(b).rating - productReviewStats(a).rating,
    );
  }
  if (sort === 'promo') {
    return [...list].sort((a, b) => {
      const ap = a.discount || a.oldPrice ? 1 : 0;
      const bp = b.discount || b.oldPrice ? 1 : 0;
      return bp - ap || a.price - b.price;
    });
  }
  return list;
}

export default function CategoryScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cellWidth = Math.floor((width - 40 - 12) / 2);

  const sheetMin = Math.round(height * 0.58);
  const sheetMax = Math.round(Math.min(height * 0.92, height - insets.top - 8));
  const sheetMid = Math.round((sheetMin + sheetMax) / 2);

  const { id, filter } = useLocalSearchParams<{ id: string; filter?: string }>();
  const cat = exploreCategories.find((c) => c.id === id);
  const filters = useMemo(
    () => categoryFilters[id ?? ''] ?? ['Tous', 'Promo', 'Nouveautés', 'Locaux'],
    [id],
  );
  const initialFilter =
    typeof filter === 'string' && filters.includes(filter) ? filter : filters[0];

  const [active, setActive] = useState(initialFilter);
  const [sort, setSort] = useState<SortKey>('pertinence');
  const [sortOpen, setSortOpen] = useState(false);

  const sheetH = useSharedValue(SHEET_MIN);
  const dragStartH = useSharedValue(SHEET_MIN);
  const minH = useSharedValue(sheetMin);
  const maxH = useSharedValue(sheetMax);
  const midH = useSharedValue(sheetMid);
  const expanded = useSharedValue(0);

  useEffect(() => {
    minH.value = sheetMin;
    maxH.value = sheetMax;
    midH.value = sheetMid;
    const target = expanded.value ? sheetMax : sheetMin;
    sheetH.value = withSpring(target, { damping: 24, stiffness: 240, mass: 0.85 });
  }, [sheetMin, sheetMax, sheetMid, sheetH, minH, maxH, midH, expanded]);

  useEffect(() => {
    if (typeof filter === 'string' && filters.includes(filter)) setActive(filter);
  }, [filter, filters]);

  const baseList = useMemo(() => {
    const inCat = productsInCategory(id ?? '');
    return inCat.length ? inCat : products;
  }, [id]);

  const list = useMemo(
    () => sortCategoryList(filterCategoryList(baseList, active), sort),
    [baseList, active, sort],
  );

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Pertinence';
  const title = cat?.title ?? 'Catégorie';
  const fabBottom = Math.max(16, insets.bottom + 12);

  const snapTo = useCallback(
    (toMax: boolean) => {
      expanded.value = toMax ? 1 : 0;
      sheetH.value = withSpring(toMax ? maxH.value : minH.value, {
        damping: 24,
        stiffness: 240,
        mass: 0.85,
      });
    },
    [expanded, sheetH, maxH, minH],
  );

  const toggleSheet = useCallback(() => {
    snapTo(sheetH.value < midH.value);
  }, [snapTo, sheetH, midH]);

  const sheetPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-3, 3])
        .failOffsetX([-20, 20])
        .onStart(() => {
          'worklet';
          dragStartH.value = sheetH.value;
        })
        .onUpdate((e) => {
          'worklet';
          const next = dragStartH.value - e.translationY;
          sheetH.value = Math.min(maxH.value, Math.max(minH.value, next));
        })
        .onEnd((e) => {
          'worklet';
          const projected = sheetH.value - e.velocityY * 0.18;
          const flingUp = e.velocityY < -280;
          const flingDown = e.velocityY > 280;
          const toMax = flingUp || (!flingDown && projected > midH.value);
          expanded.value = toMax ? 1 : 0;
          sheetH.value = withSpring(toMax ? maxH.value : minH.value, {
            damping: 24,
            stiffness: 240,
            mass: 0.85,
          });
        }),
    [dragStartH, sheetH, minH, maxH, midH, expanded],
  );

  const sheetTap = useMemo(
    () =>
      Gesture.Tap().onEnd((_e, success) => {
        'worklet';
        if (success) runOnJS(toggleSheet)();
      }),
    [toggleSheet],
  );

  const sheetHandleGesture = useMemo(
    () => Gesture.Race(sheetPan, sheetTap),
    [sheetPan, sheetTap],
  );

  const sheetAnimStyle = useAnimatedStyle(() => ({
    height: sheetH.value,
  }));

  return (
    <Screen>
      <Page style={styles.flex} edgeToEdge>
        <GestureHandlerRootView style={styles.flex}>
          <View style={styles.hero} pointerEvents="box-none">
            {cat?.image ? (
              <AppImage source={cat.image} frameStyle={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.cream }]} />
            )}
            <LinearGradient
              colors={['rgba(20,17,15,0.15)', 'rgba(20,17,15,0.55)', 'rgba(20,17,15,0.82)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={[styles.heroBar, { paddingTop: Math.max(10, insets.top + 6) }]}>
              <IconCircle
                name="chevron-left"
                bg="rgba(255,255,255,0.92)"
                accessibilityLabel="Retour"
                onPress={() => router.back()}
              />
              <IconCircle
                name="search"
                bg="rgba(255,255,255,0.92)"
                accessibilityLabel="Rechercher"
                onPress={openSearchScreen}
              />
            </View>
            <View style={[styles.heroCopy, { bottom: sheetMin - 12 }]} pointerEvents="none">
              <Text style={styles.heroEyebrow}>Marché Doré</Text>
              <Text style={styles.heroTitle}>{title}</Text>
              <Text style={styles.heroSub}>
                {baseList.length} produit{baseList.length > 1 ? 's' : ''} · frais du jour
              </Text>
            </View>
          </View>

          <Animated.View
            style={[
              styles.sheet,
              sheetAnimStyle,
              softShadow({ y: -8, blur: 28, opacity: 0.14, elevation: 12 }),
              { backgroundColor: colors.bg, paddingBottom: Math.max(8, insets.bottom) },
            ]}>
            <GestureDetector gesture={sheetHandleGesture}>
              <Animated.View
                style={styles.sheetHandleHit}
                accessibilityRole="button"
                accessibilityLabel="Agrandir ou réduire la feuille">
                <View style={[styles.sheetHandleBar, { backgroundColor: colors.border }]} />
              </Animated.View>
            </GestureDetector>

            <AnimatedGHScrollView
              style={styles.sheetScroll}
              contentContainerStyle={[styles.sheetScrollContent, { paddingBottom: fabBottom + 96 }]}
              showsVerticalScrollIndicator={false}
              bounces
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled>
              <GHScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersScroll}
                contentContainerStyle={styles.filters}
                nestedScrollEnabled
                bounces={false}>
                {filters.map((f) => {
                  const on = active === f;
                  return (
                    <PressScale
                      key={f}
                      onPress={() => setActive(f)}
                      scaleTo={0.96}
                      style={[styles.chip, on && styles.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Filtre ${f}`}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{f}</Text>
                    </PressScale>
                  );
                })}
              </GHScrollView>

              <View style={styles.meta}>
                <Text style={styles.found}>
                  {list.length} produit{list.length !== 1 ? 's' : ''}
                  {active !== 'Tous' ? ` · ${active}` : ''}
                </Text>
                <Pressable
                  style={styles.sortBtn}
                  onPress={() => setSortOpen(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Trier par ${sortLabel}`}>
                  <Feather name="sliders" size={13} color={colors.gold} />
                  <Text style={styles.sort}>{sortLabel}</Text>
                  <Feather name="chevron-down" size={13} color={colors.muted} />
                </Pressable>
              </View>

              {list.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <EmptyStateHero
                    icon="package"
                    title="Aucun produit"
                    subtitle={
                      active === 'Bio'
                        ? 'La sélection bio arrive bientôt. Explorez nos produits locaux en attendant.'
                        : `Aucun article pour « ${active} ». Essayez un autre filtre.`
                    }
                    primaryLabel={active === 'Tous' ? 'Voir tout le catalogue' : 'Voir tous'}
                    primaryIcon="grid"
                    onPrimary={() => {
                      if (active === 'Tous') router.push('/(tabs)/explore');
                      else setActive('Tous');
                    }}
                    secondaryLabel="Rechercher"
                    secondaryIcon="search"
                    onSecondary={openSearchScreen}
                  />
                </View>
              ) : (
                <View style={styles.grid}>
                  {list.map((p, i) => (
                    <MotionView
                      key={p.id}
                      index={i}
                      preset="up"
                      style={[styles.cell, { width: cellWidth }]}>
                      <ProductCard
                        product={p}
                        width="100%"
                        imageHeight={GRID_IMAGE_H}
                        compact
                        index={i}
                        animate={false}
                      />
                    </MotionView>
                  ))}
                </View>
              )}
            </AnimatedGHScrollView>

            <CartTotalFab bottom={fabBottom} />
          </Animated.View>
        </GestureHandlerRootView>

        <Modal
          visible={sortOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSortOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSortOpen(false)}>
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Trier par</Text>
              {SORT_OPTIONS.map((opt) => {
                const on = sort === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.modalRow, on && styles.modalRowOn]}
                    onPress={() => {
                      setSort(opt.key);
                      setSortOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}>
                    <Feather name={opt.icon} size={16} color={on ? colors.gold : colors.muted} />
                    <Text style={[styles.modalRowText, on && styles.modalRowTextOn]}>{opt.label}</Text>
                    {on ? <Feather name="check" size={16} color={colors.gold} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Modal>
      </Page>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    hero: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.cream,
    },
    heroBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    heroCopy: {
      position: 'absolute',
      left: 20,
      right: 20,
      zIndex: 1,
      gap: 4,
    },
    heroEyebrow: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    heroTitle: {
      ...displayFont('800'),
      color: '#ffffff',
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.4,
    },
    heroSub: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 14,
      fontWeight: '600',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      zIndex: 5,
      overflow: 'hidden',
      flexDirection: 'column',
    },
    sheetHandleHit: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      paddingTop: 16,
      paddingBottom: 14,
      ...(Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as object) : {}),
    },
    sheetHandleBar: {
      width: 48,
      height: 5,
      borderRadius: 999,
    },
    sheetScroll: {
      flex: 1,
      minHeight: 0,
    },
    sheetScrollContent: {
      flexGrow: 1,
    },
    filtersScroll: {
      flexGrow: 0,
      flexShrink: 0,
    },
    filters: {
      paddingHorizontal: 20,
      gap: 8,
      paddingBottom: 10,
      alignItems: 'center',
    },
    chip: {
      backgroundColor: colors.white,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipOn: { backgroundColor: colors.gold },
    chipText: {
      color: colors.muted,
      fontWeight: '600',
      fontSize: 13,
      lineHeight: 18,
    },
    chipTextOn: { color: colors.onAccent, fontWeight: '700' },
    meta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 10,
      gap: 12,
    },
    found: { color: colors.placeholder, fontSize: 13, fontWeight: '600', flexShrink: 1 },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.white,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      minHeight: 32,
    },
    sort: { color: colors.text, fontSize: 12, fontWeight: '700' },
    grid: {
      paddingHorizontal: 20,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    cell: {},
    emptyWrap: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 48,
      justifyContent: 'center',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
      padding: 16,
      paddingBottom: 28,
    },
    modalCard: {
      backgroundColor: colors.white,
      borderRadius: 22,
      padding: 16,
      gap: 4,
    },
    modalTitle: {
      ...displayFont('700'),
      color: colors.text,
      fontSize: 17,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    modalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 14,
      minHeight: 48,
    },
    modalRowOn: { backgroundColor: colors.cream },
    modalRowText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
    modalRowTextOn: { color: colors.gold, fontWeight: '700' },
  });
}
