import { Platform } from 'react-native';

/**
 * KeyboardAvoidingView : remonte le contenu sans bande vide.
 * Offset 0 — un offset safe-area crée souvent un trou au-dessus du clavier.
 */
export function useKeyboardAvoidProps(_extraOffset = 0) {
  return {
    behavior: (Platform.OS === 'ios' ? 'padding' : undefined) as 'padding' | undefined,
    keyboardVerticalOffset: 0,
  };
}

/** ScrollView : taps + dismiss, sans insets clavier (évite le double espace avec KAV). */
export function keyboardScrollProps() {
  return {
    keyboardShouldPersistTaps: 'handled' as const,
    keyboardDismissMode: (Platform.OS === 'ios' ? 'interactive' : 'on-drag') as
      | 'interactive'
      | 'on-drag',
    automaticallyAdjustKeyboardInsets: false,
  };
}
