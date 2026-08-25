import { type AppColors } from '@/constants/theme';
import { imagePlaceholder } from '@/constants/media';
import { useColors } from '@/context/ThemeContext';
import { Image, type ImageProps } from 'expo-image';
import { memo, useMemo } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = ImageProps & {
  frameStyle?: StyleProp<ViewStyle>;
};

/** Catalog image with blurhash + solid frame placeholder. Local `require()` sources paint instantly. */
export const AppImage = memo(function AppImage({
  style,
  frameStyle,
  placeholder = imagePlaceholder,
  placeholderContentFit = 'cover',
  transition,
  cachePolicy = 'memory-disk',
  contentFit = 'cover',
  source,
  ...rest
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const localAsset = typeof source === 'number';
  // Bundled assets: no fade / no remote fetch — native feel.
  const resolvedTransition = transition ?? (localAsset || Platform.OS === 'web' ? 0 : 120);

  return (
    <View style={[styles.frame, frameStyle]}>
      <Image
        {...rest}
        source={source}
        style={[styles.image, style]}
        placeholder={localAsset ? undefined : placeholder}
        placeholderContentFit={placeholderContentFit}
        transition={resolvedTransition}
        cachePolicy={cachePolicy}
        contentFit={contentFit}
      />
    </View>
  );
});

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    frame: {
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    image: {
      width: '100%',
      height: '100%',
    },
  });
}
