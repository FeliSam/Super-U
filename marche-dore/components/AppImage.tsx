import { type AppColors } from '@/constants/theme';
import { imagePlaceholder } from '@/constants/media';
import { useColors } from '@/context/ThemeContext';
import { avatar, catalogImageFallback } from '@/data/catalog';
import { Image, type ImageProps } from 'expo-image';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  Image as RNImage,
  Platform,
  StyleSheet,
  View,
  type ImageResizeMode,
  type ImageSourcePropType,
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

function sourceUri(source: unknown): string {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') return `mod:${source}`;
  if (source && typeof source === 'object' && 'uri' in source) {
    return String((source as { uri?: unknown }).uri ?? '');
  }
  return '';
}

function isPortraitPhotoUri(uri: string) {
  return /\/ops\/staff\/.+\/photo/i.test(uri) || /\/users\/.+\/photo/i.test(uri);
}

function isRemoteApiUri(uri: string) {
  if (/\/catalog\/media\//i.test(uri)) return true;
  if (isPortraitPhotoUri(uri)) return true;
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

function sourcesEqual(a: unknown, b: unknown) {
  if (a === b) return true;
  return sourceUri(a) === sourceUri(b) && sourceUri(a) !== '';
}

/** Catalog image with blurhash + solid frame placeholder. Local sources paint from cache. */
export const AppImage = memo(
  function AppImage({
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
    const uri = sourceUri(source);
    const [failed, setFailed] = useState(false);
    const fallback = catalogImageFallback(source) ?? (isPortraitPhotoUri(uri) ? avatar : undefined);

    useEffect(() => {
      setFailed(false);
    }, [uri]);

    const resolvedSource = failed && fallback ? fallback : source;
    const resolvedUri = sourceUri(resolvedSource);
    const bundled = isBundledSource(resolvedSource);
    const portraitRemote = isPortraitPhotoUri(resolvedUri);
    const resolvedTransition = transition ?? (bundled || Platform.OS === 'web' ? 0 : 80);
    const key = recyclingKey || resolvedUri || uri || 'img';

    if (bundled || portraitRemote) {
      const resizeMode: ImageResizeMode =
        contentFit === 'contain' ? 'contain' : contentFit === 'fill' ? 'stretch' : 'cover';
      return (
        <View style={[styles.frame, frameStyle]}>
          <RNImage
            key={key}
            source={resolvedSource as ImageSourcePropType}
            style={[styles.image, style]}
            resizeMode={resizeMode}
            accessibilityIgnoresInvertColors
            onError={() => {
              if (fallback && !failed) setFailed(true);
            }}
            {...(Platform.OS === 'web'
              ? ({
                  // Eager: le lazy web ne recharge pas correctement après un remount (chat, tabs).
                  loading: 'eager',
                  fetchPriority: priority === 'low' ? 'low' : 'high',
                  decoding: 'async',
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
          key={key}
          source={resolvedSource}
          style={[styles.image, style]}
          placeholder={placeholder}
          placeholderContentFit={placeholderContentFit}
          transition={resolvedTransition}
          cachePolicy={cachePolicy}
          contentFit={contentFit}
          priority={priority}
          recyclingKey={key}
          onError={(event) => {
            if (fallback) setFailed(true);
            onError?.(event);
          }}
        />
      </View>
    );
  },
  (prev, next) =>
    sourcesEqual(prev.source, next.source) &&
    prev.frameStyle === next.frameStyle &&
    prev.style === next.style &&
    prev.contentFit === next.contentFit &&
    prev.priority === next.priority &&
    prev.recyclingKey === next.recyclingKey &&
    prev.cachePolicy === next.cachePolicy,
);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    frame: {
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    image: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
  });
}
