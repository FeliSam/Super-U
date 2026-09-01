import { AppImage } from '@/components/AppImage';
import { MobileModalFrame } from '@/components/MobileModalFrame';
import { goBack } from '@/lib/navigation';
import { EmptyStateHero } from '@/components/EmptyStateHero';
import { PressScale } from '@/components/motion';
import {
  CartTotalFab,
  IconCircle,
  Page,
  Screen,
} from '@/components/ui';
import { displayFont, heroChrome, type AppColors, spacing } from '@/constants/theme';
import { useColors, useTheme } from '@/context/ThemeContext';
import { useCatalog } from '@/context/CatalogContext';
import {
  categoryFilters,
  exploreCategories,
  productReviewStats,
  uniqueFamilyProducts,
  type Product,
} from '@/data/catalog';
import { rankProductsForShopper } from '@/lib/homeEngine';
import { ProductFlashGrid } from '@/components/ProductFlashGrid';
import { openSearchScreen } from '@/lib/searchNav';
import { useExpandableSheet, SHEET_MIN_RATIO } from '@/lib/expandableSheet';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useOrders } from '@/context/OrdersContext';
import { useProfile } from '@/context/ProfileContext';
import { useUiState } from '@/context/UiStateContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureRoot } from '@/components/GestureRoot';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SortKey = 'pertinence' | 'price-asc' | 'price-desc' | 'rating' | 'promo';

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { key: 'pertinence', label: 'Pertinence', icon: 'zap' },
  { key: 'price-asc', label: 'Prix croissant', icon: 'arrow-up' },
  { key: 'price-desc', label: 'Prix décroissant', icon: 'arrow-down' },
  { key: 'rating', label: 'Mieux notés', icon: 'star' },
  { key: 'promo', label: 'Promotions', icon: 'tag' },
];

const GRID_IMAGE_H = Math.round(128 * 1.15);
/** First paint + each onEndReached append. Rank/filter the full list first, then slice. */
const PAGE_SIZE = 10;

