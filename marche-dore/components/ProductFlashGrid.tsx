import { ProductCard } from '@/components/ui';
import { MOBILE_FRAME_MAX, screenEdge, spacing, tabBarClearance } from '@/constants/theme';
import type { Product } from '@/data/catalog';
import { AnimatedFlashList } from '@shopify/flash-list';
import type { ComponentProps, ReactElement, Ref } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

function nearListEnd(event: unknown, lead = 160) {
  const native = (event as {
    nativeEvent?: {
      contentOffset?: { y?: number };
      contentSize?: { height?: number };
      layoutMeasurement?: { height?: number };
    };
  })?.nativeEvent;
  const y = native?.contentOffset?.y ?? 0;
  const contentH = native?.contentSize?.height ?? 0;
  const viewH = native?.layoutMeasurement?.height ?? 0;
  if (contentH < 8 || viewH < 8) return false;
  return y + viewH >= contentH - lead;
}

const WEB_WINDOW = {
  initialNumToRender: 4,
  maxToRenderPerBatch: 4,
  windowSize: 3,
  updateCellsBatchingPeriod: 48,
} as const;

/** Même marge latérale que le body sheet de l’accueil. */
export const PRODUCT_FEED_EDGE = screenEdge(spacing.screen);
const CELL_PAD_H = 1;
const CELL_PAD_B = 3;

type Props = {
  products: Product[];
  header?: ReactElement | null;
  footer?: ReactElement | null;
  empty?: ReactElement | null;
  imageHeight?: number;
  extraData?: unknown;
  estimatedItemHeight?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  onScroll?: (event: unknown) => void;
  onScrollBeginDrag?: (event: unknown) => void;
  onScrollEndDrag?: (event: unknown) => void;
  onMomentumScrollEnd?: (event: unknown) => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  scrollEnabled?: boolean;
  listRef?: Ref<FlatList<Product>>;
  refreshControl?: ReactElement;
  /** FlatList RN sans Reanimated / FlashList (isolation crash). */
  plain?: boolean;
  /** Marge latérale type body sheet accueil (défaut: PRODUCT_FEED_EDGE). */
  edgeInset?: number;
};

export function ProductFlashGrid({
  products,
  header,
  footer,
  empty,
  imageHeight = 160,
  extraData,
  estimatedItemHeight,
  contentContainerStyle,
  style,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  onEndReached,
  onEndReachedThreshold,
  keyboardShouldPersistTaps,
  scrollEnabled,
  listRef,
  refreshControl,
  plain = false,
  edgeInset = PRODUCT_FEED_EDGE,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [listW, setListW] = useState(0);
  const frameW = listW > 0 ? listW : Math.min(windowWidth, MOBILE_FRAME_MAX);
  const colW = Math.max(120, Math.floor((frameW - edgeInset * 2) / 2));
  const rowH = (estimatedItemHeight ?? imageHeight + 118) + CELL_PAD_B;

  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0) setListW((prev) => (prev === next ? prev : next));
  }, []);

  const pad = useMemo(
    () => [
      { paddingBottom: tabBarClearance, paddingHorizontal: edgeInset, flexGrow: 1 },
      contentContainerStyle,
    ],
    [contentContainerStyle, edgeInset],
  );

  const scrollIsFn = typeof onScroll === 'function';
  const handleScroll = useCallback(
    (event: unknown) => {
      if (typeof onScroll === 'function') onScroll(event);
      if (onEndReached && nearListEnd(event)) onEndReached();
    },
    [onScroll, onEndReached],
  );

  const item = useCallback(
    ({ item: product }: { item: Product }) => (
      <View
        style={{
          width: colW,
          maxWidth: colW,
          flexGrow: 0,
          flexShrink: 0,
          paddingHorizontal: CELL_PAD_H,
          paddingBottom: CELL_PAD_B,
        }}>
        <ProductCard product={product} width="100%" imageHeight={imageHeight} compact animate={false} />
      </View>
    ),
    [colW, imageHeight],
  );

  const shared = {
    data: products,
    numColumns: 2 as const,
    keyExtractor: (p: Product) => p.id,
    renderItem: item,
    ListHeaderComponent: header,
    ListFooterComponent: footer,
    ListEmptyComponent: empty,
    extraData: `${String(extraData ?? '')}-${colW}-${imageHeight}`,
    // iOS : removeClippedSubviews masque souvent les images / compresse les cellules
    removeClippedSubviews: false,
    onLayout: onListLayout,
    ...(scrollIsFn || !onScroll
      ? onEndReached || scrollIsFn
        ? { onScroll: handleScroll }
        : {}
      : { onScroll }),
    ...(onScrollBeginDrag ? { onScrollBeginDrag } : {}),
    ...(onScrollEndDrag ? { onScrollEndDrag } : {}),
    ...(onMomentumScrollEnd ? { onMomentumScrollEnd } : {}),
    ...(onEndReached ? { onEndReached, onEndReachedThreshold: onEndReachedThreshold ?? 0.4 } : {}),
    scrollEventThrottle: 16,
    keyboardShouldPersistTaps,
    showsVerticalScrollIndicator: false,
    scrollEnabled,
    style,
    contentContainerStyle: pad,
    ...(refreshControl && Platform.OS !== 'web' ? { refreshControl } : {}),
  };

  if (plain || Platform.OS === 'web') {
    return (
      <FlatList
        ref={listRef as never}
        {...shared}
        {...(Platform.OS === 'web' ? WEB_WINDOW : { initialNumToRender: 6, windowSize: 5 })}
      />
    );
  }

  return (
    <AnimatedFlashList
      ref={listRef as never}
      {...shared}
      drawDistance={180}
      estimatedItemSize={rowH}
    />
  );
}

/** FlashList casse le style CSS sur le web ; FlatList Reanimated y est fiable. */
export function PlatformVirtualList<T>(props: ComponentProps<typeof FlatList<T>>) {
  if (Platform.OS === 'web') {
    return <Animated.FlatList {...WEB_WINDOW} {...props} />;
  }
  return <AnimatedFlashList {...(props as never)} drawDistance={180} />;
}
