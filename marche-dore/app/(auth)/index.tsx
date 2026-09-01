import { AuthGhostButton, AuthPrimaryButton, AuthScreen } from '@/components/auth/AuthUI';
import { MotionView, PressScale } from '@/components/motion';
import { bodyFont, displayFont, type AppColors, spacing } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND_MARK = require('../../assets/images/brand-mark.png');
const HERO_IMG = require('../../assets/images/catalog/mango-hero.png');

const HIGHLIGHTS = [
  { icon: 'truck' as const, title: 'Livraison express', copy: 'Frais du marché jusqu’à chez vous.' },
  { icon: 'shield' as const, title: 'Paiement local', copy: 'Mobile Money & espèces à la livraison.' },
  { icon: 'heart' as const, title: 'Sélection soignée', copy: 'Produits frais, cuisine & glaces.' },
];

export default function WelcomeScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  return (
    <AuthScreen scroll={false}>
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <MotionView preset="zoom" index={0} style={styles.heroBlock}>
          <View style={styles.markPill}>
            <Image source={BRAND_MARK} style={styles.mark} />
            <Text style={styles.brand}>Marché Doré</Text>
          </View>
          <View style={styles.heroVisual}>
            <Image source={HERO_IMG} style={styles.heroImage} resizeMode="cover" />
            <View style={styles.heroScrim} />
            <Text style={styles.heroKicker}>Cotonou · Bénin</Text>
          </View>
          <Text style={styles.title}>Vos courses,{'\n'}avec élégance.</Text>
          <Text style={styles.sub}>
            Créez votre compte ou connectez-vous pour commander, suivre vos livraisons et cumuler des points fidélité.
          </Text>
        </MotionView>

        <View style={styles.highlights}>
          {HIGHLIGHTS.map((item, i) => (
            <MotionView key={item.title} preset="up" index={i + 1} style={styles.highlight}>
              <View style={styles.highlightIcon}>
                <Feather name={item.icon} size={16} color={colors.gold} />
              </View>
              <View style={styles.highlightText}>
                <Text style={styles.highlightTitle}>{item.title}</Text>
                <Text style={styles.highlightCopy}>{item.copy}</Text>
              </View>
            </MotionView>
          ))}
        </View>

        <MotionView preset="up" index={4} style={styles.actions}>
          <AuthPrimaryButton label="Créer un compte" onPress={() => router.push('/(auth)/signup')} />
          <AuthGhostButton label="Se connecter" onPress={() => router.push('/(auth)/login')} />
          <PressScale onPress={() => router.push('/(auth)/login')} hitSlop={8}>
            <Text style={styles.demoHint}>Déjà un accès démo ? Connectez-vous en 1 tap</Text>
          </PressScale>
        </MotionView>
      </View>
    </AuthScreen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      paddingHorizontal: spacing.screen,
      justifyContent: 'space-between',
      gap: 18,
    },
    heroBlock: { gap: 14 },
    markPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.white,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mark: { width: 28, height: 28 },
    brand: {
      color: colors.text,
      fontSize: 14,
      ...displayFont('700'),
    },
    heroVisual: {
      height: 168,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.cream,
    },
    heroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
    heroScrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(28,22,19,0.18)',
    },
    heroKicker: {
      position: 'absolute',
      left: 14,
      bottom: 12,
      color: colors.onAccent,
      fontSize: 12,
      letterSpacing: 0.4,
      ...bodyFont('600'),
    },
    title: {
      color: colors.text,
      fontSize: 34,
      lineHeight: 40,
      ...displayFont('800'),
    },
    sub: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
      ...bodyFont('400'),
    },
    highlights: { gap: 10 },
    highlight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    highlightIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cream,
    },
    highlightText: { flex: 1, gap: 2 },
    highlightTitle: { color: colors.text, fontSize: 14, ...bodyFont('700') },
    highlightCopy: { color: colors.muted, fontSize: 12, lineHeight: 17, ...bodyFont('400') },
    actions: { gap: 10 },
    demoHint: {
      textAlign: 'center',
      color: colors.placeholder,
      fontSize: 12,
      marginTop: 2,
      ...bodyFont('500'),
    },
  });
}
