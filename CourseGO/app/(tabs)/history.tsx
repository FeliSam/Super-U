import { Screen } from '@/components/ui';
import { bodyFont, colors, displayFont, shadow } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useTabContentPadding } from '@/hooks/useTabContentPadding';
import { fetchHistory, type OpsHistoryItem } from '@/lib/api/ops';
import { formatFcfa, shortOrderId } from '@/lib/format';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

function formatAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Aujourd’hui · ${t}`;
  return `${d.toLocaleDateString('fr-FR')} · ${t}`;
}

function statusLabel(it: OpsHistoryItem) {
  if (it.kind === 'pick') return 'Préparation terminée';
  if (it.status === 'failed') return 'Livraison échouée';
  if (it.status === 'cancelled') return 'Livraison annulée';
  return 'Livraison effectuée';
}

export default function HistoryScreen() {
  const { staff } = useStaffAuth();
  const pad = useTabContentPadding();
  const [items, setItems] = useState<OpsHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!staff) {
      setItems([]);
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetchHistory();
      setItems(res.items ?? []);
    } catch {
      /* keep last list */
    } finally {
      setRefreshing(false);
    }
  }, [staff]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: pad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}>
        <Text style={styles.title}>Historique</Text>
        {items.map((it) => {
          const payout = Number(it.payout ?? 0);
          return (
            <View key={`${it.kind}-${it.id}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.oid}>{shortOrderId(it.order_id)}</Text>
                <Text style={styles.st}>{statusLabel(it)}</Text>
                <Text style={styles.meta}>
                  {formatAt(it.at)}
                  {it.address_label ? ` · ${it.address_label}` : ''}
                </Text>
              </View>
              <Text style={[styles.amt, payout <= 0 && styles.amtZero]}>
                {payout > 0 ? `+${formatFcfa(payout)}` : '—'}
              </Text>
            </View>
          );
        })}
        {!items.length ? (
          <Text style={styles.empty}>Les courses livrées et les ramassages terminés apparaissent ici.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 10 },
  title: { ...displayFont('900'), fontSize: 22, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    gap: 12,
    ...shadow.card,
  },
  oid: { ...displayFont('800'), fontSize: 16 },
  st: { ...bodyFont('600'), color: colors.text, marginTop: 2 },
  meta: { ...bodyFont('400'), color: colors.muted, marginTop: 2, fontSize: 12 },
  amt: { ...displayFont('800'), color: colors.teal },
  amtZero: { color: colors.placeholder },
  empty: { ...bodyFont('400'), color: colors.muted },
});
