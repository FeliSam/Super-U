import {
  AuthErrorBanner,
  AuthField,
  AuthLinkRow,
  AuthPrimaryButton,
  AuthScreen,
} from '@/components/auth/AuthUI';
import { ApiHostEditor } from '@/components/ApiHostEditor';
import { MotionView, PressScale } from '@/components/motion';
import { goBack } from '@/lib/navigation';
import { IconCircle } from '@/components/ui';
import { BRAND_MARK } from '@/constants/brand';
import { bodyFont, displayFont, liquidIce, type AppColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const colors = useColors();
  const { scheme } = useTheme();
  const ice = useMemo(() => liquidIce(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors, ice), [colors, ice]);
  const insets = useSafeAreaInsets();
  const { signIn, demoHint, offline } = useAuth();
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
    <AuthScreen scroll={false}>
      <View style={[styles.topRow, { paddingTop: Math.max(insets.top, 8) }]}>
        <IconCircle name="chevron-left" variant="ghost" onPress={() => goBack('/(auth)')} accessibilityLabel="Retour" />
        <View style={styles.markSlot}>
          <View style={styles.markPill}>
            <Image source={BRAND_MARK} style={styles.mark} />
            <Text style={styles.brand}>Marché Doré</Text>
          </View>
        </View>
      </View>

      <MotionView preset="up" index={0} style={styles.hero}>
        <Text style={styles.kicker}>Connexion</Text>
        <Text style={styles.title}>Bon retour.</Text>
        <Text style={styles.sub}>Panier, commandes et fidélité — un geste, et c’est repris.</Text>
      </MotionView>

      <MotionView preset="up" index={1} style={styles.card}>
        {offline ? (
          <AuthErrorBanner message="Mode local possible : API coupée — utilisez demo@marchedore.bj / marche2024." />
        ) : null}
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
          <Text style={styles.demoChipHint}>{demoHint.email}</Text>
        </PressScale>

        <AuthPrimaryButton label="Se connecter" onPress={() => void submit()} loading={loading} />
      </MotionView>

      <View style={styles.footerBlock}>
        <ApiHostEditor />
        <AuthLinkRow
          prompt="Pas encore de compte ?"
          action="Créer le mien"
          onPress={() => router.replace('/(auth)/signup')}
        />
      </View>
    </AuthScreen>
  );
}

function createStyles(
  colors: AppColors,
  ice: ReturnType<typeof liquidIce>,
) {
  return StyleSheet.create({
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 0,
      paddingBottom: 2,
      minHeight: 44,
    },
    markSlot: { flex: 1, alignItems: 'center', paddingRight: 46 },
    markPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: ice.backgroundColor,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: ice.borderColor,
      ...(Platform.OS === 'web'
        ? {
            backdropFilter: ice.webFilter,
            WebkitBackdropFilter: ice.webFilter,
            boxShadow: ice.webShadow,
          }
        : {}),
    },
    mark: { width: 26, height: 26 },
    brand: {
      color: colors.text,
      fontSize: 13,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      ...displayFont('700'),
    },
    hero: {
      gap: 4,
      paddingTop: 4,
      paddingBottom: 2,
    },
    kicker: {
      color: colors.gold,
      fontSize: 11,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      ...bodyFont('700'),
    },
    title: {
      color: colors.text,
      fontSize: 32,
      lineHeight: 36,
      ...displayFont('800'),
    },
    sub: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      maxWidth: 320,
      ...bodyFont('400'),
    },
    card: {
      gap: 12,
      backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.72)' : colors.white,
      borderRadius: 26,
      padding: 16,
      borderWidth: 1,
      borderColor: ice.borderColor,
      ...(Platform.OS === 'web'
        ? {
            backdropFilter: ice.webFilter,
            WebkitBackdropFilter: ice.webFilter,
            boxShadow: ice.webShadow,
          }
        : {
            shadowColor: '#1c1613',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.08,
            shadowRadius: 24,
            elevation: 3,
          }),
    },
    demoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      backgroundColor: ice.backgroundColor,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: ice.borderColor,
    },
    demoChipText: {
      color: colors.text,
      fontSize: 13,
      ...bodyFont('700'),
    },
    demoChipHint: {
      color: colors.muted,
      fontSize: 11,
      ...bodyFont('500'),
    },
    footerBlock: {
      marginTop: 'auto',
      gap: 8,
      paddingTop: 4,
    },
  });
}
