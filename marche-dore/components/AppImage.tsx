import { type AppColors } from '@/constants/theme';
import { imagePlaceholder } from '@/constants/media';
import { useColors } from '@/context/ThemeContext';
import { Image, type ImageProps } from 'expo-image';
import { memo, useMemo } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = ImageProps & {
  frameStyle?: StyleProp<ViewStyle>;
};

/** Catalog image with blurhash + solid frame placeholder. */
export const AppImage = memo(function AppImage({
  style,
  frameStyle,
  placeholder = imagePlaceholder,
  placeholderContentFit = 'cover',
  // Cross-dissolve often sticks on web and leaves a blank cream frame.
  transition = Platform.OS === 'web' ? 0 : 160,
  cachePolicy = 'memory-disk',
  contentFit = 'cover',
  ...rest
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.frame, frameStyle]}>
      <Image
        {...rest}
        style={[styles.image, style]}
        placeholder={placeholder}
        placeholderContentFit={placeholderContentFit}
        transition={transition}
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
