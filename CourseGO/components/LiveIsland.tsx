import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LiveActivitySnapshot } from '@/lib/liveActivity';

/** Dynamic Island — RN Animated only (no Reanimated/worklets on boot path). */
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
  const pulse = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;
  const hideAnim = useRef<Animated.CompositeAnimation | null>(null);

  const current = items[Math.min(index, Math.max(items.length - 1, 0))];
  const many = items.length > 1;
  const compactW = Math.min(many ? 176 : 158, Math.max(128, frameW - 24));
  const expandedW = Math.min(328, Math.max(compactW, frameW - 24));
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
    appear.setValue(0);
    Animated.spring(appear, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    const collapse = setTimeout(() => setOpen(false), 2200);
    const hide = setTimeout(() => {
      hideAnim.current = Animated.timing(appear, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      hideAnim.current.start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }, 5000);
    return () => {
      loop.stop();
      clearTimeout(collapse);
      clearTimeout(hide);
      hideAnim.current?.stop();
    };
  }, [actionKey, appear, pulse]);

  if (!current || !visible) return null;

  const alert = current.tone === 'alert';
  const accentUse = alert ? '#e85a48' : accent;
  const hint = many
    ? `${index + 1}/${items.length} · flèches pour changer`
    : `${current.eta} · touchez pour agrandir`;
  const pillW = open ? expandedW : compactW;
  const pillH = open ? 108 : 38;
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.15] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.anchor,
        { top: Math.max(6, insets.top + 2) },
        {
          opacity: appear,
          transform: [
            {
              translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }),
            },
            {
              scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
            },
          ],
        },
      ]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        onLongPress={() => router.push(current.href as Href)}
        accessibilityRole="button"
        accessibilityLabel={`${current.title}, ${current.subtitle}${many ? `, commande ${index + 1} sur ${items.length}` : ''}`}>
        <View style={[styles.pill, { width: pillW, height: pillH, borderRadius: open ? 24 : 19 }]}>
          <LinearGradient
            colors={alert ? ['#5a221c', '#2a0f0c'] : ['#2a2623', '#0d0c0b']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.rim, { borderRadius: open ? 24 : 19 }]} pointerEvents="none" />
          <View style={styles.glass} pointerEvents="none" />
          {!open ? (
            <View style={styles.row} pointerEvents="none">
              <View style={styles.liveCluster}>
                <Animated.View
                  style={[styles.halo, { backgroundColor: accentUse, transform: [{ scale: ringScale }], opacity: ringOpacity }]}
                />
                <View style={[styles.dot, { backgroundColor: accentUse }]} />
              </View>
              <View style={[styles.iconWell, { borderColor: `${accentUse}66` }]}>
                <Feather name="truck" size={13} color="#fff" />
              </View>
              <Text style={styles.compactEta} numberOfLines={1}>
                {current.eta}
              </Text>
              {many ? (
                <Text style={styles.countTxt}>
                  {index + 1}/{items.length}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.detail} pointerEvents="none">
              <View style={styles.detailTop}>
                <View style={[styles.liveTag, { backgroundColor: `${accentUse}28`, borderColor: `${accentUse}66` }]}>
                  <View style={[styles.dotSm, { backgroundColor: accentUse }]} />
                  <Text style={styles.liveTxt}>LIVE</Text>
                </View>
                <Text style={styles.idTxt}>{current.title}</Text>
              </View>
              <Text style={styles.subTxt} numberOfLines={2}>
                {current.subtitle}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { backgroundColor: accentUse, width: `${Math.round((current.progress ?? 0) * 100)}%` }]} />
              </View>
              <Text style={styles.hintTxt}>{hint}</Text>
            </View>
          )}
        </View>
      </Pressable>
      {many ? (
        <View style={styles.pagerRow}>
          <Pressable
            hitSlop={10}
            onPress={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            style={styles.pagerBtn}
            accessibilityLabel="Course précédente">
            <Feather name="chevron-left" size={14} color="#111" />
          </Pressable>
          <View style={styles.pager} pointerEvents="none">
            {items.map((item, i) => (
              <View
                key={item.id}
                style={[styles.pageDot, i === index ? styles.pageDotOn : null, i === index ? { backgroundColor: accentUse } : null]}
              />
            ))}
          </View>
          <Pressable
            hitSlop={10}
            onPress={() => setIndex((i) => (i + 1) % items.length)}
            style={styles.pagerBtn}
            accessibilityLabel="Course suivante">
            <Feather name="chevron-right" size={14} color="#111" />
          </Pressable>
        </View>
      ) : null}
      {open ? (
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
    shadowColor: '#000',
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
  rim: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
  row: {
    ...StyleSheet.absoluteFill,
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
  halo: {
    position: 'absolute',
    width: 8,
    height: 8,
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
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  pagerBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pager: {
    flexDirection: 'row',
    gap: 5,
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
