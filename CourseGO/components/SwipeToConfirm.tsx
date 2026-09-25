import { colors, displayFont } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useRef } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

const THUMB = 44;
const PAD = 5;
const HEIGHT = 54;
const THRESHOLD = 0.72;

export function SwipeToConfirm({
  label,
  disabled,
  onConfirm,
}: {
  label: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const maxX = useRef(1);
  const startX = useRef(0);
  const locked = useRef(false);
  const x = useRef(new Animated.Value(0)).current;

  const onLayout = (e: LayoutChangeEvent) => {
    maxX.current = Math.max(1, e.nativeEvent.layout.width - THUMB - PAD * 2);
  };

  const reset = () => {
    locked.current = false;
    Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
  };

  const fire = () => {
    locked.current = true;
    Animated.timing(x, { toValue: maxX.current, duration: 140, useNativeDriver: false }).start();
    void Promise.resolve(onConfirm()).finally(() => {
      setTimeout(reset, 400);
    });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !locked.current,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
      onPanResponderGrant: (_, g) => {
        startX.current = g.x0;
        x.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        if (locked.current || disabled) return;
        x.setValue(Math.min(maxX.current, Math.max(0, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        if (locked.current || disabled) return;
        const dx = Math.min(maxX.current, Math.max(0, g.dx));
        if (dx >= maxX.current * THRESHOLD) fire();
        else Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 8 }).start();
      },
    }),
  ).current;

  const fillW = Animated.add(x, THUMB + PAD * 2);

  return (
    <View
      style={[styles.track, disabled && { opacity: 0.5 }]}
      onLayout={onLayout}
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Animated.View style={[styles.fill, { width: fillW }]} pointerEvents="none" />
      <Text style={styles.label} pointerEvents="none">
        {label}
      </Text>
      <Animated.View
        style={[styles.thumb, { transform: [{ translateX: x }] }]}
        pointerEvents="none">
        <Feather name="chevron-right" size={22} color={colors.teal} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: 999,
    backgroundColor: colors.teal,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          touchAction: 'none',
          userSelect: 'none',
          cursor: 'grab',
          boxShadow: '0 6px 8px rgba(5,141,129,0.2)',
        } as object)
      : {
          shadowColor: colors.teal,
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }),
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
  },
  label: {
    ...displayFont('800'),
    color: colors.onAccent,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: THUMB + 12,
  },
  thumb: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    width: THUMB,
    height: HEIGHT - PAD * 2,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
