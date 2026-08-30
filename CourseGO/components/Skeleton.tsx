import { colors, radius } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

export function MissionSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.pill, { width: 88 }]} />
        <View style={[styles.pill, { width: 56 }]} />
      </View>
      <View style={[styles.line, { width: '70%' }]} />
      <View style={[styles.line, { width: '42%', height: 12 }]} />
      <View style={styles.row}>
        <View style={[styles.line, { width: 96, height: 20 }]} />
        <View style={[styles.cta]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 20,
    gap: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  pill: { height: 22, borderRadius: 999, backgroundColor: colors.border },
  line: { height: 16, borderRadius: 8, backgroundColor: colors.border },
  cta: { width: 88, height: 32, borderRadius: 999, backgroundColor: colors.tealSoft },
});
