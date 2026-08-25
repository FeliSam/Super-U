import { IconCircle, Page, Screen } from '@/components/ui';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const highlights = [
  { icon: 'shopping-bag' as const, title: 'Produits frais', text: 'Sélection locale et importée, mise à jour chaque matin.' },
  { icon: 'truck' as const, title: 'Livraison Cotonou', text: 'Créneaux flexibles, suivi en direct avec votre livreur.' },
  { icon: 'award' as const, title: 'Fidélité', text: 'Points, QR code client et récompenses exclusives.' },
];

export default function AboutScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <Text style={styles.title}>À propos</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <Text style={styles.brandName}>Marché Doré</Text>
            <Text style={styles.brandTag}>Le marché, livré chez vous</Text>
            <View style={styles.versionPill}>
              <Text style={styles.versionText}>Version 1.0.0</Text>
            </View>
          </View>

          <Text style={styles.body}>
            Marché Doré est une application de courses pensée pour Cotonou : fruits, légumes, viandes,
            épicerie et boissons, avec une expérience simple du panier à la porte.
          </Text>

          {highlights.map((item) => (
            <View key={item.title} style={styles.card}>
              <View style={styles.icon}>
                <Feather name={item.icon} size={18} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.text}</Text>
              </View>
            </View>
          ))}

          <Text style={styles.footer}>© 2026 Marché Doré · Cotonou, Bénin</Text>
        </ScrollView>
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
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  brand: {
    backgroundColor: colors.cream,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 8 },
  brandName: { color: colors.text, fontSize: 28, fontWeight: '800' },
  brandTag: { color: colors.muted, fontSize: 14 },
  versionPill: {
    marginTop: 4,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6 },
  versionText: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardBody: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  footer: { textAlign: 'center', color: colors.placeholder, fontSize: 12, marginTop: 8 } });
}
