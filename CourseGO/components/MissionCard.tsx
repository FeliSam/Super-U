import { colors, displayFont, bodyFont, radius, shadow } from '@/constants/theme';
import { formatFcfa, kmLabel, minLabel, shortOrderId } from '@/lib/format';
import type { DeliveryJob, PickJob } from '@/lib/api/ops';
import { slotKind, slotKindLabel, type SlotKind } from '@/lib/slotKind';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type Kind = 'pick' | 'deliver';

function ctaIcon(cta: string, selected?: boolean, kind?: Kind): ComponentProps<typeof Feather>['name'] {
  const label = cta.trim().toUpperCase();
  if (selected || label.includes('SÉLECTIONN') || label.includes('SELECTIONN')) return 'check-circle';
  if (label.includes('AJOUTER')) return 'plus-circle';
  if (label.includes('PRENDRE')) return 'check';
  if (label.includes('CONTINUER') || label.includes('OUVRIR')) return 'arrow-right-circle';
  if (label.includes('SUIVRE') || label.includes('VOIR')) return 'navigation';
  if (label.includes('DÉMARRER') || label.includes('DEMARRER')) return 'play-circle';
  if (label.includes('EN COURS') || label.includes('MAX')) return 'lock';
  return kind === 'deliver' ? 'plus-circle' : 'check';
}

export function MissionCard({
  kind,
  title,
  orderId,
  itemCount,
  distanceM,
  durationS,
  slotLabel,
  slotId,
  total,
  cta,
  onPress,
  onAccept,
  selected,
  nearest,
}: {
  kind: Kind;
  title: string;
  orderId: string;
  itemCount: number;
  distanceM?: number | null;
  durationS?: number | null;
  slotLabel?: string | null;
  slotId?: string | null;
  total: number;
  cta: string;
  onPress?: () => void;
  onAccept?: () => void;
  selected?: boolean;
  nearest?: boolean;
}) {
  const speed = slotKind(slotId, slotLabel);
  const icon = ctaIcon(cta, selected, kind);
  const iconColor = selected ? colors.teal : colors.onAccent;
  return (
    <Pressable onPress={onPress} style={[styles.card, speed === 'urgent' && styles.cardUrgent, selected && styles.cardSelected, nearest && styles.cardNearest]}>
      <View style={styles.header}>
        <View style={styles.badges}>
          {nearest ? (
            <View style={styles.badgeNear}>
              <Text style={styles.badgeNearTxt}>PLUS PROCHE</Text>
            </View>
          ) : null}
          <View style={[styles.badge, kind === 'pick' ? styles.badgePick : styles.badgeDel]}>
            <Text style={[styles.badgeText, kind === 'pick' ? { color: colors.teal } : { color: colors.coral }]}>
              {kind === 'pick' ? 'PRÉPARATION' : 'LIVRAISON'}
            </Text>
          </View>
          <SpeedTag kind={speed} />
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
          style={[
            styles.accept,
            selected
              ? styles.acceptSelected
              : kind === 'deliver'
                ? styles.acceptDeliver
                : styles.acceptPick,
          ]}>
          <Feather name={icon} size={15} color={iconColor} />
          <Text
            style={[
              styles.acceptText,
              selected ? styles.acceptTextSelected : kind === 'deliver' ? styles.acceptTextDeliver : styles.acceptTextPick,
            ]}>
            {cta}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function SpeedTag({ kind }: { kind: SlotKind }) {
  return (
    <View
      style={[
        styles.speed,
        kind === 'urgent' && styles.speedUrgent,
        kind === 'express' && styles.speedExpress,
      ]}>
      <Text
        style={[
          styles.speedTxt,
          kind === 'urgent' && styles.speedTxtUrgent,
          kind === 'express' && styles.speedTxtExpress,
        ]}>
        {slotKindLabel(kind)}
      </Text>
    </View>
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
    title: job.store_name || job.address_label || 'Commande magasin',
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
  cardUrgent: {
    borderWidth: 1.5,
    borderColor: colors.coral,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: colors.teal,
  },
  cardNearest: {
    borderWidth: 1.5,
    borderColor: '#fbbf24',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1, paddingRight: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgePick: { backgroundColor: colors.tealSoft },
  badgeDel: { backgroundColor: colors.coralSoft },
  badgeNear: { backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeNearTxt: { ...displayFont('800'), fontSize: 11, color: '#b45309' },
  badgeText: { ...displayFont('800'), fontSize: 11 },
  speed: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.bg,
  },
  speedUrgent: { backgroundColor: colors.dangerSoft },
  speedExpress: { backgroundColor: colors.amberSoft },
  speedTxt: { ...displayFont('800'), fontSize: 11, color: colors.muted },
  speedTxtUrgent: { color: colors.danger },
  speedTxtExpress: { color: '#b45309' },
  order: { ...displayFont('700'), fontSize: 14, color: colors.placeholder },
  title: { ...displayFont('800'), fontSize: 18, color: colors.text },
  meta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...bodyFont('400'), fontSize: 13, color: colors.muted },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { ...displayFont('900'), fontSize: 20, color: colors.teal },
  accept: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
  acceptPick: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  acceptDeliver: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  acceptSelected: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  acceptText: { ...displayFont('800'), fontSize: 13 },
  acceptTextPick: { color: colors.onAccent },
  acceptTextDeliver: { color: colors.onAccent },
  acceptTextSelected: { color: colors.teal },
});
