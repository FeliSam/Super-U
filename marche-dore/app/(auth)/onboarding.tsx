import { AuthPrimaryButton, AuthScreen } from '@/components/auth/AuthUI';
import { AppImage } from '@/components/AppImage';
import { MotionView, PressScale } from '@/components/motion';
import { bodyFont, displayFont, type AppColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View, type ImageRequireSource } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FeatherName = ComponentProps<typeof Feather>['name'];

type Step = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: FeatherName;
  accent: 'gold' | 'green' | 'terracotta';
  image: ImageRequireSource;
  imageLabel: string;
};

const STEPS: Step[] = [
  {
    key: 'welcome',
    eyebrow: 'Bienvenue',
    title: 'Votre marché,\nà portée de doigt',
    body: 'Commandez fruits, légumes, cuisine maison et glaces — livrés frais à Cotonou.',
    icon: 'shopping-bag',
    accent: 'gold',
    image: require('../../assets/images/catalog/mango-hero.png'),
    imageLabel: 'Fraîcheur du jour',
  },
  {
    key: 'delivery',
    eyebrow: 'Livraison',
    title: 'Express ou\ncréneau au choix',
    body: 'Suivez le livreur en direct et recevez des alertes à chaque étape du trajet.',
    icon: 'map-pin',
    accent: 'green',
    image: require('../../assets/images/catalog/cart-mangues.png'),
    imageLabel: 'Prêt à livrer',
  },
  {
    key: 'rewards',
    eyebrow: 'Fidélité',
    title: 'Gagnez des\npoints à chaque panier',
    body: 'Plus vous commandez, plus vous débloquez des avantages exclusifs Marché Doré.',
    icon: 'award',
    accent: 'terracotta',
    image: require('../../assets/images/catalog/cuisine-poulet-roti.png'),
    imageLabel: 'Récompenses gourmandes',
  },
];

const INTERESTS = [
  {
    id: 'fruits',
    label: 'Fruits & légumes',
    image: require('../../assets/images/catalog/cat-fruits.png') as ImageRequireSource,
  },
  {
    id: 'cuisine',
    label: 'Cuisine prête',
    image: require('../../assets/images/catalog/cuisine-poulet-roti.png') as ImageRequireSource,
  },
  {
    id: 'glaces',
    label: 'Glaces',
    image: require('../../assets/images/catalog/cat-glaces.png') as ImageRequireSource,
  },
  {
    id: 'epicerie',
    label: 'Épicerie',
    image: require('../../assets/images/catalog/cat-epicerie.png') as ImageRequireSource,
  },
  {
    id: 'boissons',
    label: 'Boissons',
    image: require('../../assets/images/catalog/promo-boissons.png') as ImageRequireSource,
  },
  {
    id: 'bebe',
    label: 'Bébé',
    image: require('../../assets/images/catalog/cat-bebe.png') as ImageRequireSource,
  },
];

const ALERTS_IMAGE = require('../../assets/images/catalog/promo.png') as ImageRequireSource;
const DELIVERY_FLOATS = [
  require('../../assets/images/catalog/cart-plantains.png') as ImageRequireSource,
  require('../../assets/images/catalog/cart-poulet.png') as ImageRequireSource,
  require('../../assets/images/catalog/plantains.png') as ImageRequireSource,
];

