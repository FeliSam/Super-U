import {
  AuthBrand,
  AuthErrorBanner,
  AuthField,
  AuthLinkRow,
  AuthPrimaryButton,
  AuthScreen,
} from '@/components/auth/AuthUI';
import { MotionView } from '@/components/motion';
import { IconCircle } from '@/components/ui';
import { type AppColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/context/ThemeContext';
import { formatBeninPhoneInput } from '@/lib/beninPhone';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export default function SignupScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+229 ');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const result = await signUp({ firstName, lastName, email, phone, password });
      if (!result.ok) setError(result.error);
      // AuthGate routes to onboarding when session.onboardingDone === false
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen>
      <View style={styles.topRow}>
        <IconCircle name="chevron-left" onPress={() => router.back()} accessibilityLabel="Retour" />
      </View>

      <AuthBrand
        compact
        title="Créer mon compte"
        subtitle="Quelques infos pour personnaliser Marché Doré — onboarding premium juste après."
      />

      <MotionView preset="up" index={1} style={styles.card}>
        <AuthErrorBanner message={error} />
        <View style={styles.row}>
          <View style={styles.half}>
            <AuthField
              label="Prénom"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              textContentType="givenName"
              placeholder="Amina"
            />
          </View>
          <View style={styles.half}>
            <AuthField
              label="Nom"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              textContentType="familyName"
              placeholder="Diallo"
            />
          </View>
        </View>
        <AuthField
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="vous@email.com"
        />
        <AuthField
          label="Téléphone (+229)"
          value={phone}
          onChangeText={(v) => setPhone(formatBeninPhoneInput(v))}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          placeholder="+229 97 00 00 00"
        />
        <AuthField
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          secureToggle
          textContentType="newPassword"
          placeholder="6 caractères min."
        />
        <AuthField
          label="Confirmer"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          secureToggle
          textContentType="newPassword"
          placeholder="Retapez le mot de passe"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
        <AuthPrimaryButton label="Continuer" onPress={() => void submit()} loading={loading} />
      </MotionView>

      <AuthLinkRow
        prompt="Déjà inscrit ?"
        action="Se connecter"
        onPress={() => router.replace('/(auth)/login')}
      />
    </AuthScreen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    card: {
      gap: 14,
      backgroundColor: colors.white,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#1c1613',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
      elevation: 2,
    },
    row: { flexDirection: 'row', gap: 10 },
    half: { flex: 1 },
  });
}
