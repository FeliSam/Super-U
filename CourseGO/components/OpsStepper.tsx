import { bodyFont, colors, displayFont } from '@/constants/theme';
import { DELIVERY_PHASE } from '@/lib/courierTrack';
import { DELIVERY_STEPS, normalizeDeliveryStatus } from '@/lib/opsModel';
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
  const compact = steps.length > 5;
  if (compact) {
    const cur = normalizeDeliveryStatus(status);
    const phase = DELIVERY_PHASE[cur];
    const i = Math.max(0, DELIVERY_STEPS.findIndex((s) => s.status === cur));
    const pct = Math.round((i / Math.max(1, DELIVERY_STEPS.length - 1)) * 100);
    return (
      <View style={styles.phase}>
        <View style={styles.phaseHead}>
          <Text style={styles.phaseKicker}>Étape {i + 1} / {DELIVERY_STEPS.length}</Text>
          <Text style={styles.phasePct}>{pct}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.phaseTitle}>{phase.title}</Text>
        <Text style={styles.phaseHint}>{phase.hint}</Text>
      </View>
    );
  }
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
  row: { flexDirection: 'row', gap: 6 },
  item: { flex: 1, alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.teal },
  dotActive: { backgroundColor: colors.teal, transform: [{ scale: 1.25 }] },
  label: { ...bodyFont('600'), fontSize: 11, color: colors.placeholder, textAlign: 'center' },
  labelOn: { ...displayFont('700'), fontSize: 11, color: colors.teal },
  phase: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phaseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phaseKicker: {
    ...bodyFont('700'),
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.teal,
    textTransform: 'uppercase',
  },
  phasePct: { ...displayFont('800'), fontSize: 13, color: colors.text },
  track: { height: 6, borderRadius: 99, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.teal, borderRadius: 99 },
  phaseTitle: { ...displayFont('800'), fontSize: 18, color: colors.text, letterSpacing: -0.3 },
  phaseHint: { ...bodyFont('400'), fontSize: 14, lineHeight: 21, color: colors.muted },
});
