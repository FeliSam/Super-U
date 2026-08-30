import { colors, displayFont, bodyFont, radius, shadow } from '@/constants/theme';
import { formatFcfa, kmLabel, minLabel, shortOrderId } from '@/lib/format';
import type { DeliveryJob, PickJob } from '@/lib/api/ops';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type Kind = 'pick' | 'deliver';

export function MissionCard({
  kind,
  title,
  orderId,
  itemCount,
  distanceM,
  durationS,
  slotLabel,
  total,
  cta,
  onPress,
  onAccept,
}: {
  kind: Kind;
  title: string;
  orderId: string;
  itemCount: number;
  distanceM?: number | null;
  durationS?: number | null;
  slotLabel?: string | null;
  total: number;
  cta: string;
  onPress?: () => void;
  onAccept?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.badge, kind === 'pick' ? styles.badgePick : styles.badgeDel]}>
          <Text style={[styles.badgeText, kind === 'pick' ? { color: colors.teal } : { color: colors.coral }]}>
            {kind === 'pick' ? 'PRÉPARATION' : 'LIVRAISON'}
          </Text>
        </View>
        <Text style={styles.order}>{shortOrderId(orderId)}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.meta}>
        <Meta icon="shopping-bag" text={`${itemCount} produit${itemCount > 1 ? 's' : ''}`} />
        <Meta icon="map-pin" text={kmLabel(distanceM)} />
        <Meta icon="clock" text={slotLabel || minLabel(durationS)} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.price}>{formatFcfa(total)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cta}
          onPress={(e) => {
            e.stopPropagation();
            onAccept?.();
          }}
          style={styles.accept}>
          <Text style={styles.acceptText}>{cta}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function Meta({ icon, text }: { icon: ComponentProps<typeof Feather>['name']; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Feather name={icon} size={14} color={colors.muted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

export function pickCardProps(job: PickJob) {
  return {
    kind: 'pick' as const,
    title: job.address_label || 'Commande magasin',
    orderId: job.order_id,
    itemCount: job.item_count,
    slotLabel: job.slot_label,
    total: job.total,
  };
}

export function deliveryCardProps(d: DeliveryJob) {
  return {
    kind: 'deliver' as const,
    title: d.store_name || d.address_label || 'Livraison',
    orderId: d.order_id,
    itemCount: d.item_count,
    distanceM: d.route_distance_m,
    durationS: d.route_duration_s,
    slotLabel: d.slot_label,
    total: d.total,
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 20,
    gap: 14,
    ...shadow.card,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgePick: { backgroundColor: colors.tealSoft },
  badgeDel: { backgroundColor: colors.coralSoft },
  badgeText: { ...displayFont('800'), fontSize: 11 },
  order: { ...displayFont('700'), fontSize: 14, color: colors.placeholder },
  title: { ...displayFont('800'), fontSize: 18, color: colors.text },
  meta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...bodyFont('400'), fontSize: 13, color: colors.muted },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { ...displayFont('900'), fontSize: 20, color: colors.teal },
  accept: {
    backgroundColor: colors.teal,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  acceptText: { ...displayFont('800'), fontSize: 13, color: colors.onAccent },
});
