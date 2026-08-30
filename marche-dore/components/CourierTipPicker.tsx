import { useColors } from '@/context/ThemeContext';
import { formatFcfa } from '@/lib/format';
import { displayFont } from '@/constants/theme';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const TIP_PRESETS = [500, 1000, 5000] as const;
export const TIP_CUSTOM_MIN = 100;
export const TIP_MAX = 100_000;

export function normalizeTipAmount(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(TIP_MAX, Math.round(n));
}

export function CourierTipPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (amount: number) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPreset = value === 0 || TIP_PRESETS.includes(value as (typeof TIP_PRESETS)[number]);
  const [otherOpen, setOtherOpen] = useState(!isPreset && value > 0);
  const [otherText, setOtherText] = useState(!isPreset && value > 0 ? String(value) : '');

  const selectPreset = (n: number) => {
    setOtherOpen(false);
    setOtherText('');
    onChange(n);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Pourboire au livreur</Text>
      <Text style={styles.hint}>Facultatif — versé avec votre avis après une livraison réussie.</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => selectPreset(0)}
          style={[styles.chip, value === 0 && !otherOpen && styles.chipOn]}>
          <Text style={[styles.chipTxt, value === 0 && !otherOpen && styles.chipTxtOn]}>Sans</Text>
        </Pressable>
        {TIP_PRESETS.map((n) => (
          <Pressable
            key={n}
            onPress={() => selectPreset(n)}
            style={[styles.chip, !otherOpen && value === n && styles.chipOn]}>
            <Text style={[styles.chipTxt, !otherOpen && value === n && styles.chipTxtOn]}>{formatFcfa(n)}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => {
            setOtherOpen(true);
            onChange(normalizeTipAmount(Number(otherText.replace(/\D/g, ''))));
          }}
          style={[styles.chip, otherOpen && styles.chipOn]}>
          <Text style={[styles.chipTxt, otherOpen && styles.chipTxtOn]}>Autre</Text>
        </Pressable>
      </View>
      {otherOpen ? (
        <TextInput
          value={otherText}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, '');
            setOtherText(digits);
            const n = Number(digits);
            onChange(digits ? normalizeTipAmount(n) : 0);
          }}
          keyboardType="number-pad"
          placeholder={`Montant (min. ${TIP_CUSTOM_MIN} F)`}
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrap: { gap: 8 },
    label: { ...displayFont('700'), fontSize: 14, color: colors.text },
    hint: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '500' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
    chipTxt: { fontWeight: '800', fontSize: 12, color: colors.muted },
    chipTxtOn: { color: colors.onAccent },
    input: {
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
}
