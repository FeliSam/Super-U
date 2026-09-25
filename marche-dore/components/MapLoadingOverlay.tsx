import { displayFont } from '@/constants/theme';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  /** Force-hide even if `visible` stays true (iOS MapView onMapReady can stall). */
  maxVisibleMs?: number;
};

/**
 * Soft loading veil over the map — never a permanent solid white mask.
 * Auto-dismisses after maxVisibleMs so a stuck onMapReady cannot block forever.
 */
export function MapLoadingOverlay({
  visible,
  title = 'Chargement de la carte',
  subtitle = 'Préparation de votre zone…',
  maxVisibleMs = 2200,
}: Props) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0.35)).current;
  const [mounted, setMounted] = useState(visible);
  const [forceHidden, setForceHidden] = useState(false);

  useEffect(() => {
    if (!visible) {
      setForceHidden(false);
      return;
    }
    setForceHidden(false);
    if (!maxVisibleMs || maxVisibleMs <= 0) return;
    const t = setTimeout(() => setForceHidden(true), maxVisibleMs);
    return () => clearTimeout(t);
  }, [visible, maxVisibleMs]);

  const show = visible && !forceHidden;

  useEffect(() => {
    if (show) {
      setMounted(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [show, opacity, pulse]);

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.root, { opacity }]} pointerEvents="none">
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#e2931d" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { opacity: pulse }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    // Soft veil — map tiles remain visible underneath (CourseGO has no solid white mask).
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  card: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    maxWidth: 280,
  },
  title: {
    ...displayFont('800'),
    marginTop: 8,
    fontSize: 18,
    color: '#1c1613',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8a7f78',
    textAlign: 'center',
    lineHeight: 18,
  },
  barTrack: {
    marginTop: 10,
    width: 120,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(28,22,19,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#e2931d',
  },
});
