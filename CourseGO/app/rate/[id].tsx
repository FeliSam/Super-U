import { StarPicker } from '@/components/ConfirmModal';
import { PillButton, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { formatFcfa, shortOrderId } from '@/lib/format';
import { ApiError } from '@/lib/api/http';
import { fetchDeliveries, rateCustomer } from '@/lib/api/ops';
import { orderIdFromOpsId } from '@/lib/opsModel';
import { nextDeliveryInTour, clearLastDropoff } from '@/lib/tourRoute';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function RateCustomerScreen() {
  const { id, payout } = useLocalSearchParams<{ id: string; payout?: string }>();
  const delId = decodeURIComponent(id ?? '');
  const { deliveries, refresh } = useBoard();
  const { staff } = useStaffAuth();
  const d = deliveries.find((x) => x.id === delId || x.order_id === orderIdFromOpsId(delId));
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bonus = Number(payout ?? 0);

  const skip = async () => {
    await refresh();
    const fresh = staff?.canDeliver ? await fetchDeliveries().catch(() => null) : null;
    const pool = fresh?.deliveries ?? deliveries;
    const next = staff ? nextDeliveryInTour(pool, staff.id, delId) : null;
    if (next) {
      router.replace(`/run/${encodeURIComponent(next.id)}`);
      return;
    }
    if (staff?.id) clearLastDropoff(staff.id);
    router.replace('/(tabs)/missions');
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await rateCustomer(delId, { rating, comment });
      await refresh();
      const fresh = staff?.canDeliver ? await fetchDeliveries().catch(() => null) : null;
      const pool = fresh?.deliveries ?? deliveries;
      const next = staff ? nextDeliveryInTour(pool, staff.id, delId) : null;
      if (next) {
        router.replace(`/run/${encodeURIComponent(next.id)}`);
        return;
      }
      if (staff?.id) clearLastDropoff(staff.id);
      router.replace('/(tabs)/missions');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => void skip()}>
          <Text style={styles.back}>Plus tard</Text>
        </Pressable>
        <Text style={styles.navTitle}>Avis {shortOrderId(d?.order_id ?? delId)}</Text>
        <View style={{ width: 72 }} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Noter le client</Text>
        <Text style={styles.sub}>
          La remise est confirmée
          {bonus > 0 ? ` · +${formatFcfa(bonus)}` : ''}. Laissez une note sur cet échange.
        </Text>
        <StarPicker value={rating} onChange={setRating} />
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Commentaire (optionnel)"
          placeholderTextColor={colors.placeholder}
          style={styles.review}
        />
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <PillButton label={busy ? '…' : 'Envoyer la note'} onPress={() => void submit()} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    height: 56,
  },
  back: { ...bodyFont('600'), color: colors.teal },
  navTitle: { ...displayFont('800'), fontSize: 16 },
  body: { padding: 24, gap: 16 },
  title: { ...displayFont('900'), fontSize: 24, letterSpacing: -0.4 },
  sub: { ...bodyFont('400'), fontSize: 15, color: colors.muted, lineHeight: 22 },
  review: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    ...bodyFont('500'),
    fontSize: 15,
    color: colors.text,
  },
  err: { ...bodyFont('600'), color: colors.danger, textAlign: 'center' },
});
