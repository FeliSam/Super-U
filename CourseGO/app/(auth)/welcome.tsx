import { CourseLogo } from '@/components/CourseLogo';
import { PillButton, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function WelcomeScreen() {
  const { staff } = useStaffAuth();
  const { completeWelcome } = useOnboarding();
  const name = staff?.firstName ?? 'coursier';

  const go = async () => {
    await completeWelcome();
    router.replace('/(auth)/permissions');
  };

  return (
    <Screen style={styles.wrap}>
      <View style={styles.hero}>
        <CourseLogo width={220} />
        <Text style={styles.kicker}>COMPTE CRÉÉ</Text>
        <Text style={styles.title}>Bienvenue, {name}</Text>
        <Text style={styles.sub}>
          Votre espace CourseGo est prêt. Vous rassemblez les courses du magasin, puis vous pouvez emporter jusqu’à 3 colis déjà ramassés.
        </Text>
      </View>
      <View style={styles.bottom}>
        <PillButton label="COMMENCER" onPress={() => void go()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'space-between' },
  hero: { paddingHorizontal: 28, paddingTop: 48, gap: 12, alignItems: 'center' },
  kicker: { ...displayFont('800'), fontSize: 12, letterSpacing: 1.4, color: colors.teal },
  title: { ...displayFont('900'), fontSize: 28, color: colors.text, textAlign: 'center' },
  sub: { ...bodyFont('400'), fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: 'center' },
  bottom: { padding: 24 },
});
