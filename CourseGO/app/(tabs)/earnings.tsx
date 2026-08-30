import { PullBanner, pullRefreshControl } from '@/components/PullRefresh';
import { Screen } from '@/components/ui';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { formatFcfa } from '@/lib/format';
import { fetchEarnings } from '@/lib/api/ops';
import { useTabContentPadding } from '@/hooks/useTabContentPadding';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Earnings = Awaited<ReturnType<typeof fetchEarnings>>;

const EMPTY: Omit<Earnings, 'ok'> = {
  today: 0,
  week: 0,
  allTime: 0,
  deliveriesToday: 0,
  picksToday: 0,
  cashToday: 0,
  pickToday: 0,
  deliverToday: 0,
  pickWeek: 0,
  deliverWeek: 0,
  deliveriesWeek: 0,
  picksWeek: 0,
  avgDeliveryPayout: 0,
  jobsAll: 0,
  failedAll: 0,
  successRate: null,
  avgMinutes: 0,
  ratingAvg: 0,
  ratingCount: 0,
  tipToday: 0,
  tipAll: 0,
  weekDays: [],
};

const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function last7Days(rows: { date: string; amount: number }[]) {
  const map = new Map(rows.map((r) => [r.date, r.amount]));
  const out: { key: string; label: string; amount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ key, label: WEEKDAYS[d.getDay()], amount: map.get(key) ?? 0 });
  }
  return out;
}

