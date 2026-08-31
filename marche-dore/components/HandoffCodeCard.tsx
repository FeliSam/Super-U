import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function HandoffCodeCard({ code }: { code?: string | null }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const digits = String(code ?? '').replace(/\D/g, '').slice(0, 4);
  if (digits.length !== 4) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>CODE LIVREUR</Text>
      <View style={styles.row}>
        {digits.split('').map((d, i) => (
          <View key={`${d}-${i}`} style={styles.box}>
            <Text style={styles.digit}>{d}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>Donnez ce code au livreur avant de récupérer le colis.</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'stretch',
      backgroundColor: colors.white,
      borderRadius: 20,
      padding: 16,
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    kicker: {
      ...displayFont('700'),
      fontSize: 11,
      letterSpacing: 1.2,
      color: colors.gold,
    },
    row: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
    box: {
      width: 44,
      height: 52,
      borderRadius: 12,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
    },
    digit: { ...displayFont('800'), fontSize: 26, color: colors.text, letterSpacing: 1 },
    hint: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      fontWeight: '600',
    },
  });
}
