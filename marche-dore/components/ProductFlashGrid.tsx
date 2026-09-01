import { ProductCard } from '@/components/ui';
import { tabBarClearance } from '@/constants/theme';
import type { Product } from '@/data/catalog';
import { AnimatedFlashList } from '@shopify/flash-list';
import type { ComponentProps, ReactElement, Ref } from 'react';
import { FlatList, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

const WEB_WINDOW = {
  initialNumToRender: 4,
  maxToRenderPerBatch: 4,
  windowSize: 3,
  updateCellsBatchingPeriod: 48,
} as const;

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
}: Props) {
  const pad = contentContainerStyle ?? { paddingBottom: tabBarClearance };
  const rowH = (estimatedItemHeight ?? imageHeight + 108) + 3;
  const getItemLayout = (_: unknown, index: number) => {
    const row = Math.floor(index / 2);
    return { length: rowH, offset: rowH * row, index };
  };
  const item = ({ item: product }: { item: Product }) => (
    <View style={{ flex: 1, paddingHorizontal: 1, paddingBottom: 3 }}>
      <ProductCard product={product} width="100%" imageHeight={imageHeight} compact animate={false} />
    </View>
  );

  const shared = {
    data: products,
    numColumns: 2 as const,
    keyExtractor: (p: Product) => p.id,
    renderItem: item,
    ListHeaderComponent: header,
    ListFooterComponent: footer,
    ListEmptyComponent: empty,
    extraData,
    removeClippedSubviews: Platform.OS !== 'web',
    ...(onScroll ? { onScroll } : {}),
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
  };

  if (Platform.OS === 'web') {
    return (
      <Animated.FlatList
        ref={listRef as never}
        {...shared}
        {...WEB_WINDOW}
        getItemLayout={getItemLayout}
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
