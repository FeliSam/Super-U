import { colors } from '@/constants/theme';
import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Une erreur inattendue est survenue.';
  const detail =
    error instanceof Error && typeof error.stack === 'string'
      ? error.stack.split('\n').slice(0, 3).join('\n')
      : null;

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>CourseGo</Text>
      <Text style={styles.title}>Petit souci</Text>
      <Text style={styles.body}>{message}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      <Pressable onPress={retry} style={styles.btn} accessibilityRole="button">
        <Text style={styles.btnText}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  kicker: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.teal,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 4,
  },
  detail: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.placeholder,
    textAlign: 'left',
    alignSelf: 'stretch',
    fontFamily: 'Courier',
    marginBottom: 8,
  },
  btn: {
    marginTop: 8,
    backgroundColor: colors.teal,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
