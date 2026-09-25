import { CourseLogo } from '@/components/CourseLogo';
import { bodyFont, colors } from '@/constants/theme';
import { hideSplash } from '@/lib/bootstrap';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

type Props = {
  onFinish: () => void;
  /** false = garder le splash (auth / onboarding pas prêt). */
  allowExit?: boolean;
};

/** Splash animé — Animated natif iOS/Android (pas de Reanimated). */
export function CourseSplash({ onFinish, allowExit = true }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.86)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const orb = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);
  const enteredAt = useRef(Date.now());

  useEffect(() => {
    void hideSplash();

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 170, useNativeDriver: true }),
      Animated.timing(orb, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(220),
        Animated.timing(tag, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(bar, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();
  }, [bar, opacity, orb, scale, tag]);

  useEffect(() => {
    if (!allowExit || finished.current) return;
    const minMs = 1600;
    const wait = Math.max(0, minMs - (Date.now() - enteredAt.current));
    const t = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      Animated.timing(exit, {
        toValue: 1,
        duration: 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished: ok }) => {
        if (ok) onFinish();
      });
    }, wait);
    return () => clearTimeout(t);
  }, [allowExit, exit, onFinish]);

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
          ],
        },
      ]}
      pointerEvents="auto">
      <LinearGradient colors={['#fafaf9', '#f0fdfa', '#fafaf9']} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[
          styles.orb,
          {
            opacity: orb.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.45] }),
            transform: [{ scale: orb.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }],
          },
        ]}
      />
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <CourseLogo width={280} />
      </Animated.View>
      <Animated.View style={{ opacity: tag }}>
        <Text style={styles.tag}>Ramasser · Livrer · Cotonou</Text>
      </Animated.View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { width: bar.interpolate({ inputRange: [0, 1], outputRange: [8, 88] }) },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 80,
    gap: 18,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  orb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.teal,
    top: '28%',
  },
  tag: { ...bodyFont('600'), fontSize: 14, color: colors.muted, textAlign: 'center' },
  barTrack: {
    height: 4,
    width: 88,
    borderRadius: 999,
    backgroundColor: 'rgba(5,141,129,0.15)',
    overflow: 'hidden',
    marginTop: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.teal,
  },
});
