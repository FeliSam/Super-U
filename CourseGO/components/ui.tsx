import { colors, displayFont, bodyFont } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 8) }, style]}>{children}</View>
  );
}

export function PillButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        variant === 'primary' && styles.pillPrimary,
        variant === 'ghost' && styles.pillGhost,
        variant === 'danger' && styles.pillDanger,
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}>
      <Text
        style={[
          styles.pillText,
          variant === 'ghost' && { color: colors.muted },
          variant === 'danger' && { color: colors.danger },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  secureToggle,
  ...props
}: TextInputProps & { label: string; secureToggle?: boolean }) {
  const [hidden, setHidden] = useState(!!props.secureTextEntry);
  return (
    <View style={{ gap: 8, width: '100%' }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={colors.placeholder}
          style={[styles.input, secureToggle && { paddingRight: 48, borderWidth: 0 }]}
          {...props}
          secureTextEntry={secureToggle ? hidden : props.secureTextEntry}
        />
        {secureToggle ? (
          <Pressable style={styles.eye} onPress={() => setHidden((v) => !v)} accessibilityLabel={hidden ? 'Afficher le mot de passe' : 'Masquer le mot de passe'}>
            <Feather name={hidden ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function IconBtn({
  name,
  onPress,
  size = 44,
  bg = colors.bg,
  badge,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  size?: number;
  bg?: string;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Feather name={name} size={20} color={colors.text} />
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pill: {
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pillPrimary: {
    backgroundColor: colors.teal,
    shadowColor: colors.teal,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  pillGhost: { backgroundColor: colors.bg },
  pillDanger: { backgroundColor: colors.dangerSoft },
  pillText: { ...displayFont('800'), color: colors.onAccent, fontSize: 16 },
  fieldLabel: { ...displayFont('700'), color: colors.muted, fontSize: 13, letterSpacing: 0.4 },
  inputWrap: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  input: {
    ...bodyFont('400'),
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eye: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { ...bodyFont('800'), fontSize: 9, color: colors.onAccent },
});
