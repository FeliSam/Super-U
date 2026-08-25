import {
  AuthBrand,
  AuthErrorBanner,
  AuthField,
  AuthLinkRow,
  AuthPrimaryButton,
  AuthScreen,
} from '@/components/auth/AuthUI';
import { MotionView, PressScale } from '@/components/motion';
import { IconCircle } from '@/components/ui';
import { bodyFont, type AppColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function LoginScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { signIn, demoHint } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signIn(identifier, password);
      if (!result.ok) setError(result.error);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setIdentifier(demoHint.email);
    setPassword(demoHint.password);
    setError(null);
  };

  return (
    <AuthScreen>
      <View style={styles.topRow}>
        <IconCircle name="chevron-left" onPress={() => router.back()} accessibilityLabel="Retour" />
      </View>

      <AuthBrand
        compact
        title="Bon retour"
        subtitle="Connectez-vous pour retrouver panier, commandes et fidélité."
      />

      <MotionView preset="up" index={1} style={styles.card}>
        <AuthErrorBanner message={error} />
        <AuthField
          label="E-mail ou téléphone"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          placeholder="vous@email.com"
          returnKeyType="next"
        />
        <AuthField
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          secureToggle
          textContentType="password"
          placeholder="••••••••"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />

        <PressScale style={styles.demoChip} onPress={fillDemo} scaleTo={0.98}>
          <Feather name="zap" size={14} color={colors.gold} />
          <Text style={styles.demoChipText}>Remplir le compte démo</Text>
        </PressScale>

        <AuthPrimaryButton label="Se connecter" onPress={() => void submit()} loading={loading} />
      </MotionView>

      <AuthLinkRow
        prompt="Pas encore de compte ?"
        action="Créer le mien"
        onPress={() => router.replace('/(auth)/signup')}
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
    demoChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.cream,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    demoChipText: {
      color: colors.text,
      fontSize: 13,
      ...bodyFont('600'),
    },
  });
}
