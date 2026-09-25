import { MOBILE_FRAME_MAX, spacing } from '@/constants/theme';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

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
  const [kbInset, setKbInset] = useState(0);

  useEffect(() => {
    if (align !== 'bottom') return;

    // Web / preview navigateur
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const vv = window.visualViewport;
      if (!vv) return;
      const sync = () => {
        const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setKbInset(covered > 48 ? covered : 0);
      };
      vv.addEventListener('resize', sync);
      vv.addEventListener('scroll', sync);
      sync();
      return () => {
        vv.removeEventListener('resize', sync);
        vv.removeEventListener('scroll', sync);
      };
    }

    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => {
      setKbInset(Math.max(0, e.endCoordinates.height));
    });
    const hide = Keyboard.addListener(hideEvt, () => setKbInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [align]);

  return (
    <View style={styles.modalStage}>
      <Pressable style={[StyleSheet.absoluteFill, styles.modalDim]} onPress={onDismiss} />
      <View
        style={[
          styles.modalPhone,
          align === 'center' && styles.modalPhoneCenter,
          align === 'fill' && styles.modalPhoneFill,
          align === 'bottom' && kbInset > 0 ? { paddingBottom: kbInset } : null,
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
