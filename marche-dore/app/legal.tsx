import { ScreenHeader } from '@/components/ScreenHeader';
import { Page, Screen } from '@/components/ui';
import { type AppColors, spacing } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { legalSections } from '@/data/help';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function LegalScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Screen>
      <Page style={styles.flex}>
        <ScreenHeader title="Conditions & confidentialité" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.lead}>
            Dernière mise à jour : août 2026. Ces informations résument nos engagements envers les clients Marché Doré.
          </Text>
          {legalSections.map((section) => (
            <View key={section.id} style={styles.card}>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={styles.cardBody}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </Page>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  lead: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 8 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  cardBody: { color: colors.muted, fontSize: 13, lineHeight: 20 } });
}
