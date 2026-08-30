import { type BirthDateFieldProps } from '@/components/BirthDateField.types';
import { type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { defaultPickerDate, formatBirthDate, parseBirthDate } from '@/lib/birthDate';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export function BirthDateField({ label, value, onChange }: BirthDateFieldProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const empty = !parseBirthDate(value);
  const current = defaultPickerDate(value);

  const onPick = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type !== 'set' || !date) return;
      onChange(formatBirthDate(date));
      return;
    }
    if (date) onChange(formatBirthDate(date));
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.input}
        accessibilityRole="button"
        accessibilityLabel={label}>
        <Text style={[styles.value, empty && styles.placeholder]}>{empty ? 'JJ/MM/AAAA' : value}</Text>
        <Feather name="calendar" size={16} color={colors.gold} />
      </Pressable>
      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={current}
          mode="date"
          display="default"
          maximumDate={new Date()}
          minimumDate={new Date(1920, 0, 1)}
          onChange={onPick}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => undefined}>
              <DateTimePicker
                value={current}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                minimumDate={new Date(1920, 0, 1)}
                onChange={onPick}
                locale="fr-FR"
              />
              <Pressable style={styles.done} onPress={() => setOpen(false)}>
                <Text style={styles.doneText}>OK</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    field: { gap: 6 },
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
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingBottom: 24,
      paddingTop: 8,
    },
    done: { alignItems: 'center', paddingVertical: 12 },
    doneText: { color: colors.gold, fontSize: 16, fontWeight: '700' },
  });
}
