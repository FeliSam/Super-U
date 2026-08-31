import { CourseLogo } from '@/components/CourseLogo';
import { Field, PillButton, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { opsChangePassword } from '@/lib/api/ops';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ResetPasswordScreen() {
  const { staff, applyStaff, signOut } = useStaffAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      setError('Au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux saisies ne correspondent pas.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await opsChangePassword({ password });
      applyStaff(res.staff);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de changer le mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.wrap}>
      <View style={styles.hero}>
        <CourseLogo width={180} />
        <Text style={styles.title}>Nouveau mot de passe</Text>
        <Text style={styles.sub}>
          {staff?.firstName}, le magasin vous a donné un mot de passe temporaire. Choisissez le vôtre avant d’entrer en course.
        </Text>
      </View>
      <View style={styles.form}>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <Field
          label="NOUVEAU MOT DE PASSE"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          secureToggle
          textContentType="newPassword"
        />
        <Field
          label="CONFIRMER"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          secureToggle
          textContentType="newPassword"
        />
        <PillButton label={loading ? '…' : 'ENREGISTRER'} onPress={() => void submit()} disabled={loading} />
        <Text style={styles.out} onPress={() => void signOut()}>
          Se déconnecter
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'space-between' },
  hero: { gap: 8, paddingHorizontal: 24, paddingTop: 36, alignItems: 'center' },
  title: { ...displayFont('800'), fontSize: 22, color: colors.text, textAlign: 'center' },
  sub: { ...bodyFont('400'), fontSize: 14, color: colors.muted, textAlign: 'center' },
  form: { paddingHorizontal: 24, gap: 16, paddingBottom: 32 },
  err: { ...bodyFont('600'), color: colors.danger },
  out: { ...bodyFont('600'), fontSize: 14, color: colors.muted, textAlign: 'center' },
});
