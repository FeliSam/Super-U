import { AppImage } from '@/components/AppImage';
import { EmptyStateHero } from '@/components/EmptyStateHero';
import { IconCircle, Page, ProductCard, Screen } from '@/components/ui';
import { type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { promoProducts, type Product } from '@/data/catalog';
import { formatFcfa } from '@/lib/format';
import { goBack, navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FilterId = 'all' | 'promo';

function FavoriteRow({
  product,
  onRemove,
  onAdd,
}: {
  product: Product;
  onRemove: () => void;
  onAdd: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [justAdded, setJustAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAdd = () => {
    onAdd();
    setJustAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <View style={styles.row}>
      <Pressable style={styles.rowMain} onPress={() => router.push(`/product/${product.id}`)}>
        <AppImage source={product.image} frameStyle={styles.rowImage} />
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.rowUnit}>{product.unit}</Text>
          <View style={styles.rowPriceLine}>
            <Text style={styles.rowPrice}>{formatFcfa(product.price)}</Text>
            {product.discount ? (
              <View style={styles.promoPill}>
                <Text style={styles.promoPillText}>{product.discount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={styles.rowActions}>
        <Pressable
          style={[styles.iconBtn, justAdded && styles.iconBtnDone]}
          onPress={handleAdd}
          hitSlop={8}
          accessibilityLabel={justAdded ? 'Ajouté au panier' : 'Ajouter au panier'}
          accessibilityRole="button">
          <Feather
            name={justAdded ? 'check' : 'shopping-bag'}
            size={15}
            color={colors.onAccent}
          />
        </Pressable>
        <Pressable
          style={styles.iconBtnGhost}
          onPress={onRemove}
          hitSlop={8}
          accessibilityLabel="Retirer des favoris"
          accessibilityRole="button">
          <Feather name="heart" size={15} color={colors.terracotta} />
        </Pressable>
      </View>
    </View>
  );
}

export default function FavoritesScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { products, count, remove, clear, refresh } = useFavorites();
  const { add } = useCart();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<FilterId>('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [refreshing, setRefreshing] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  const cardWidth = Math.min((Math.min(width, 430) - 52) / 2, 180);
  const promoCount = useMemo(() => products.filter((p) => Boolean(p.discount || p.oldPrice)).length, [products]);
  const totalValue = useMemo(() => products.reduce((sum, p) => sum + p.price, 0), [products]);

  const filtered = useMemo(() => {
    if (filter === 'promo') return products.filter((p) => Boolean(p.discount || p.oldPrice));
    return products;
  }, [filter, products]);

  const suggestions = useMemo(() => {
    const liked = new Set(products.map((p) => p.id));
    return promoProducts()
      .filter((p) => !liked.has(p.id))
      .slice(0, 6);
  }, [products]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true }),
    );
    loop.start();
    try {
      await refresh();
      await new Promise((r) => setTimeout(r, 350));
    } finally {
      loop.stop();
      spin.setValue(0);
      setRefreshing(false);
    }
  }, [refresh, spin]);

  const addAll = () => {
    filtered.forEach((p) => add(p.id, 1));
    navigateTab(tabPaths.cart);
  };

  const spinStyle = {
    transform: [
      {
        rotate: spin.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'] }) },
    ] };

  return (
    <Screen>
      <Page style={styles.flex} edgeToEdge>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.terracotta}
              colors={[colors.terracotta]}
            />
          }>
          <LinearGradient colors={[colors.blush, colors.cream, colors.bg]} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
            <View style={styles.heroBar}>
              <IconCircle name="chevron-left" onPress={() => goBack()} variant="hero" />
              <Text style={styles.heroTitle}>Mes favoris</Text>
              <Pressable
                style={styles.refreshBtn}
                onPress={onRefresh}
                disabled={refreshing}
                accessibilityLabel="Actualiser les favoris">
                <Animated.View style={spinStyle}>
                  <Feather name="refresh-cw" size={15} color={colors.terracotta} />
                </Animated.View>
                <Text style={styles.refreshText}>Actualiser</Text>
              </Pressable>
            </View>

            <View style={styles.heroBody}>
              <View style={styles.heroIcon}>
                <Feather name="heart" size={28} color={colors.terracotta} />
              </View>
              <Text style={styles.heroCount}>
                {count} produit{count > 1 ? 's' : ''}
              </Text>
              <Text style={styles.heroSub}>
                {count > 0
                  ? `Valeur estimée · ${formatFcfa(totalValue)}`
                  : 'Enregistrez vos coups de cœur pour les retrouver vite.'}
              </Text>
              {count > 0 ? (
                <Pressable style={styles.clearBtn} onPress={clear}>
                  <Text style={styles.clearText}>Vider la liste</Text>
                </Pressable>
              ) : null}
            </View>

            {count > 0 ? (
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{count}</Text>
                  <Text style={styles.heroStatLabel}>Likés</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{promoCount}</Text>
                  <Text style={styles.heroStatLabel}>En promo</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{formatFcfa(totalValue).replace(' F', '')}</Text>
                  <Text style={styles.heroStatLabel}>Total F</Text>
                </View>
              </View>
            ) : null}
          </LinearGradient>

          <View style={styles.body}>
            {refreshing && count === 0 ? (
              <View style={styles.refreshingEmpty}>
                <ActivityIndicator color={colors.terracotta} />
                <Text style={styles.refreshingText}>Actualisation…</Text>
              </View>
            ) : null}

            {count === 0 && !refreshing ? (
              <EmptyStateHero
                icon="heart"
                badge="Favoris"
                title={'Aucun favori\npour l’instant'}
                subtitle="Touchez le cœur sur une fiche produit pour le retrouver ici et le rajouter vite au panier."
                primaryLabel="Explorer le marché"
                primaryIcon="compass"
                onPrimary={() => navigateTab(tabPaths.explore)}
                secondaryLabel="Voir les promotions"
                secondaryIcon="tag"
                onSecondary={() => router.push('/promotions')}
                perks={[
                  { icon: 'zap', label: 'Accès rapide', color: colors.gold },
                  { icon: 'bell', label: 'Alertes prix', color: colors.green },
                  { icon: 'shopping-bag', label: 'Ajout 1 tap', color: colors.terracotta },
                ]}
              />
            ) : count > 0 ? (
              <>
                <View style={styles.toolbar}>
                  <View style={styles.filters}>
                    <Pressable
                      style={[styles.chip, filter === 'all' && styles.chipOn]}
                      onPress={() => setFilter('all')}>
                      <Text style={[styles.chipText, filter === 'all' && styles.chipTextOn]}>Tous ({count})</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.chip, filter === 'promo' && styles.chipOn]}
                      onPress={() => setFilter('promo')}>
                      <Text style={[styles.chipText, filter === 'promo' && styles.chipTextOn]}>
                        Promos ({promoCount})
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.viewToggle}>
                    <Pressable
                      style={[styles.viewBtn, view === 'list' && styles.viewBtnOn]}
                      onPress={() => setView('list')}>
                      <Feather name="list" size={16} color={view === 'list' ? colors.white : colors.muted} />
                    </Pressable>
                    <Pressable
                      style={[styles.viewBtn, view === 'grid' && styles.viewBtnOn]}
                      onPress={() => setView('grid')}>
                      <Feather name="grid" size={15} color={view === 'grid' ? colors.white : colors.muted} />
                    </Pressable>
                  </View>
                </View>

                {filtered.length === 0 ? (
                  <View style={styles.filterEmpty}>
                    <Text style={styles.filterEmptyText}>Aucun produit en promo dans vos favoris.</Text>
                    <Pressable onPress={() => setFilter('all')}>
                      <Text style={styles.filterEmptyLink}>Voir tous les favoris</Text>
                    </Pressable>
                  </View>
                ) : view === 'list' ? (
                  <View style={styles.list}>
                    {filtered.map((product) => (
                      <FavoriteRow
                        key={product.id}
                        product={product}
                        onRemove={() => remove(product.id)}
                        onAdd={() => add(product.id, 1)}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {filtered.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        width={cardWidth}
                        imageHeight={118}
                        compact
                      />
                    ))}
                  </View>
                )}

                <Pressable style={styles.addAll} onPress={addAll}>
                  <Feather name="shopping-bag" size={18} color={colors.onAccent} />
                  <Text style={styles.addAllText}>
                    Ajouter {filtered.length} article{filtered.length > 1 ? 's' : ''} au panier
                  </Text>
                </Pressable>
              </>
            ) : null}

            {suggestions.length > 0 ? (
              <View style={styles.suggestSection}>
                <View style={styles.suggestHead}>
                  <Text style={styles.suggestTitle}>Ça pourrait vous plaire</Text>
                  <Pressable onPress={() => navigateTab(tabPaths.explore)}>
                    <Text style={styles.suggestLink}>Voir plus</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestRow}>
                  {suggestions.map((product) => (
                    <ProductCard key={product.id} product={product} width={140} imageHeight={110} compact />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </Page>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 16 },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8 },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.white },
  refreshText: { color: colors.terracotta, fontSize: 12, fontWeight: '700' },
  clearBtn: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.white },
  clearText: { color: colors.terracotta, fontSize: 13, fontWeight: '700' },
  heroBody: { alignItems: 'center', gap: 8, paddingTop: 4 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center' },
  heroCount: { color: colors.text, fontSize: 28, fontWeight: '800' },
  heroSub: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 12 },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 14 },
  heroStat: { flex: 1, alignItems: 'center', gap: 2 },
  heroStatValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  heroStatLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  heroStatDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  body: {
    marginTop: -16,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16 },
  refreshingEmpty: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24 },
  refreshingText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10 },
  filters: { flexDirection: 'row', gap: 8, flex: 1 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chipTextOn: { color: colors.onAccent },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden' },
  viewBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  viewBtnOn: { backgroundColor: colors.terracotta },
  list: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowImage: { width: 64, height: 64, borderRadius: 14, backgroundColor: colors.cream },
  rowText: { flex: 1, gap: 2 },
  rowName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowUnit: { color: colors.muted, fontSize: 12 },
  rowPriceLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  rowPrice: { color: colors.text, fontSize: 15, fontWeight: '800' },
  promoPill: {
    backgroundColor: colors.blush,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2 },
  promoPillText: { color: colors.terracotta, fontSize: 10, fontWeight: '800' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDone: {
    backgroundColor: colors.green,
  },
  iconBtnGhost: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.terracotta,
    borderRadius: 16,
    paddingVertical: 14 },
  addAllText: { color: colors.onAccent, fontSize: 14, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 28, paddingHorizontal: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptySub: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  filterEmpty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  filterEmptyText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  filterEmptyLink: { color: colors.terracotta, fontSize: 13, fontWeight: '700' },
  suggestSection: { gap: 12, paddingTop: 8 },
  suggestHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  suggestTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  suggestLink: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  suggestRow: { gap: 12, paddingRight: 4 } });
}
