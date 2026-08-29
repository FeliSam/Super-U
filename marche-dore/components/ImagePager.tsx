import { AppImage } from '@/components/AppImage';
import { useColors } from '@/context/ThemeContext';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { type ImageSourcePropType, type StyleProp, type ViewStyle, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const SNAP = {
  duration: 180,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
} as const;

function PagerImage({
  source,
  recyclingKey,
  width,
  height,
}: {
  source: ImageSourcePropType;
  recyclingKey: string;
  width: number;
  height: number;
}) {
  const colors = useColors();
  return (
    <AppImage
      source={source}
      recyclingKey={recyclingKey}
      frameStyle={{ width, height, backgroundColor: colors.border }}
    />
  );
}

export type ImagePagerHandle = {
  goTo: (index: number) => void;
};

type Props = {
  images: ImageSourcePropType[];
  width: number;
  height: number;
  onIndexChange?: (index: number) => void;
  onPress?: () => void;
  recyclingKeyPrefix?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Horizontal image pager that only claims the gesture when the swipe is clearly
 * horizontal — vertical parent ScrollViews keep working.
 */
export const ImagePager = memo(
  forwardRef<ImagePagerHandle, Props>(function ImagePager(
    {
      images,
      width,
      height,
      onIndexChange,
      onPress,
      recyclingKeyPrefix = 'img',
      style,
    },
    ref,
  ) {
    const colors = useColors();
    const translateX = useSharedValue(0);
    const dragStart = useSharedValue(0);
    const indexSV = useSharedValue(0);
    const widthSV = useSharedValue(Math.max(1, width));
    const lenSV = useSharedValue(images.length);
    const indexRef = useRef(0);
    const onIndexChangeRef = useRef(onIndexChange);
    const onPressRef = useRef(onPress);
    onIndexChangeRef.current = onIndexChange;
    onPressRef.current = onPress;

    widthSV.value = Math.max(1, width);
    lenSV.value = images.length;

    const notifyIndex = useCallback((next: number) => {
      indexRef.current = next;
      onIndexChangeRef.current?.(next);
    }, []);

    const snapTo = useCallback(
      (nextIndex: number, animated = true) => {
        const w = Math.max(1, widthSV.value);
        const clamped = Math.max(0, Math.min(Math.max(0, lenSV.value - 1), nextIndex));
        indexSV.value = clamped;
        notifyIndex(clamped);
        const dest = -clamped * w;
        if (animated) {
          translateX.value = withTiming(dest, SNAP);
        } else {
          translateX.value = dest;
        }
      },
      [indexSV, lenSV, notifyIndex, translateX, widthSV],
    );

    useImperativeHandle(ref, () => ({
      goTo: (i: number) => snapTo(i, true),
    }));

    useEffect(() => {
      indexRef.current = 0;
      indexSV.value = 0;
      translateX.value = 0;
      onIndexChangeRef.current?.(0);
    }, [recyclingKeyPrefix, images.length, indexSV, translateX]);

    useEffect(() => {
      translateX.value = -indexRef.current * width;
    }, [width, translateX]);

    const pan = Gesture.Pan()
      .maxPointers(1)
      .activeOffsetX([-6, 6])
      .failOffsetY([-18, 18])
      .onBegin(() => {
        cancelAnimation(translateX);
        dragStart.value = translateX.value;
      })
      .onUpdate((e) => {
        const w = widthSV.value;
        const max = -Math.max(0, lenSV.value - 1) * w;
        const raw = dragStart.value + e.translationX;
        if (raw > 0) {
          translateX.value = raw * 0.22;
        } else if (raw < max) {
          translateX.value = max + (raw - max) * 0.22;
        } else {
          translateX.value = raw;
        }
      })
      .onEnd((e) => {
        const w = Math.max(1, widthSV.value);
        const last = Math.max(0, lenSV.value - 1);
        const current = indexSV.value;
        const projected = translateX.value + e.velocityX * 0.16;
        let next = Math.round(-projected / w);
        if (e.velocityX < -550) next = current + 1;
        else if (e.velocityX > 550) next = current - 1;
        else if (e.translationX < -w * 0.12) next = current + 1;
        else if (e.translationX > w * 0.12) next = current - 1;
        next = Math.max(0, Math.min(last, next));
        indexSV.value = next;
        translateX.value = withTiming(-next * w, SNAP);
        runOnJS(notifyIndex)(next);
      });

    const tap = Gesture.Tap().onEnd(() => {
      const press = onPressRef.current;
      if (press) runOnJS(press)();
    });

    const composed = Gesture.Exclusive(pan, tap);

    const stripStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    if (width <= 0 || images.length === 0) {
      return <View style={[{ width: '100%', height, backgroundColor: colors.border }, style]} />;
    }

    const pages = (
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            height,
            width: width * images.length,
          },
          stripStyle,
        ]}>
        {images.map((src, i) => (
          <View key={`${recyclingKeyPrefix}-${i}`} style={{ width, height }}>
            <PagerImage
              source={src}
              recyclingKey={`${recyclingKeyPrefix}-${i}`}
              width={width}
              height={height}
            />
          </View>
        ))}
      </Animated.View>
    );

    if (images.length === 1) {
      return (
        <GestureHandlerRootView style={[{ width, height, overflow: 'hidden' }, style]}>
          <GestureDetector gesture={tap}>
            <Animated.View
              accessible
              accessibilityRole="imagebutton"
              accessibilityLabel="Agrandir les photos"
              style={{ width, height }}>
              {pages}
            </Animated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      );
    }

    return (
      <GestureHandlerRootView
        style={[{ width, height, overflow: 'hidden', backgroundColor: colors.border }, style]}>
        <GestureDetector gesture={composed}>
          <Animated.View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Photos du produit"
            style={{ width, height }}>
            {pages}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    );
  }),
);
