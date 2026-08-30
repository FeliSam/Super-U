import { bodyFont, colors, displayFont, radius } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  online: boolean;
  pickCount: number;
  deliveryCount: number;
  heldCount: number;
  tourStarted: boolean;
  onResume: () => void;
};

export function NowPresence({
  online,
  pickCount,
  deliveryCount,
  heldCount,
  tourStarted,
  onResume,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: online ? 1100 : 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: online ? 1100 : 1600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [online, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const inProgress = pickCount + deliveryCount;
  const liveLabel = tourStarted
    ? 'Tournée en cours'
    : inProgress
      ? `${inProgress} course${inProgress > 1 ? 's' : ''} en main`
      : 'Disponible — radar ouvert';

  if (!online) {
    return (
      <View style={styles.pauseCard}>
        <View style={styles.pauseGlow} />
        <View style={styles.pauseTop}>
          <View style={styles.iconWrap}>
            <Animated.View
              style={[
                styles.ring,
                styles.ringPause,
                { transform: [{ scale: ringScale }], opacity: ringOpacity },
              ]}
            />
            <View style={[styles.iconCore, styles.iconPause]}>
              <Feather name="moon" size={22} color="#fbbf24" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kickerPause}>Maintenant</Text>
            <Text style={styles.pauseTitle}>En pause</Text>
            <Text style={styles.pauseSub}>La file est masquée. Reprenez quand vous êtes prêt.</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Passer en ligne"
          onPress={onResume}
          style={({ pressed }) => [styles.resumeBtn, pressed && { opacity: 0.9 }]}>
          <View style={styles.resumeDot} />
          <Text style={styles.resumeTxt}>REPRENDRE · EN LIGNE</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.liveWrap}>
      <View style={styles.liveHead}>
        <View style={styles.iconWrapSm}>
          <Animated.View
            style={[styles.ring, styles.ringLive, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
          />
          <View style={[styles.iconCore, styles.iconLive, { width: 36, height: 36, borderRadius: 18 }]}>
            <Feather name="radio" size={16} color={colors.white} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Maintenant</Text>
          <Text style={styles.liveTitle}>{liveLabel}</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeTxt}>En ligne</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat n={pickCount} label="Prépas" icon="package" accent={pickCount > 0} />
        <Stat n={deliveryCount} label="Livraisons" icon="navigation" accent={deliveryCount > 0} />
        <Stat n={heldCount} label="Prêtes" icon="check-circle" accent={heldCount > 0 && !tourStarted} />
      </View>

      {!inProgress ? (
        <View style={styles.ready}>
          <Feather name="zap" size={16} color={colors.teal} />
          <Text style={styles.readyTxt}>Aucune course sur cet écran. Ouvrez Courses pour en prendre.</Text>
        </View>
      ) : tourStarted ? (
        <View style={[styles.ready, styles.readyTour]}>
          <Feather name="play-circle" size={16} color="#b45309" />
          <Text style={[styles.readyTxt, { color: '#92400e' }]}>Tournée lancée — plus d’ajout possible.</Text>
        </View>
      ) : heldCount ? (
        <View style={styles.ready}>
          <Feather name="flag" size={16} color={colors.teal} />
          <Text style={styles.readyTxt}>Sélection prête. Démarrez dès que vous partez.</Text>
        </View>
      ) : null}
    </View>
  );
}

function Stat({
  n,
  label,
  icon,
  accent,
}: {
  n: number;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  accent: boolean;
}) {
  return (
    <View style={[styles.stat, accent && styles.statOn]}>
      <Feather name={icon} size={14} color={accent ? colors.teal : colors.muted} />
      <Text style={[styles.statN, accent && { color: colors.teal }]}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pauseCard: {
    backgroundColor: '#141820',
    borderRadius: radius.card,
    padding: 18,
    overflow: 'hidden',
    gap: 16,
  },
  pauseGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  pauseTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  kickerPause: {
    ...displayFont('800'),
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(251,191,36,0.85)',
  },
  pauseTitle: { ...displayFont('900'), fontSize: 22, color: '#f8fafc', marginTop: 2 },
  pauseSub: { ...bodyFont('500'), fontSize: 13, color: 'rgba(226,232,240,0.72)', marginTop: 4, lineHeight: 18 },
  resumeBtn: {
    height: 50,
    borderRadius: 999,
    backgroundColor: '#fbbf24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resumeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#111827' },
  resumeTxt: { ...displayFont('800'), fontSize: 13, letterSpacing: 0.4, color: '#111827' },

  liveWrap: {
    gap: 12,
    backgroundColor: '#f0faf8',
    borderRadius: radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(5,141,129,0.14)',
  },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: {
    ...displayFont('800'),
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  liveTitle: { ...displayFont('800'), fontSize: 16, color: colors.text, marginTop: 1 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.teal },
  liveBadgeTxt: { ...displayFont('800'), fontSize: 11, color: colors.teal },

  iconWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  iconWrapSm: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 36, height: 36, borderRadius: 18, borderWidth: 2 },
  ringLive: { borderColor: colors.teal },
  ringPause: { width: 48, height: 48, borderRadius: 24, borderColor: '#fbbf24' },
  iconCore: { alignItems: 'center', justifyContent: 'center' },
  iconLive: { backgroundColor: colors.teal },
  iconPause: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(251,191,36,0.14)',
  },

  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(5,141,129,0.08)',
  },
  statOn: { backgroundColor: colors.tealSoft, borderColor: 'rgba(5,141,129,0.18)' },
  statN: { ...displayFont('900'), fontSize: 20, color: colors.text },
  statL: { ...bodyFont('600'), fontSize: 11, color: colors.muted },

  ready: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  readyTour: { backgroundColor: colors.amberSoft },
  readyTxt: { ...bodyFont('600'), fontSize: 13, color: colors.teal, flex: 1, lineHeight: 18 },
});
