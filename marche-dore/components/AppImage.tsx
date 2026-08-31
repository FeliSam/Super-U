import { type AppColors } from '@/constants/theme';
import { imagePlaceholder } from '@/constants/media';
import { useColors } from '@/context/ThemeContext';
import { catalogImageFallback } from '@/data/catalog';
import { Image, type ImageProps } from 'expo-image';
import { memo, useEffect, useMemo, useState } from 'react';
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

/** Metro serves bundled assets over http://host:8081/assets/… — not the shop API. */
function isBundledUri(uri: string) {
  if (!uri) return false;
  if (/^(file:|asset:|content:|data:)/i.test(uri)) return true;
  if (uri.includes('/assets/')) return true;
  if (/:(8081|8082|19000|19006|8085)\b/.test(uri)) return true;
  return false;
}

function isRemoteApiUri(uri: string) {
  if (/\/catalog\/media\//i.test(uri)) return true;
  if (/\/ops\/staff\/.+\/photo/i.test(uri)) return true;
  if (/^(blob:)/i.test(uri)) return true;
  if (/^https?:/i.test(uri) && !isBundledUri(uri)) return true;
  return false;
}

/** Metro web packs `require()` as `{ uri, width, height }`, not a numeric module id. */
function isBundledSource(source: ImageProps['source']): boolean {
  if (source == null) return false;
  if (typeof source === 'number') return true;
  if (typeof source === 'string') return !isRemoteApiUri(source);
  if (Array.isArray(source)) return source.length > 0 && source.every(isBundledSource);
  const uri = (source as { uri?: string }).uri;
  if (!uri) return true;
  return !isRemoteApiUri(uri);
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
  onError,
  priority = 'low',
  recyclingKey,
  ...rest
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [failed, setFailed] = useState(false);
  const fallback = catalogImageFallback(source);
  useEffect(() => setFailed(false), [source]);
  const resolvedSource = failed && fallback ? fallback : source;
  const bundled = isBundledSource(resolvedSource);
  const resolvedTransition = transition ?? (bundled || Platform.OS === 'web' ? 0 : 80);

  if (bundled) {
    const resizeMode: ImageResizeMode =
      contentFit === 'contain' ? 'contain' : contentFit === 'fill' ? 'stretch' : 'cover';
    return (
      <View style={[styles.frame, frameStyle]}>
        <RNImage
          source={resolvedSource as number}
          style={[styles.image, style]}
          resizeMode={resizeMode}
          accessibilityIgnoresInvertColors
          {...(Platform.OS === 'web'
            ? ({
                loading: priority === 'low' ? 'lazy' : 'eager',
                fetchPriority: priority === 'low' ? 'low' : 'high',
              } as object)
            : null)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.frame, frameStyle]}>
      <Image
        {...rest}
        source={resolvedSource}
        style={[styles.image, style]}
        placeholder={placeholder}
        placeholderContentFit={placeholderContentFit}
        transition={resolvedTransition}
        cachePolicy={cachePolicy}
        contentFit={contentFit}
        priority={priority}
        recyclingKey={recyclingKey}
        onError={(event) => {
          if (fallback) setFailed(true);
          onError?.(event);
        }}
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
