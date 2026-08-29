import { type AppColors } from '@/constants/theme';
import { imagePlaceholder } from '@/constants/media';
import { useColors } from '@/context/ThemeContext';
import { Image, type ImageProps } from 'expo-image';
import { memo, useMemo } from 'react';
import {
  Image as RNImage,
  Platform,
  StyleSheet,
  View,
  type ImageResizeMode,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = ImageProps & {
  frameStyle?: StyleProp<ViewStyle>;
};

/** Metro web packs `require()` as `{ uri, width, height }`, not a numeric module id. */
function isBundledSource(source: ImageProps['source']): boolean {
  if (source == null) return false;
  if (typeof source === 'number') return true;
  if (typeof source === 'string') return !/^https?:\/\//i.test(source);
  if (Array.isArray(source)) return source.length > 0 && source.every(isBundledSource);
  const uri = (source as { uri?: string }).uri;
  if (!uri) return true;
  return !/^https?:\/\//i.test(uri);
}

/** Catalog image with blurhash + solid frame placeholder. Local sources paint from cache. */
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
  const bundled = isBundledSource(source);
  const resolvedTransition = transition ?? (bundled || Platform.OS === 'web' ? 0 : 80);

  if (Platform.OS === 'web' && bundled) {
    const resizeMode: ImageResizeMode =
      contentFit === 'contain' ? 'contain' : contentFit === 'fill' ? 'stretch' : 'cover';
    return (
      <View style={[styles.frame, frameStyle]}>
        <RNImage
          source={source as number}
          style={[styles.image, style]}
          resizeMode={resizeMode}
          accessibilityIgnoresInvertColors
          {...({ loading: 'eager', fetchPriority: 'high' } as object)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.frame, frameStyle]}>
      <Image
        {...rest}
        source={source}
        style={[styles.image, style]}
        placeholder={bundled ? undefined : placeholder}
        placeholderContentFit={placeholderContentFit}
        transition={resolvedTransition}
        cachePolicy={cachePolicy}
        contentFit={contentFit}
        priority="high"
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
