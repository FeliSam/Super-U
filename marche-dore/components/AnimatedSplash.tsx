import { displayFont, bodyFont } from '@/constants/theme';
import { hideSplash } from '@/lib/bootstrap';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const BRAND_MARK = require('../assets/images/brand-mark.png');

type Props = {
  onFinish: () => void;
};

/**
 * Branded animated splash — matches native splash cream/gold so the handoff is seamless.
 * Syne for the wordmark, DM Sans for the tagline.
 */
export function AnimatedSplash({ onFinish }: Props) {
  const markScale = useSharedValue(0.72);
  const markOpacity = useSharedValue(0);
  const markRotate = useSharedValue(-8);
  const titleY = useSharedValue(22);
  const titleOpacity = useSharedValue(0);
  const tagOpacity = useSharedValue(0);
  const tagY = useSharedValue(14);
  const bar = useSharedValue(0);
  const orb = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    void hideSplash();

    orb.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });

    markOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    markScale.value = withSpring(1, { damping: 14, stiffness: 160, mass: 0.85 });
    markRotate.value = withSpring(0, { damping: 16, stiffness: 140 });

    titleOpacity.value = withDelay(180, withTiming(1, { duration: 480 }));
    titleY.value = withDelay(180, withSpring(0, { damping: 18, stiffness: 160 }));

    tagOpacity.value = withDelay(360, withTiming(1, { duration: 420 }));
    tagY.value = withDelay(360, withSpring(0, { damping: 18, stiffness: 150 }));

    bar.value = withDelay(
      420,
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
    );

    // Soft pulse on the mark while loading completes.
    markScale.value = withDelay(
      700,
      withSequence(
        withTiming(1.04, { duration: 420, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }),
      ),
    );

    const finish = () => onFinish();
    exit.value = withDelay(
      1750,
      withTiming(1, { duration: 480, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(finish)();
      }),
    );
  }, [bar, exit, markOpacity, markRotate, markScale, onFinish, orb, tagOpacity, tagY, titleOpacity, titleY]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(exit.value, [0, 1], [1, 1.06], Extrapolation.CLAMP),
      },
    ],
  }));

  const orbStyle = useAnimatedStyle(() => ({
    opacity: interpolate(orb.value, [0, 1], [0.35, 0.7], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(orb.value, [0, 1], [0.85, 1.12], Extrapolation.CLAMP) },
      { translateX: interpolate(orb.value, [0, 1], [12, 0], Extrapolation.CLAMP) },
    ],
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }, { rotate: `${markRotate.value}deg` }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
    transform: [{ translateY: tagY.value }],
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    width: interpolate(bar.value, [0, 1], [10, 120], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      <LinearGradient
        colors={['#f8e4c4', '#fdfbf7', '#fdf0d5']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.orb, orbStyle]} />
      <View style={styles.orbSoft} />

      <View style={styles.center}>
        <Animated.View style={[styles.markWrap, markStyle]}>
          <Image source={BRAND_MARK} style={styles.mark} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={titleStyle}>
          <Text style={styles.brand}>Marché Doré</Text>
        </Animated.View>

        <Animated.View style={tagStyle}>
          <Text style={styles.tagline}>Produits frais · Livrés chez vous</Text>
        </Animated.View>

        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, barFillStyle]} />
        </View>
      </View>

      <Text style={styles.footer}>Cotonou · Bénin</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
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
  mark: {
    width: '100%',
    height: '100%',
  },
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
    borderRadius: 2,
    backgroundColor: 'rgba(28,22,19,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#e2931d',
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    color: '#9e938d',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    ...bodyFont('600'),
  },
});
