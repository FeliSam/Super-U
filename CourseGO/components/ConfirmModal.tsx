import { PhoneModalFrame } from '@/components/PhoneShell';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityLabel={`${n} étoiles`}>
          <Feather name="star" size={28} color={n <= value ? colors.amber : colors.border} />
        </Pressable>
      ))}
    </View>
  );
}

export function ConfirmModal({
  visible,
  title,
  body,
  children,
  icon,
  danger,
  cancelLabel = 'Annuler',
  confirmLabel = 'Confirmer',
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  body?: string;
  children?: ReactNode;
  icon?: ComponentProps<typeof Feather>['name'];
  danger?: boolean;
  cancelLabel?: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <PhoneModalFrame align="center" onDismiss={onCancel}>
        <View style={styles.card}>
          {icon ? (
            <View style={[styles.iconWrap, danger ? styles.iconDanger : styles.iconTeal]}>
              <Feather name={icon} size={26} color={danger ? colors.danger : colors.teal} />
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          {children}
          <View style={styles.actions}>
            <Pressable style={styles.ghost} onPress={onCancel} disabled={busy}>
              <Text style={styles.ghostTxt}>{cancelLabel}</Text>
            </Pressable>
            {onConfirm ? (
              <Pressable
                style={[styles.ok, danger && styles.okDanger, busy && { opacity: 0.6 }]}
                onPress={onConfirm}
                disabled={busy}>
                <Text style={styles.okTxt}>{busy ? '…' : confirmLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </PhoneModalFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 24,
    gap: 10,
    alignItems: 'stretch',
    ...shadow.tabBar,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  iconTeal: { backgroundColor: colors.tealSoft },
  iconDanger: { backgroundColor: colors.dangerSoft },
  title: { ...displayFont('800'), fontSize: 20, color: colors.text, textAlign: 'center' },
  body: { ...bodyFont('500'), fontSize: 15, color: colors.muted, lineHeight: 22, textAlign: 'center' },
  stars: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  ghost: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostTxt: { ...displayFont('700'), fontSize: 14, color: colors.muted },
  ok: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.teal,
    paddingVertical: 14,
    alignItems: 'center',
  },
  okDanger: { backgroundColor: colors.danger },
  okTxt: { ...displayFont('800'), fontSize: 14, color: colors.onAccent },
});
