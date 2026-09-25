import {
  AuthBrand,
  AuthErrorBanner,
  AuthField,
  AuthLinkRow,
  AuthPrimaryButton,
  AuthScreen,
} from '@/components/auth/AuthUI';
import { GestureRoot } from '@/components/GestureRoot';
import { PressScale } from '@/components/motion';
import { goBack } from '@/lib/navigation';
import { IconCircle } from '@/components/ui';
import { bodyFont, displayFont, spacing, type AppColors } from '@/constants/theme';
import { softShadow } from '@/lib/shadow';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/context/ThemeContext';
import { formatBeninPhoneInput, isValidBeninPhone } from '@/lib/beninPhone';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { iosKeyboardAccessoryProps } from '@/components/KeyboardDismissBar';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const TEST_OTP = '123456';
const TEST = {
  firstName: 'Merveille',
  lastName: 'ADJO',
  email: 'merveille.adjo@marche-dore.test',
  phone: '+229 97 12 34 56',
  password: 'marche123',
};

const STEPS = [
  { title: 'Qui êtes-vous ?', subtitle: 'Prénom, nom et e-mail pour votre carte fidélité.' },
  { title: 'Votre numéro', subtitle: 'On envoie un code SMS pour confirmer que c’est bien vous.' },
  { title: 'Code & sécurité', subtitle: 'Entrez le code reçu, puis choisissez un mot de passe.' },
] as const;

const PAGE_TIMING = {
  duration: 420,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
} as const;

