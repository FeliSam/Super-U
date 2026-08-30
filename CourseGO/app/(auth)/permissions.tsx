import { PillButton, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingContext';
import { Feather } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Row = { key: 'gps' | 'notif' | 'camera'; icon: keyof typeof Feather.glyphMap; title: string; hint: string };

const ROWS: Row[] = [
  { key: 'gps', icon: 'map-pin', title: 'Localisation', hint: 'Suivi GPS pendant les livraisons.' },
  { key: 'notif', icon: 'bell', title: 'Notifications', hint: 'Nouvelles courses et messages client.' },
  { key: 'camera', icon: 'camera', title: 'Caméra', hint: 'Scanner codes-barres et QR en magasin.' },
];

export default function PermissionsScreen() {
  const { completePerms } = useOnboarding();
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const ask = async (key: Row['key']) => {
    setBusy(key);
    try {
      if (key === 'gps') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setOk((p) => ({ ...p, gps: status === 'granted' }));
      } else if (key === 'camera') {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setOk((p) => ({ ...p, camera: status === 'granted' }));
      } else if (Platform.OS === 'web' && typeof Notification !== 'undefined') {
        const res = await Notification.requestPermission();
        setOk((p) => ({ ...p, notif: res === 'granted' }));
      } else {
        setOk((p) => ({ ...p, notif: true }));
      }
    } catch {
      setOk((p) => ({ ...p, [key]: false }));
    } finally {
      setBusy(null);
    }
  };

  const finish = async () => {
    await completePerms();
    router.replace('/(tabs)');
  };

  return (
    <Screen style={styles.wrap}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>AUTORISATIONS</Text>
        <Text style={styles.title}>Pour travailler en course</Text>
        <Text style={styles.sub}>Activez GPS, notifications et caméra. Vous pourrez changer ça plus tard dans les réglages.</Text>
      </View>
      <View style={styles.list}>
        {ROWS.map((row) => (
          <Pressable key={row.key} style={styles.card} onPress={() => void ask(row.key)}>
            <View style={styles.icon}>
              <Feather name={row.icon} size={20} color={colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{row.title}</Text>
              <Text style={styles.cardHint}>{row.hint}</Text>
            </View>
            <Text style={styles.badge}>
              {busy === row.key ? '…' : ok[row.key] ? 'OK' : 'Autoriser'}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.bottom}>
        <PillButton label="CONTINUER" onPress={() => void finish()} />
        <Pressable onPress={() => void finish()}>
          <Text style={styles.skip}>Plus tard</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'space-between' },
  hero: { paddingHorizontal: 24, paddingTop: 32, gap: 8 },
  kicker: { ...displayFont('800'), fontSize: 12, letterSpacing: 1.2, color: colors.teal },
  title: { ...displayFont('900'), fontSize: 24, color: colors.text },
  sub: { ...bodyFont('400'), fontSize: 15, lineHeight: 22, color: colors.muted },
  list: { paddingHorizontal: 24, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...displayFont('800'), fontSize: 16, color: colors.text },
  cardHint: { ...bodyFont('400'), fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: { ...displayFont('800'), fontSize: 12, color: colors.teal },
  bottom: { padding: 24, gap: 8 },
  skip: { ...bodyFont('600'), textAlign: 'center', color: colors.muted, paddingVertical: 8 },
});
