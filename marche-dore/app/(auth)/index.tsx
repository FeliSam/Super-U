import { AuthGhostButton, AuthPrimaryButton } from '@/components/auth/AuthUI';
import { MotionView, PressScale } from '@/components/motion';
import { Screen } from '@/components/ui';
import { BRAND_MARK } from '@/constants/brand';
import { bodyFont, displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HERO_IMG = require('../../assets/images/catalog/mango-hero.png');

const HIGHLIGHTS = [
  { icon: 'truck' as const, title: 'Livraison' },
  { icon: 'shield' as const, title: 'Paiement' },
  { icon: 'heart' as const, title: 'Sélection' },
];

export default function WelcomeScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const heroH = Math.max(280, Math.round(windowHeight * 0.58));

  return (
    <Screen>
      <View style={styles.root}>
        <View style={[styles.hero, { height: heroH }]}>
          <Image source={HERO_IMG} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(20,17,15,0.15)', 'rgba(20,17,15,0.08)', 'rgba(20,17,15,0.72)']}
            locations={[0, 0.42, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroTop, { paddingTop: insets.top + 12 }]}>
            <View style={styles.markPill}>
              <Image source={BRAND_MARK} style={styles.mark} />
              <Text style={styles.brand}>Marché Doré</Text>
            </View>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Cotonou · Bénin</Text>
            <Text style={styles.title}>Vos courses,{'\n'}avec élégance.</Text>
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <MotionView preset="up" index={0}>
            <Text style={styles.sub}>Compte, livraisons et fidélité — en un geste.</Text>
          </MotionView>
          <MotionView preset="up" index={1} style={styles.actions}>
            <AuthPrimaryButton compact label="Créer un compte" onPress={() => router.push('/(auth)/signup')} />
            <AuthGhostButton compact label="Se connecter" onPress={() => router.push('/(auth)/login')} />
            <PressScale onPress={() => router.push('/(auth)/login')} hitSlop={8}>
              <Text style={styles.demoHint}>Accès démo · se connecter</Text>
            </PressScale>
          </MotionView>
          <View style={styles.highlights}>
            {HIGHLIGHTS.map((item, i) => (
              <MotionView key={item.title} preset="up" index={i + 2} style={styles.highlight}>
                <View style={styles.highlightIcon}>
                  <Feather name={item.icon} size={15} color={colors.gold} />
                </View>
                <Text style={styles.highlightTitle}>{item.title}</Text>
              </MotionView>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    hero: {
      width: '100%',
      overflow: 'hidden',
      backgroundColor: '#1c1613',
    },
    heroImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    heroTop: {
      position: 'absolute',
      top: 0,
      left: 16,
      right: 16,
      zIndex: 2,
    },
    markPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(255,255,255,0.88)',
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.95)',
    },
    mark: { width: 28, height: 28 },
    brand: {
      color: colors.text,
      fontSize: 14,
      ...displayFont('700'),
    },
    heroCopy: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 28,
      gap: 8,
    },
    heroKicker: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      ...bodyFont('600'),
    },
    title: {
      color: '#ffffff',
      fontSize: 36,
      lineHeight: 42,
      ...displayFont('800'),
    },
    sheet: {
      flex: 1,
      justifyContent: 'flex-start',
      gap: 11,
      paddingHorizontal: 20,
      paddingTop: 15,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      marginTop: -22,
    },
    sub: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      ...bodyFont('400'),
    },
    actions: { gap: 9 },
    demoHint: {
      textAlign: 'center',
      color: colors.placeholder,
      fontSize: 12,
      marginTop: 0,
      ...bodyFont('500'),
    },
    highlights: { flexDirection: 'row', gap: 8, marginTop: 2 },
    highlight: {
      flex: 1,
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.white,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    highlightIcon: {
      width: 29,
      height: 29,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cream,
    },
    highlightTitle: {
      color: colors.text,
      fontSize: 11,
      textAlign: 'center',
      ...bodyFont('700'),
    },
  });
}
