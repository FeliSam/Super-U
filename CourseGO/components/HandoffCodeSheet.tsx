import { KeyboardDismissBar } from '@/components/KeyboardDismissBar';
import { PhoneModalFrame } from '@/components/PhoneShell';
import { PillButton } from '@/components/ui';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { keyboardScrollProps, useKeyboardAvoidProps } from '@/lib/keyboardAvoid';
import { useRef, useState, type RefObject } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function HandoffCodeSheet({
  visible,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (code: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const kav = useKeyboardAvoidProps();
  const [cells, setCells] = useState(['', '', '', '']);
  const refs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  const setCell = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length > 1) {
      const next = ['', '', '', ''];
      digits.slice(0, 4).split('').forEach((ch, i) => {
        next[i] = ch;
      });
      setCells(next);
      refs[Math.min(3, digits.length)]?.current?.focus();
      return;
    }
    const ch = digits.slice(-1);
    setCells((prev) => {
      const next = [...prev];
      next[index] = ch;
      return next;
    });
    if (ch && index < 3) refs[index + 1]?.current?.focus();
  };

  const onKey = (index: number, key: string) => {
    if (key !== 'Backspace') return;
    if (cells[index]) {
      setCells((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }
    if (index > 0) {
      refs[index - 1]?.current?.focus();
      setCells((prev) => {
        const next = [...prev];
        next[index - 1] = '';
        return next;
      });
    }
  };

  const close = () => {
    Keyboard.dismiss();
    setCells(['', '', '', '']);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent>
      <KeyboardAvoidingView style={styles.avoid} {...kav}>
        <PhoneModalFrame onDismiss={close}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Je remets le colis</Text>
            <Text style={styles.sub}>Demandez au client les 4 chiffres affichés dans Marché Doré.</Text>
            <ScrollView
              {...keyboardScrollProps()}
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}>
              <View style={styles.row}>
                {cells.map((dgt, i) => (
                  <TextInput
                    key={i}
                    ref={refs[i] as RefObject<TextInput>}
                    value={dgt}
                    onChangeText={(t) => setCell(i, t)}
                    onKeyPress={({ nativeEvent }) => onKey(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={i === 0 ? 4 : 1}
                    selectTextOnFocus
                    autoFocus={i === 0}
                    style={[styles.box, dgt ? styles.boxOn : null]}
                    accessibilityLabel={`Chiffre ${i + 1} sur 4`}
                  />
                ))}
              </View>
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <PillButton
                label={busy ? '…' : 'Valider la remise'}
                onPress={() => {
                  Keyboard.dismiss();
                  onSubmit(cells.join(''));
                }}
                disabled={busy}
              />
              <Pressable onPress={close} style={styles.cancel}>
                <Text style={styles.cancelTxt}>Annuler</Text>
              </Pressable>
            </ScrollView>
          </View>
        </PhoneModalFrame>
        <KeyboardDismissBar />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avoid: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
    zIndex: 2,
    maxHeight: '92%',
    ...shadow.tabBar,
  },
  scrollBody: { gap: 12, paddingBottom: 4 },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.placeholder,
    marginBottom: 4,
  },
  title: { ...displayFont('900'), fontSize: 22, color: colors.text },
  sub: { ...bodyFont('400'), fontSize: 15, color: colors.muted, lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginVertical: 4 },
  box: {
    width: 62,
    height: 72,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    ...displayFont('900'),
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
  },
  boxOn: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  err: { ...bodyFont('600'), color: colors.danger, textAlign: 'center' },
  cancel: { alignItems: 'center', paddingVertical: 8 },
  cancelTxt: { ...bodyFont('700'), color: colors.muted },
});
