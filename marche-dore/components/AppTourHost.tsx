import { useAppTour } from '@/context/AppTourContext';
import { bodyFont, displayFont, liquidIce, type AppColors } from '@/constants/theme';
import { useColors, useTheme } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPrimaryButton } from '@/components/auth/AuthUI';
import { PressScale } from '@/components/motion';

export function AppTourHost() {
  const colors = useColors();
  const { scheme } = useTheme();
  const ice = useMemo(() => liquidIce(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors, ice), [colors, ice]);
  const insets = useSafeAreaInsets();
  const { active, step, stepIndex, total, next, skip } = useAppTour();

  if (!active || !step) return null;

  const last = stepIndex === total - 1;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View entering={Platform.OS === 'web' ? undefined : FadeIn.duration(220)} style={styles.dim} />
      <Pressable style={StyleSheet.absoluteFill} onPress={next} accessibilityLabel="Étape suivante" />
      <Animated.View
        entering={Platform.OS === 'web' ? undefined : FadeInDown.duration(280)}
        style={[styles.card, { marginBottom: Math.max(insets.bottom, 12) + 78 }]}>
        <View style={styles.cardTop}>
          <View style={styles.iconWrap}>
            <Feather name={step.icon} size={18} color={colors.gold} />
          </View>
          <Text style={styles.progress}>
            {stepIndex + 1}/{total}
          </Text>
          <PressScale onPress={skip} hitSlop={10}>
            <Text style={styles.skip}>Passer</Text>
          </PressScale>
        </View>
        <Text style={styles.eyebrow}>{step.eyebrow}</Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
        <AuthPrimaryButton compact label={last ? 'C’est parti' : 'Continuer'} onPress={next} />
      </Animated.View>
    </View>
  );
}

function createStyles(colors: AppColors, ice: ReturnType<typeof liquidIce>) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
    },
    dim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(20, 16, 14, 0.46)',
    },
    card: {
      zIndex: 1,
      gap: 8,
      borderRadius: 24,
      padding: 18,
      backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.88)' : colors.white,
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
            shadowOpacity: 0.16,
            shadowRadius: 24,
            elevation: 8,
          }),
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cream,
    },
    progress: {
      flex: 1,
      color: colors.muted,
      fontSize: 13,
      ...bodyFont('700'),
    },
    skip: {
      color: colors.muted,
      fontSize: 13,
      ...bodyFont('600'),
    },
    eyebrow: {
      color: colors.gold,
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      ...bodyFont('700'),
    },
    title: {
      color: colors.text,
      fontSize: 22,
      lineHeight: 26,
      ...displayFont('800'),
    },
    body: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 6,
      ...bodyFont('400'),
    },
  });
}