function hashAccount(id?: string) {
  if (!id) return 0;
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function filterCategoryList(list: Product[], active: string) {
  if (!active || active === 'Tous') return list;
  if (active === 'Fruits') {
    return list.filter((p) => /mangue|banane|pomme|papaye|ananas|plantain/i.test(p.name));
  }
  if (active === 'Légumes') {
    return list.filter((p) => /tomate|gombo|patate|carotte|gingembre|légume|legume/i.test(p.name));
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
  if (active === 'Riz') return list.filter((p) => /riz/i.test(p.name));
  if (active === 'Attiéké') return list.filter((p) => /attiéké|attieke/i.test(p.name));
  if (active === 'Farines') return list.filter((p) => /farine|semoule|gari/i.test(p.name));
  if (active === 'Huiles') return list.filter((p) => /huile/i.test(p.name));
  if (active === 'Sauces') return list.filter((p) => /sauce|concentré|mayonnaise|cube/i.test(p.name));
  if (active === 'Pain') return list.filter((p) => /pain|baguette/i.test(p.name));
  if (active === 'Viennoiserie') return list.filter((p) => /croissant|brioche/i.test(p.name));
  if (active === 'Salé') return list.filter((p) => /chip|cacahu/i.test(p.name));
  if (active === 'Sucré') return list.filter((p) => /biscuit/i.test(p.name));
  if (active === 'Café') return list.filter((p) => /café|cafe/i.test(p.name));
  if (active === 'Thé') return list.filter((p) => /thé|the |kinkeliba/i.test(p.name));
  if (active === 'Plats') return list.filter((p) => /pizza|filet/i.test(p.name));
  if (active === 'Poisson') return list.filter((p) => /sardine|thon/i.test(p.name));
  if (active === 'Bière') return list.filter((p) => /bière|biere/i.test(p.name));
  if (active === 'Vin') return list.filter((p) => /vin/i.test(p.name));
  if (active === 'Corps') return list.filter((p) => /savon|shampoing|papier/i.test(p.name));
  if (active === 'Oral') return list.filter((p) => /dentifrice/i.test(p.name));
  if (active === 'Entretien') return list.filter((p) => /lessive|vaisselle|javel|sac/i.test(p.name));
  if (active === 'Couches') return list.filter((p) => /couche|lingette/i.test(p.name));
  if (active === 'Repas') return list.filter((p) => /lait 2|petit.?pot/i.test(p.name));
  if (active === 'Chien') return list.filter((p) => /chien/i.test(p.name));
  if (active === 'Chat') return list.filter((p) => /chat|litière|litiere/i.test(p.name));
  return list;
}

function sortCategoryList(
  list: Product[],
  sort: SortKey,
  rank?: (items: Product[]) => Product[],
) {
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
  return rank ? rank(list) : list;
}

export default function CategoryScreen() {
  const { version: catalogVersion, products, productsInCategory } = useCatalog();
  const colors = useColors();
  const { scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const heroTitleSize = Math.round(Math.min(34, Math.max(22, windowWidth * 0.07)));

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
    expandedSV,
  } = useExpandableSheet({
    minRatio: SHEET_MIN_RATIO * 0.7,
    lockCollapseToHandle: true,
    initiallyExpanded: true,
  });

  const heroPopStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandedSV.value, [0, 0.85], [1, 0]),
  }));
  const barTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandedSV.value, [0.2, 0.85], [0, 1]),
  }));

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
  const [visitSalt] = useState(() => Date.now());
  const { session } = useAuth();
  const { lines } = useCart();
  const { ids: favoriteIds } = useFavorites();
  const { orders } = useOrders();
  const { profile } = useProfile();
  const { searchRecents, interests } = useUiState();
  const orderedIds = useMemo(
    () => orders.flatMap((order) => order.lines.map((line) => line.productId)).slice(0, 48),
    [orders],
  );
  const shopperSignals = useMemo(
    () => ({
      recents: searchRecents,
      favoriteIds,
      cartIds: lines.map((line) => line.productId),
      orderedIds,
      interests,
      firstName: profile.firstName,
      hour: new Date().getHours(),
      sessionSalt: visitSalt + hashAccount(session?.accountId),
    }),
    [
      searchRecents,
      favoriteIds,
      lines,
      orderedIds,
      interests,
      profile.firstName,
      visitSalt,
      session?.accountId,
    ],
  );

  useEffect(() => {
    if (typeof filter !== 'string' || !filters.includes(filter)) return;
    setActive((prev) => (prev === filter ? prev : filter));
  }, [filter, filters]);

  const baseList = useMemo(() => {
    const inCat = productsInCategory(id ?? '');
    const raw = inCat.length ? inCat : products;
    return uniqueFamilyProducts(raw);
  }, [id, catalogVersion, products, productsInCategory]);

  const list = useMemo(
    () =>
      sortCategoryList(filterCategoryList(baseList, active), sort, (items) =>
        rankProductsForShopper(items, shopperSignals),
      ),
    [baseList, active, sort, shopperSignals],
  );

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [appending, setAppending] = useState(false);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setAppending(false);
  }, [id, active, sort]);

  const visibleList = useMemo(() => list.slice(0, visibleCount), [list, visibleCount]);
  const hasMore = visibleCount < list.length;

  const loadMore = useCallback(() => {
    if (!hasMore || appending) return;
    setAppending(true);
    requestAnimationFrame(() => {
      setVisibleCount((n) => Math.min(n + PAGE_SIZE, list.length));
      setAppending(false);
    });
  }, [hasMore, appending, list.length]);

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Pertinence';
  const title = cat?.title ?? 'Catégorie';
  const fabBottom = Math.max(16, insets.bottom + 12);
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);

  return (
    <Screen>
      <Page style={styles.flex} edgeToEdge>
        <GestureRoot style={styles.flex}>
          <View style={styles.hero} pointerEvents="box-none">
            <LinearGradient
              colors={chrome.gradient}
              locations={[0, 0.42, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {cat?.image ? (
              <Animated.View style={[styles.heroPop, heroPopStyle]} pointerEvents="none">
                <AppImage
                  source={cat.image}
                  frameStyle={styles.heroPopImage}
                  contentFit="cover"
                  priority="low"
                />
              </Animated.View>
            ) : null}
            <View style={[styles.heroBar, { paddingTop: Math.max(10, insets.top + 6) }]}>
              <IconCircle
                name="chevron-left"
                variant="hero"
                accessibilityLabel="Retour"
                onPress={() => goBack()}
              />
              <Animated.Text
                style={[styles.barTitle, barTitleStyle]}
                numberOfLines={1}
                accessibilityRole="header">
                {title}
              </Animated.Text>
              <IconCircle
                name="search"
                variant="hero"
                accessibilityLabel="Rechercher"
                onPress={openSearchScreen}
              />
            </View>
            <View style={[styles.heroCopy, { bottom: sheetMin + 28 }]} pointerEvents="none">
              <Text style={styles.heroEyebrow}>Rayon</Text>
              <Text
                style={[styles.heroTitle, { fontSize: heroTitleSize, lineHeight: Math.round(heroTitleSize * 1.15) }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.7}>
                {title}
              </Text>
              <Text style={styles.heroSub}>
                {baseList.length} produit{baseList.length > 1 ? 's' : ''} · frais du jour
              </Text>
            </View>
          </View>

          <Animated.View
            style={[
              styles.sheet,
              { height: sheetMax },
              sheetAnimStyle,
              { paddingBottom: Math.max(8, insets.bottom) },
            ]}>
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
            <Animated.View style={styles.sheetBody}>
            <View style={styles.sheetChrome}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersScroll}
                contentContainerStyle={styles.filters}
                bounces={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={onFiltersScroll}>
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
              </ScrollView>

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
            </View>

            <ProductFlashGrid
              products={visibleList}
              extraData={`${active}-${sort}-${visibleList.length}-${appending}`}
              imageHeight={GRID_IMAGE_H}
              listRef={sheetScrollRef as never}
              style={styles.sheetScroll}
              contentContainerStyle={[styles.sheetScrollContent, { paddingBottom: fabBottom + 96 }]}
              scrollEnabled={listScrollEnabled}
              onScroll={onSheetScroll as (event: unknown) => void}
              onScrollBeginDrag={onSheetScrollBeginDrag as (event: unknown) => void}
              onScrollEndDrag={onSheetScrollEndDrag as (event: unknown) => void}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              footer={
                appending ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ActivityIndicator color={colors.gold} />
                  </View>
                ) : null
              }
              empty={
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
              }
            />
            </Animated.View>
            </GestureDetector>

            <CartTotalFab bottom={fabBottom} />
          </Animated.View>
        </GestureRoot>

        <Modal
          visible={sortOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSortOpen(false)}>
          <MobileModalFrame align="bottom" onDismiss={() => setSortOpen(false)}>
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
          </MobileModalFrame>
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
      overflow: 'visible',
    },
    heroPop: {
      position: 'absolute',
      right: -28,
      bottom: '18%',
      width: '58%',
      height: '62%',
      zIndex: 1,
    },
    heroPopImage: {
      width: '100%',
      height: '100%',
      borderRadius: 36,
    },
    heroBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: spacing.screenMd,
    },
    barTitle: {
      flex: 1,
      ...displayFont('800'),
      color: colors.text,
      fontSize: 17,
      lineHeight: 22,
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    heroCopy: {
      position: 'absolute',
      left: spacing.screen,
      right: '42%',
      zIndex: 1,
      gap: 6,
    },
    heroEyebrow: {
      color: colors.gold,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    heroTitle: {
      ...displayFont('800'),
      color: colors.text,
      fontSize: 30,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    heroSub: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: '600',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 8,
      zIndex: 5,
      overflow: 'hidden',
      flexDirection: 'column',
      ...Platform.select({
        ios: {
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.14,
          shadowRadius: 16,
        },
        android: { elevation: 8 },
        web: {
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        } as object,
        default: {},
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
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.grabber,
    },
    sheetBody: {
      flex: 1,
      minHeight: 0,
    },
    sheetChrome: {
      backgroundColor: colors.bg,
      paddingBottom: 6,
      zIndex: 6,
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
    },
    filtersScroll: {
      flexGrow: 0,
      flexShrink: 0,
      ...(Platform.OS === 'web' ? ({ touchAction: 'pan-x' } as object) : {}),
    },
    filters: {
      paddingHorizontal: spacing.screen,
      gap: 8,
      paddingBottom: 0,
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
      paddingHorizontal: spacing.screen,
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
      paddingHorizontal: spacing.screen,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2,
    },
    cell: {},
    emptyWrap: {
      flexGrow: 1,
      paddingHorizontal: spacing.screen,
      paddingTop: 16,
      paddingBottom: 48,
      justifyContent: 'center',
    },
    modalCard: {
      backgroundColor: colors.white,
      borderRadius: 22,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 28,
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
