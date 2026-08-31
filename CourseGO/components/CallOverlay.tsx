import { useCall } from '@/context/CallContext';
import { bodyFont, colors, displayFont, shadow } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
] as const;

type IconName = ComponentProps<typeof Feather>['name'];

function Ctrl({
  icon,
  label,
  on,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  on?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.ctrl, disabled && styles.ctrlOff]}>
      <View style={[styles.circ, on && styles.circOn]}>
        <Feather name={icon} size={22} color={on ? colors.onAccent : '#e5e7eb'} />
      </View>
      <Text style={[styles.ctrlLabel, on && styles.ctrlLabelOn]}>{label}</Text>
    </Pressable>
  );
}

export function CallOverlay() {
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
  const initials = useMemo(() => {
    const parts = (call?.peerName ?? 'Client').split(' ').filter(Boolean);
    return ((parts[0]?.[0] ?? 'C') + (parts[1]?.[0] ?? '')).toUpperCase();
  }, [call?.peerName]);

  useEffect(() => {
    if (phase === 'outgoing' || phase === 'incoming') {
      pulse.value = withRepeat(withTiming(1.22, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 220 });
    }
  }, [phase, pulse]);

  useEffect(() => {
    if (!controls.keypadOpen || phase === 'idle') setDigits('');
  }, [controls.keypadOpen, phase]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1.85 - pulse.value,
  }));

  if (phase === 'idle' || !call) return null;

  const statusLabel =
    phase === 'outgoing'
      ? 'Sonnerie…'
      : phase === 'incoming'
        ? 'Appel audio'
        : controls.onHold
          ? 'En attente'
          : formatElapsed(elapsedSec);

  const hint =
    phase === 'outgoing'
      ? 'Le micro s’ouvre seulement quand le client décroche'
      : phase === 'incoming'
        ? 'Décrochez pour parler — audio uniquement'
        : controls.muted
          ? 'Micro coupé'
          : 'Appel vocal · numéro masqué';

  if (phase === 'active' && controls.minimized) {
    return (
      <View style={styles.mini} pointerEvents="box-none">
        <Pressable style={styles.miniBar} onPress={expand} accessibilityRole="button" accessibilityLabel="Ouvrir l’appel">
          <View style={styles.miniAvatar}>
            <Feather name={controls.muted ? 'mic-off' : 'phone'} size={16} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniName} numberOfLines={1}>
              {call.peerName}
            </Text>
            <Text style={styles.miniSub} numberOfLines={1}>
              {statusLabel}
              {controls.muted ? ' · muet' : ''}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            style={[styles.miniIcon, controls.muted ? styles.miniMicOff : styles.miniMicOn]}
            accessibilityLabel={controls.muted ? 'Activer le micro' : 'Couper le micro'}
            accessibilityRole="button">
            <Feather name={controls.muted ? 'mic-off' : 'mic'} size={16} color="#fff" />
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              void hangup();
            }}
            style={styles.miniHang}
            accessibilityLabel="Raccrocher">
            <Feather name="phone-off" size={16} color="#fff" />
          </Pressable>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.glow} />
      <View style={styles.center}>
        <View style={styles.avatarWrap}>
          {phase === 'outgoing' || phase === 'incoming' ? <Animated.View style={[styles.pulse, ringStyle]} /> : null}
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
        </View>
        <Text style={styles.kicker}>APPEL AUDIO</Text>
        <Text style={styles.name}>{call.peerName}</Text>
        <Text style={styles.status}>{statusLabel}</Text>
        <Text style={styles.hint}>{hint}</Text>
        {phase === 'active' ? (
          <Pressable onPress={minimize} style={styles.minimizeBtn} accessibilityLabel="Réduire l’appel">
            <Feather name="chevron-down" size={18} color="rgba(250,250,249,0.55)" />
            <Text style={styles.minimizeLbl}>Réduire</Text>
          </Pressable>
        ) : null}
      </View>

      {phase === 'incoming' ? (
        <View style={styles.incoming}>
          <Pressable style={styles.action} onPress={decline}>
            <View style={[styles.hangBtn, { backgroundColor: colors.danger }]}>
              <Feather name="phone-off" size={28} color="#fff" />
            </View>
            <Text style={styles.actionLbl}>Refuser</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={accept}>
            <View style={[styles.hangBtn, { backgroundColor: colors.teal }]}>
              <Feather name="phone" size={28} color="#fff" />
            </View>
            <Text style={styles.actionLbl}>Décrocher</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {controls.keypadOpen ? (
            <View style={styles.keypad}>
              <Pressable style={styles.backBtn} onPress={toggleKeypad} accessibilityLabel="Retour aux commandes">
                <Feather name="chevron-left" size={20} color={colors.onAccent} />
                <Text style={styles.backLbl}>Retour · micro, attente…</Text>
              </Pressable>
              {KEYPAD.map((row) => (
                <View key={row.join()} style={styles.keyRow}>
                  {row.map((k) => (
                    <Pressable key={k} style={styles.key} onPress={() => setDigits((d) => (d + k).slice(-16))}>
                      <Text style={styles.keyText}>{k}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              <Text style={styles.digits}>{digits || ' '}</Text>
            </View>
          ) : (
            <View style={styles.row}>
              <Ctrl icon={controls.muted ? 'mic-off' : 'mic'} label={controls.muted ? 'Muet' : 'Micro'} on={controls.muted} onPress={toggleMute} />
              <Ctrl icon={controls.speakerOn ? 'volume-2' : 'volume-1'} label="Haut-parleur" on={controls.speakerOn} onPress={toggleSpeaker} />
              <Ctrl icon="pause" label="Attente" on={controls.onHold} onPress={toggleHold} disabled={phase !== 'active'} />
              <Ctrl icon="grid" label="Clavier" on={controls.keypadOpen} onPress={toggleKeypad} />
            </View>
          )}
          <View style={styles.bottomRow}>
            {controls.keypadOpen ? (
              <Pressable style={styles.action} onPress={toggleKeypad}>
                <View style={[styles.hangBtn, styles.softBtn]}>
                  <Feather name="arrow-left" size={26} color={colors.onAccent} />
                </View>
                <Text style={styles.actionLbl}>Menus</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.action} onPress={hangup}>
              <View style={styles.hangBtn}>
                <Feather name="phone-off" size={28} color="#fff" />
              </View>
              <Text style={styles.actionLbl}>{phase === 'active' ? 'Raccrocher' : 'Annuler'}</Text>
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.protect}>
        <Feather name="shield" size={14} color="rgba(250,250,249,0.45)" />
        <Text style={styles.protectText}>Audio seulement · numéro masqué</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0b1220',
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  glow: {
    position: 'absolute',
    top: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(5,141,129,0.18)',
  },
  center: { alignItems: 'center', gap: 6 },
  avatarWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pulse: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.teal,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(250,250,249,0.18)',
  },
  initials: { ...displayFont('800'), fontSize: 32, color: colors.onAccent },
  kicker: { ...displayFont('800'), fontSize: 11, letterSpacing: 1.6, color: colors.teal, marginTop: 4 },
  name: { ...displayFont('800'), fontSize: 26, color: colors.onAccent, textAlign: 'center' },
  status: { ...bodyFont('700'), fontSize: 15, color: 'rgba(250,250,249,0.72)' },
  hint: { ...bodyFont('500'), fontSize: 13, color: 'rgba(250,250,249,0.42)', textAlign: 'center', maxWidth: 280, marginTop: 4 },
  minimizeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, padding: 6 },
  minimizeLbl: { ...bodyFont('600'), fontSize: 12, color: 'rgba(250,250,249,0.45)' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, maxWidth: 340 },
  ctrl: { alignItems: 'center', gap: 8, width: 72 },
  ctrlOff: { opacity: 0.38 },
  circ: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circOn: { backgroundColor: colors.teal },
  ctrlLabel: { ...bodyFont('600'), fontSize: 11, color: 'rgba(250,250,249,0.45)', textAlign: 'center' },
  ctrlLabelOn: { color: colors.onAccent },
  hangWrap: { alignItems: 'center', gap: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 36 },
  softBtn: { backgroundColor: 'rgba(255,255,255,0.12)' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  backLbl: { ...bodyFont('700'), fontSize: 13, color: colors.onAccent },
  hangBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  incoming: { flexDirection: 'row', gap: 48, alignItems: 'center' },
  action: { alignItems: 'center', gap: 10 },
  actionLbl: { ...bodyFont('700'), fontSize: 13, color: 'rgba(250,250,249,0.7)' },
  protect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(250,250,249,0.06)',
  },
  protectText: { ...bodyFont('500'), fontSize: 12, color: 'rgba(250,250,249,0.45)' },
  mini: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 9999, elevation: 9999 },
  miniBar: {
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniName: { ...bodyFont('700'), color: colors.onAccent, fontSize: 14 },
  miniSub: { ...bodyFont('500'), color: 'rgba(250,250,249,0.5)', fontSize: 11 },
  miniHang: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  miniIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  miniMicOn: { backgroundColor: colors.teal },
  miniMicOff: { backgroundColor: 'rgba(239,68,68,0.85)' },
  keypad: { gap: 10, alignItems: 'center' },
  keyRow: { flexDirection: 'row', gap: 14 },
  key: {
    width: 68,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { ...displayFont('700'), color: colors.onAccent, fontSize: 20 },
  digits: { ...bodyFont('600'), color: 'rgba(250,250,249,0.45)', minHeight: 20, letterSpacing: 3 },
});
