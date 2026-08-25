import { AppImage } from '@/components/AppImage';
import { useColors } from '@/context/ThemeContext';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import {
  Animated,
  Image as RNImage,
  type ImageSourcePropType,
  PanResponder,
  Platform,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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
  // RN Image is more reliable for the product hero on web (expo-image transitions can stick blank).
  if (Platform.OS === 'web') {
    return (
      <RNImage
        source={source}
        style={{ width, height, backgroundColor: colors.border }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return <AppImage source={source} recyclingKey={recyclingKey} frameStyle={{ width, height }} />;
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
    const translateX = useRef(new Animated.Value(0)).current;
    const dragStart = useRef(0);
    const indexRef = useRef(0);
    const widthRef = useRef(width);
    const lenRef = useRef(images.length);
    const onIndexChangeRef = useRef(onIndexChange);
    onIndexChangeRef.current = onIndexChange;

    widthRef.current = width;
    lenRef.current = images.length;

    const snapTo = (nextIndex: number, animated = true) => {
      const w = Math.max(1, widthRef.current);
      const clamped = Math.max(0, Math.min(lenRef.current - 1, nextIndex));
      indexRef.current = clamped;
      onIndexChangeRef.current?.(clamped);
      if (animated) {
        Animated.spring(translateX, {
          toValue: -clamped * w,
          useNativeDriver: true,
          friction: 8,
          tension: 70,
        }).start();
      } else {
        translateX.setValue(-clamped * w);
      }
    };

    useImperativeHandle(ref, () => ({
      goTo: (i: number) => snapTo(i, true),
    }));

    useEffect(() => {
      indexRef.current = 0;
      translateX.setValue(0);
      onIndexChangeRef.current?.(0);
    }, [recyclingKeyPrefix, images.length, translateX]);

    useEffect(() => {
      translateX.setValue(-indexRef.current * width);
    }, [width, translateX]);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, g) => {
          const ax = Math.abs(g.dx);
          const ay = Math.abs(g.dy);
          if (ax < 6 && ay < 6) return false;
          return ax > ay * 1.2;
        },
        onMoveShouldSetPanResponderCapture: (_, g) => {
          const ax = Math.abs(g.dx);
          const ay = Math.abs(g.dy);
          if (ax < 8 && ay < 8) return false;
          return ax > ay * 1.35;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          translateX.stopAnimation((v) => {
            dragStart.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const w = widthRef.current;
          const max = -Math.max(0, lenRef.current - 1) * w;
          const next = Math.min(0, Math.max(max, dragStart.current + g.dx));
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          const w = Math.max(1, widthRef.current);
          const projected = dragStart.current + g.dx + g.vx * 90;
          snapTo(Math.round(-projected / w), true);
        },
      }),
    ).current;

    if (width <= 0 || images.length === 0) {
      return <View style={[{ width: '100%', height, backgroundColor: colors.border }, style]} />;
    }

    if (images.length === 1) {
      return (
        <Pressable
          onPress={onPress}
          accessibilityRole="imagebutton"
          accessibilityLabel="Agrandir les photos"
          style={[{ width, height, overflow: 'hidden' }, style]}>
          <PagerImage
            source={images[0]}
            recyclingKey={`${recyclingKeyPrefix}-0`}
            width={width}
            height={height}
          />
        </Pressable>
      );
    }

    return (
      <View
        style={[{ width, height, overflow: 'hidden', backgroundColor: colors.border }, style]}
        {...panResponder.panHandlers}>
        <Animated.View
          style={{
            flexDirection: 'row',
            height,
            width: width * images.length,
            transform: [{ translateX }],
          }}>
          {images.map((src, i) => (
            <Pressable
              key={`${recyclingKeyPrefix}-${i}`}
              onPress={onPress}
              accessibilityRole="imagebutton"
              accessibilityLabel="Agrandir les photos"
              style={{ width, height }}>
              <PagerImage
                source={src}
                recyclingKey={`${recyclingKeyPrefix}-${i}`}
                width={width}
                height={height}
              />
            </Pressable>
          ))}
        </Animated.View>
      </View>
    );
  }),
);
