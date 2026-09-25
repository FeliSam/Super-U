import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LiveActivitySnapshot } from '@/lib/liveActivity';
import { hitBoxNone, hitNone } from '@/lib/hit';
import { softShadow } from '@/lib/shadow';

const SPRING = { damping: 16, stiffness: 240, mass: 0.55 };
const SHEEN = { duration: 2600, easing: Easing.inOut(Easing.quad) };

export function LiveIsland({
  snapshot,
  snapshots,
  accent = '#c84b31',
  followLabel = 'Suivre',
}: {
  snapshot?: LiveActivitySnapshot;
  snapshots?: LiveActivitySnapshot[];
  accent?: string;
  followLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const frameW = Math.min(winW, 430);
  const items = useMemo(
    () => (snapshots?.length ? snapshots : snapshot ? [snapshot] : []),
    [snapshot, snapshots],
  );
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const pulse = useSharedValue(0);
  const expand = useSharedValue(0);
  const appear = useSharedValue(0);
  const swipeX = useSharedValue(0);
  const sheen = useSharedValue(0);
  const truck = useSharedValue(0);

  const current = items[Math.min(index, Math.max(items.length - 1, 0))];
  const many = items.length > 1;
  const compactW = Math.min(many ? 176 : 158, Math.max(128, frameW - 24));
  const expandedW = Math.min(328, Math.max(compactW, frameW - 24));
  /** Changement métier (pas le tick horloge) → réaffiche l’île 5 s. */
  const actionKey = current ? `${current.id}|${current.subtitle}|${current.eta}|${current.tone}` : '';

  useEffect(() => {
    setIndex((i) => (items.length ? Math.min(i, items.length - 1) : 0));
  }, [items.length]);

  useEffect(() => {
    if (!actionKey) {
      setVisible(false);
      setOpen(false);
      return;
    }
    setVisible(true);
    setOpen(true);
    appear.value = 0;
    appear.value = withSpring(1, SPRING);
    const collapse = setTimeout(() => setOpen(false), 2200);
    const hide = setTimeout(() => {
      appear.value = withTiming(0, { duration: 280 }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      });
    }, 5000);
    return () => {
      clearTimeout(collapse);
      clearTimeout(hide);
    };
  }, [actionKey, appear]);

  useEffect(() => {
    if (!visible || !current) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    sheen.value = 0;
    sheen.value = withRepeat(withTiming(1, SHEEN), -1, false);
    truck.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
        withDelay(400, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
  }, [visible, current?.id, pulse, sheen, truck]);

  useEffect(() => {
    expand.value = withSpring(open ? 1 : 0, SPRING);
  }, [expand, open]);

  const goTo = useCallback(
    (next: number) => {
      if (!items.length) return;
      const wrapped = ((next % items.length) + items.length) % items.length;
      setIndex(wrapped);
      swipeX.value = 0;
    },
    [items.length, swipeX],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(many)
        .activeOffsetX([-18, 18])
        .failOffsetY([-20, 20])
        .onUpdate((e) => {
          swipeX.value = e.translationX * 0.35;
        })
        .onEnd((e) => {
          const pass = Math.abs(e.velocityX) > 420 || Math.abs(e.translationX) > 36;
          if (pass && e.translationX < 0) runOnJS(goTo)(index + 1);
          else if (pass && e.translationX > 0) runOnJS(goTo)(index - 1);
          swipeX.value = withSpring(0, SPRING);
        }),
    [goTo, index, many, swipeX],
  );

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(appear.value, [0, 1], [-28, 0]) },
      { scale: interpolate(appear.value, [0, 1], [0.82, 1]) },
    ],
    opacity: appear.value,
  }));

  const pillStyle = useAnimatedStyle(() => ({
    width: interpolate(expand.value, [0, 1], [compactW, expandedW]),
    height: interpolate(expand.value, [0, 1], [38, 108]),
    borderRadius: interpolate(expand.value, [0, 1], [19, 24]),
    transform: [
      { translateX: swipeX.value },
      { scale: interpolate(expand.value, [0, 1], [interpolate(pulse.value, [0, 1], [1, 1.015]), 1]) },
    ],
  }));

  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0, 0.32, 1], [1, 0, 0]),
  }));

  const detailStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0, 0.42, 1], [0, 0, 1]),
    transform: [{ translateY: interpolate(expand.value, [0.42, 1], [8, 0]) }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.round((current?.progress ?? 0) * 100)}%`,
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.15]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.55, 0]),
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.12]) }],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sheen.value, [0, 1], [-70, compactW + 50]) }],
    opacity: interpolate(expand.value, [0, 1], [0.55, 0.22]),
  }));

  const truckStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(truck.value, [0, 1], [-1, 3]) }],
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0.65, 1], [0, 1]),
    transform: [{ translateY: interpolate(expand.value, [0.65, 1], [10, 0]) }, { scale: interpolate(expand.value, [0.65, 1], [0.92, 1]) }],
  }));

  if (!current || !visible) return null;

  const alert = current.tone === 'alert';
  const accentUse = alert ? '#e85a48' : accent;
  const hint = many
    ? `${index + 1}/${items.length} · glissez pour changer`
    : `${current.eta} · touchez pour agrandir`;

  return (
    <Animated.View
      style={[styles.anchor, { top: Math.max(6, insets.top + 2) }, wrapStyle, hitBoxNone]}>
      <GestureDetector gesture={pan}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          onLongPress={() => router.push(current.href as Href)}
          accessibilityRole="button"
          accessibilityLabel={`${current.title}, ${current.subtitle}${many ? `, commande ${index + 1} sur ${items.length}` : ''}`}>
          <Animated.View style={[styles.pill, pillStyle]}>
            <LinearGradient
              colors={alert ? ['#5a221c', '#2a0f0c'] : ['#2a2623', '#0d0c0b']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.rim, hitNone]} />
            <View style={[styles.glass, hitNone]} />
            <Animated.View style={[styles.sheen, sheenStyle, hitNone]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.22)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.sheenFill}
              />
            </Animated.View>
            <Animated.View style={[styles.row, compactStyle, hitNone]}>
              <View style={styles.liveCluster}>
                <Animated.View style={[styles.halo, { backgroundColor: accentUse }, haloStyle]} />
                <Animated.View style={[styles.dot, { backgroundColor: accentUse }, dotStyle]} />
              </View>
              <Animated.View style={[styles.iconWell, { borderColor: `${accentUse}66` }, truckStyle]}>
                <Feather name="truck" size={13} color="#fff" />
              </Animated.View>
              <Text style={styles.compactEta} numberOfLines={1}>
                {current.eta}
              </Text>
              {many ? (
                <Text style={styles.countTxt}>
                  {index + 1}/{items.length}
                </Text>
              ) : null}
            </Animated.View>
            <Animated.View style={[styles.detail, detailStyle, hitNone]}>
              <View style={styles.detailTop}>
                <View style={[styles.liveTag, { backgroundColor: `${accentUse}28`, borderColor: `${accentUse}66` }]}>
                  <View style={styles.liveClusterSm}>
                    <Animated.View style={[styles.haloSm, { backgroundColor: accentUse }, haloStyle]} />
                    <View style={[styles.dotSm, { backgroundColor: accentUse }]} />
                  </View>
                  <Text style={styles.liveTxt}>LIVE</Text>
                </View>
                <Text style={styles.idTxt}>{current.title}</Text>
              </View>
              <Text style={styles.subTxt} numberOfLines={2}>
                {current.subtitle}
              </Text>
              <View style={styles.track}>
                <Animated.View style={[styles.fill, { backgroundColor: accentUse }, barStyle]} />
              </View>
              <Text style={styles.hintTxt}>{hint}</Text>
            </Animated.View>
          </Animated.View>
        </Pressable>
      </GestureDetector>
      {many ? (
        <View style={[styles.pager, hitNone]}>
          {items.map((item, i) => (
            <View
              key={item.id}
              style={[styles.pageDot, i === index ? styles.pageDotOn : null, i === index ? { backgroundColor: accentUse } : null]}
            />
          ))}
        </View>
      ) : null}
      {open ? (
        <Animated.View style={ctaStyle}>
          <Pressable
            style={styles.cta}
            onPress={() => router.push(current.href as Href)}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir le suivi">
            <LinearGradient
              colors={alert ? ['#c84b31', '#8f2e1e'] : [accentUse, '#8f3a22']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.ctaTxt}>{followLabel}</Text>
            <Feather name="chevron-right" size={14} color="#fff" />
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 80,
    alignItems: 'center',
  },
  pill: {
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    ...softShadow({ color: '#000000', y: 10, blur: 18, opacity: 0.42, elevation: 18 }),
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
  },
  glass: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 0,
    height: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 54,
  },
  sheenFill: {
    flex: 1,
  },
  row: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  liveCluster: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveClusterSm: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  haloSm: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  iconWell: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  compactEta: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  countTxt: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '800',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotSm: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detailTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  liveTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  idTxt: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  subTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: {
    height: 5,
    borderRadius: 3,
  },
  hintTxt: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 10,
    fontWeight: '600',
  },
  pager: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
  },
  pageDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(12,12,14,0.28)',
  },
  pageDotOn: {
    width: 12,
  },
  cta: {
    marginTop: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  ctaTxt: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});
