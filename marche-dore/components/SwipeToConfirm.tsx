import { liquidIce, type AppColors } from '@/constants/theme';
import { useColors, useTheme } from '@/context/ThemeContext';
import { softShadow } from '@/lib/shadow';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const THUMB = 48;
const PAD = 4;
const TRACK_H = 54;
const THRESHOLD = 0.62;

type Props = {
  title?: string;
  subtitle?: string;
  amount: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
};

/** Swipe L→R pour confirmer — Pan RNGH pour ne pas faire scroller la page. */
export const SwipeToConfirm = memo(function SwipeToConfirm({
  title = 'Glisser pour payer',
  subtitle,
  amount,
  onConfirm,
  disabled = false,
}: Props) {
  const colors = useColors();
  const { scheme } = useTheme();
  const ice = useMemo(() => liquidIce(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors, ice), [colors, ice]);
  const x = useSharedValue(0);
  const maxX = useSharedValue(1);
  const lockedSV = useSharedValue(0);
  const maxXRef = useRef(1);
  const lockedRef = useRef(false);
  const onConfirmRef = useRef(onConfirm);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    if (disabled) {
      lockedRef.current = false;
      lockedSV.value = 0;
      x.value = withSpring(0, { damping: 18, stiffness: 220 });
    }
  }, [disabled, lockedSV, x]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const next = Math.max(1, e.nativeEvent.layout.width - THUMB - PAD * 2);
    maxX.value = next;
    maxXRef.current = next;
  };

  const resetKnob = useCallback(() => {
    lockedRef.current = false;
    lockedSV.value = 0;
    x.value = withSpring(0, { damping: 18, stiffness: 220 });
  }, [lockedSV, x]);

  const fireConfirm = useCallback(() => {
    if (lockedRef.current || disabled) return;
    lockedRef.current = true;
    lockedSV.value = 1;
    x.value = withTiming(maxXRef.current, { duration: 120 });
    void Promise.resolve(onConfirmRef.current()).finally(() => {
      setTimeout(resetKnob, 450);
    });
  }, [disabled, lockedSV, resetKnob, x]);

  const releaseAt = useCallback(
    (dx: number) => {
      if (disabled || lockedRef.current) return;
      const next = Math.min(maxXRef.current, Math.max(0, dx));
      if (next >= maxXRef.current * THRESHOLD) fireConfirm();
      else x.value = withSpring(0, { damping: 18, stiffness: 220 });
    },
    [disabled, fireConfirm, x],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-8, 8])
        .failOffsetY([-18, 18])
        .onBegin(() => {
          'worklet';
          if (lockedSV.value) return;
          x.value = 0;
        })
        .onUpdate((e) => {
          'worklet';
          if (lockedSV.value) return;
          x.value = Math.min(maxX.value, Math.max(0, e.translationX));
        })
        .onEnd((e) => {
          'worklet';
          runOnJS(releaseAt)(e.translationX);
        })
        .onFinalize((_e, success) => {
          'worklet';
          if (!success && !lockedSV.value) {
            x.value = withSpring(0, { damping: 18, stiffness: 220 });
          }
        }),
    [disabled, lockedSV, maxX, releaseAt, x],
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: x.value + THUMB + PAD * 2,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, Math.max(1, maxX.value * 0.5)], [1, 0]),
  }));

  const doneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [Math.max(1, maxX.value * 0.62), Math.max(2, maxX.value)], [0, 1]),
  }));

  return (
    <View
      style={
        Platform.OS === 'web'
          ? ({ touchAction: 'none', overscrollBehavior: 'none' } as object)
          : undefined
      }>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.track,
            disabled && styles.trackDisabled,
            Platform.OS === 'web'
              ? ({
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  cursor: disabled ? 'default' : 'grab',
                } as object)
              : null,
          ]}
          onLayout={onTrackLayout}
          onStartShouldSetResponder={() => !disabled}
          onMoveShouldSetResponder={() => !disabled}
          onResponderTerminationRequest={() => false}>
          <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none">
            <LinearGradient
              colors={['rgba(226, 147, 29, 0.55)', 'rgba(200, 75, 49, 0.5)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View style={[styles.centerCopy, hintStyle]} pointerEvents="none">
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </Animated.View>

          <Animated.View style={[styles.doneCopy, doneStyle]} pointerEvents="none">
            <Feather name="check" size={18} color={colors.green} />
            <Text style={styles.doneText}>Confirmé</Text>
          </Animated.View>

          <View style={styles.amountWrap} pointerEvents="none">
            <Text style={styles.amount}>{amount}</Text>
          </View>

          <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none">
            <Feather name="chevron-right" size={22} color={colors.gold} />
            <Feather
              name="chevron-right"
              size={22}
              color={colors.gold}
              style={styles.thumbChevron2}
            />
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <Pressable
        style={styles.tapFallback}
        onPress={() => {
          if (disabled || lockedRef.current) return;
          fireConfirm();
        }}
        disabled={disabled}
        hitSlop={8}>
        <Text style={styles.tapFallbackText}>Toucher pour confirmer</Text>
      </Pressable>
    </View>
  );
});

function createStyles(colors: AppColors, ice: ReturnType<typeof liquidIce>) {
  const glassWeb =
    Platform.OS === 'web'
      ? {
          backdropFilter: ice.webFilter,
          WebkitBackdropFilter: ice.webFilter,
          boxShadow: ice.webShadow,
        }
      : {};
  return StyleSheet.create({
    track: {
      height: TRACK_H,
      borderRadius: 16,
      overflow: 'hidden',
      justifyContent: 'center',
      backgroundColor: ice.backgroundColor,
      borderWidth: 1,
      borderColor: ice.borderColor,
      ...glassWeb,
    },
    trackDisabled: { opacity: 0.55 },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: 16,
      overflow: 'hidden',
    },
    centerCopy: {
      position: 'absolute',
      left: THUMB + 14,
      right: 80,
      justifyContent: 'center',
    },
    title: { color: colors.text, fontSize: 14, fontWeight: '800' },
    subtitle: { color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 1 },
    doneCopy: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    doneText: { color: colors.text, fontSize: 14, fontWeight: '800' },
    amountWrap: {
      position: 'absolute',
      right: 14,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    amount: { color: colors.text, fontSize: 15, fontWeight: '800' },
    thumb: {
      position: 'absolute',
      left: PAD,
      top: PAD,
      width: THUMB,
      height: TRACK_H - PAD * 2,
      borderRadius: 12,
      backgroundColor: ice.backgroundColor,
      borderWidth: 1,
      borderColor: ice.borderColor,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...glassWeb,
      ...softShadow({ y: 3, blur: 16, opacity: 0.18, elevation: 4 }),
    },
    thumbChevron2: { marginLeft: -14, opacity: 0.45 },
    tapFallback: { alignItems: 'center', paddingTop: 6, paddingBottom: 0 },
    tapFallbackText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  });
}
