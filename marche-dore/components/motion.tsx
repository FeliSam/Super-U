import { memo, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING = { damping: 16, stiffness: 220, mass: 0.7 };

export function enterFade(delay = 0) {
  return FadeIn.duration(300).delay(delay);
}

export function enterUp(delay = 0) {
  return FadeInUp.duration(360).delay(delay).springify().damping(18);
}

export function enterDown(delay = 0) {
  return FadeInDown.duration(360).delay(delay);
}

export function enterRight(delay = 0) {
  return FadeInRight.duration(340).delay(delay);
}

export function enterZoom(delay = 0) {
  return ZoomIn.duration(300).delay(delay).springify().damping(14);
}

export function staggerDelay(index: number, base = 45, cap = 240) {
  return Math.min(Math.max(0, index) * base, cap);
}

type MotionViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  index?: number;
  preset?: 'fade' | 'up' | 'down' | 'right' | 'zoom';
  delay?: number;
};

/** Enter animation wrapper for page sections and cards. */
export const MotionView = memo(function MotionView({
  children,
  style,
  index = 0,
  preset = 'down',
  delay,
}: MotionViewProps) {
  const d = delay ?? staggerDelay(index);
  const entering =
    preset === 'fade'
      ? enterFade(d)
      : preset === 'up'
        ? enterUp(d)
        : preset === 'right'
          ? enterRight(d)
          : preset === 'zoom'
            ? enterZoom(d)
            : enterDown(d);

  return (
    <Animated.View entering={Platform.OS === 'web' ? undefined : entering} style={style}>
      {children}
    </Animated.View>
  );
});

type PressScaleProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

/** Soft press scale feedback for interactive elements. */
export const PressScale = memo(function PressScale({
  children,
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  ...rest
}: PressScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}>
      {children}
    </AnimatedPressable>
  );
});
