import { AppImage } from '@/components/AppImage';
import { CategoryTile, IconCircle, ProductCard, PromoBanner, Screen, SearchField, Page, TabHero } from '@/components/ui';
import { PressScale } from '@/components/motion';
import { displayFont, heroChrome, tabBarClearance, type AppColors } from '@/constants/theme';
import { useColors, useTheme } from '@/context/ThemeContext';
import { useUiState } from '@/context/UiStateContext';
import {
  exploreCategories,
  getProducts,
  homePromoBanners,
  popularIds,
  products,
  productsInCategory,
  promoProducts,
  searchCategories,
  searchCategoryRoute,
  trendingSearches,
} from '@/data/catalog';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PROMO_WIDTH = Dimensions.get('window').width - 40;
const explorePromo = homePromoBanners[1];
const HERO_OVERLAP = 28;

function ExploreScreen() {
  const { scheme } = useTheme();
  const colors = useColors();
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [heroHeight, setHeroHeight] = useState(210);
  const [trendTick, setTrendTick] = useState(() => Math.floor(Date.now() / 12_000));

  const { setSearchQuery, searchRecents } = useUiState();

  useEffect(() => {
    const id = setInterval(() => {
      setTrendTick(Math.floor(Date.now() / 12_000));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const trends = useMemo(
    () => trendingSearches({ recents: searchRecents, limit: 8, tick: trendTick }),
    [searchRecents, trendTick],
  );

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
    router.push('/search');
  };

  const openPromos = () => {
    router.push('/promotions');
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <View
          style={styles.heroBackdrop}
          onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
          pointerEvents="box-none">
          <TabHero
            title="Explorer"
            subtitle="Parcourez nos rayons et découvrez les produits du marché."
            right={
              <IconCircle
                name="search"
                variant="hero"
                accessibilityLabel="Rechercher"
                onPress={() => openSearch()}
              />
            }>
            <View
              style={[
                styles.heroStats,
                { backgroundColor: chrome.surface, borderColor: chrome.surfaceBorder },
              ]}>
              <PressScale
                style={styles.heroStat}
                onPress={() => openSearch()}
                scaleTo={0.96}
                accessibilityLabel={`${exploreCategories.length} rayons`}>
                <Text style={[styles.heroStatValue, { color: chrome.ink }]}>
                  {exploreCategories.length}
                </Text>
                <Text style={[styles.heroStatLabel, { color: chrome.muted }]}>Rayons</Text>
              </PressScale>
              <View style={[styles.heroDivider, { backgroundColor: chrome.divider }]} />
              <PressScale
                style={styles.heroStat}
                onPress={() => openSearch()}
                scaleTo={0.96}
                accessibilityLabel={`${products.length} produits`}>
                <Text style={[styles.heroStatValue, { color: chrome.ink }]}>{products.length}+</Text>
                <Text style={[styles.heroStatLabel, { color: chrome.muted }]}>Produits</Text>
              </PressScale>
              <View style={[styles.heroDivider, { backgroundColor: chrome.divider }]} />
              <PressScale
                style={styles.heroStat}
                onPress={() => router.push('/tracking')}
                scaleTo={0.96}
                accessibilityLabel="Suivi de livraison">
                <Feather name="truck" size={16} color={colors.gold} />
                <Text style={[styles.heroStatLabel, { color: chrome.muted }]}>Livraison rapide</Text>
              </PressScale>
            </View>
          </TabHero>
        </View>

        <ScrollView
          style={styles.scrollLayer}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(0, heroHeight - HERO_OVERLAP) },
          ]}
          showsVerticalScrollIndicator={false}>
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
                <View style={styles.suggestHeadLeft}>
                  <View style={styles.liveDot} />
                  <Feather name="zap" size={15} color={colors.gold} />
                  <Text style={styles.suggestTitle}>Recherches tendance</Text>
                </View>
                <Text style={styles.trendMeta}>En direct</Text>
              </View>
              <View style={styles.chips}>
                {trends.map((item) => {
                  const hot = item.rank <= 3 || item.heat >= 70;
                  const deltaColor =
                    item.delta === 'up' || item.delta === 'new'
                      ? colors.green
                      : item.delta === 'down'
                        ? colors.terracotta
                        : colors.muted;
                  const deltaIcon =
                    item.delta === 'up'
                      ? 'trending-up'
                      : item.delta === 'down'
                        ? 'trending-down'
                        : item.delta === 'new'
                          ? 'zap'
                          : 'minus';
                  return (
                    <PressScale
                      key={`${item.rank}-${item.term}`}
                      style={[styles.chip, hot && styles.chipHot]}
                      onPress={() => openSearch(item.term)}
                      scaleTo={0.96}
                      accessibilityLabel={`Rechercher ${item.term}`}>
                      <Text style={[styles.chipRank, hot && styles.chipRankHot]}>{item.rank}</Text>
                      <Text style={[styles.chipText, hot && styles.chipTextHot]} numberOfLines={1}>
                        {item.term}
                      </Text>
                      <View style={styles.chipHeatTrack}>
                        <View
                          style={[
                            styles.chipHeatFill,
                            { width: `${item.heat}%`, backgroundColor: hot ? colors.gold : colors.muted },
                          ]}
                        />
                      </View>
                      <Feather name={deltaIcon} size={12} color={deltaColor} />
                    </PressScale>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Tous les rayons</Text>
                <Text style={styles.sectionMeta}>{exploreCategories.length} catégories</Text>
              </View>
              <View style={styles.grid}>
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

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    heroBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 0,
    },
    scrollLayer: {
      flex: 1,
      zIndex: 1,
    },
    scrollContent: { paddingBottom: tabBarClearance },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginTop: 18,
      borderWidth: 1,
    },
    heroStat: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 },
    heroStatValue: { fontSize: 18, ...displayFont('800') },
    heroStatLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
    heroDivider: { width: 1, height: 28 },
    bodySheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 20,
      gap: 22,
      // Tall enough so the sheet covers the hero while scrolling.
      minHeight: Dimensions.get('window').height,
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
    suggestHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    suggestHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.terracotta,
    },
    suggestTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
    trendMeta: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    chipHot: {
      backgroundColor: colors.cream,
      borderColor: colors.gold,
    },
    chipRank: {
      minWidth: 14,
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'center',
    },
    chipRankHot: { color: colors.gold },
    chipText: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
    chipTextHot: { fontWeight: '700' },
    chipHeatTrack: {
      width: 28,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    chipHeatFill: { height: '100%', borderRadius: 2 },
    grid: { gap: 12 },
    gridRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  });
}
