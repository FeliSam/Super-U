import { PullBanner, pullRefreshControl } from '@/components/PullRefresh';
import { Screen } from '@/components/ui';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useTabContentPadding } from '@/hooks/useTabContentPadding';
import { fetchHistory, fetchIncidents, type OpsHistoryItem, type OpsIncidentItem } from '@/lib/api/ops';
import { formatFcfa, shortOrderId } from '@/lib/format';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

function clock(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Aujourd’hui';
  if (d.toDateString() === yest.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function dayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'other';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function statusLabel(it: OpsHistoryItem) {
  if (it.kind === 'pick') return 'Préparation terminée';
  if (it.status === 'failed') return 'Livraison échouée';
  if (it.status === 'cancelled') return 'Livraison annulée';
  return 'Livraison effectuée';
}

function clientActionLabel(action?: string | null) {
  switch (action) {
    case 'retry':
      return 'Client : relancer';
    case 'support':
      return 'Client : assistance';
    case 'reorder':
      return 'Client : nouvelle commande';
    case 'refund':
      return 'Client : remboursement';
    default:
      return null;
  }
}

export default function HistoryScreen() {
  const { staff } = useStaffAuth();
  const pad = useTabContentPadding();
  const [items, setItems] = useState<OpsHistoryItem[]>([]);
  const [incidents, setIncidents] = useState<OpsIncidentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!staff) {
      setItems([]);
      setIncidents([]);
      return;
    }
    setRefreshing(true);
    try {
      const hist = await fetchHistory();
      setItems(hist.items ?? []);
    } catch {
      /* keep last list */
    }
    try {
      const inc = await fetchIncidents();
      setIncidents(inc.items ?? []);
    } catch {
      setIncidents([]);
    } finally {
      setRefreshing(false);
    }
  }, [staff]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: OpsHistoryItem[] }>();
    for (const it of items) {
      const key = dayKey(it.at);
      const cur = map.get(key);
      if (cur) cur.rows.push(it);
      else map.set(key, { label: dayLabel(it.at), rows: [it] });
    }
    return [...map.values()];
  }, [items]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: pad }]}
        refreshControl={pullRefreshControl(refreshing, () => void load())}
        showsVerticalScrollIndicator={false}>
        <PullBanner visible={refreshing} />
        <View style={styles.head}>
          <Text style={styles.title}>Historique</Text>
          <Text style={styles.sub}>
            {items.length
              ? `${items.length} course${items.length > 1 ? 's' : ''} · livraisons et ramassages`
              : 'Livraisons et ramassages terminés'}
          </Text>
        </View>

        {groups.map((g) => (
          <View key={g.label} style={styles.group}>
            <Text style={styles.groupTitle}>{g.label}</Text>
            <View style={styles.stack}>
              {g.rows.map((it) => {
                const payout = Number(it.payout ?? 0);
                const failed = it.status === 'failed' || it.status === 'cancelled';
                const pick = it.kind === 'pick';
                return (
                  <View key={`${it.kind}-${it.id}`} style={styles.row}>
                    <View style={[styles.kind, pick && styles.kindPick, failed && styles.kindFail]}>
                      <Feather
                        name={failed ? 'alert-circle' : pick ? 'package' : 'truck'}
                        size={16}
                        color={failed ? colors.danger : colors.teal}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowTop}>
                        <Text style={styles.oid}>{shortOrderId(it.order_id)}</Text>
                        <Text style={[styles.amt, payout <= 0 && styles.amtZero]}>
                          {payout > 0 ? `+${formatFcfa(payout)}` : '—'}
                        </Text>
                      </View>
                      <Text style={[styles.st, failed && styles.stFail]}>{statusLabel(it)}</Text>
                      {failed && (it.failed_reason || clientActionLabel(it.client_action)) ? (
                        <Text style={styles.issue}>
                          {[it.failed_reason, clientActionLabel(it.client_action)].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                      <Text style={styles.meta}>
                        {clock(it.at)}
                        {it.address_label ? ` · ${it.address_label}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {!items.length ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Feather name="clock" size={22} color={colors.teal} />
            </View>
            <Text style={styles.emptyTitle}>Rien pour le moment</Text>
            <Text style={styles.empty}>
              Les courses livrées et les ramassages terminés apparaissent ici.
            </Text>
          </View>
        ) : null}

        {incidents.length ? (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Incidents & actions client</Text>
            <View style={styles.stack}>
              {incidents.map((inc) => (
                <View key={inc.id} style={styles.row}>
                  <View style={[styles.kind, styles.kindFail]}>
                    <Feather name="alert-triangle" size={16} color={colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.oid}>{shortOrderId(inc.order_id)}</Text>
                    <Text style={[styles.st, styles.stFail]}>{inc.reason_text || inc.reason_code}</Text>
                    {clientActionLabel(inc.client_action) ? (
                      <Text style={styles.issue}>{clientActionLabel(inc.client_action)}</Text>
                    ) : (
                      <Text style={styles.meta}>En attente d’une action client</Text>
                    )}
                    <Text style={styles.meta}>
                      {clock(inc.created_at)}
                      {inc.address_label ? ` · ${inc.address_label}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  head: { gap: 4, paddingHorizontal: 4, marginBottom: 2 },
  title: { ...displayFont('800'), fontSize: 26, color: colors.text, letterSpacing: -0.4 },
  sub: { ...bodyFont('500'), fontSize: 13, color: colors.muted },
  group: { gap: 8 },
  groupTitle: {
    ...displayFont('800'),
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    paddingLeft: 4,
  },
  stack: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  kind: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  kindPick: { backgroundColor: colors.tealSoft },
  kindFail: { backgroundColor: colors.dangerSoft },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  oid: { ...displayFont('800'), fontSize: 16, color: colors.text },
  st: { ...bodyFont('600'), color: colors.text, marginTop: 3, fontSize: 13 },
  stFail: { color: colors.danger },
  issue: { ...bodyFont('500'), color: colors.danger, marginTop: 4, fontSize: 12 },
  meta: { ...bodyFont('400'), color: colors.muted, marginTop: 4, fontSize: 12 },
  amt: { ...displayFont('800'), color: colors.teal, fontSize: 14 },
  amtZero: { color: colors.placeholder },
  emptyCard: {
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
  empty: { ...bodyFont('400'), color: colors.muted, textAlign: 'center', fontSize: 13, lineHeight: 20 },
});
