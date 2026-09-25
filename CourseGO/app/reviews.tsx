import { AccountScreen } from '@/components/AccountScreen';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { fetchRatings, type StaffRatingItem } from '@/lib/api/ops';
import { formatFcfa, shortOrderId } from '@/lib/format';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Aujourd’hui · ${t}`;
  return `${d.toLocaleDateString('fr-FR')} · ${t}`;
}

function Stars({ value }: { value: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Feather key={n} name="star" size={14} color={n <= value ? colors.amber : colors.border} />
      ))}
    </View>
  );
}

export default function ReviewsScreen() {
  const [items, setItems] = useState<StaffRatingItem[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchRatings();
      setItems(res.items ?? []);
    } catch {
      /* keep last */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const avg = useMemo(() => {
    if (!items.length) return 0;
    return items.reduce((s, r) => s + r.rating, 0) / items.length;
  }, [items]);
  const tips = useMemo(() => items.reduce((s, r) => s + (r.tipAmount || 0), 0), [items]);

  return (
    <AccountScreen title="Avis & pourboires">
      {items.length ? (
        <View style={styles.summary}>
          <View style={styles.sumCell}>
            <Text style={styles.sumLabel}>Note moyenne</Text>
            <Text style={styles.sumVal}>{avg.toFixed(1)}</Text>
            <Text style={styles.sumHint}>
              {items.length} avis
            </Text>
          </View>
          <View style={styles.sumCell}>
            <Text style={styles.sumLabel}>Pourboires</Text>
            <Text style={styles.sumVal}>{formatFcfa(tips)}</Text>
            <Text style={styles.sumHint}>Total reçu</Text>
          </View>
        </View>
      ) : null}

      {items.map((r) => (
        <View key={r.id} style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.who} numberOfLines={1}>
                {r.customer}
              </Text>
              <Text style={styles.oid}>{shortOrderId(r.orderId)}</Text>
            </View>
            {r.tipAmount > 0 ? (
              <Text style={styles.tip}>+{formatFcfa(r.tipAmount)}</Text>
            ) : (
              <Text style={styles.noTip}>Sans pourboire</Text>
            )}
          </View>
          <Stars value={r.rating} />
          {r.comment.trim() ? <Text style={styles.comment}>{r.comment.trim()}</Text> : null}
          <Text style={styles.meta}>
            {when(String(r.createdAt))}
            {r.addressLabel ? ` · ${r.addressLabel}` : ''}
          </Text>
        </View>
      ))}

      {ready && !items.length ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="star" size={22} color={colors.teal} />
          </View>
          <Text style={styles.emptyTitle}>Pas encore d’avis</Text>
          <Text style={styles.emptySub}>
            Les notes et pourboires laissés par les clients après une livraison apparaissent ici.
          </Text>
        </View>
      ) : null}
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: 10, width: '100%' },
  sumCell: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sumLabel: { ...bodyFont('500'), color: colors.muted, fontSize: 12 },
  sumVal: { ...displayFont('800'), fontSize: 18, color: colors.text, marginTop: 6 },
  sumHint: { ...bodyFont('500'), fontSize: 11, color: colors.placeholder, marginTop: 4 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    ...shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  who: { ...displayFont('800'), fontSize: 16, color: colors.text },
  oid: { ...bodyFont('600'), fontSize: 12, color: colors.muted, marginTop: 2 },
  tip: { ...displayFont('800'), fontSize: 14, color: colors.teal },
  noTip: { ...bodyFont('600'), fontSize: 11, color: colors.placeholder, marginTop: 2 },
  stars: { flexDirection: 'row', gap: 3 },
  comment: { ...bodyFont('500'), fontSize: 14, color: colors.text, lineHeight: 20 },
  meta: { ...bodyFont('400'), fontSize: 12, color: colors.placeholder },
  empty: {
    alignItems: 'center',
    padding: 28,
    gap: 8,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { ...displayFont('800'), fontSize: 16, color: colors.text },
  emptySub: { ...bodyFont('400'), color: colors.muted, textAlign: 'center', fontSize: 13, lineHeight: 20 },
});
