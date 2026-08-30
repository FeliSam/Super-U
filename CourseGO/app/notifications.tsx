import { IconBtn, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useStaffNotifications } from '@/context/NotificationsContext';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return t;
  return `${d.toLocaleDateString('fr-FR')} · ${t}`;
}

export default function NotificationsScreen() {
  const { items, unreadCount, markRead, markAllRead } = useStaffNotifications();
  return (
    <Screen>
      <View style={styles.nav}>
        <IconBtn name="chevron-left" onPress={() => router.back()} />
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>
      {unreadCount > 0 ? (
        <Pressable onPress={() => void markAllRead()} style={styles.markAll}>
          <Text style={styles.markAllTxt}>Tout marquer lu</Text>
        </Pressable>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12, paddingTop: unreadCount > 0 ? 8 : 24 }}>
        {items.map((n) => (
          <Pressable
            key={n.id}
            style={[styles.row, !n.read_at && styles.unread]}
            onPress={() => {
              void markRead(n.id);
              if (n.href) router.push(n.href as never);
            }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.oid}>{n.title}</Text>
              {n.live_hint ? <Text style={styles.hint}>{n.live_hint}</Text> : null}
              {n.body ? (
                <Text style={styles.prev} numberOfLines={2}>
                  {n.body}
                </Text>
              ) : null}
              <Text style={styles.when}>{formatWhen(n.created_at)}</Text>
            </View>
            {!n.read_at ? <View style={styles.dot} /> : null}
          </Pressable>
        ))}
        {!items.length ? (
          <Text style={styles.empty}>
            Les nouvelles courses, messages clients, appels et avis apparaissent ici.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56 },
  title: { ...displayFont('800'), fontSize: 18 },
  markAll: { alignSelf: 'flex-end', paddingHorizontal: 24, paddingBottom: 4 },
  markAllTxt: { ...bodyFont('700'), color: colors.teal, fontSize: 13 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  unread: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  oid: { ...displayFont('700'), fontSize: 15 },
  hint: { ...bodyFont('700'), color: colors.teal, fontSize: 12, marginTop: 4 },
  prev: { ...bodyFont('400'), color: colors.muted, marginTop: 4 },
  when: { ...bodyFont('500'), color: colors.placeholder, fontSize: 11, marginTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral },
  empty: { ...bodyFont('400'), color: colors.muted },
});
