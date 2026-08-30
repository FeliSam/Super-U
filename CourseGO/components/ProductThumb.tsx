import { colors, displayFont } from '@/constants/theme';
import { productImageSource } from '@/lib/productMedia';
import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export function ProductThumb({
  productId,
  name,
  categoryId,
  size = 48,
  style,
}: {
  productId: string;
  name?: string;
  categoryId?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const source = productImageSource(productId, categoryId);
  const remote = typeof source === 'object' && source !== null && 'uri' in source;

  if (!productId || failed) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: Math.round(size / 6) }, style]}>
        <Text style={styles.letter}>{(name ?? '?')[0]}</Text>
      </View>
    );
  }
  return (
    <Image
      source={source}
      style={[styles.img, { width: size, height: size, borderRadius: Math.round(size / 6) }, style]}
      onError={() => {
        if (remote) setFailed(true);
      }}
    />
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.border },
  fallback: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  letter: { ...displayFont('800'), color: colors.teal },
});
