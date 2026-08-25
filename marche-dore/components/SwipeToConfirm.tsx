import { type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { softShadow } from '@/lib/shadow';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

const THUMB = 54;
const PAD = 5;
const THRESHOLD = 0.82;

type Props = {
  title?: string;
  subtitle?: string;
  amount: string;
  onConfirm: () => void;
  disabled?: boolean;
};

/** Swipe left → right to confirm payment. */
export const SwipeToConfirm = memo(function SwipeToConfirm({
  title = 'Glisser pour payer',
  subtitle,
  amount,
  onConfirm,
  disabled = false,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [trackW, setTrackW] = useState(0);
  const maxX = Math.max(1, trackW - THUMB - PAD * 2);
  const translateX = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);
  const locked = useRef(false);
  const maxXRef = useRef(maxX);
  const xRef = useRef(0);
  maxXRef.current = maxX;

  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      xRef.current = value;
    });
    return () => translateX.removeListener(id);
  }, [translateX]);


  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackW(e.nativeEvent.layout.width);
  };

  const reset = () => {
    locked.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      friction: 7,
      tension: 80,
    }).start();
  };

  const complete = () => {
    if (locked.current) return;
    locked.current = true;
    Animated.timing(translateX, {
      toValue: maxXRef.current,
      duration: 140,
      useNativeDriver: false,
    }).start(() => {
      onConfirm();
      // Allow retry if navigation fails / user comes back
      setTimeout(reset, 600);
    });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !locked.current,
      onMoveShouldSetPanResponder: (_, g) => !disabled && !locked.current && Math.abs(g.dx) > 3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
        startX.current = xRef.current;
      },
      onPanResponderMove: (_, g) => {
        if (locked.current || disabled) return;
        const next = Math.min(maxXRef.current, Math.max(0, startX.current + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        if (locked.current || disabled) return;
        const next = Math.min(maxXRef.current, Math.max(0, startX.current + g.dx));
        if (next >= maxXRef.current * THRESHOLD || g.vx > 1.2) {
          complete();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            friction: 7,
            tension: 80,
          }).start();
        }
      },
    }),
  ).current;

  const fillWidth = Animated.add(translateX, THUMB + PAD * 2);
  const hintOpacity = translateX.interpolate({
    inputRange: [0, maxX * 0.55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const doneOpacity = translateX.interpolate({
    inputRange: [maxX * 0.7, maxX],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.track, disabled && styles.trackDisabled]}
      onLayout={onTrackLayout}
      {...(disabled ? {} : pan.panHandlers)}>
      <LinearGradient
        colors={['#c84b31', '#a83c26']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.fill, { width: fillWidth }]}>
        <LinearGradient
          colors={['#d45a3d', '#b8432c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[styles.centerCopy, { opacity: hintOpacity, pointerEvents: 'none' }]}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </Animated.View>

      <Animated.View style={[styles.doneCopy, { opacity: doneOpacity, pointerEvents: 'none' }]}>
        <Feather name="check" size={18} color={colors.onAccent} />
        <Text style={styles.doneText}>Confirmé</Text>
      </Animated.View>

      <View style={[styles.amountWrap, { pointerEvents: 'none' }]}>
        <Text style={styles.amount}>{amount}</Text>
      </View>

      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX }],
          },
        ]}>
        <Feather name="chevron-right" size={22} color={colors.terracotta} />
        <Feather name="chevron-right" size={22} color={colors.terracotta} style={styles.thumbChevron2} />
      </Animated.View>
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
  });
}
