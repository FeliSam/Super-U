import { bodyFont, colors, radius } from '@/constants/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function ApiBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.box}>
      <Text style={styles.txt}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.retry}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.card,
    padding: 14,
    gap: 8,
  },
  txt: { ...bodyFont('600'), fontSize: 13, color: colors.danger },
  retry: { ...bodyFont('700'), fontSize: 13, color: colors.teal },
});
