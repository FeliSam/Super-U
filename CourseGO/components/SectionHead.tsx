import { bodyFont, colors, displayFont, radius } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export function SectionHead({
  title,
  count,
  kind = 'pick',
}: {
  title: string;
  count: number;
  kind?: 'pick' | 'deliver';
}) {
  const deliver = kind === 'deliver';
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.chip, deliver ? styles.chipDel : styles.chipPick]}>
        <Text style={[styles.chipTxt, deliver ? styles.txtDel : styles.txtPick]}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingVertical: 2,
  },
  title: {
    ...displayFont('800'),
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  chip: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPick: { backgroundColor: colors.tealSoft },
  chipDel: { backgroundColor: colors.coralSoft },
  chipTxt: { ...bodyFont('800'), fontSize: 12 },
  txtPick: { color: colors.teal },
  txtDel: { color: colors.coral },
});
