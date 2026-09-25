import { iosKeyboardAccessoryProps } from '@/components/KeyboardDismissBar';
import { BRAND_MARK } from '@/constants/brand';
import { MotionView, PressScale } from '@/components/motion';
import { Screen } from '@/components/ui';
import { bodyFont, displayFont, type AppColors, spacing } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { noZoomInputStyle } from '@/lib/noZoomInput';
import { keyboardScrollProps, useKeyboardAvoidProps } from '@/lib/keyboardAvoid';
import { softShadow } from '@/lib/shadow';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function AuthScreen({
  children,
  scroll = Platform.OS === 'web',
  footer,
}: {
  children: ReactNode;
  /** Sur web uniquement. iOS / Android = page intégrée (pas de défilement). */
  scroll?: boolean;
  footer?: ReactNode;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const kav = useKeyboardAvoidProps();
  const padBottom = Math.max(insets.bottom, 16);
  const useScroll = scroll && Platform.OS === 'web';

  const body = useScroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: padBottom + 12 }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      {...keyboardScrollProps()}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.integrated, { paddingBottom: padBottom }]}>{children}</View>
  );

  return (
    <Screen>
      <LinearGradient colors={[colors.cream, colors.bg, colors.bg]} style={styles.fill} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}>
        <View style={[styles.orb, styles.orbA, { backgroundColor: 'rgba(226,147,29,0.14)' }]} />
        <View style={[styles.orb, styles.orbB, { backgroundColor: 'rgba(200,75,49,0.08)' }]} />
        <KeyboardAvoidingView style={styles.fill} {...kav}>
          {body}
          {footer ? <View style={[styles.footerSlot, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </LinearGradient>
    </Screen>
  );
}

export function AuthBrand({
  title,
  subtitle,
  compact,
  skipSafePad,
}: {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  skipSafePad?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const padTop = skipSafePad ? (compact ? 4 : 16) : insets.top + (compact ? 8 : 28);

  return (
    <MotionView preset="down" index={0} style={[styles.brand, { paddingTop: padTop }]}>
      <View style={styles.markWrap}>
        <Image source={BRAND_MARK} style={compact ? styles.markSm : styles.mark} />
      </View>
      <Text style={styles.wordmark}>Marché Doré</Text>
      {title ? <Text style={styles.heroTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.heroSub}>{subtitle}</Text> : null}
    </MotionView>
  );
}

export function AuthField({
  label,
  error,
  secureToggle,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  secureToggle?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [secure, setSecure] = useState(Boolean(props.secureTextEntry));
  const isSecure = secureToggle ? secure : props.secureTextEntry;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
        <TextInput
          {...props}
          {...iosKeyboardAccessoryProps()}
          secureTextEntry={isSecure}
          placeholderTextColor={colors.placeholder}
          style={[styles.input, noZoomInputStyle, props.style]}
        />
        {secureToggle ? (
          <PressScale
            onPress={() => setSecure((v) => !v)}
            hitSlop={10}
            style={styles.eyeBtn}
            accessibilityRole="button"
            accessibilityLabel={secure ? 'Afficher le mot de passe' : 'Masquer le mot de passe'}>
            <Feather name={secure ? 'eye' : 'eye-off'} size={18} color={colors.muted} />
          </PressScale>
        ) : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function AuthPrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  compact,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const locked = disabled || loading;

  return (
    <PressScale
      style={[styles.primaryBtn, compact && styles.primaryBtnCompact, locked ? styles.primaryBtnDisabled : null]}
      onPress={onPress}
      disabled={locked}
      scaleTo={0.98}>
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Text style={[styles.primaryBtnText, compact && styles.primaryBtnTextCompact]}>{label}</Text>
      )}
    </PressScale>
  );
}

export function AuthGhostButton({
  label,
  onPress,
  compact,
}: {
  label: string;
  onPress: () => void;
  compact?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <PressScale style={[styles.ghostBtn, compact && styles.ghostBtnCompact]} onPress={onPress} scaleTo={0.98}>
      <Text style={[styles.ghostBtnText, compact && styles.ghostBtnTextCompact]}>{label}</Text>
    </PressScale>
  );
}

export function AuthLinkRow({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.linkRow}>
      <Text style={styles.linkPrompt}>{prompt}</Text>
      <PressScale onPress={onPress} hitSlop={8}>
        <Text style={styles.linkAction}>{action}</Text>
      </PressScale>
    </View>
  );
}

export function AuthErrorBanner({ message }: { message: string | null }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!message) return null;
  return (
    <MotionView preset="fade" style={styles.errorBanner}>
      <Feather name="alert-circle" size={16} color={colors.terracotta} />
      <Text style={styles.errorText}>{message}</Text>
    </MotionView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    fill: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.screen,
      gap: 18,
    },
    integrated: {
      flex: 1,
      paddingHorizontal: spacing.screen,
      gap: 10,
      justifyContent: 'flex-start',
    },
    footerSlot: {
      paddingHorizontal: spacing.screen,
      paddingTop: 8,
      gap: 10,
      backgroundColor: 'transparent',
    },
    orb: {
      position: 'absolute',
      borderRadius: 999,
    },
    orbA: {
      width: 220,
      height: 220,
      top: -40,
      right: -60,
    },
    orbB: {
      width: 180,
      height: 180,
      bottom: 80,
      left: -70,
    },
    brand: {
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    markWrap: {
      padding: 10,
      borderRadius: 22,
      backgroundColor: colors.white,
      ...softShadow({ y: 8, blur: 16, opacity: 0.1, elevation: 4 }),
    },
    mark: { width: 56, height: 56 },
    markSm: { width: 40, height: 40 },
    wordmark: {
      color: colors.gold,
      fontSize: 13,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      ...displayFont('700'),
    },
    heroTitle: {
      color: colors.text,
      fontSize: 28,
      textAlign: 'center',
      lineHeight: 34,
      marginTop: 6,
      ...displayFont('800'),
    },
    heroSub: {
      color: colors.muted,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 320,
      ...bodyFont('400'),
    },
    field: { gap: 7 },
    fieldLabel: {
      color: colors.muted,
      fontSize: 12,
      letterSpacing: 0.3,
      ...bodyFont('600'),
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      minHeight: 52,
    },
    inputWrapError: {
      borderColor: colors.terracotta,
    },
    input: {
      flex: 1,
      color: colors.text,
      paddingVertical: Platform.OS === 'web' ? 14 : 12,
      ...bodyFont('500'),
    },
    eyeBtn: { padding: 4 },
    fieldError: {
      color: colors.terracotta,
      fontSize: 12,
      ...bodyFont('500'),
    },
    primaryBtn: {
      backgroundColor: colors.gold,
      borderRadius: 16,
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    primaryBtnCompact: { minHeight: 48, borderRadius: 14 },
    primaryBtnDisabled: { opacity: 0.55 },
    primaryBtnText: {
      color: colors.onAccent,
      fontSize: 16,
      ...displayFont('700'),
    },
    primaryBtnTextCompact: { fontSize: 15 },
    ghostBtn: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    ghostBtnCompact: { minHeight: 46, borderRadius: 14 },
    ghostBtnText: {
      color: colors.text,
      fontSize: 15,
      ...bodyFont('600'),
    },
    ghostBtnTextCompact: { fontSize: 14 },
    linkRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      paddingVertical: 4,
    },
    linkPrompt: { color: colors.muted, fontSize: 14, ...bodyFont('400') },
    linkAction: { color: colors.gold, fontSize: 14, ...bodyFont('700') },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.blush,
      borderRadius: 14,
      padding: 12,
    },
    errorText: {
      flex: 1,
      color: colors.terracotta,
      fontSize: 13,
      lineHeight: 18,
      ...bodyFont('500'),
    },
  });
}