export default function EarningsScreen() {
  const { staff } = useStaffAuth();
  const pad = useTabContentPadding();
  const [data, setData] = useState(EMPTY);
  const [refreshing, setRefreshing] = useState(false);
  const bars = useMemo(() => last7Days(data.weekDays), [data.weekDays]);
  const maxBar = Math.max(1, ...bars.map((b) => b.amount));
  const empty = data.jobsAll === 0 && data.today === 0;

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
        pickToday: Number(res.pickToday ?? 0),
        deliverToday: Number(res.deliverToday ?? 0),
        pickWeek: Number(res.pickWeek ?? 0),
        deliverWeek: Number(res.deliverWeek ?? 0),
        deliveriesWeek: Number(res.deliveriesWeek ?? 0),
        picksWeek: Number(res.picksWeek ?? 0),
        avgDeliveryPayout: Number(res.avgDeliveryPayout ?? 0),
        jobsAll: Number(res.jobsAll ?? 0),
        failedAll: Number(res.failedAll ?? 0),
        successRate: res.successRate ?? null,
        avgMinutes: Number(res.avgMinutes ?? 0),
        ratingAvg: Number(res.ratingAvg ?? staff.ratingAvg ?? 0),
        ratingCount: Number(res.ratingCount ?? staff.ratingCount ?? 0),
        tipToday: Number(res.tipToday ?? 0),
        tipAll: Number(res.tipAll ?? 0),
        weekDays: Array.isArray(res.weekDays) ? res.weekDays : [],
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
        refreshControl={pullRefreshControl(refreshing, () => void load())}>
        <PullBanner visible={refreshing} />
        <Text style={styles.title}>Performance</Text>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Gains du jour</Text>
          <Text style={styles.heroAmt}>{formatFcfa(data.today)}</Text>
          <Text style={styles.heroSub}>
            {data.deliveriesToday} livraison{data.deliveriesToday > 1 ? 's' : ''} · {data.picksToday}{' '}
            ramassage{data.picksToday > 1 ? 's' : ''}
          </Text>
        </View>

        {empty ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Feather name="trending-up" size={22} color={colors.teal} />
            </View>
            <Text style={styles.emptyTitle}>Pas encore de course payée</Text>
            <Text style={styles.emptySub}>
              Les gains, notes clients et temps moyens apparaîtront ici dès votre première mission
              validée.
            </Text>
          </View>
        ) : null}

        <Text style={styles.section}>Cette semaine</Text>
        <View style={styles.chart}>
          {bars.map((b) => (
            <View key={b.key} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.max(8, (b.amount / maxBar) * 100)}%` }]} />
              </View>
              <Text style={styles.barLbl}>{b.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Gains semaine</Text>
            <Text style={styles.cellVal}>{formatFcfa(data.week)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Total</Text>
            <Text style={styles.cellVal}>{formatFcfa(data.allTime)}</Text>
          </View>
        </View>

        <Text style={styles.section}>Répartition du jour</Text>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Livraisons</Text>
            <Text style={styles.cellVal}>{formatFcfa(data.deliverToday)}</Text>
            <Text style={styles.cellHint}>{data.deliveriesToday} course{data.deliveriesToday > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Ramassages</Text>
            <Text style={styles.cellVal}>{formatFcfa(data.pickToday)}</Text>
            <Text style={styles.cellHint}>{data.picksToday} panier{data.picksToday > 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Pourboires du jour</Text>
            <Text style={styles.cellVal}>{formatFcfa(data.tipToday)}</Text>
            <Text style={styles.cellHint}>Total {formatFcfa(data.tipAll)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Note clients</Text>
            <Text style={styles.cellVal}>
              {data.ratingCount > 0 ? data.ratingAvg.toFixed(1) : '—'}
            </Text>
            <Text style={styles.cellHint}>
              {data.ratingCount > 0 ? `${data.ratingCount} avis` : 'Aucun avis'}
            </Text>
          </View>
        </View>
        <Text style={styles.section}>Qualité</Text>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Taux de succès</Text>
            <Text style={styles.cellVal}>{data.successRate != null ? `${data.successRate} %` : '—'}</Text>
            <Text style={styles.cellHint}>{data.failedAll} échec{data.failedAll > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Temps moyen</Text>
            <Text style={styles.cellVal}>{data.avgMinutes > 0 ? `${data.avgMinutes} min` : '—'}</Text>
            <Text style={styles.cellHint}>Prise → livré</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Gain / livraison</Text>
            <Text style={styles.cellVal}>
              {data.avgDeliveryPayout > 0 ? formatFcfa(data.avgDeliveryPayout) : '—'}
            </Text>
            <Text style={styles.cellHint}>Moyenne</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Semaine · livraisons</Text>
            <Text style={styles.cellVal}>{data.deliveriesWeek}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Semaine · ramassages</Text>
            <Text style={styles.cellVal}>{data.picksWeek}</Text>
          </View>
        </View>

        <Pressable style={styles.link} onPress={() => router.push('/(tabs)/history')}>
          <Text style={styles.linkTxt}>Voir l’historique détaillé</Text>
          <Feather name="chevron-right" size={16} color={colors.teal} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 12 },
  title: { ...displayFont('900'), fontSize: 22, color: colors.text },
  section: {
    ...displayFont('800'),
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 8,
  },
  hero: { backgroundColor: colors.teal, borderRadius: 24, padding: 24, gap: 8 },
  heroLabel: { ...bodyFont('700'), color: colors.onAccent, fontSize: 12, textTransform: 'uppercase' },
  heroAmt: { ...displayFont('900'), color: colors.onAccent, fontSize: 28 },
  heroSub: { ...bodyFont('600'), color: colors.onAccent, fontSize: 13, opacity: 0.9 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    height: 132,
    borderWidth: 1,
    borderColor: colors.border,
  },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 },
  barTrack: {
    flex: 1,
    width: '70%',
    backgroundColor: colors.bg,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: colors.teal, borderRadius: 8, minHeight: 6 },
  barLbl: { ...bodyFont('700'), fontSize: 11, color: colors.muted },
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
  cellHint: { ...bodyFont('500'), fontSize: 11, color: colors.muted, marginTop: 4 },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...displayFont('800'), fontSize: 16, color: colors.text, textAlign: 'center' },
  emptySub: { ...bodyFont('400'), fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 16,
    ...shadow.card,
  },
  linkTxt: { ...bodyFont('700'), fontSize: 14, color: colors.teal },
});
