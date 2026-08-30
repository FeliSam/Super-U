import { colors, displayFont, bodyFont } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { CourseLogo } from '@/components/CourseLogo';
import { Field, PillButton, Screen } from '@/components/ui';
import { getApiBaseUrl } from '@/lib/api/http';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function LoginScreen() {
  const { signIn, demoHint } = useStaffAuth();
  const [identifier, setIdentifier] = useState(demoHint.email);
  const [password, setPassword] = useState(demoHint.password);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!identifier.trim()) {
      setError('Entrez votre e-mail ou numéro.');
      return;
    }
    if (!password) {
      setError('Entrez votre mot de passe.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await signIn(identifier, password);
      if (!res.ok) setError(res.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.wrap}>
      <View>
        <View style={styles.hero}>
          <CourseLogo width={210} style={styles.logo} />
          <Text style={styles.title}>Connectez-vous à votre compte</Text>
          <Text style={styles.sub}>E-mail staff et mot de passe pour entrer en course.</Text>
        </View>

        <View style={styles.form}>
          {error ? <Text style={styles.err}>{error}</Text> : null}

          <Field
            label="E-MAIL OU TÉLÉPHONE"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            placeholder={demoHint.email}
            returnKeyType="next"
          />

          <Field
            label="MOT DE PASSE"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            secureToggle
            textContentType="password"
            placeholder="••••••••"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />

          <PillButton label={loading ? '…' : 'CONTINUER'} onPress={() => void submit()} disabled={loading} />

          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.forgot}>Créer un compte livreur</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setIdentifier(demoHint.email);
              setPassword(demoHint.password);
              setError(null);
            }}>
            <Text style={styles.forgot}>Compte démo · {demoHint.email} / {demoHint.password}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.foot}>API {getApiBaseUrl()}</Text>
        <View style={styles.indicator} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'space-between' },
  hero: { gap: 8, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, alignItems: 'center' },
  logo: { marginBottom: 8, alignSelf: 'center' },
  title: { ...displayFont('800'), fontSize: 20, color: colors.text, textAlign: 'center' },
  sub: { ...bodyFont('400'), fontSize: 14, color: colors.muted },
  form: { paddingHorizontal: 24, gap: 20 },
  err: { ...bodyFont('600'), color: colors.danger },
  forgot: { ...bodyFont('600'), fontSize: 14, color: colors.muted, textAlign: 'center' },
  bottom: { padding: 24, alignItems: 'center', gap: 12 },
  foot: { ...bodyFont('400'), fontSize: 12, color: colors.placeholder, textAlign: 'center' },
  indicator: { width: 134, height: 5, borderRadius: 10, backgroundColor: colors.teal },
});
