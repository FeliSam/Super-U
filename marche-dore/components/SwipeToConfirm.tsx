import { type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { softShadow } from '@/lib/shadow';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const THUMB = 54;
const PAD = 5;
const THRESHOLD = 0.62;

type Props = {
  title?: string;
  subtitle?: string;
  amount: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
};

function pageXOf(e: GestureResponderEvent) {
  return e.nativeEvent.pageX;
}

/** Swipe left → right to confirm payment. Touch/mouse via RN responders (works on phone web). */
export const SwipeToConfirm = memo(function SwipeToConfirm({
  title = 'Glisser pour payer',
  subtitle,
  amount,
  onConfirm,
  disabled = false,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const x = useSharedValue(0);
  const maxX = useSharedValue(1);
  const maxXRef = useRef(1);
  const lockedRef = useRef(false);
  const draggingRef = useRef(false);
  const startPageX = useRef(0);
  const onConfirmRef = useRef(onConfirm);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled) {
      lockedRef.current = false;
      draggingRef.current = false;
      x.value = withSpring(0, { damping: 18, stiffness: 220 });
    }
  }, [disabled, x]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const next = Math.max(1, e.nativeEvent.layout.width - THUMB - PAD * 2);
    maxX.value = next;
    maxXRef.current = next;
  };

  const resetKnob = useCallback(() => {
    lockedRef.current = false;
    draggingRef.current = false;
    x.value = withSpring(0, { damping: 18, stiffness: 220 });
  }, [x]);

  const fireConfirm = useCallback(() => {
    lockedRef.current = true;
    x.value = withTiming(maxXRef.current, { duration: 120 });
    void Promise.resolve(onConfirmRef.current()).finally(() => {
      setTimeout(resetKnob, 450);
    });
  }, [resetKnob, x]);

  const grant = (e: GestureResponderEvent) => {
    if (disabledRef.current || lockedRef.current) return;
    draggingRef.current = true;
    startPageX.current = pageXOf(e);
    x.value = 0;
  };

  const move = (e: GestureResponderEvent) => {
    if (!draggingRef.current || disabledRef.current || lockedRef.current) return;
    const dx = pageXOf(e) - startPageX.current;
    x.value = Math.min(maxXRef.current, Math.max(0, dx));
  };

  const release = (e: GestureResponderEvent) => {
    if (!draggingRef.current || disabledRef.current || lockedRef.current) {
      draggingRef.current = false;
      return;
    }
    draggingRef.current = false;
    const dx = pageXOf(e) - startPageX.current;
    const next = Math.min(maxXRef.current, Math.max(0, dx));
    if (next >= maxXRef.current * THRESHOLD) {
      fireConfirm();
    } else {
      x.value = withSpring(0, { damping: 18, stiffness: 220 });
    }
  };

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
    <View>
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
        onStartShouldSetResponder={() => !disabled && !lockedRef.current}
        onMoveShouldSetResponder={() => !disabled && !lockedRef.current}
        onResponderTerminationRequest={() => false}
        onResponderGrant={grant}
        onResponderMove={move}
        onResponderRelease={release}
        onResponderTerminate={release}>
        <LinearGradient
          colors={['#c84b31', '#a83c26']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none">
          <LinearGradient
            colors={['#d45a3d', '#b8432c']}
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
          <Feather name="check" size={18} color={colors.onAccent} />
          <Text style={styles.doneText}>Confirmé</Text>
        </Animated.View>

        <View style={styles.amountWrap} pointerEvents="none">
          <Text style={styles.amount}>{amount}</Text>
        </View>

        <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none">
          <Feather name="chevron-right" size={22} color={colors.terracotta} />
          <Feather
            name="chevron-right"
            size={22}
            color={colors.terracotta}
            style={styles.thumbChevron2}
          />
        </Animated.View>
      </Animated.View>

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

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    track: {
      height: 64,
      borderRadius: 18,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    trackDisabled: { opacity: 0.55 },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: 18,
      overflow: 'hidden',
    },
    centerCopy: {
      position: 'absolute',
      left: THUMB + 18,
      right: 88,
      justifyContent: 'center',
    },
    title: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
    subtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '600', marginTop: 2 },
    doneCopy: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    doneText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
    amountWrap: {
      position: 'absolute',
      right: 16,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    amount: { color: colors.onAccent, fontSize: 16, fontWeight: '800' },
    thumb: {
      position: 'absolute',
      left: PAD,
      top: PAD,
      width: THUMB,
      height: 64 - PAD * 2,
      borderRadius: 14,
      backgroundColor: '#ffffff',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...softShadow({ y: 3, blur: 16, opacity: 0.18, elevation: 4 }),
    },
    thumbChevron2: { marginLeft: -14, opacity: 0.45 },
    tapFallback: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
    tapFallbackText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  });
}
