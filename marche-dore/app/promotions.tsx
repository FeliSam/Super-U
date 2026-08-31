import { IconCircle, Page, PromoBanner, Screen } from '@/components/ui';
import { ProductFlashGrid } from '@/components/ProductFlashGrid';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useCatalogVersion } from '@/context/CatalogContext';
import {
  bannerIsLive,
  homePromoBanners,
  promoProducts } from '@/data/catalog';
import { formatFcfa } from '@/lib/format';
import { goBack, navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export default function PromotionsScreen() {
  const catalogVersion = useCatalogVersion();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { width } = useWindowDimensions();
  const products = useMemo(() => promoProducts(), [catalogVersion]);
  const bannerWidth = Math.min(width, 430) - 40;
  const totalSavings = products.reduce((sum, p) => sum + Math.max(0, (p.oldPrice ?? p.price) - p.price), 0);

  const header = (
    <View style={styles.headerBlock}>
      <LinearGradient colors={['#3d2f28', '#5a4638', '#c84b31']} style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Offres de la semaine</Text>
        <Text style={styles.heroTitle}>{products.length} produits en promo</Text>
        <Text style={styles.heroSub}>
          Économisez jusqu’à {formatFcfa(totalSavings)} sur la sélection actuelle.
        </Text>
        <View style={styles.heroChips}>
          <View style={styles.heroChip}>
            <Feather name="tag" size={12} color={colors.cream} />
            <Text style={styles.heroChipText}>Jusqu’à −30 %</Text>
          </View>
          <View style={styles.heroChip}>
            <Feather name="truck" size={12} color={colors.cream} />
            <Text style={styles.heroChipText}>Livraison rapide</Text>
          </View>
        </View>
      </LinearGradient>

      <Text style={styles.sectionTitle}>Campagnes</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bannerRow}>
        {homePromoBanners.filter(bannerIsLive).map((banner) => (
          <PromoBanner
            key={banner.id}
            title={banner.title}
            subtitle={banner.subtitle}
            cta={banner.cta}
            image={banner.image}
            width={Math.min(bannerWidth, 300)}
            onPress={() => router.push(banner.href)}
          />
        ))}
      </ScrollView>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Produits en promotion</Text>
        <Text style={styles.sectionMeta}>{products.length}</Text>
      </View>
    </View>
  );

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => goBack()} />
          <Text style={styles.title}>Promotions</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ProductFlashGrid
          products={products}
          extraData={catalogVersion}
          imageHeight={96}
          header={header}
          style={styles.flex}
          contentContainerStyle={styles.content}
          footer={
            <Pressable style={styles.cta} onPress={() => navigateTab(tabPaths.explore)}>
              <Text style={styles.ctaText}>Continuer les courses</Text>
              <Feather name="arrow-right" size={18} color={colors.onAccent} />
            </Pressable>
          }
        />
      </Page>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12 },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 17, ...displayFont('700') },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  headerBlock: { gap: 16, paddingBottom: 8 },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    gap: 8 },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  heroTitle: { color: colors.onAccent, fontSize: 26, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6 },
  heroChipText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 16, ...displayFont('700') },
  sectionMeta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  bannerRow: { gap: 12, paddingRight: 4 },
  cta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingVertical: 15 },
  ctaText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' } });
}
