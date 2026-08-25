import { IconCircle, Page, Screen } from '@/components/ui';
import { colors, displayFont } from '@/constants/theme';
import { contactChannels } from '@/data/help';
import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ContactScreen() {
  const onPress = (channel: (typeof contactChannels)[number]) => {
    if (channel.action === 'chat') {
      router.push('/chat/support' as Href);
      return;
    }
    if (channel.value) Linking.openURL(channel.value);
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <Text style={styles.title}>Nous contacter</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>L’équipe Marché Doré</Text>
            <Text style={styles.heroSub}>
              Service client disponible 7j/7 de 8h à 22h. Réponse moyenne sous 10 minutes sur le chat.
            </Text>
          </View>

          <View style={styles.list}>
            {contactChannels.map((channel) => (
              <Pressable key={channel.id} style={styles.row} onPress={() => onPress(channel)}>
                <View style={styles.icon}>
                  <Feather name={channel.icon} size={18} color={colors.gold} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{channel.title}</Text>
                  <Text style={styles.rowSub}>{channel.subtitle}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.placeholder} />
              </Pressable>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Adresse</Text>
            <Text style={styles.cardBody}>Marché Doré · Plateau, Dakar, Sénégal</Text>
            <Text style={styles.cardBody}>Horaires magasin : 8h – 21h</Text>
          </View>
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
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: colors.cream,
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  heroSub: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  list: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.muted, fontSize: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cardBody: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
