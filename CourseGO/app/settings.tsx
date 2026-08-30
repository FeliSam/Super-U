import { IconBtn, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useStaffPrefs } from '@/context/StaffPrefsContext';
import { getApiBaseUrl } from '@/lib/api/http';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

type FeatherName = ComponentProps<typeof Feather>['name'];

function roleLabel(role?: string | null) {
  if (role === 'picker') return 'Préparateur';
  if (role === 'courier' || role === 'coursier') return 'Livreur';
  if (role === 'dispatcher') return 'Dispatch';
  if (role === 'both') return 'Coursier';
  return role || 'Staff';
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onValueChange,
  last,
}: {
  icon: FeatherName;
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.icon}>
        <Feather name={icon} size={18} color={colors.teal} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.teal }}
        thumbColor={colors.white}
      />
    </View>
  );
}

function LinkRow({
  icon,
  label,
  hint,
  onPress,
  last,
}: {
  icon: FeatherName;
  label: string;
  hint?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, last && styles.rowLast]}>
      <View style={styles.icon}>
        <Feather name={icon} size={18} color={colors.teal} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.placeholder} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { staff, signOut } = useStaffAuth();
  const { online, setOnline } = useBoard();
  const { prefs, patchPrefs } = useStaffPrefs();
  const [permBusy, setPermBusy] = useState<string | null>(null);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const askGps = useCallback(async () => {
    setPermBusy('gps');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      patchPrefs({ shareLocation: status === 'granted' });
    } finally {
      setPermBusy(null);
    }
  }, [patchPrefs]);

  const askCamera = useCallback(async () => {
    setPermBusy('camera');
    try {
      await Camera.requestCameraPermissionsAsync();
    } finally {
      setPermBusy(null);
    }
  }, []);

  const askNotif = useCallback(async () => {
    setPermBusy('notif');
    try {
      if (Platform.OS === 'web' && typeof Notification !== 'undefined') {
        await Notification.requestPermission();
      }
    } finally {
      setPermBusy(null);
    }
  }, []);

  return (
    <Screen>
      <View style={styles.nav}>
        <IconBtn name="chevron-left" bg={colors.white} onPress={() => router.back()} />
        <Text style={styles.title}>Paramètres</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>Course</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="radio"
            label={online ? 'En ligne' : 'En pause'}
            hint={online ? 'Vous recevez des courses du magasin.' : 'La file n’apparaît plus sur l’accueil.'}
            value={online}
            onValueChange={setOnline}
          />
          <ToggleRow
            icon="navigation"
            label="Partager ma position"
            hint="Le client voit votre pin pendant la livraison."
            value={prefs.shareLocation}
            onValueChange={(v) => patchPrefs({ shareLocation: v })}
            last
          />
        </View>

        <Text style={styles.section}>Notifications</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="package"
            label="Nouvelles courses"
            hint="Ramassages et livraisons à prendre."
            value={prefs.notifJobs}
            onValueChange={(v) => patchPrefs({ notifJobs: v })}
          />
          <ToggleRow
            icon="message-circle"
            label="Messages client"
            hint="Chat pendant une livraison."
            value={prefs.notifChat}
            onValueChange={(v) => patchPrefs({ notifChat: v })}
          />
          <ToggleRow
            icon="phone"
            label="Appels"
            hint="Le client peut vous joindre depuis le suivi."
            value={prefs.notifCalls}
            onValueChange={(v) => patchPrefs({ notifCalls: v })}
          />
          <ToggleRow
            icon="volume-2"
            label="Sons"
            hint="Alerte à l’arrivée d’une mission."
            value={prefs.sound}
            onValueChange={(v) => patchPrefs({ sound: v })}
          />
          <LinkRow
            icon="bell"
            label="Boîte de réception"
            hint="Historique des alertes"
            onPress={() => router.push('/notifications')}
            last
          />
        </View>

        <Text style={styles.section}>Autorisations</Text>
        <View style={styles.card}>
          <LinkRow
            icon="map-pin"
            label="Localisation"
            hint={permBusy === 'gps' ? 'Demande…' : 'GPS pendant les livraisons'}
            onPress={() => void askGps()}
          />
          <LinkRow
            icon="camera"
            label="Caméra"
            hint={permBusy === 'camera' ? 'Demande…' : 'Scan codes-barres et QR magasin'}
            onPress={() => void askCamera()}
          />
          <LinkRow
            icon="bell"
            label="Notifications système"
            hint={permBusy === 'notif' ? 'Demande…' : 'Autoriser les alertes de l’appareil'}
            onPress={() => void askNotif()}
            last
          />
        </View>

        <Text style={styles.section}>Compte</Text>
        <View style={styles.card}>
          <LinkRow
            icon="user"
            label="Identité"
            hint={`${staff?.firstName ?? ''} ${staff?.lastName ?? ''} · ${roleLabel(staff?.role)}`.trim()}
            onPress={() => router.push('/account/security')}
          />
          <LinkRow
            icon="truck"
            label="Véhicule et magasin"
            hint={`${staff?.vehicle?.trim() || 'Moto'} · ${staff?.storeId || 'magasin'}`}
            onPress={() => router.push('/account/vehicle')}
          />
          <LinkRow icon="file-text" label="Documents" hint="Pièce, permis, assurance" onPress={() => router.push('/account/documents')} />
          <LinkRow icon="lock" label="Sécurité" hint={staff?.email || 'Session staff'} onPress={() => router.push('/account/security')} last />
        </View>

        <Text style={styles.section}>Application</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.icon}>
              <Feather name="globe" size={18} color={colors.teal} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Langue</Text>
              <Text style={styles.rowHint}>Français</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.icon}>
              <Feather name="package" size={18} color={colors.teal} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowHint}>CourseGo {version}</Text>
            </View>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.icon}>
              <Feather name="server" size={18} color={colors.teal} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>API SuperU</Text>
              <Text style={styles.rowHint} numberOfLines={2}>
                {getApiBaseUrl()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.section}>Aide</Text>
        <View style={styles.card}>
          <LinkRow
            icon="help-circle"
            label="Support magasin"
            hint="+229 01 40 00 00 00"
            onPress={() => router.push('/account/support')}
          />
          <LinkRow
            icon="phone"
            label="Appeler le dispatch"
            hint="Ligne ops"
            onPress={() => void Linking.openURL('tel:+2290140000000')}
          />
          <LinkRow icon="info" label="À propos" hint="Cartes, API, version" onPress={() => router.push('/account/about')} last />
        </View>

        <Pressable style={styles.logout} onPress={() => void signOut()}>
          <Text style={styles.logoutTxt}>Se déconnecter</Text>
        </Pressable>
        <Text style={styles.legal}>
          Auth ops.staff uniquement — distincte du login client Marché Doré. Une seule base SuperU.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  title: { ...displayFont('800'), fontSize: 18 },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  section: {
    ...displayFont('800'),
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 10,
    marginBottom: 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f6f9',
  },
  rowLast: { borderBottomWidth: 0 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...bodyFont('600'), fontSize: 15, color: colors.text },
  rowHint: { ...bodyFont('400'), fontSize: 12, color: colors.muted },
  logout: {
    marginTop: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutTxt: { ...displayFont('800'), fontSize: 15, color: colors.danger },
  legal: { ...bodyFont('400'), fontSize: 12, color: colors.placeholder, lineHeight: 18, textAlign: 'center' },
});
