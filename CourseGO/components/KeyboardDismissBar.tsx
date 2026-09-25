import { colors } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

/** Conservé pour compat imports. */
export const IOS_KEYBOARD_ACCESSORY_ID = 'coursego.keyboard.dismiss';

/** No-op : pas d’InputAccessoryView (prend de la place). Chevron flottant à la place. */
export function iosKeyboardAccessoryProps(): Record<string, never> {
  return {};
}

/**
 * Chevron flottant en position absolue, juste au-dessus du clavier.
 * Ne réserve aucun espace dans le layout.
 */
export function KeyboardDismissBar() {
  /** Distance du bas de l’écran jusqu’au haut du clavier ; null = fermé. */
  const [kbTopFromBottom, setKbTopFromBottom] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const vv = window.visualViewport;
      if (!vv) return;
      const sync = () => {
        const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setKbTopFromBottom(covered > 48 ? covered : null);
      };
      vv.addEventListener('resize', sync);
      vv.addEventListener('scroll', sync);
      return () => {
        vv.removeEventListener('resize', sync);
        vv.removeEventListener('scroll', sync);
      };
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates: { height: number } }) => {
      // iOS : coller au-dessus du clavier. Android (resize) : bas de la zone visible.
      setKbTopFromBottom(Platform.OS === 'ios' ? Math.max(0, e.endCoordinates.height) : 0);
    };
    const onHide = () => setKbTopFromBottom(null);
    const onFrame = (e: { endCoordinates: { height: number } }) => {
      if (Platform.OS !== 'ios') return;
      const h = e.endCoordinates.height;
      setKbTopFromBottom(h > 40 ? h : null);
    };

    const show = Keyboard.addListener(showEvent, onShow);
    const hide = Keyboard.addListener(hideEvent, onHide);
    const frame =
      Platform.OS === 'ios' ? Keyboard.addListener('keyboardWillChangeFrame', onFrame) : null;

    return () => {
      show.remove();
      hide.remove();
      frame?.remove();
    };
  }, []);

  if (kbTopFromBottom == null) return null;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Pressable
        style={[styles.btn, { bottom: kbTopFromBottom }]}
        onPress={() => Keyboard.dismiss()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Fermer le clavier">
        <Feather name="chevron-down" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10050,
    elevation: 10050,
  },
  btn: {
    position: 'absolute',
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});
