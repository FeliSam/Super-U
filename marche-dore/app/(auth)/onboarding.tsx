import { AuthPrimaryButton } from '@/components/auth/AuthUI';
import { AppImage } from '@/components/AppImage';
import { MotionView, PressScale } from '@/components/motion';
import { Screen } from '@/components/ui';
import { bodyFont, displayFont, liquidIce, type AppColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useUiState } from '@/context/UiStateContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { primaryChipId, TASTE_OPTIONS } from '@/lib/taste';
import { useMemo, useState, type ComponentProps } from 'react';
import { Platform, StyleSheet, Text, View, type ImageRequireSource } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FeatherName = ComponentProps<typeof Feather>['name'];
type StoryKey = 'welcome' | 'delivery' | 'rewards';

type Step = {
  key: StoryKey;
  eyebrow: string;
  title: string;
  body: string;
  icon: FeatherName;
  image: ImageRequireSource;
  imageLabel: string;
};

const STEPS: Step[] = [
  {
    key: 'welcome',
    eyebrow: 'Bienvenue',
    title: 'Votre marché,\nà portée de doigt',
    body: 'Fruits, légumes, cuisine maison et glaces — livrés frais à Cotonou.',
    icon: 'shopping-bag',
    image: require('../../assets/images/catalog/mango-hero.png'),
    imageLabel: 'Fraîcheur du jour',
  },
  {
    key: 'delivery',
    eyebrow: 'Livraison',
    title: 'Express ou\ncréneau au choix',
    body: 'Suivez le livreur en direct. Une alerte à chaque étape du trajet.',
    icon: 'map-pin',
    image: require('../../assets/images/catalog/wa-fruits-legumes-070.jpg'),
    imageLabel: 'Prêt à livrer',
  },
  {
    key: 'rewards',
    eyebrow: 'Fidélité',
    title: 'Des points\nà chaque panier',
    body: 'Plus vous commandez, plus Marché Doré vous réserve des avantages.',
    icon: 'award',
    image: require('../../assets/images/catalog/cuisine-poulet-roti.png'),
    imageLabel: 'Récompenses',
  },
];

const ALERTS_IMAGE = require('../../assets/images/catalog/promo-rentree.png') as ImageRequireSource;
const DELIVERY_FLOATS = [
  require('../../assets/images/catalog/cart-plantains.png') as ImageRequireSource,
  require('../../assets/images/catalog/cart-poulet.png') as ImageRequireSource,
  require('../../assets/images/catalog/plantains.png') as ImageRequireSource,
];

const GRADIENTS: Record<string, readonly [string, string, string]> = {
  welcome: ['rgba(20,17,15,0.22)', 'rgba(20,17,15,0.08)', 'rgba(20,17,15,0.78)'],
  delivery: ['rgba(18,42,28,0.35)', 'rgba(20,17,15,0.12)', 'rgba(12,28,20,0.82)'],
  rewards: ['rgba(80,28,18,0.28)', 'rgba(20,17,15,0.1)', 'rgba(40,16,12,0.84)'],
  interests: ['rgba(20,17,15,0.45)', 'rgba(20,17,15,0.2)', 'rgba(20,17,15,0.72)'],
  alerts: ['rgba(20,17,15,0.3)', 'rgba(20,17,15,0.12)', 'rgba(20,17,15,0.8)'],
};