export default function OnboardingScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { session, completeOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>(['fruits', 'cuisine']);
  const [alertsOn, setAlertsOn] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const total = STEPS.length + 2;
  const isInterests = step === STEPS.length;
  const isAlerts = step === STEPS.length + 1;
  const progress = (step + 1) / total;
  const current = STEPS[step];

  const accentColor = (key: Step['accent']) =>
    key === 'green' ? colors.green : key === 'terracotta' ? colors.terracotta : colors.gold;

  const toggleInterest = (id: string) => {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const next = async () => {
    if (step < total - 1) {
      setStep((s) => s + 1);
      return;
    }
    setFinishing(true);
    try {
      await completeOnboarding();
    } finally {
      setFinishing(false);
    }
  };

  const skip = async () => {
    setFinishing(true);
    try {
      await completeOnboarding();
    } finally {
      setFinishing(false);
    }
  };

  const firstName = session?.firstName?.trim() || 'vous';

  return (
    <AuthScreen scroll={false}>
      <View style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.topBar}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <PressScale onPress={() => void skip()} hitSlop={10} disabled={finishing}>
            <Text style={styles.skip}>Passer</Text>
          </PressScale>
        </View>

        <View style={styles.stage}>
          {!isInterests && !isAlerts && current ? (
            <Animated.View
              key={current.key}
              entering={FadeIn.duration(280)}
              exiting={FadeOut.duration(160)}
              style={styles.story}>
              <View style={styles.heroFrame}>
                <AppImage source={current.image} frameStyle={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient colors={['transparent', 'rgba(28,22,19,0.55)']} style={styles.heroScrim} />
                <View style={[styles.heroBadge, { backgroundColor: accentColor(current.accent) }]}>
                  <Feather name={current.icon} size={14} color={colors.onAccent} />
                  <Text style={styles.heroBadgeText}>{current.imageLabel}</Text>
                </View>
                {current.key === 'delivery' ? (
                  <View style={styles.floatRow} pointerEvents="none">
                    {DELIVERY_FLOATS.map((src, i) => (
                      <MotionView
                        key={i}
                        index={i}
                        preset="zoom"
                        style={[styles.floatCard, i === 1 ? styles.floatCardMid : null]}>
                        <AppImage source={src} frameStyle={StyleSheet.absoluteFill} contentFit="cover" />
                      </MotionView>
                    ))}
                  </View>
                ) : null}
              </View>
              <Text style={styles.eyebrow}>{current.eyebrow}</Text>
              <Text style={styles.title}>{current.title}</Text>
              <Text style={styles.body}>{current.body}</Text>
              {step === 0 ? (
                <Text style={styles.hello}>
                  Enchanté, <Text style={styles.helloName}>{firstName}</Text>.
                </Text>
              ) : null}
            </Animated.View>
          ) : null}

          {isInterests ? (
            <Animated.View key="interests" entering={FadeIn.duration(280)} style={styles.story}>
              <Text style={styles.eyebrow}>Préférences</Text>
              <Text style={styles.title}>Qu’est-ce qui{'\n'}vous fait envie ?</Text>
              <Text style={styles.body}>Choisissez vos rayons favoris — on personnalisera votre accueil.</Text>
              <View style={styles.interestGrid}>
                {INTERESTS.map((item, i) => {
                  const on = interests.includes(item.id);
                  return (
                    <MotionView key={item.id} index={i} preset="zoom" style={styles.interestCell}>
                      <PressScale
                        onPress={() => toggleInterest(item.id)}
                        style={[styles.interestCard, on ? styles.interestCardOn : null]}
                        scaleTo={0.97}>
                        <AppImage source={item.image} frameStyle={StyleSheet.absoluteFill} contentFit="cover" />
                        <LinearGradient
                          colors={['transparent', 'rgba(28,22,19,0.72)']}
                          style={styles.interestScrim}
                        />
                        <View style={styles.interestMeta}>
                          <Text style={styles.interestLabel} numberOfLines={1}>
                            {item.label}
                          </Text>
                          {on ? (
                            <View style={styles.check}>
                              <Feather name="check" size={12} color={colors.onAccent} />
                            </View>
                          ) : null}
                        </View>
                      </PressScale>
                    </MotionView>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}

          {isAlerts ? (
            <Animated.View key="alerts" entering={FadeIn.duration(280)} style={styles.story}>
              <View style={styles.heroFrame}>
                <AppImage source={ALERTS_IMAGE} frameStyle={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient colors={['transparent', 'rgba(28,22,19,0.5)']} style={styles.heroScrim} />
                <View style={[styles.heroBadge, { backgroundColor: colors.gold }]}>
                  <Feather name="bell" size={14} color={colors.onAccent} />
                  <Text style={styles.heroBadgeText}>Promos & suivi</Text>
                </View>
              </View>
              <Text style={styles.eyebrow}>Alertes</Text>
              <Text style={styles.title}>Restez dans{'\n'}le coup</Text>
              <Text style={styles.body}>
                Promos flash, statut de livraison et messages du livreur — vous gardez le contrôle.
              </Text>
              <PressScale
                style={[styles.toggleCard, alertsOn ? styles.toggleCardOn : null]}
                onPress={() => setAlertsOn((v) => !v)}
                scaleTo={0.985}>
                <View style={[styles.toggleIcon, { backgroundColor: alertsOn ? colors.gold : colors.cream }]}>
                  <Feather name="bell" size={20} color={alertsOn ? colors.onAccent : colors.gold} />
                </View>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleTitle}>Notifications utiles</Text>
                  <Text style={styles.toggleSub}>
                    {alertsOn ? 'Activées pour cette démo' : 'Désactivées pour l’instant'}
                  </Text>
                </View>
                <View style={[styles.switchTrack, alertsOn ? styles.switchTrackOn : null]}>
                  <View style={[styles.switchThumb, alertsOn ? styles.switchThumbOn : null]} />
                </View>
              </PressScale>
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[styles.dot, i === step ? styles.dotOn : null]} />
            ))}
          </View>
          <AuthPrimaryButton
            label={isAlerts ? 'Entrer dans Marché Doré' : 'Continuer'}
            onPress={() => void next()}
            loading={finishing}
          />
        </View>
      </View>
    </AuthScreen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      paddingHorizontal: 22,
      justifyContent: 'space-between',
      gap: 12,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    progressTrack: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.gold,
    },
    skip: {
      color: colors.muted,
      fontSize: 14,
      ...bodyFont('600'),
    },
    stage: { flex: 1, justifyContent: 'center' },
    story: { gap: 10 },
    heroFrame: {
      height: 178,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.cream,
      marginBottom: 6,
    },
    heroScrim: {
      ...StyleSheet.absoluteFill,
    },
    heroBadge: {
      position: 'absolute',
      left: 12,
      bottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    heroBadgeText: {
      color: colors.onAccent,
      fontSize: 12,
      ...bodyFont('700'),
    },
    floatRow: {
      position: 'absolute',
      right: 10,
      top: 12,
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    floatCard: {
      width: 44,
      height: 44,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.onAccent,
      marginLeft: -10,
      backgroundColor: colors.white,
    },
    floatCardMid: {
      width: 52,
      height: 52,
      borderRadius: 16,
      zIndex: 2,
      marginBottom: 4,
    },
    eyebrow: {
      color: colors.gold,
      fontSize: 12,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      ...displayFont('700'),
    },
    title: {
      color: colors.text,
      fontSize: 30,
      lineHeight: 36,
      ...displayFont('800'),
    },
    body: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 340,
      ...bodyFont('400'),
    },
    hello: {
      marginTop: 2,
      color: colors.text,
      fontSize: 16,
      ...bodyFont('500'),
    },
    helloName: { ...displayFont('700'), color: colors.gold },
    interestGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 6,
    },
    interestCell: {
      width: '48%',
      flexGrow: 1,
      maxWidth: '48.5%',
    },
    interestCard: {
      height: 96,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: colors.cream,
    },
    interestCardOn: {
      borderColor: colors.gold,
    },
    interestScrim: {
      ...StyleSheet.absoluteFill,
    },
    interestMeta: {
      position: 'absolute',
      left: 10,
      right: 10,
      bottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    interestLabel: {
      flex: 1,
      color: colors.onAccent,
      fontSize: 13,
      ...bodyFont('700'),
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleCard: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleCardOn: {
      borderColor: colors.gold,
      backgroundColor: colors.selectSoft,
    },
    toggleIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleText: { flex: 1, gap: 2 },
    toggleTitle: { color: colors.text, fontSize: 15, ...bodyFont('700') },
    toggleSub: { color: colors.muted, fontSize: 12, ...bodyFont('400') },
    switchTrack: {
      width: 44,
      height: 26,
      borderRadius: 999,
      backgroundColor: colors.border,
      padding: 3,
      justifyContent: 'center',
    },
    switchTrackOn: { backgroundColor: colors.gold },
    switchThumb: {
      width: 20,
      height: 20,
      borderRadius: 999,
      backgroundColor: colors.white,
    },
    switchThumbOn: { alignSelf: 'flex-end' },
    footer: { gap: 14 },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: colors.border,
    },
    dotOn: {
      width: 18,
      backgroundColor: colors.gold,
    },
  });
}
