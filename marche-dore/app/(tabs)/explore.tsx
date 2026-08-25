import { AppImage } from '@/components/AppImage';
import { CategoryTile, ProductCard, PromoBanner, Screen, SearchField, Page } from '@/components/ui';
import { colors, displayFont, tabBarClearance } from '@/constants/theme';
import { useUiState } from '@/context/UiStateContext';
import {
  exploreCategories,
  getProducts,
  homePromoBanners,
  popularIds,
  popularSuggestions,
  products,
  productsInCategory,
  promoProducts,
  searchCategories,
  searchCategoryRoute,
} from '@/data/catalog';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useMemo } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PROMO_WIDTH = Dimensions.get('window').width - 40;
const explorePromo = homePromoBanners[1];

function ExploreScreen() {
  const { setSearchQuery } = useUiState();

  const rows = useMemo(() => {
    const result: (typeof exploreCategories)[] = [];
    for (let i = 0; i < exploreCategories.length; i += 2) {
      result.push(exploreCategories.slice(i, i + 2));
    }
    return result;
  }, []);

  const trending = useMemo(() => promoProducts().slice(0, 6), []);
  const popular = useMemo(() => getProducts(popularIds), []);

  const openSearch = (term?: string) => {
    if (term) setSearchQuery(term);
    navigateTab(tabPaths.search);
  };

  const openPromos = () => {
    router.push('/promotions');
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['#f8e4c4', colors.cream, colors.bg]} style={styles.hero}>
            <View style={styles.heroOrb} />
            <Text style={styles.heroTitle}>Explorer</Text>
            <Text style={styles.heroSub}>Parcourez nos rayons et découvrez les produits du marché.</Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{exploreCategories.length}</Text>
                <Text style={styles.heroStatLabel}>Rayons</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{products.length}+</Text>
                <Text style={styles.heroStatLabel}>Produits</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Feather name="truck" size={16} color={colors.gold} />
                <Text style={styles.heroStatLabel}>Livraison rapide</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.bodySheet}>
            <SearchField onPress={() => openSearch()} />

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Accès rapide</Text>
                <Text style={styles.sectionMeta}>Sélection</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickRow}>
                {searchCategories.map((cat) => {
                  const count = productsInCategory(cat.id).length;
                  return (
                    <Pressable
                      key={cat.label}
                      style={styles.quickCard}
                      onPress={() => router.push(searchCategoryRoute(cat))}>
                      <View style={styles.quickImageWrap}>
                        <AppImage source={cat.image} frameStyle={styles.quickImage} />
                      </View>
                      <Text style={styles.quickLabel}>{cat.label}</Text>
                      <Text style={styles.quickCount}>{count || '12+'} produits</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <PromoBanner
              title={explorePromo.title}
              subtitle={explorePromo.subtitle}
              cta={explorePromo.cta}
              image={explorePromo.image}
              width={PROMO_WIDTH}
              onPress={() => router.push(explorePromo.href)}
            />

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>En promotion</Text>
                <Pressable onPress={openPromos}>
                  <Text style={styles.sectionLink}>Voir tout</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.productRow}>
                {trending.map((product) => (
                  <ProductCard key={product.id} product={product} width={148} imageHeight={130} compact />
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Populaires</Text>
                <Text style={styles.sectionMeta}>Les plus commandés</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.productRow}>
                {popular.map((product) => (
                  <ProductCard key={product.id} product={product} width={148} imageHeight={130} compact />
                ))}
              </ScrollView>
            </View>

            <View style={styles.suggestCard}>
              <View style={styles.suggestHead}>
                <Feather name="zap" size={16} color={colors.gold} />
                <Text style={styles.suggestTitle}>Recherches tendance</Text>
              </View>
              <View style={styles.chips}>
                {popularSuggestions.map((term) => (
                  <Pressable key={term} style={styles.chip} onPress={() => openSearch(term)}>
                    <Feather name="search" size={12} color={colors.muted} />
                    <Text style={styles.chipText}>{term}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Tous les rayons</Text>
                <Text style={styles.sectionMeta}>{exploreCategories.length} catégories</Text>
              </View>
              <View style={styles.gridCard}>
                {rows.map((row, idx) => (
                  <View key={idx} style={styles.gridRow}>
                    {row.map((cat) => {
                      const count = productsInCategory(cat.id).length;
                      return (
                        <CategoryTile
                          key={cat.id}
                          title={cat.title}
                          image={cat.image}
                          height={cat.height + 8}
                          flex={cat.flex}
                          count={count || undefined}
                          index={idx}
                          onPress={() => router.push(`/category/${cat.id}`)}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </Page>
    </Screen>
  );
}

export default memo(ExploreScreen);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: tabBarClearance },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.35)',
    top: -40,
    right: -30,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSub: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    maxWidth: '90%',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  heroStat: { flex: 1, alignItems: 'center', gap: 4 },
  heroStatValue: { color: colors.text, fontSize: 18, ...displayFont('800') },
  heroStatLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  heroDivider: { width: 1, height: 28, backgroundColor: colors.border },
  bodySheet: {
    marginTop: -24,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 22,
  },
  section: { gap: 12 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: colors.text, fontSize: 18, ...displayFont('700') },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  sectionLink: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  quickRow: { gap: 10, paddingRight: 4 },
  quickCard: {
    width: 108,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  quickImageWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: colors.cream,
  },
  quickImage: { width: '100%', height: '100%' },
  quickLabel: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  quickCount: { color: colors.placeholder, fontSize: 10, fontWeight: '600' },
  productRow: { gap: 12, paddingRight: 4 },
  suggestCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  gridCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 12,
    gap: 12,
  },
  gridRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
});
