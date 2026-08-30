import { bodyFont, colors, displayFont } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export type OpsStep = { status: string; label: string };

export function stepIndex(steps: readonly OpsStep[], status: string | null | undefined) {
  const i = steps.findIndex((s) => s.status === status);
  return i >= 0 ? i : 0;
}

export function OpsStepper({
  steps,
  status,
}: {
  steps: readonly OpsStep[];
  status: string | null | undefined;
}) {
  const current = stepIndex(steps, status);
  return (
    <View style={styles.row}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={step.status} style={styles.item}>
            <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]} />
            <Text style={[styles.label, (done || active) && styles.labelOn]} numberOfLines={1}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.teal },
  dotActive: { backgroundColor: colors.teal, transform: [{ scale: 1.25 }] },
  label: { ...bodyFont('600'), fontSize: 10, color: colors.placeholder, textAlign: 'center' },
  labelOn: { ...displayFont('700'), fontSize: 10, color: colors.teal },
});
