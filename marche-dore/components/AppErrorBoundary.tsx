import { fontFamilies } from '@/constants/typography';
import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Catch React render crashes so the app can recover instead of a blank screen.
 * Native module / Reanimated crashes before first paint are outside this scope.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Une erreur inattendue est survenue.';

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>Marché Doré</Text>
      <Text style={styles.title}>Petit souci</Text>
      <Text style={styles.body}>{message}</Text>
      <Pressable onPress={retry} style={styles.btn} accessibilityRole="button">
        <Text style={styles.btnText}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fdfbf7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  kicker: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#e2931d',
  },
  title: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 28,
    color: '#1c1613',
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 22,
    color: '#615752',
    textAlign: 'center',
    marginBottom: 8,
  },
  btn: {
    marginTop: 8,
    backgroundColor: '#e2931d',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnText: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 15,
    color: '#fff',
  },
});
