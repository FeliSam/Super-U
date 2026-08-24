import { IconCircle, Screen, Page } from '@/components/ui';
import { colors } from '@/constants/theme';
import { notifications } from '@/data/notifications';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function NotificationsScreen() {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Notifications</Text>
            {unread > 0 ? <Text style={styles.sub}>{unread} non lue{unread > 1 ? 's' : ''}</Text> : null}
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {notifications.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => router.push(`/notifications/${item.id}`)}>
              <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
                <Feather name={item.icon} size={18} color={item.read ? colors.muted : colors.gold} />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowTitle, !item.read && styles.rowTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!item.read ? <View style={styles.dot} /> : null}
                </View>
                <Text style={styles.preview} numberOfLines={2}>
                  {item.preview}
                </Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.placeholder} />
            </Pressable>
          ))}
        </ScrollView>
      </Page>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12 },
  content: { padding: 20, gap: 10, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  rowUnread: {
    borderColor: colors.blush,
    backgroundColor: '#fffdfb',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: { backgroundColor: colors.cream },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  rowTitleUnread: { fontWeight: '700' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.terracotta,
  },
  preview: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  time: { color: colors.placeholder, fontSize: 11, marginTop: 2 },
});
