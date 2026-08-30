import { type BirthDateFieldProps } from '@/components/BirthDateField.types';
import { type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { birthDateFromIso, toIsoDate, todayIso } from '@/lib/birthDate';
import { Feather } from '@expo/vector-icons';
import { useMemo, useRef, type CSSProperties } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function BirthDateField({ label, value, onChange }: BirthDateFieldProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const inputRef = useRef<HTMLInputElement>(null);
  const iso = toIsoDate(value);
  const empty = !iso;

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker();
        return;
      }
    } catch {
      /* fall through */
    }
    el.focus();
    el.click();
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.wrap}>
        <input
          ref={inputRef}
          type="date"
          value={iso}
          min="1920-01-01"
          max={todayIso()}
          aria-hidden
          tabIndex={-1}
          onChange={(event) => onChange(birthDateFromIso(event.target.value))}
          style={hiddenDateInputStyle}
        />
        <Pressable
          onPress={openPicker}
          style={styles.input}
          accessibilityRole="button"
          accessibilityLabel={label}>
          <Text style={[styles.value, empty && styles.placeholder]}>{empty ? 'JJ/MM/AAAA' : value}</Text>
          <Feather name="calendar" size={16} color={colors.gold} />
        </Pressable>
      </View>
    </View>
  );
}

const hiddenDateInputStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
};

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    field: { gap: 6 },
    wrap: { position: 'relative' },
    fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 46,
    },
    value: { color: colors.text, fontSize: 16, fontWeight: '500' },
    placeholder: { color: colors.placeholder, fontWeight: '500' },
  });
}