export default function SignupScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const contentW = Math.max(280, Math.round(windowW - spacing.screen * 2));
  const { signUp } = useAuth();
  const [step, setStep] = useState(0);
  const [pagerW, setPagerW] = useState(0);
  const pageWidth = pagerW > 0 ? pagerW : contentW;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+229 ');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pageW = useSharedValue(contentW);
  const tx = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const progress = useSharedValue(0);
  const stepSV = useSharedValue(0);

  useEffect(() => {
    if (pagerW > 0) return;
    pageW.value = contentW;
  }, [contentW, pageW, pagerW]);

  const snapTo = useCallback(
    (index: number) => {
      const w = pageW.value;
      tx.value = withTiming(-index * w, PAGE_TIMING);
      progress.value = withTiming(index, PAGE_TIMING);
      stepSV.value = index;
    },
    [pageW, progress, stepSV, tx],
  );

  useEffect(() => {
    snapTo(step);
  }, [snapTo, step]);

  const fillTest = () => {
    setError(null);
    if (step === 0) {
      setFirstName(TEST.firstName);
      setLastName(TEST.lastName);
      setEmail(TEST.email);
      return;
    }
    if (step === 1) {
      setPhone(formatBeninPhoneInput(TEST.phone));
      return;
    }
    setOtp(TEST_OTP);
    setPassword(TEST.password);
    setConfirm(TEST.password);
  };

  const canEnter = useCallback(
    (target: number) => {
      if (target <= 0) return true;
      if (target >= 1) {
        if (!firstName.trim() || !lastName.trim()) {
          setError('Ajoutez votre prénom et votre nom.');
          return false;
        }
        if (!email.includes('@') || email.trim().length < 5) {
          setError('Entrez une adresse e-mail valide.');
          return false;
        }
      }
      if (target >= 2) {
        if (!isValidBeninPhone(phone)) {
          setError('Numéro béninois invalide (+229 01 00 00 00 00).');
          return false;
        }
      }
      setError(null);
      return true;
    },
    [email, firstName, lastName, phone],
  );

  const goTo = useCallback(
    (target: number) => {
      const next = Math.max(0, Math.min(2, target));
      if (next > step && !canEnter(next)) {
        snapTo(step);
        return;
      }
      if (next === 2 && step === 1) setCodeSent(true);
      setStep(next);
    },
    [canEnter, snapTo, step],
  );

  const goNext = () => goTo(step + 1);

  const submit = async () => {
    setError(null);
    if (otp !== TEST_OTP) {
      setError('Code incorrect. Astuce test : 123456, ou « Remplir le test ».');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const result = await signUp({ firstName, lastName, email, phone, password });
      if (!result.ok) setError(result.error);
    } finally {
      setLoading(false);
    }
  };

  const onBack = () => {
    setError(null);
    if (step === 0) goBack('/(auth)');
    else goTo(step - 1);
  };

  const onSwipeSettle = useCallback(
    (target: number) => {
      goTo(target);
    },
    [goTo],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-14, 14])
        .onStart(() => {
          dragStart.value = tx.value;
        })
        .onUpdate((e) => {
          const w = pageW.value;
          const min = -2 * w;
          tx.value = Math.min(0, Math.max(min, dragStart.value + e.translationX));
          progress.value = Math.min(2, Math.max(0, -tx.value / Math.max(1, w)));
        })
        .onEnd((e) => {
          const w = Math.max(1, pageW.value);
          let next = Math.round(-tx.value / w);
          if (e.velocityX < -520) next += 1;
          if (e.velocityX > 520) next -= 1;
          next = Math.max(0, Math.min(2, next));
          runOnJS(onSwipeSettle)(next);
        }),
    [dragStart, onSwipeSettle, pageW, progress, tx],
  );

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const copyTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  return (
    <AuthScreen scroll={false}>
      <View style={[styles.topRow, { paddingTop: Math.max(insets.top, 8) }]}>
        <IconCircle name="chevron-left" onPress={onBack} accessibilityLabel="Retour" />
        <View style={styles.progress}>
          {STEPS.map((_, i) => (
            <ProgressSeg key={i} index={i} progress={progress} colors={colors} />
          ))}
        </View>
        <Text style={styles.stepLabel}>{step + 1}/3</Text>
      </View>

      <AuthBrand compact skipSafePad />
      <View style={styles.copyViewport} pointerEvents="none">
        <Animated.View style={[styles.copyTrack, { width: pageWidth * 3 }, copyTrackStyle]}>
          {STEPS.map((s) => (
            <View key={s.title} style={[styles.copyPage, { width: pageWidth }]}>
              <Text style={styles.copyTitle}>{s.title}</Text>
              <Text style={styles.copySub}>{s.subtitle}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <GestureRoot style={styles.pagerShell}>
        <GestureDetector gesture={pan}>
          <View
            style={styles.pager}
            onLayout={(e) => {
              const w = Math.round(e.nativeEvent.layout.width);
              if (!w || w === pagerW) return;
              setPagerW(w);
              pageW.value = w;
              tx.value = -step * w;
            }}>
            <Animated.View style={[styles.track, { width: pageWidth * 3 }, trackStyle]}>
              <View style={[styles.page, { width: pageWidth }]}>
                <View style={styles.card}>
                  <AuthErrorBanner message={step === 0 ? error : null} />
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <AuthField
                        label="Prénom"
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                        textContentType="givenName"
                        placeholder="Merveille"
                      />
                    </View>
                    <View style={styles.half}>
                      <AuthField
                        label="Nom"
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                        textContentType="familyName"
                        placeholder="ADJO"
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
                  <PressScale style={styles.demoChip} onPress={fillTest} scaleTo={0.98}>
                    <Feather name="zap" size={14} color={colors.gold} />
                    <Text style={styles.demoChipText}>Remplir le test · Merveille ADJO</Text>
                  </PressScale>
                  <AuthPrimaryButton label="Continuer" onPress={goNext} />
                </View>
              </View>

              <View style={[styles.page, { width: pageWidth }]}>
                <View style={styles.card}>
                  <AuthErrorBanner message={step === 1 ? error : null} />
                  <View style={styles.phoneHero}>
                    <View style={styles.phoneHeroIcon}>
                      <Feather name="smartphone" size={22} color={colors.gold} />
                    </View>
                    <Text style={styles.phoneHeroText}>Un SMS Marché Doré arrive en quelques secondes.</Text>
                  </View>
                  <AuthField
                    label="Téléphone (+229)"
                    value={phone}
                    onChangeText={(v) => setPhone(formatBeninPhoneInput(v))}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    placeholder="+229 01 00 00 00 00"
                  />
                  <PressScale style={styles.demoChip} onPress={fillTest} scaleTo={0.98}>
                    <Feather name="zap" size={14} color={colors.gold} />
                    <Text style={styles.demoChipText}>Remplir le test · +229 97 12 34 56</Text>
                  </PressScale>
                  <AuthPrimaryButton label="Envoyer le code" onPress={goNext} />
                </View>
              </View>

              <View style={[styles.page, { width: pageWidth }]}>
                <View style={styles.card}>
                  <AuthErrorBanner message={step === 2 ? error : null} />
                  <Text style={styles.otpHint}>
                    Code envoyé {codeSent ? `au ${phone.trim()}` : ''} · démo {TEST_OTP}
                  </Text>
                  <Text style={styles.otpLabel}>Code à 6 chiffres</Text>
                  <View style={styles.otpRow}>
                    {Array.from({ length: 6 }, (_, i) => (
                      <View key={i} style={[styles.otpBox, otp[i] ? styles.otpBoxOn : null]}>
                        <Text style={styles.otpDigit}>{otp[i] ?? ''}</Text>
                      </View>
                    ))}
                    <TextInput
                      value={otp}
                      onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      caretHidden
                      {...iosKeyboardAccessoryProps()}
                      style={styles.otpGhost}
                    />
                  </View>
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
                  <PressScale style={styles.demoChip} onPress={fillTest} scaleTo={0.98}>
                    <Feather name="zap" size={14} color={colors.gold} />
                    <Text style={styles.demoChipText}>Remplir le test · code {TEST_OTP}</Text>
                  </PressScale>
                  <AuthPrimaryButton label="Créer mon compte" onPress={() => void submit()} loading={loading} />
                </View>
              </View>
            </Animated.View>
          </View>
        </GestureDetector>
      </GestureRoot>

      <AuthLinkRow
        prompt="Déjà inscrit ?"
        action="Se connecter"
        onPress={() => router.replace('/(auth)/login')}
      />
    </AuthScreen>
  );
}

function ProgressSeg({
  index,
  progress,
  colors,
}: {
  index: number;
  progress: SharedValue<number>;
  colors: AppColors;
}) {
  const fillStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [index - 0.55, index], [12, 100], Extrapolation.CLAMP)}%`,
  }));
  return (
    <View style={[segStyles.track, { backgroundColor: colors.border }]}>
      <Animated.View style={[segStyles.fill, { backgroundColor: colors.gold }, fillStyle]} />
    </View>
  );
}

const segStyles = StyleSheet.create({
  track: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 0,
      paddingBottom: 4,
      minHeight: 48,
    },
    progress: { flex: 1, flexDirection: 'row', gap: 6, height: 5 },
    stepLabel: { color: colors.muted, fontSize: 13, ...bodyFont('700') },
    copyViewport: {
      height: 72,
      overflow: 'hidden',
      marginTop: -4,
    },
    copyTrack: {
      flexDirection: 'row',
    },
    copyPage: {
      paddingHorizontal: 4,
      alignItems: 'center',
      gap: 4,
    },
    copyTitle: {
      color: colors.text,
      fontSize: 24,
      textAlign: 'center',
      lineHeight: 28,
      ...displayFont('800'),
    },
    copySub: {
      color: colors.muted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
      ...bodyFont('400'),
    },
    pagerShell: {
      flex: 1,
      minHeight: 220,
      width: '100%',
    },
    pager: {
      flex: 1,
      width: '100%',
      minHeight: 220,
    },
    track: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    page: {
      paddingBottom: 4,
      flexShrink: 0,
    },
    card: {
      gap: 14,
      backgroundColor: colors.white,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      ...softShadow({ y: 10, blur: 20, opacity: 0.06, elevation: 2 }),
    },
    row: { flexDirection: 'row', gap: 10 },
    half: { flex: 1 },
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
    phoneHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.cream,
      borderRadius: 16,
      padding: 12,
    },
    phoneHeroIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    phoneHeroText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      ...bodyFont('500'),
    },
    otpHint: { color: colors.muted, fontSize: 12, ...bodyFont('500') },
    otpLabel: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    otpRow: {
      position: 'relative',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
    },
    otpBox: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    otpBoxOn: {
      borderColor: colors.gold,
      backgroundColor: colors.cream,
    },
    otpDigit: {
      color: colors.text,
      fontSize: 20,
      ...displayFont('800'),
    },
    otpGhost: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.02,
      fontSize: 1,
    },
  });
}
