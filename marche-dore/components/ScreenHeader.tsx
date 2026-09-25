import { IconCircle } from '@/components/ui';
import { displayFont, spacing, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { goBack } from '@/lib/navigation';
import { type ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Padding haut sous notch / Dynamic Island (0 sur web). */
export function useHeaderPadTop(extra = 6) {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'web') return Math.max(8, extra);
  // iPhone : insets.top (~47–59) + petite marge ; évite le titre collé sous le status bar
  return Math.max(insets.top + extra, 12);
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const padTop = useHeaderPadTop();

  return (
    <View style={[styles.header, { paddingTop: padTop }]}>
      <View style={styles.side}>
        <IconCircle name="chevron-left" onPress={onBack ?? (() => goBack())} />
      </View>
      {subtitle ? (
        <View style={styles.center}>
          <Text style={styles.titleInCenter} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      ) : (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      )}
      <View style={styles.side}>{right ?? <View style={styles.spacer} />}</View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: spacing.screen,
      paddingBottom: 10,
      minHeight: 44,
      backgroundColor: colors.bg,
    },
    side: {
      width: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: { flex: 1, alignItems: 'center', minWidth: 0 },
    title: {
      flex: 1,
      textAlign: 'center',
      color: colors.text,
      fontSize: 17,
      lineHeight: 22,
      ...displayFont('700'),
    },
    titleInCenter: {
      textAlign: 'center',
      color: colors.text,
      fontSize: 17,
      lineHeight: 22,
      ...displayFont('700'),
    },
    sub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 1, textAlign: 'center' },
    spacer: { width: 40, height: 40 },
  });
}
