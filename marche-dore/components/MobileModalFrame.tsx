import { MOBILE_FRAME_MAX, spacing } from '@/constants/theme';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

/** Cadre 430 px pour Modal RN Web (sinon feuilles et cartes s’étalent sur tout l’écran). */
export function MobileModalFrame({
  children,
  align = 'bottom',
  onDismiss,
}: {
  children: ReactNode;
  align?: 'bottom' | 'center' | 'fill';
  onDismiss?: () => void;
}) {
  return (
    <View style={styles.modalStage}>
      <Pressable style={[StyleSheet.absoluteFill, styles.modalDim]} onPress={onDismiss} />
      <View
        style={[
          styles.modalPhone,
          align === 'center' && styles.modalPhoneCenter,
          align === 'fill' && styles.modalPhoneFill,
        ]}
        pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalStage: {
    flex: 1,
    alignItems: 'center',
  },
  modalDim: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalPhone: {
    width: '100%',
    maxWidth: MOBILE_FRAME_MAX,
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalPhoneCenter: {
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
  },
  modalPhoneFill: {
    justifyContent: 'flex-start',
    position: 'relative',
  },
});
