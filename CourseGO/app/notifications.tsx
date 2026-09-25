import { IconBtn, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { useStaffNotifications } from '@/context/NotificationsContext';
import { goBack, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type FeatherName = ComponentProps<typeof Feather>['name'];

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

function kindIcon(kind: string): FeatherName {
  switch (kind) {
    case 'pick':
    case 'job':
      return 'package';
    case 'deliver':
    case 'order':
      return 'truck';
    case 'tip':
      return 'gift';
    case 'rating':
      return 'star';
    case 'chat':
      return 'message-circle';
    case 'call':
      return 'phone';
    case 'incident':
    case 'incident_action':
      return 'alert-triangle';
    default:
      return 'bell';
  }
}

export default function NotificationsScreen() {
  const { items, unreadCount, markRead, markAllRead } = useStaffNotifications();

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: StaffNotification[] }>();
    for (const n of items) {
      const key = dayKey(n.created_at);
      const cur = map.get(key);
      if (cur) cur.rows.push(n);
      else map.set(key, { label: dayLabel(n.created_at), rows: [n] });
    }
    return [...map.values()];
  }, [items]);

  return (
    <Screen>
      <View style={styles.nav}>
        <IconBtn name="chevron-left" bg={colors.white} onPress={() => goBack(tabPaths.home)} />
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={() => void markAllRead()} hitSlop={8} style={styles.markAll}>
            <Text style={styles.markAllTxt}>Tout lu</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}>
        {unreadCount > 0 ? (
          <Text style={styles.sub}>
            {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
          </Text>
        ) : items.length ? (
          <Text style={styles.sub}>Tout est à jour</Text>
        ) : null}

        {groups.map((g) => (
          <View key={g.label} style={styles.group}>
            <Text style={styles.groupTitle}>{g.label}</Text>
            {g.rows.map((n) => {
              const unread = !n.read_at;
              return (
                <Pressable
                  key={n.id}
                  style={[styles.row, unread && styles.unread]}
                  onPress={() => {
                    void markRead(n.id);
                    if (n.href) router.push(n.href as never);
                  }}>
                  <View style={[styles.icon, unread && styles.iconUnread]}>
                    <Feather name={kindIcon(n.kind)} size={16} color={colors.teal} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.rowTop}>
                      <Text style={styles.oid} numberOfLines={2}>
                        {n.title}
                      </Text>
                      {unread ? <View style={styles.dot} /> : null}
                    </View>
                    {n.live_hint ? <Text style={styles.hint}>{n.live_hint}</Text> : null}
                    {n.body ? (
                      <Text style={styles.prev} numberOfLines={2}>
                        {n.body}
                      </Text>
                    ) : null}
                    <Text style={styles.when}>{clock(n.created_at)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {!items.length ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Feather name="bell" size={22} color={colors.teal} />
            </View>
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.empty}>
              Les nouvelles courses, messages clients, appels et avis apparaissent ici.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  title: { ...displayFont('800'), fontSize: 18, color: colors.text },
  markAll: {
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  markAllTxt: { ...bodyFont('700'), color: colors.teal, fontSize: 13 },
  scroller: { flex: 1, width: '100%', overflow: 'hidden' },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 14,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  sub: { ...bodyFont('500'), fontSize: 13, color: colors.muted, paddingHorizontal: 4 },
  group: { gap: 8 },
  groupTitle: {
    ...displayFont('800'),
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    paddingLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadow.card,
  },
  unread: { backgroundColor: colors.tealSoft, borderColor: 'rgba(5,141,129,0.28)' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUnread: { backgroundColor: colors.white },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  oid: { ...displayFont('700'), fontSize: 15, color: colors.text, flex: 1 },
  hint: { ...bodyFont('700'), color: colors.teal, fontSize: 12, marginTop: 4 },
  prev: { ...bodyFont('400'), color: colors.muted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  when: { ...bodyFont('500'), color: colors.placeholder, fontSize: 11, marginTop: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coral,
    marginTop: 6,
  },
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