export default function OnboardingScreen() {
  const colors = useColors();
  const { scheme } = useTheme();
  const ice = useMemo(() => liquidIce(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors, ice), [colors, ice]);
  const insets = useSafeAreaInsets();
  const { session, completeOnboarding } = useAuth();
  const {
    setInterests: persistInterests,
    setAlertsOn: persistAlerts,
    setHomeActiveChipId,
    setAppTourDone,
  } = useUiState();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>(['fruits', 'cuisine']);
  const [alertsOn, setAlertsOn] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const total = STEPS.length + 2;
  const isInterests = step === STEPS.length;
  const isAlerts = step === STEPS.length + 1;
  const current = STEPS[step];
  const mood = isAlerts ? 'alerts' : isInterests ? 'interests' : current.key;

  const heroImage: ImageRequireSource = isAlerts
    ? ALERTS_IMAGE
    : isInterests
      ? TASTE_OPTIONS[0].image
      : current.image;

  const toggleInterest = (id: string) => {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const persistAndEnter = async () => {
    persistInterests(interests);
    persistAlerts(alertsOn);
    const chip = primaryChipId(interests);
    if (chip) setHomeActiveChipId(chip);
    setAppTourDone(false);
    await completeOnboarding();
    router.replace('/account/addresses?setup=1' as Href);
  };

  const next = async () => {
    if (step < total - 1) {
      setStep((s) => s + 1);
      return;
    }
    setFinishing(true);
    try {
      await persistAndEnter();
    } finally {
      setFinishing(false);
    }
  };

  const skip = async () => {
    setFinishing(true);
    try {
      await persistAndEnter();
    } finally {
      setFinishing(false);
    }
  };

  const firstName = session?.firstName?.trim() || 'vous';
  const copy = isInterests
    ? { eyebrow: 'Préférences', title: 'Ce qui vous\nfait envie', body: 'Cochez vos rayons — ils s’affichent en premier à l’accueil.' }
    : isAlerts
      ? { eyebrow: 'Alertes', title: 'Restez dans\nle coup', body: 'Promos flash, livraison et messages du livreur.' }
      : { eyebrow: current.eyebrow, title: current.title, body: current.body };

  const badge =
    mood === 'alerts'
      ? { icon: 'bell' as const, label: 'Promos & suivi', bg: colors.gold }
      : mood === 'interests'
        ? { icon: 'heart' as const, label: 'Votre goût', bg: colors.gold }
        : mood === 'delivery'
          ? { icon: 'map-pin' as const, label: current.imageLabel, bg: colors.green }
          : mood === 'rewards'
            ? { icon: 'award' as const, label: current.imageLabel, bg: colors.terracotta }
            : { icon: 'shopping-bag' as const, label: current.imageLabel, bg: colors.gold };

  return (
    <Screen>
      <View style={styles.root}>
        <Animated.View key={`bg-${step}`} entering={FadeIn.duration(380)} style={StyleSheet.absoluteFill}>
          <AppImage source={heroImage} frameStyle={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
        <LinearGradient colors={[...GRADIENTS[mood]]} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.progress}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[styles.progressSeg, i <= step && styles.progressSegOn]} />
            ))}
          </View>
          <PressScale style={styles.skipPill} onPress={() => void skip()} hitSlop={8} disabled={finishing}>
            <Text style={styles.skip}>Passer</Text>
          </PressScale>
        </View>

        {mood === 'delivery' ? (
          <View style={[styles.floatRow, { top: insets.top + 52 }]} pointerEvents="none">
            {DELIVERY_FLOATS.map((src, i) => (
              <MotionView key={i} index={i} preset="zoom" style={[styles.floatCard, i === 1 ? styles.floatCardMid : null]}>
                <AppImage source={src} frameStyle={StyleSheet.absoluteFill} contentFit="cover" />
              </MotionView>
            ))}
          </View>
        ) : null}

        {mood === 'rewards' ? (
          <View style={styles.loyaltyMark} pointerEvents="none">
            <Feather name="award" size={28} color={colors.onAccent} />
            <Text style={styles.loyaltyMarkText}>+ pts</Text>
          </View>
        ) : null}

        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Feather name={badge.icon} size={13} color={colors.onAccent} />
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>

          <Animated.View key={`copy-${step}`} entering={FadeIn.duration(260)} style={styles.copy}>
            <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.body}>{copy.body}</Text>
            {step === 0 ? (
              <Text style={styles.hello}>
                Enchanté, <Text style={styles.helloName}>{firstName}</Text>.
              </Text>
            ) : null}
          </Animated.View>

          {isInterests ? (
            <View style={styles.interestGrid}>
              {TASTE_OPTIONS.map((item) => {
                const on = interests.includes(item.id);
                return (
                  <PressScale
                    key={item.id}
                    onPress={() => toggleInterest(item.id)}
                    style={[styles.interestCard, on ? styles.interestCardOn : null]}
                    scaleTo={0.97}>
                    <AppImage source={item.image} frameStyle={StyleSheet.absoluteFill} contentFit="cover" />
                    <LinearGradient colors={['transparent', 'rgba(12,10,8,0.78)']} style={StyleSheet.absoluteFill} />
                    <Text style={styles.interestLabel} numberOfLines={2}>
                      {item.label}
                    </Text>
                    {on ? (
                      <View style={styles.check}>
                        <Feather name="check" size={13} color={colors.onAccent} />
                      </View>
                    ) : null}
                  </PressScale>
                );
              })}
            </View>
          ) : null}

          {isAlerts ? (
            <PressScale
              style={[styles.toggleCard, alertsOn ? styles.toggleCardOn : null]}
              onPress={() => setAlertsOn((v) => !v)}
              scaleTo={0.985}>
              <View style={[styles.toggleIcon, { backgroundColor: alertsOn ? colors.gold : 'rgba(255,255,255,0.2)' }]}>
                <Feather name="bell" size={18} color={alertsOn ? colors.onAccent : '#fff'} />
              </View>
              <View style={styles.toggleText}>
                <Text style={styles.toggleTitle}>Notifications utiles</Text>
                <Text style={styles.toggleSub}>{alertsOn ? 'Activées' : 'Désactivées'}</Text>
              </View>
              <View style={[styles.switchTrack, alertsOn ? styles.switchTrackOn : null]}>
                <View style={[styles.switchThumb, alertsOn ? styles.switchThumbOn : null]} />
              </View>
            </PressScale>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.dots}>
              {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={[styles.dot, i === step ? styles.dotOn : null]} />
              ))}
            </View>
            <AuthPrimaryButton
              compact
              label={isAlerts ? 'Entrer dans Marché Doré' : 'Continuer'}
              onPress={() => void next()}
              loading={finishing}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors, ice: ReturnType<typeof liquidIce>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#1c1613' },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 16,
      right: 16,
      zIndex: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    progress: { flex: 1, flexDirection: 'row', gap: 5, height: 4 },
    progressSeg: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    progressSegOn: { backgroundColor: '#ffffff' },
    skipPill: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: 'rgba(255,255,255,0.88)',
      borderWidth: 1,
      borderColor: ice.borderColor,
    },
    skip: { color: colors.text, fontSize: 13, ...bodyFont('700') },
    floatRow: {
      position: 'absolute',
      right: 16,
      zIndex: 2,
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    floatCard: {
      width: 52,
      height: 64,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.92)',
      marginLeft: -12,
      backgroundColor: colors.white,
    },
    floatCardMid: {
      width: 60,
      height: 76,
      borderRadius: 18,
      zIndex: 2,
      marginBottom: 8,
    },
    loyaltyMark: {
      position: 'absolute',
      right: 20,
      top: '28%',
      alignItems: 'center',
      gap: 4,
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: 'rgba(200,75,49,0.88)',
      justifyContent: 'center',
    },
    loyaltyMarkText: { color: '#fff', fontSize: 11, ...displayFont('800') },
    bottom: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 20,
      gap: 12,
    },
    badge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    badgeText: { color: colors.onAccent, fontSize: 12, ...bodyFont('700') },
    copy: { gap: 8 },
    eyebrow: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 11,
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      ...bodyFont('700'),
    },
    title: {
      color: '#ffffff',
      fontSize: 34,
      lineHeight: 38,
      ...displayFont('800'),
    },
    body: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 340,
      ...bodyFont('400'),
    },
    hello: {
      color: '#ffffff',
      fontSize: 16,
      ...bodyFont('500'),
    },
    helloName: { ...displayFont('700'), color: colors.gold },
    interestGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    interestCard: {
      width: '48%',
      flexGrow: 1,
      height: 108,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    interestCardOn: { borderColor: colors.gold },
    interestLabel: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      color: '#fff',
      fontSize: 13,
      ...bodyFont('700'),
    },
    check: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 18,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      backgroundColor: 'rgba(255,255,255,0.16)',
      ...(Platform.OS === 'web'
        ? {
            backdropFilter: 'blur(18px) saturate(160%)',
            WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          }
        : {}),
    },
    toggleCardOn: { borderColor: colors.gold },
    toggleIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleText: { flex: 1, gap: 2 },
    toggleTitle: { color: '#fff', fontSize: 14, ...bodyFont('700') },
    toggleSub: { color: 'rgba(255,255,255,0.72)', fontSize: 12, ...bodyFont('400') },
    switchTrack: {
      width: 42,
      height: 24,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.28)',
      padding: 3,
      justifyContent: 'center',
    },
    switchTrackOn: { backgroundColor: colors.gold },
    switchThumb: {
      width: 18,
      height: 18,
      borderRadius: 999,
      backgroundColor: colors.white,
    },
    switchThumbOn: { alignSelf: 'flex-end' },
    footer: { gap: 10, paddingTop: 4 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    dotOn: { width: 18, backgroundColor: '#fff' },
  });
}
