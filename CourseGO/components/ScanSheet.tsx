import { PillButton } from '@/components/ui';
import { ProductThumb } from '@/components/ProductThumb';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import type { OrderLine } from '@/lib/api/ops';
import { productBarcode } from '@/lib/productMedia';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export function lineBarcode(line: OrderLine) {
  return (line.barcode ?? '').trim() || productBarcode(line.product_id);
}

export function matchesScan(line: OrderLine, code: string) {
  const c = code.trim().toLowerCase();
  if (!c) return false;
  const id = (line.product_id ?? '').toLowerCase();
  const name = (line.name ?? '').toLowerCase();
  const barcode = lineBarcode(line).toLowerCase();
  return c === id || id.endsWith(c) || c === name || name.includes(c) || c === barcode;
}

export function ScanSheet({
  line,
  visible,
  onClose,
  onScanned,
}: {
  line: OrderLine | null;
  visible: boolean;
  onClose: () => void;
  onScanned: (line: OrderLine) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && line) {
      setCode(lineBarcode(line));
      setError('');
    }
  }, [visible, line?.product_id, line?.barcode]);

  if (!line) return null;

  const submit = (raw: string) => {
    const typed = raw.trim();
    if (typed && !matchesScan(line, typed)) {
      setError('Code ne correspond pas à ce produit.');
      return;
    }
    onScanned(line);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>SCANNER</Text>
          <View style={styles.hero}>
            <ProductThumb productId={line.product_id} name={line.name} size={88} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{line.name}</Text>
              <Text style={styles.qty}>
                {line.qty} × {line.unit ?? 'u'}
              </Text>
            </View>
          </View>
          <Text style={styles.hint}>Code-barres prérempli. Validez le scan ou corrigez-le.</Text>
          <TextInput
            autoFocus
            selectTextOnFocus
            style={styles.input}
            placeholder="Code-barres / référence"
            placeholderTextColor={colors.placeholder}
            value={code}
            onChangeText={(t) => {
              setCode(t);
              setError('');
            }}
            onSubmitEditing={() => submit(code)}
            returnKeyType="done"
            keyboardType="number-pad"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PillButton label="VALIDER LE SCAN" onPress={() => submit(code)} />
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Annuler</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: 24,
    gap: 12,
    ...shadow.tabBar,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  kicker: { ...displayFont('800'), fontSize: 12, color: colors.teal, letterSpacing: 1 },
  hero: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  title: { ...displayFont('800'), fontSize: 20, color: colors.text },
  qty: { ...bodyFont('700'), fontSize: 15, color: colors.teal, marginTop: 4 },
  hint: { ...bodyFont('400'), fontSize: 14, color: colors.muted },
  input: {
    ...bodyFont('600'),
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    letterSpacing: 0.4,
  },
  error: { ...bodyFont('600'), color: colors.coral, fontSize: 13 },
  cancel: { ...displayFont('700'), textAlign: 'center', color: colors.muted, paddingVertical: 8 },
});
