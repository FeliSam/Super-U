import { Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { formatFcfa } from '@/lib/format';
import { fetchEarnings } from '@/lib/api/ops';
import { useTabContentPadding } from '@/hooks/useTabContentPadding';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

const EMPTY = {
  today: 0,
  week: 0,
  allTime: 0,
  deliveriesToday: 0,
  picksToday: 0,
  cashToday: 0,
};

export default function EarningsScreen() {
  const { staff } = useStaffAuth();
  const pad = useTabContentPadding();
  const [data, setData] = useState(EMPTY);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!staff) {
      setData(EMPTY);
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetchEarnings();
      setData({
        today: Number(res.today ?? 0),
        week: Number(res.week ?? 0),
        allTime: Number(res.allTime ?? 0),
        deliveriesToday: Number(res.deliveriesToday ?? 0),
        picksToday: Number(res.picksToday ?? 0),
        cashToday: Number(res.cashToday ?? 0),
      });
    } catch {
      /* keep last */
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
        <Text style={styles.title}>Revenus</Text>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>AUJOURD’HUI</Text>
          <Text style={styles.heroAmt}>{formatFcfa(data.today)}</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Cette semaine</Text>
            <Text style={styles.cellVal}>{formatFcfa(data.week)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Total</Text>
            <Text style={styles.cellVal}>{formatFcfa(data.allTime)}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Livraisons du jour</Text>
            <Text style={styles.cellVal}>{data.deliveriesToday}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Ramassages du jour</Text>
            <Text style={styles.cellVal}>{data.picksToday}</Text>
          </View>
        </View>
        <View style={styles.cellWide}>
          <Text style={styles.cellLabel}>Espèces encaissées aujourd’hui</Text>
          <Text style={styles.cellVal}>{formatFcfa(data.cashToday)}</Text>
        </View>
        <Text style={styles.hint}>
          Chaque livraison réussie crédite les frais de course (min. 1 500 F). Un ramassage validé ajoute 500 F.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  title: { ...displayFont('900'), fontSize: 22, color: colors.text },
  hero: { backgroundColor: colors.teal, borderRadius: 24, padding: 24, gap: 8 },
  heroLabel: { ...bodyFont('700'), color: colors.onAccent, fontSize: 12 },
  heroAmt: { ...displayFont('900'), color: colors.onAccent, fontSize: 28 },
  row: { flexDirection: 'row', gap: 12 },
  cell: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellWide: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellLabel: { ...bodyFont('400'), color: colors.placeholder, fontSize: 12 },
  cellVal: { ...displayFont('800'), fontSize: 18, color: colors.text, marginTop: 4 },
  hint: { ...bodyFont('400'), color: colors.muted, fontSize: 13, lineHeight: 20 },
});
