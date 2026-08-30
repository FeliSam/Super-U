import { IconBtn, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { getApiBaseUrl } from '@/lib/api/http';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <Screen>
      <View style={styles.nav}>
        <IconBtn name="chevron-left" onPress={() => router.back()} />
        <Text style={styles.title}>Paramètres</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={{ padding: 24, gap: 12 }}>
        <Text style={styles.label}>API</Text>
        <Text style={styles.val}>{getApiBaseUrl()}</Text>
        <Text style={styles.hint}>
          Définissez EXPO_PUBLIC_API_URL pour viser le serveur SuperU (port 8787). Auth ops.staff uniquement.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56 },
  title: { ...displayFont('800'), fontSize: 18 },
  label: { ...bodyFont('700'), color: colors.muted, fontSize: 13 },
  val: { ...displayFont('700'), fontSize: 16 },
  hint: { ...bodyFont('400'), color: colors.muted, lineHeight: 20 },
});
