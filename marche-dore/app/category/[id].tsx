import { CartTotalFab, IconCircle, ProductCard, Screen, Page } from '@/components/ui';
import { colors, displayFont } from '@/constants/theme';
import { categoryFilters, exploreCategories, products, productsInCategory } from '@/data/catalog';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function CategoryScreen() {
  const { id, filter } = useLocalSearchParams<{ id: string; filter?: string }>();
  const cat = exploreCategories.find((c) => c.id === id);
  const filters = categoryFilters[id] ?? ['Tous'];
  const [active, setActive] = useState(filter ?? filters[1] ?? filters[0]);

  const list = useMemo(() => {
    const base = productsInCategory(id).length ? productsInCategory(id) : products;
    if (!active || active === 'Tous') return base;
    if (active === 'Fruits') {
      return base.filter((p) =>
        /mangue|banane|pomme|papaye|ananas|plantain/i.test(p.name),
      );
    }
    if (active === 'Légumes') {
      return base.filter((p) => /tomate|gombo|patate|carotte|gingembre/i.test(p.name));
    }
    return base;
  }, [id, active]);

  return (
    <Screen>
      <Page style={{ flex: 1 }}>
        <View style={styles.header}>
          <IconCircle name="arrow-left" onPress={() => router.back()} />
          <Text style={styles.title}>{cat?.title ?? 'Catégorie'}</Text>
          <IconCircle name="search" onPress={() => router.push('/search')} />
        </View>
        <View style={styles.filtersWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filters}>
            {filters.map((f) => (
              <Pressable key={f} onPress={() => setActive(f)} style={[styles.chip, active === f && styles.chipOn]}>
                <Text style={[styles.chipText, active === f && styles.chipTextOn]}>{f}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <View style={styles.meta}>
          <Text style={styles.found}>{list.length} produits trouvés</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.sort}>Trier par: Pertinence</Text>
            <Feather name="chevron-down" size={12} color={colors.text} />
          </View>
        </View>
        <View style={styles.body}>
          <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {list.map((p) => (
              <View key={p.id} style={styles.cell}>
                <ProductCard product={p} width="100%" />
              </View>
            ))}
          </ScrollView>
          <CartTotalFab bottom={20} />
        </View>
      </Page>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { color: colors.text, fontSize: 18, ...displayFont('700') },
  filtersWrap: {
    backgroundColor: colors.bg,
    zIndex: 2,
  },
  filtersScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 56,
  },
  filters: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 56,
  },
  chip: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  chipOn: { backgroundColor: colors.gold },
  chipText: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  chipTextOn: { color: colors.white },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.bg,
    zIndex: 1,
  },
  found: { color: colors.placeholder, fontSize: 13, fontWeight: '600' },
  sort: { color: colors.text, fontSize: 13, fontWeight: '600' },
  body: { flex: 1 },
  gridScroll: { flex: 1 },
  grid: { paddingHorizontal: 20, paddingBottom: 88, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '48%', flexGrow: 1 },
});
