import { useCall } from '@/context/CallContext';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    toggleVideo,
    toggleKeypad,
    expand,
    minimize,
  } = useCall();
  const [digits, setDigits] = useState('');
  const initials = useMemo(() => {
    const parts = (call?.peerName ?? 'Client').split(' ').filter(Boolean);
    return ((parts[0]?.[0] ?? 'C') + (parts[1]?.[0] ?? '')).toUpperCase();
  }, [call?.peerName]);

  if (phase === 'idle' || !call) return null;

  if (phase === 'active' && controls.minimized) {
    return (
      <View style={styles.mini} pointerEvents="box-none">
        <Pressable
          style={styles.miniBar}
          onPress={expand}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir le menu d’appel">
          <Text style={styles.miniText}>
            {call.peerName} · {formatElapsed(elapsedSec)}
          </Text>
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

  const statusLabel =
    phase === 'outgoing' ? 'Sonnerie…' : phase === 'incoming' ? 'Appel entrant' : 'Appel en cours...';

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <View style={styles.ring}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
        </View>
        <Text style={styles.name}>{call.peerName}</Text>
        <Text style={styles.status}>{statusLabel}</Text>
        {phase === 'active' ? <Text style={styles.timer}>{formatElapsed(elapsedSec)}</Text> : null}
        {phase === 'active' ? (
          <Pressable onPress={minimize} style={styles.minimizeBtn} accessibilityLabel="Réduire l’appel">
            <Feather name="chevron-down" size={18} color={colors.placeholder} />
            <Text style={styles.minimizeLbl}>Réduire</Text>
          </Pressable>
        ) : null}
      </View>

      {controls.keypadOpen ? (
        <View style={styles.keypad}>
          {KEYPAD.map((row) => (
            <View key={row.join()} style={styles.keyRow}>
              {row.map((k) => (
                <Pressable key={k} style={styles.key} onPress={() => setDigits((d) => d + k)}>
                  <Text style={styles.keyText}>{k}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          <Text style={styles.digits}>{digits}</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Ctrl icon={controls.muted ? 'mic-off' : 'mic'} label="Muet" on={controls.muted} onPress={toggleMute} />
          <Ctrl icon="volume-2" label="Haut-parleur" on={controls.speakerOn} onPress={toggleSpeaker} />
          <Ctrl icon="pause" label="Attente" on={controls.onHold} onPress={toggleHold} />
        </View>
      )}

      <View style={styles.row}>
        <Ctrl icon="grid" label="Clavier" on={controls.keypadOpen} onPress={toggleKeypad} />
        <Ctrl icon="video" label="Caméra" on={controls.videoOn} onPress={toggleVideo} />
      </View>

      {phase === 'incoming' ? (
        <View style={styles.incoming}>
          <Pressable style={[styles.hang, { backgroundColor: colors.danger }]} onPress={decline}>
            <Feather name="phone-off" size={28} color="#fff" />
          </Pressable>
          <Pressable style={[styles.hang, { backgroundColor: colors.teal }]} onPress={accept}>
            <Feather name="phone" size={28} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.hang} onPress={hangup}>
          <Feather name="phone-off" size={28} color="#fff" />
        </Pressable>
      )}

      <View style={styles.protect}>
        <Feather name="shield" size={14} color={colors.placeholder} />
        <Text style={styles.protectText}>Numéro masqué pour votre protection</Text>
      </View>
    </View>
  );
}

function Ctrl({
  icon,
  label,
  on,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.ctrl}>
      <View style={[styles.circ, on && { backgroundColor: colors.teal }]}>
        <Feather name={icon} size={20} color="#fafaf9" />
      </View>
      <Text style={styles.ctrlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.callBg,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  center: { alignItems: 'center', gap: 8 },
  ring: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { ...displayFont('900'), fontSize: 32, color: colors.onAccent },
  name: { ...displayFont('800'), fontSize: 24, color: colors.onAccent },
  status: { ...bodyFont('700'), fontSize: 14, color: colors.teal },
  timer: { ...bodyFont('500'), fontSize: 16, color: colors.placeholder },
  minimizeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, padding: 6 },
  minimizeLbl: { ...bodyFont('600'), fontSize: 12, color: colors.placeholder },
  row: { flexDirection: 'row', gap: 36, justifyContent: 'center' },
  ctrl: { alignItems: 'center', gap: 8, width: 80 },
  circ: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.callCtrl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlLabel: { ...bodyFont('400'), fontSize: 12, color: colors.placeholder },
  hang: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incoming: { flexDirection: 'row', gap: 40 },
  protect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(250,250,249,0.04)',
  },
  protectText: { ...bodyFont('400'), fontSize: 12, color: colors.placeholder },
  mini: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  miniBar: {
    backgroundColor: colors.callBg,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniText: { ...bodyFont('600'), color: colors.onAccent },
  miniHang: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  keypad: { gap: 8, alignItems: 'center' },
  keyRow: { flexDirection: 'row', gap: 16 },
  key: {
    width: 64,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.callCtrl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { ...displayFont('700'), color: colors.onAccent, fontSize: 18 },
  digits: { ...bodyFont('500'), color: colors.placeholder, minHeight: 20 },
});
