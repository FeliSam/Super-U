import { ApiHostEditor } from '@/components/ApiHostEditor';
import { colors, displayFont, bodyFont, radius, shadow } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { CourseLogo } from '@/components/CourseLogo';
import { Field, PillButton, Screen } from '@/components/ui';
import { keyboardScrollProps, useKeyboardAvoidProps } from '@/lib/keyboardAvoid';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function LoginScreen() {
  const { signIn, sessionNotice, clearSessionNotice, offline } = useStaffAuth();
  const { pending } = useLocalSearchParams<{ pending?: string }>();
  const pendingNotice =
    pending === '1'
      ? 'Compte créé. Il est en attente de validation par l’équipe Super U : vous pourrez vous connecter dès son activation.'
      : null;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const kav = useKeyboardAvoidProps();

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
    clearSessionNotice();
    setLoading(true);
    try {
      const res = await signIn(identifier, password);
      if (!res.ok) setError(res.error);
    } finally {
      setLoading(false);
    }
  };

  const banner = error || sessionNotice || pendingNotice;
  const isPendingError = Boolean(error && /attente de validation/i.test(error));
  const warn = (!error && Boolean(sessionNotice || pendingNotice)) || isPendingError;

  return (
    <Screen style={styles.wrap}>
      <KeyboardAvoidingView {...kav} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          {...keyboardScrollProps()}
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <CourseLogo width={196} />
            <Text style={styles.kicker}>Espace staff</Text>
            <Text style={styles.title}>Connexion CourseGo</Text>
            <Text style={styles.sub}>
              E-mail ou téléphone de votre compte staff. Vos identifiants vous sont remis par votre responsable.
            </Text>
          </View>

          <View style={styles.card}>
            {offline ? (
              <View style={[styles.errBox, styles.warnBox]}>
                <Text style={[styles.errKicker, styles.warnKicker]}>Mode local</Text>
                <Text style={[styles.err, styles.warnTxt]}>
                  Serveur injoignable — réessayez dès que le réseau revient.
                </Text>
              </View>
            ) : null}
            {banner ? (
              <View style={[styles.errBox, warn ? styles.warnBox : null]}>
                <Text style={[styles.errKicker, warn ? styles.warnKicker : null]}>
                  {isPendingError || (!error && !sessionNotice && pendingNotice)
                    ? 'Compte en attente de validation'
                    : error
                      ? 'Erreur'
                      : 'Pourquoi vous êtes ici'}
                </Text>
                <Text style={[styles.err, warn ? styles.warnTxt : null]}>{banner}</Text>
              </View>
            ) : null}

            <Field
              label="E-MAIL OU TÉLÉPHONE"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              placeholder="vous@exemple.com"
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
          </View>

          <Pressable onPress={() => router.push('/(auth)/register')} style={styles.linkBtn}>
            <Text style={styles.link}>Créer un compte livreur</Text>
          </Pressable>

          <View style={styles.bottom}>
            <ApiHostEditor />
            <View style={styles.indicator} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'space-between' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 16, flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 8, paddingBottom: 4 },
  kicker: {
    ...displayFont('800'),
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.teal,
  },
  title: { ...displayFont('800'), fontSize: 24, color: colors.text, textAlign: 'center', letterSpacing: -0.4 },
  sub: { ...bodyFont('400'), fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  errBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  warnBox: {
    backgroundColor: colors.tealSoft,
  },
  errKicker: {
    ...displayFont('800'),
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.danger,
  },
  warnKicker: { color: colors.teal },
  err: { ...bodyFont('600'), color: colors.danger, fontSize: 13, lineHeight: 18 },
  warnTxt: { color: colors.text },
  linkBtn: { alignItems: 'center', paddingVertical: 4 },
  link: { ...bodyFont('700'), fontSize: 14, color: colors.teal, textAlign: 'center' },
  demo: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.tealSoft,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
  },
  demoKicker: { ...displayFont('800'), fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.teal },
  demoTxt: { ...bodyFont('600'), fontSize: 12, color: colors.muted },
  bottom: { padding: 16, alignItems: 'center', gap: 10 },
  indicator: { width: 120, height: 5, borderRadius: 10, backgroundColor: colors.teal },
});
