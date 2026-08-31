import { colors, displayFont } from '@/constants/theme';
import { productImageFallback, productImageUrl } from '@/lib/productMedia';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';

export function ProductThumb({
  productId,
  name,
  categoryId,
  imageUrl,
  size = 48,
  style,
}: {
  productId: string;
  name?: string;
  categoryId?: string | null;
  imageUrl?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const local = productImageFallback(productId, categoryId);

  useEffect(() => {
    setFailed(false);
  }, [productId, imageUrl]);

  if (!productId || (failed && !local)) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: Math.round(size / 6) }, style]}>
        <Text style={styles.letter}>{(name ?? '?')[0]}</Text>
      </View>
    );
  }
  return (
    <Image
      source={failed ? local : productImageUrl(productId, imageUrl)}
      placeholder={local}
      placeholderContentFit="cover"
      cachePolicy="memory-disk"
      contentFit="cover"
      transition={120}
      style={[styles.img, { width: size, height: size, borderRadius: Math.round(size / 6) }, style]}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.border },
  fallback: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  letter: { ...displayFont('800'), color: colors.teal },
});
