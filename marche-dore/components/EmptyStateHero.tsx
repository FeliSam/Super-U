import { MotionView, PressScale } from '@/components/motion';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type FeatherName = ComponentProps<typeof Feather>['name'];

export type EmptyPerk = {
  icon: FeatherName;
  label: string;
  color?: string;
};

type EmptyStateHeroProps = {
  icon: FeatherName;
  badge?: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryIcon?: FeatherName;
  onPrimary: () => void;
  secondaryLabel?: string;
  secondaryIcon?: FeatherName;
  onSecondary?: () => void;
  perks?: EmptyPerk[];
  footer?: ReactNode;
};

export function EmptyStateHero({
  icon,
  badge = 'Marché Doré',
  title,
  subtitle,
  primaryLabel,
  primaryIcon = 'compass',
  onPrimary,
  secondaryLabel,
  secondaryIcon = 'arrow-right',
  onSecondary,
  perks,
  footer,
}: EmptyStateHeroProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <MotionView preset="up" delay={40} style={styles.heroCard}>
        <MotionView preset="zoom" delay={80} style={styles.art}>
          <View style={styles.blobA} />
          <View style={styles.blobB} />
          <View style={styles.iconRing}>
            <Feather name={icon} size={34} color={colors.terracotta} />
          </View>
          <View style={styles.badge}>
            <Feather name="sun" size={12} color={colors.gold} />
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        </MotionView>
        <MotionView preset="up" delay={140}>
          <Text style={styles.title}>{title}</Text>
        </MotionView>
        <MotionView preset="up" delay={180}>
          <Text style={styles.sub}>{subtitle}</Text>
        </MotionView>
        <MotionView preset="up" delay={220} style={styles.ctaMotion}>
          <PressScale style={styles.cta} onPress={onPrimary} scaleTo={0.97}>
            <LinearGradient
              colors={['#c84b31', '#a83c26']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}>
              <Feather name={primaryIcon} size={16} color={colors.onAccent} />
              <Text style={styles.ctaText}>{primaryLabel}</Text>
            </LinearGradient>
          </PressScale>
        </MotionView>
        {secondaryLabel && onSecondary ? (
          <MotionView preset="fade" delay={280}>
            <Pressable
              style={styles.secondary}
              onPress={onSecondary}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={secondaryLabel}>
              <Feather name={secondaryIcon} size={15} color={colors.gold} />
              <Text style={styles.secondaryText}>{secondaryLabel}</Text>
            </Pressable>
          </MotionView>
        ) : null}
      </MotionView>

      {perks && perks.length > 0 ? (
        <View style={styles.perks}>
          {perks.map((perk, i) => (
            <MotionView key={perk.label} preset="up" delay={300 + i * 60} style={styles.perkMotion}>
              <View style={styles.perk}>
                <Feather name={perk.icon} size={15} color={perk.color ?? colors.gold} />
                <Text style={styles.perkText}>{perk.label}</Text>
              </View>
            </MotionView>
          ))}
        </View>
      ) : null}

      {footer}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: { gap: 18 },
    heroCard: {
      backgroundColor: colors.white,
      borderRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 28,
      paddingBottom: 24,
      alignItems: 'center',
      gap: 12,
    },
    art: {
      width: 140,
      height: 120,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    blobA: {
      position: 'absolute',
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.cream,
      top: 8,
      left: 8,
      opacity: 0.9,
    },
    blobB: {
      position: 'absolute',
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.blush,
      bottom: 6,
      right: 10,
      opacity: 0.85,
    },
    iconRing: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    badge: {
      position: 'absolute',
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.white,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeText: { color: colors.gold, fontSize: 11, fontWeight: '800' },
    title: {
      ...displayFont('700'),
      color: colors.text,
      fontSize: 24,
      lineHeight: 30,
      textAlign: 'center',
      marginTop: 4,
    },
    sub: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      maxWidth: 300,
      marginBottom: 4,
    },
    cta: { alignSelf: 'stretch', borderRadius: 16, overflow: 'hidden', marginTop: 4 },
    ctaMotion: { alignSelf: 'stretch', width: '100%' },
    ctaGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
      paddingHorizontal: 18,
      minHeight: 48,
    },
    ctaText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
    secondary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      minHeight: 44,
    },
    secondaryText: { color: colors.gold, fontSize: 14, fontWeight: '600' },
    perks: { flexDirection: 'row', gap: 8 },
    perkMotion: { flex: 1 },
    perk: {
      flex: 1,
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 6,
    },
    perkText: { color: colors.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  });
}
