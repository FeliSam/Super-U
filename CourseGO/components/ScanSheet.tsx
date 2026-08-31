import { PillButton } from '@/components/ui';
import { ProductThumb } from '@/components/ProductThumb';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { ApiError } from '@/lib/api/http';
import { fetchProductByBarcode, type OrderLine } from '@/lib/api/ops';
import { productBarcode } from '@/lib/productMedia';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
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
  onMissing,
  lines = [],
  storeId,
}: {
  line: OrderLine | null;
  visible: boolean;
  onClose: () => void;
  onScanned: (line: OrderLine) => void;
  onMissing?: (line: OrderLine) => void;
  lines?: OrderLine[];
  storeId?: string | null;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [mode, setMode] = useState<'camera' | 'type'>('type');
  const [permission, requestPermission] = useCameraPermissions();
  const lock = useRef(false);

  useEffect(() => {
    if (visible && line) {
      setCode(lineBarcode(line));
      setError('');
      setMode('type');
      lock.current = false;
    }
  }, [visible, line?.product_id, line?.picked_qty]);

  if (!line) return null;

  const identifyMismatch = async (raw: string) => {
    const otherLine = lines.find((candidate) => candidate.product_id !== line.product_id && matchesScan(candidate, raw));
    if (otherLine) {
      setError(`Ce code appartient à « ${otherLine.name} », une autre ligne de la commande.`);
      return;
    }
    if (!/^\d{8}$|^\d{12,14}$/.test(raw)) {
      setError('Ce code ne correspond pas à ce produit.');
      return;
    }
    setChecking(true);
    try {
      const result = await fetchProductByBarcode(raw, storeId);
      const matchingOrderLine = lines.find((candidate) => candidate.product_id === result.product.id);
      if (matchingOrderLine) {
        setError(`Ce code appartient à « ${matchingOrderLine.name} », une autre ligne de la commande.`);
      } else {
        const payloadName =
          typeof result.product.payload.name === 'string' ? result.product.payload.name : result.product.sku;
        setError(`« ${payloadName} » n’est pas demandé dans cette commande. Aucun article ramassé.`);
      }
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? 'Code-barres inconnu du catalogue. Aucun article ramassé.'
          : e instanceof ApiError
            ? e.message
            : 'Impossible de vérifier ce code-barres.',
      );
    } finally {
      setChecking(false);
    }
  };

  const submit = async (raw: string) => {
    const typed = raw.trim();
    if (!typed) {
      setError('Scannez ou saisissez le code.');
      return;
    }
    if (!matchesScan(line, typed)) {
      await identifyMismatch(typed);
      return;
    }
    onScanned(line);
  };

  const onBar = async ({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;
    if (matchesScan(line, data)) {
      onScanned(line);
      return;
    }
    setCode(data);
    setMode('type');
    await identifyMismatch(data.trim());
    lock.current = false;
  };

  const picked = Math.min(line.picked_qty ?? 0, line.qty);
  const remaining = Math.max(0, line.qty - picked);
  const licenseName = line.image?.licenseName ?? line.image?.license_name;
  const attribution = line.image?.attribution;
  const placeholder = line.image?.placeholder ?? line.image?.is_placeholder;
  const imageCredit = placeholder === true ? null : attribution || licenseName;
  const lotNumber = line.lot?.number ?? line.lot?.batchNumber ?? line.lot_number ?? line.batch_number;
  const expiryDate =
    line.lot?.expiryDate ?? line.lot?.bestBeforeDate ?? line.expiry_date ?? line.best_before_date;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>SCANNER</Text>
          <View style={styles.hero}>
            <ProductThumb
              productId={line.product_id}
              name={line.name}
              categoryId={line.category_id}
              imageUrl={line.image_url}
              size={72}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{line.name}</Text>
              <Text style={styles.qty}>Demandé {line.qty} · Ramassé {picked} · Restant {remaining}</Text>
              {imageCredit ? <Text style={styles.credit}>Image : {imageCredit}</Text> : null}
            </View>
          </View>
          <View style={styles.facts}>
            {line.stock_before != null ? <Text style={styles.fact}>Avant vente {line.stock_before}</Text> : null}
            {line.stock_after != null ? <Text style={styles.fact}>Après commande {line.stock_after}</Text> : null}
            {line.available_qty != null ? <Text style={styles.fact}>Disponible actuel {line.available_qty}</Text> : null}
          </View>
          {lotNumber || expiryDate ? (
            <Text style={styles.lot}>
              {lotNumber ? `Lot ${lotNumber}` : ''}
              {lotNumber && expiryDate ? ' · ' : ''}
              {expiryDate ? `DLC/DDM ${expiryDate}` : ''}
            </Text>
          ) : null}
          <View style={styles.tabs}>
            <Pressable style={[styles.tab, mode === 'camera' && styles.tabOn]} onPress={() => setMode('camera')}>
              <Text style={[styles.tabTxt, mode === 'camera' && styles.tabTxtOn]}>Caméra</Text>
            </Pressable>
            <Pressable style={[styles.tab, mode === 'type' && styles.tabOn]} onPress={() => setMode('type')}>
              <Text style={[styles.tabTxt, mode === 'type' && styles.tabTxtOn]}>QR / saisie</Text>
            </Pressable>
          </View>
          {mode === 'camera' ? (
            <View style={styles.camWrap}>
              {!permission?.granted ? (
                <View style={styles.camFallback}>
                  <Text style={styles.hint}>Autorisez la caméra pour scanner le code-barres ou le QR.</Text>
                  <PillButton label="AUTORISER LA CAMÉRA" onPress={() => void requestPermission()} />
                </View>
              ) : (
                <CameraView
                  style={styles.cam}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'code128'] }}
                  onBarcodeScanned={(event) => void onBar(event)}
                />
              )}
            </View>
          ) : (
            <>
              <Text style={styles.hint}>Saisissez le code-barres, la référence, ou le contenu du QR.</Text>
              <TextInput
                autoFocus
                selectTextOnFocus
                style={styles.input}
                placeholder="Code-barres / QR / référence"
                placeholderTextColor={colors.placeholder}
                value={code}
                onChangeText={(t) => {
                  setCode(t);
                  setError('');
                }}
                onSubmitEditing={() => void submit(code)}
                returnKeyType="done"
              />
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {mode === 'type' ? (
            <PillButton
              label={checking ? 'VÉRIFICATION…' : 'VALIDER LE SCAN'}
              onPress={() => void submit(code)}
              disabled={checking}
            />
          ) : null}
          {onMissing ? (
            <Pressable onPress={() => onMissing(line)}>
              <Text style={styles.missing}>Produit introuvable</Text>
            </Pressable>
          ) : null}
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
  credit: { ...bodyFont('400'), fontSize: 10, color: colors.placeholder, marginTop: 3 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fact: {
    ...bodyFont('600'),
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lot: { ...bodyFont('600'), fontSize: 11, color: colors.amber },
  tabs: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabOn: { backgroundColor: colors.white },
  tabTxt: { ...bodyFont('700'), fontSize: 13, color: colors.muted },
  tabTxtOn: { color: colors.teal },
  camWrap: { height: 220, borderRadius: 20, overflow: 'hidden', backgroundColor: '#111827' },
  cam: { flex: 1 },
  camFallback: { flex: 1, justifyContent: 'center', padding: 16, gap: 12, backgroundColor: colors.bg },
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
  },
  error: { ...bodyFont('600'), color: colors.coral, fontSize: 13 },
  missing: { ...displayFont('700'), textAlign: 'center', color: colors.coral, paddingVertical: 4 },
  cancel: { ...displayFont('700'), textAlign: 'center', color: colors.muted, paddingVertical: 8 },
});
