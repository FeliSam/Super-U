import type { LibreMapProps } from '@/components/LibreMap.types';
import { colors } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export function LibreMap({ style }: LibreMapProps) {
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.txt}>Carte MapLibre — ouvrez l’app web pour le fond de carte</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 120 },
  txt: { color: colors.muted, textAlign: 'center' },
});
