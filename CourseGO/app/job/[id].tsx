import { ProductThumb } from '@/components/ProductThumb';
import { OpsStepper } from '@/components/OpsStepper';
import { ScanSheet } from '@/components/ScanSheet';
import { PillButton, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { ApiError } from '@/lib/api/http';
import { claimDelivery, claimPick, fetchOrder, packPick, patchPickLines, startPick, type OrderLine } from '@/lib/api/ops';
import { deliveryJobId, PICK_STEPS } from '@/lib/opsModel';
import { productBarcode } from '@/lib/productMedia';
import { formatFcfa, shortOrderId } from '@/lib/format';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

function lineDone(line: OrderLine) {
  return Boolean(line.unavailable) || (line.picked_qty ?? 0) >= line.qty;
}

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pickId = decodeURIComponent(id ?? '');
  const { jobs, deliveries, refresh } = useBoard();
  const { staff } = useStaffAuth();
  const job = jobs.find((j) => j.id === pickId);
  const orderId = job?.order_id ?? pickId.replace(/^pick-/, '');
  const delivery = deliveries.find((d) => d.order_id === orderId || d.id === `del-${orderId}`);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanLine, setScanLine] = useState<OrderLine | null>(null);
  const [packedDone, setPackedDone] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetchOrder(orderId);
      setLines(res.lines);
    } catch {
      setLines([]);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const packed = packedDone || job?.pick_status === 'packed' || delivery?.pick_status === 'packed';
  const queued = !packed && (!job || job.pick_status === 'queued');
  const collected = lines.filter(lineDone).length;
  const allScanned = lines.length > 0 && lines.every(lineDone);
  const nextScan = lines.find((l) => !lineDone(l)) ?? null;
  const pct = lines.length ? Math.round((collected / lines.length) * 100) : 0;

  const saveLine = async (line: OrderLine, patch: Partial<OrderLine>) => {
    const next = { ...line, ...patch };
    setLines((prev) => prev.map((l) => (l.product_id === line.product_id ? next : l)));
    try {
      await patchPickLines(pickId, [
        {
          productId: line.product_id,
          pickedQty: next.picked_qty ?? 0,
          unavailable: next.unavailable ?? false,
          note: next.note ?? undefined,
        },
      ]);
    } catch (e) {
      Alert.alert('Ligne', e instanceof ApiError ? e.message : 'Impossible d’enregistrer la ligne');
    }
  };

  const onTake = async () => {
    setBusy(true);
    try {
      await claimPick(pickId);
      await refresh();
    } catch (e) {
      Alert.alert('Course', e instanceof ApiError ? e.message : (e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const openScanner = async (line: OrderLine | null) => {
    if (queued) {
      Alert.alert('Course', 'Appuyez d’abord sur PRENDRE.');
      return;
    }
    if (!line) {
      Alert.alert('Scan', 'Tous les produits sont déjà scannés.');
      return;
    }
    setBusy(true);
    try {
      if (job?.pick_status === 'assigned') {
        await startPick(pickId);
        await refresh();
      }
      setScanLine(line);
    } catch (e) {
      Alert.alert('Scan', e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onScanned = async (line: OrderLine) => {
    await saveLine(line, { picked_qty: line.qty, unavailable: false });
    const remaining = lines.find((l) => l.product_id !== line.product_id && !lineDone(l));
    setScanLine(remaining ?? null);
  };

  const onPack = async () => {
    if (!allScanned) {
      Alert.alert('Ramassage', 'Scannez chaque produit avant de valider.');
      return;
    }
    setBusy(true);
    try {
      const packed = await packPick(pickId);
      setPackedDone(true);
      await refresh();
      const bonus = Number(packed.payout ?? 0);
      if (bonus > 0) {
        Alert.alert('Ramassage terminé', `+${formatFcfa(bonus)} ajoutés à vos revenus.`);
      }
    } catch (e) {
      Alert.alert('Rassemblement', e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onTakeDelivery = async () => {
    setBusy(true);
    try {
      const delId = delivery?.id ?? deliveryJobId(orderId);
      await claimDelivery(delId);
      await refresh();
      router.replace(`/run/${encodeURIComponent(delId)}`);
    } catch (e) {
      Alert.alert('Livraison', e instanceof ApiError ? e.message : (e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Retour</Text>
        </Pressable>
        <Text style={styles.title}>Préparation {shortOrderId(orderId)}</Text>
        <View style={styles.timer}>
          <Text style={styles.timerTxt}>{job?.slot_label ?? '—'}</Text>
        </View>
      </View>
      <View style={styles.stepWrap}>
        <OpsStepper steps={PICK_STEPS} status={packed ? 'packed' : (job?.pick_status ?? 'queued')} />
      </View>
      <View style={styles.progress}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {collected} / {lines.length} PRODUITS SCANNÉS
          </Text>
          <Text style={styles.pct}>{pct}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {lines.map((line) => {
          const done = lineDone(line);
          const active = !done && !queued;
          return (
            <View key={line.product_id} style={[styles.card, active && styles.cardActive]}>
              <ProductThumb productId={line.product_id} name={line.name} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.prod}>{line.name}</Text>
                <Text style={styles.qty}>
                  {line.qty} × {line.unit ?? 'u'}
                </Text>
                <Text style={styles.code}>{line.barcode || productBarcode(line.product_id)}</Text>
                {line.unavailable ? (
                  <TextInput
                    style={styles.note}
                    placeholder="Note rupture"
                    value={line.note ?? ''}
                    onChangeText={(t) => void saveLine(line, { note: t })}
                    editable={!queued}
                  />
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={[styles.badge, done && styles.badgeDone, active && styles.badgeScan]}>
                  <Text style={[styles.badgeTxt, done && { color: colors.teal }, active && { color: colors.onAccent }]}>
                    {done ? (line.unavailable ? 'RUPTURE' : '✓ SCANNÉ') : queued ? 'EN ATTENTE' : 'À SCANNER'}
                  </Text>
                </View>
                {queued ? null : (
                  <Pressable onPress={() => void saveLine(line, { unavailable: !line.unavailable, picked_qty: 0 })}>
                    <Text style={styles.rupture}>{line.unavailable ? 'Remettre' : 'Rupture'}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.bottom}>
        {queued ? (
          <PillButton label={busy ? '…' : 'PRENDRE'} onPress={() => void onTake()} disabled={busy || !staff?.canPick} />
        ) : packed ? (
          delivery?.courier_id ? (
            <PillButton
              label="SUIVRE LA LIVRAISON"
              onPress={() => router.replace(`/run/${encodeURIComponent(delivery.id)}`)}
            />
          ) : staff?.canDeliver ? (
            <PillButton
              label={busy ? '…' : 'LIVRER MAINTENANT'}
              onPress={() => void onTakeDelivery()}
              disabled={busy}
            />
          ) : (
            <PillButton label="RETOUR À L’ACCUEIL" onPress={() => router.replace('/(tabs)/missions')} />
          )
        ) : allScanned ? (
          <PillButton
            label={busy ? '…' : 'TERMINER LE RAMASSAGE'}
            onPress={() => void onPack()}
            disabled={busy || !staff?.canPick}
          />
        ) : (
          <PillButton
            label={busy ? '…' : 'SCANNER'}
            onPress={() => void openScanner(nextScan)}
            disabled={busy || !nextScan}
          />
        )}
      </View>
      <ScanSheet
        line={scanLine}
        visible={Boolean(scanLine)}
        onClose={() => setScanLine(null)}
        onScanned={(line) => void onScanned(line)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, height: 56 },
  back: { ...bodyFont('600'), color: colors.teal },
  title: { ...displayFont('900'), fontSize: 16, flex: 1, textAlign: 'center' },
  timer: { backgroundColor: colors.amberSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  timerTxt: { ...displayFont('700'), fontSize: 12, color: colors.amber },
  stepWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  progress: { paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { ...bodyFont('700'), fontSize: 13, color: colors.muted },
  pct: { ...displayFont('900'), color: colors.teal, fontSize: 13 },
  track: { height: 8, backgroundColor: colors.border, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.teal },
  list: { paddingHorizontal: 24, gap: 12, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActive: { backgroundColor: colors.tealSoft, borderColor: 'transparent' },
  prod: { ...displayFont('700'), fontSize: 15 },
  qty: { ...bodyFont('700'), color: colors.teal, fontSize: 13, marginTop: 2 },
  code: { ...bodyFont('600'), fontSize: 11, color: colors.placeholder, marginTop: 2, letterSpacing: 0.3 },
  note: { ...bodyFont('400'), fontSize: 14, marginTop: 6, borderBottomWidth: 1, borderColor: colors.border },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.bg },
  badgeDone: { backgroundColor: colors.tealSoft },
  badgeScan: { backgroundColor: colors.teal },
  badgeTxt: { ...displayFont('800'), fontSize: 11, color: colors.placeholder },
  rupture: { ...bodyFont('600'), fontSize: 12, color: colors.coral },
  bottom: { padding: 24 },
});
