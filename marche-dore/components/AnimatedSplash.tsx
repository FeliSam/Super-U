import { BRAND_MARK } from '@/constants/brand';
import { bodyFont, displayFont } from '@/constants/theme';
import { hideSplash } from '@/lib/bootstrap';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  onFinish: () => void;
  /** false = garder le splash visible (auth pas encore prêt). */
  allowExit?: boolean;
};

/** Splash animé — Animated natif iOS/Android (pas de Reanimated). */
export function AnimatedSplash({ onFinish, allowExit = true }: Props) {
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.72)).current;
  const markRotate = useRef(new Animated.Value(-8)).current;
  const titleY = useRef(new Animated.Value(22)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagY = useRef(new Animated.Value(14)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const orb = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);
  const enteredAt = useRef(Date.now());

  useEffect(() => {
    void hideSplash();

    Animated.parallel([
      Animated.timing(orb, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(markOpacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(markScale, { toValue: 1, damping: 14, stiffness: 200, mass: 0.75, useNativeDriver: true }),
      Animated.spring(markRotate, { toValue: 0, damping: 16, stiffness: 180, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(100),
        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(titleY, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(tagOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(tagY, { toValue: 0, damping: 18, stiffness: 180, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(220),
        Animated.timing(bar, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(420),
      Animated.timing(markScale, { toValue: 1.03, duration: 220, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(markScale, { toValue: 1, duration: 220, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]).start();
  }, [bar, markOpacity, markRotate, markScale, orb, tagOpacity, tagY, titleOpacity, titleY]);

  useEffect(() => {
    if (!allowExit || finished.current) return;
    const minMs = 1050;
    const wait = Math.max(0, minMs - (Date.now() - enteredAt.current));
    const t = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      Animated.timing(exit, {
        toValue: 1,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished: ok }) => {
        if (ok) onFinish();
      });
    }, wait);
    return () => clearTimeout(t);
  }, [allowExit, exit, onFinish]);

  const rootStyle = {
    opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      {
        scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
      },
    ],
  };

  const orbStyle = {
    opacity: orb.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }),
    transform: [
      { scale: orb.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.12] }) },
      { translateX: orb.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
    ],
  };

  const markStyle = {
    opacity: markOpacity,
    transform: [
      { scale: markScale },
      {
        rotate: markRotate.interpolate({
          inputRange: [-8, 0],
          outputRange: ['-8deg', '0deg'],
        }),
      },
    ],
  };

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      <LinearGradient
        colors={['#f8e4c4', '#fdfbf7', '#fdf0d5']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[styles.orb, orbStyle]} />
      <View style={styles.orbSoft} />

      <View style={styles.center}>
        <Animated.View style={[styles.markWrap, markStyle]}>
          <Image source={BRAND_MARK} style={styles.mark} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
          <Text style={styles.brand}>Marché Doré</Text>
        </Animated.View>

        <Animated.View style={{ opacity: tagOpacity, transform: [{ translateY: tagY }] }}>
          <Text style={styles.tagline}>Produits frais · Livrés chez vous</Text>
        </Animated.View>

        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              {
                width: bar.interpolate({ inputRange: [0, 1], outputRange: [10, 120] }),
              },
            ]}
          />
        </View>
      </View>

      <Text style={styles.footer}>Cotonou · Bénin</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdfbf7',
  },
  orb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(226,147,29,0.18)',
    top: '18%',
    alignSelf: 'center',
  },
  orbSoft: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(255,255,255,0.45)',
    bottom: '-12%',
    right: '-18%',
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 10,
    maxWidth: 360,
    width: '100%',
  },
  markWrap: {
    width: 112,
    height: 112,
    marginBottom: 18,
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1c1613',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  mark: { width: '100%', height: '100%' },
  brand: {
    color: '#1c1613',
    fontSize: 34,
    letterSpacing: -0.8,
    textAlign: 'center',
    ...displayFont('800'),
  },
  tagline: {
    color: '#615752',
    fontSize: 14,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 2,
    ...bodyFont('500'),
  },
  barTrack: {
    marginTop: 28,
    width: 120,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(28,22,19,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#e2931d',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    ...bodyFont('600'),
    fontSize: 12,
    color: '#8a7f78',
    letterSpacing: 0.4,
  },
});
