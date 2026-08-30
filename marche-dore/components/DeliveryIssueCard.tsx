import { CtaButton } from '@/components/ui';
import { useCart } from '@/context/CartContext';
import { useColors } from '@/context/ThemeContext';
import { getProduct } from '@/data/catalog';
import { displayFont, type AppColors } from '@/constants/theme';
import type { Order } from '@/context/OrdersContext';
import { apiPostIncidentAction } from '@/lib/api/orders';
import {
  CLIENT_ISSUE_ACTIONS,
  asClientIssueAction,
  issueActionsFor,
  issueReasonLabel,
  type ClientIssueActionId,
} from '@/lib/deliveryIssue';
import { fulfillmentPhase } from '@/lib/orderOps';
import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

export function DeliveryIssueCard({ order }: { order: Order }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { add } = useCart();
  const [busy, setBusy] = useState<ClientIssueActionId | null>(null);
  const [chosen, setChosen] = useState<ClientIssueActionId | null>(
    asClientIssueAction(order.incidentAction),
  );

  useEffect(() => {
    setChosen(asClientIssueAction(order.incidentAction));
  }, [order.incidentAction]);

  if (fulfillmentPhase(order) !== 'failed') return null;

  const reason = issueReasonLabel(order.failedReasonCode, order.failedReason);
  const offered = issueActionsFor(order.failedReasonCode, {
    paymentId: order.paymentId,
    paymentStatus: order.paymentStatus,
  });

  const run = async (id: ClientIssueActionId) => {
    if (busy) return;
    setBusy(id);
    try {
      await apiPostIncidentAction(order.id, id);
      setChosen(id);
      if (id === 'support') {
        router.push('/chat/support' as Href);
        return;
      }
      if (id === 'reorder') {
        order.lines.forEach((line) => {
          if (getProduct(line.productId)) add(line.productId, line.qty);
        });
        router.push('/(tabs)/cart' as Href);
        return;
      }
      Alert.alert(
        id === 'refund' ? 'Demande enregistrée' : 'Demande enregistrée',
        id === 'refund'
          ? 'L’équipe va traiter votre demande de remboursement.'
          : 'Nous relançons une course dès que possible. Vous serez notifié.',
      );
    } catch (e) {
      Alert.alert('Action', e instanceof Error ? e.message : 'Impossible d’enregistrer l’action.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.white }]}>
      <View style={[styles.icon, { backgroundColor: 'rgba(200,75,49,0.14)' }]}>
        <Feather name="alert-circle" size={22} color={colors.terracotta} />
      </View>
      <Text style={styles.title}>Livraison non aboutie</Text>
      <Text style={styles.reason}>{reason}</Text>
      <Text style={styles.sub}>
        Choisissez une action. L’équipe Super U en est informée et conserve la trace.
      </Text>
      {chosen ? (
        <View style={[styles.done, { backgroundColor: colors.successSoft }]}>
          <Feather name="check-circle" size={16} color={colors.green} />
          <Text style={[styles.doneText, { color: colors.green }]}>
            Action retenue : {CLIENT_ISSUE_ACTIONS[chosen].title}
          </Text>
        </View>
      ) : null}
      {offered.map((id) => {
        const def = CLIENT_ISSUE_ACTIONS[id];
        const selected = chosen === id;
        return (
          <Pressable
            key={id}
            onPress={() => void run(id)}
            disabled={Boolean(busy)}
            style={[
              styles.action,
              {
                borderColor: selected ? colors.terracotta : colors.border,
                backgroundColor: selected ? 'rgba(200,75,49,0.08)' : colors.bg,
              },
            ]}>
            <View style={[styles.actionIcon, { backgroundColor: colors.cream }]}>
              <Feather name={def.icon} size={16} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{def.title}</Text>
              <Text style={styles.actionHint}>{def.hint}</Text>
            </View>
            <Text style={styles.actionCta}>{busy === id ? '…' : selected ? 'OK' : 'Choisir'}</Text>
          </Pressable>
        );
      })}
      {chosen === 'support' ? (
        <CtaButton label="Ouvrir l’assistance" onPress={() => router.push('/chat/support' as Href)} />
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: { borderRadius: 18, padding: 16, gap: 10 },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...displayFont('700'), color: colors.text, fontSize: 18 },
    reason: { color: colors.terracotta, fontSize: 14, fontWeight: '700' },
    sub: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '500' },
    done: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 14,
      padding: 12,
    },
    doneText: { flex: 1, fontSize: 13, fontWeight: '600' },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
    },
    actionIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
    actionHint: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: '500' },
    actionCta: { color: colors.terracotta, fontSize: 12, fontWeight: '800' },
  });
}
