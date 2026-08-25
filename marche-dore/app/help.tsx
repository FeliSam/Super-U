import { IconCircle, Page, Screen } from '@/components/ui';
import { colors, displayFont } from '@/constants/theme';
import { faqItems } from '@/data/help';
import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HelpCenterScreen() {
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null);
  const categories = useMemo(() => [...new Set(faqItems.map((f) => f.category))], []);
  const [category, setCategory] = useState('Tous');
  const filtered = category === 'Tous' ? faqItems : faqItems.filter((f) => f.category === category);

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <Text style={styles.title}>Centre d’aide</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <Feather name="help-circle" size={22} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Besoin d’un coup de main ?</Text>
              <Text style={styles.introSub}>Parcourez la FAQ ou contactez l’assistance.</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {['Tous', ...categories].map((cat) => (
              <Pressable
                key={cat}
                style={[styles.chip, category === cat && styles.chipOn]}
                onPress={() => setCategory(cat)}>
                <Text style={[styles.chipText, category === cat && styles.chipTextOn]}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.list}>
            {filtered.map((item) => {
              const open = openId === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={styles.item}
                  onPress={() => setOpenId(open ? null : item.id)}>
                  <View style={styles.itemHead}>
                    <Text style={styles.itemQ}>{item.question}</Text>
                    <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                  </View>
                  {open ? <Text style={styles.itemA}>{item.answer}</Text> : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.cta} onPress={() => router.push('/chat/support' as Href)}>
            <Feather name="message-circle" size={18} color={colors.white} />
            <Text style={styles.ctaText}>Parler à l’assistance</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push('/contact')}>
            <Text style={styles.secondaryText}>Autres moyens de contact</Text>
          </Pressable>
        </ScrollView>
      </Page>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 17, ...displayFont('700') },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  intro: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 16,
    padding: 14,
  },
  introTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  introSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chips: { gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.cream, borderColor: colors.gold },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: colors.text },
  list: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemQ: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  itemA: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 16,
    paddingVertical: 14,
  },
  ctaText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  secondary: { alignItems: 'center', paddingVertical: 8 },
  secondaryText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
});
