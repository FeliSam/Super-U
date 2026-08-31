import { useCall } from '@/context/CallContext';
import { useColors } from '@/context/ThemeContext';
import { displayFont, type AppColors } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
] as const;

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type IconName = ComponentProps<typeof Feather>['name'];

function ControlBtn({
  icon,
  label,
  onPress,
  active,
  disabled,
  styles,
  colors,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  return (
    <Pressable
      style={[styles.ctrl, disabled && styles.ctrlDisabled]}
      onPress={onPress}
      disabled={disabled}>
      <View style={[styles.ctrlRound, active && styles.ctrlRoundOn]}>
        <Feather name={icon} size={20} color={active ? colors.onAccent : colors.text} />
      </View>
      <Text style={[styles.ctrlLabel, active && styles.ctrlLabelOn]}>{label}</Text>
    </Pressable>
  );
}

export function CallOverlay() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    call,
    phase,
    elapsedSec,
    controls,
    accept,
    decline,
    hangup,
    toggleMute,
    toggleSpeaker,
    toggleHold,
    toggleKeypad,
    expand,
    minimize,
  } = useCall();
  const pulse = useSharedValue(1);
  const [digits, setDigits] = useState('');

  useEffect(() => {
    if (phase === 'outgoing' || phase === 'incoming') {
      pulse.value = withRepeat(withTiming(1.18, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [phase, pulse]);

  useEffect(() => {
    if (!controls.keypadOpen) setDigits('');
  }, [controls.keypadOpen]);

  useEffect(() => {
    if (phase === 'idle') setDigits('');
  }, [phase]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  if (phase === 'idle' || !call) return null;

  const flags = [
    controls.muted ? 'Micro coupé' : null,
    controls.speakerOn ? 'Haut-parleur' : null,
    controls.onHold ? 'En attente' : null,
  ].filter(Boolean);

  const statusLabel =
    phase === 'outgoing'
      ? 'Appel…'
      : phase === 'incoming'
        ? 'Appel entrant'
        : controls.onHold
          ? 'En attente'
          : formatElapsed(elapsedSec);

  if (phase === 'active' && controls.minimized) {
    return (
      <View style={styles.miniWrap} pointerEvents="box-none">
        <Pressable
          style={styles.miniBar}
          onPress={expand}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir le menu d’appel">
          <View style={styles.miniAvatar}>
            <Feather name={controls.muted ? 'mic-off' : 'phone'} size={16} color={colors.onAccent} />
          </View>
          <View style={styles.miniText}>
            <Text style={styles.miniName} numberOfLines={1}>
              {call.peerName}
            </Text>
            <Text style={styles.miniStatus} numberOfLines={1}>
              {statusLabel}
              {flags.length ? ` · ${flags.join(' · ')}` : ''}
            </Text>
          </View>
          <Pressable
            style={styles.miniHang}
            onPress={(e) => {
              e.stopPropagation();
              hangup();
            }}
            hitSlop={8}
            accessibilityLabel="Raccrocher">
            <Feather name="phone-off" size={16} color={colors.onAccent} />
          </Pressable>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.avatarWrap}>
          {phase === 'outgoing' || phase === 'incoming' ? (
            <Animated.View style={[styles.pulse, ringStyle]} />
          ) : null}
          <View style={styles.avatar}>
            <Feather name="phone" size={32} color={colors.onAccent} />
          </View>
        </View>
        <Text style={styles.name}>{call.peerName}</Text>
        <Text style={styles.status}>{statusLabel}</Text>
        <Text style={styles.hint}>
          {flags.length
            ? flags.join(' · ')
            : phase === 'outgoing'
              ? 'Le micro s’ouvre quand le coursier décroche'
              : 'Appel audio dans l’app'}
        </Text>
        {phase === 'active' ? (
          <Pressable style={styles.minimizeBtn} onPress={minimize} accessibilityLabel="Réduire l’appel">
            <Feather name="chevron-down" size={22} color={colors.muted} />
            <Text style={styles.minimizeLbl}>Réduire</Text>
          </Pressable>
        ) : null}

        {phase === 'incoming' ? (
          <View style={styles.actions}>
            <Pressable style={styles.action} onPress={decline}>
              <View style={[styles.round, styles.decline]}>
                <Feather name="phone-off" size={22} color={colors.onAccent} />
              </View>
              <Text style={styles.roundLabel}>Refuser</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={toggleMute}>
              <View style={[styles.round, styles.soft, controls.muted && styles.softOn]}>
                <Feather name={controls.muted ? 'mic-off' : 'mic'} size={22} color={controls.muted ? colors.onAccent : colors.text} />
              </View>
              <Text style={styles.roundLabel}>{controls.muted ? 'Silence' : 'Muet'}</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={accept}>
              <View style={[styles.round, styles.accept]}>
                <Feather name="phone" size={22} color={colors.onAccent} />
              </View>
              <Text style={styles.roundLabel}>Décrocher</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {controls.keypadOpen ? (
              <View style={styles.keypad}>
                <Text style={styles.digits} numberOfLines={1}>
                  {digits || ' '}
                </Text>
                {KEYPAD.map((row) => (
                  <View key={row.join('')} style={styles.keyRow}>
                    {row.map((key) => (
                      <Pressable
                        key={key}
                        style={styles.key}
                        onPress={() => setDigits((d) => (d + key).slice(-16))}>
                        <Text style={styles.keyText}>{key}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.grid}>
                <ControlBtn
                  icon={controls.muted ? 'mic-off' : 'mic'}
                  label={controls.muted ? 'Muet' : 'Micro'}
                  active={controls.muted}
                  onPress={toggleMute}
                  styles={styles}
                  colors={colors}
                />
                <ControlBtn
                  icon={controls.speakerOn ? 'volume-2' : 'volume-1'}
                  label="Haut-parleur"
                  active={controls.speakerOn}
                  onPress={toggleSpeaker}
                  styles={styles}
                  colors={colors}
                />
                <ControlBtn
                  icon="grid"
                  label="Clavier"
                  active={controls.keypadOpen}
                  onPress={toggleKeypad}
                  styles={styles}
                  colors={colors}
                />
                <ControlBtn
                  icon="pause"
                  label="Attente"
                  active={controls.onHold}
                  disabled={phase !== 'active'}
                  onPress={toggleHold}
                  styles={styles}
                  colors={colors}
                />
              </View>
            )}

            <View style={styles.bottomRow}>
              {controls.keypadOpen ? (
                <Pressable style={styles.action} onPress={toggleKeypad}>
                  <View style={[styles.round, styles.soft]}>
                    <Feather name="x" size={22} color={colors.text} />
                  </View>
                  <Text style={styles.roundLabel}>Fermer</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.action} onPress={hangup}>
                <View style={[styles.round, styles.decline]}>
                  <Feather name="phone-off" size={22} color={colors.onAccent} />
                </View>
                <Text style={styles.roundLabel}>{phase === 'active' ? 'Raccrocher' : 'Annuler'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      elevation: 9999,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.white,
      borderRadius: 28,
      paddingTop: 16,
      paddingBottom: 28,
      paddingHorizontal: 20,
      alignItems: 'center',
      gap: 8,
    },
    avatarWrap: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    pulse: {
      position: 'absolute',
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: colors.green,
      opacity: 0.25,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { color: colors.text, fontSize: 22, ...displayFont('700'), textAlign: 'center' },
    status: { color: colors.muted, fontSize: 15, fontWeight: '600' },
    hint: { color: colors.placeholder, fontSize: 12, marginTop: 2, textAlign: 'center' },
    actions: { flexDirection: 'row', gap: 20, marginTop: 24 },
    action: { alignItems: 'center', gap: 10, minWidth: 72 },
    round: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    decline: { backgroundColor: colors.terracotta },
    accept: { backgroundColor: colors.green },
    soft: { backgroundColor: colors.cream },
    softOn: { backgroundColor: colors.text },
    roundLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    grid: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 18,
      rowGap: 16,
    },
    ctrl: { width: '33%', alignItems: 'center', gap: 8 },
    ctrlDisabled: { opacity: 0.38 },
    ctrlRound: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctrlRoundOn: { backgroundColor: colors.text },
    ctrlLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
    ctrlLabelOn: { color: colors.text },
    keypad: { width: '100%', marginTop: 12, gap: 10, alignItems: 'center' },
    digits: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 3,
      minHeight: 28,
      marginBottom: 4,
    },
    keyRow: { flexDirection: 'row', gap: 12, width: '100%', justifyContent: 'center' },
    key: {
      width: 72,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyText: { color: colors.text, fontSize: 22, fontWeight: '700' },
    bottomRow: { flexDirection: 'row', gap: 28, marginTop: 22 },
    miniWrap: {
      position: 'absolute',
      top: 12,
      left: 12,
      right: 12,
      zIndex: 9999,
      elevation: 9999,
    },
    miniBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.white,
      borderRadius: 18,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    miniAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniText: { flex: 1, gap: 2 },
    miniName: { color: colors.text, fontSize: 14, fontWeight: '700' },
    miniStatus: { color: colors.muted, fontSize: 11 },
    miniHang: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.terracotta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    minimizeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, padding: 6 },
    minimizeLbl: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  });
}
