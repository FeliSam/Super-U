import { PillButton } from '@/components/ui';
import { bodyFont, colors, displayFont, iceSurface } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shown when the courier finishes the last stop of their tour
 * (no next pending delivery).
 */
export default function TourCompleteScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour à l'accueil"
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [styles.navBtn, iceSurface(), pressed && { opacity: 0.85 }]}>
          <Feather name="home" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.mark}>
          <Feather name="check-circle" size={40} color={colors.teal} />
        </View>
        <Text style={styles.kicker}>TOURNÉE</Text>
        <Text style={styles.title}>Tournée terminée</Text>
        <Text style={styles.subtitle}>
          Toutes les livraisons de cette tournée sont terminées. Bravo — vous pouvez reprendre des
          courses quand vous voulez.
        </Text>
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <PillButton label="Retour à l'accueil" onPress={() => router.replace('/(tabs)')} />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)/missions')}
          style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.75 }]}>
          <Text style={styles.ghostText}>Voir les courses</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 22,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 10,
  },
  mark: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 118, 110, 0.12)',
    marginBottom: 8,
  },
  kicker: {
    ...bodyFont('700'),
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.teal,
  },
  title: {
    ...displayFont('800'),
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    ...bodyFont('500'),
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 4,
  },
  actions: {
    gap: 12,
    paddingTop: 8,
  },
  ghost: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 10,
  },
  ghostText: {
    ...bodyFont('700'),
    fontSize: 15,
    color: colors.teal,
  },
});
