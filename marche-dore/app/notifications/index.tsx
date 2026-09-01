import { IconCircle, Screen, Page } from '@/components/ui';
import { displayFont, type AppColors, spacing } from '@/constants/theme';
import { useNotifications } from '@/context/NotificationsContext';
import { useColors } from '@/context/ThemeContext';
import { goBack, navigateTab } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function NotificationsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { items, unreadCount, markAllAsRead, markAsRead } = useNotifications();

  const openHref = (href: string) => {
    if (href.startsWith('/(tabs)')) {
      navigateTab(href as Href);
      return;
    }
    router.push(href as Href);
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => goBack()} />
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 ? (
              <Text style={styles.sub}>
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </Text>
            ) : (
              <Text style={styles.sub}>Tout est à jour</Text>
            )}
          </View>
          {unreadCount > 0 ? (
            <Pressable
              onPress={markAllAsRead}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Tout marquer comme lu">
              <Text style={styles.markAll}>Tout lire</Text>
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bell" size={28} color={colors.placeholder} />
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptySub}>
                Les mises à jour de vos commandes apparaîtront ici.
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.row, !item.read && styles.rowUnread]}
                onPress={() => {
                  markAsRead(item.id);
                  router.push(`/notifications/${item.id}`);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}${item.read ? '' : ', non lue'}`}>
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
                  <View style={styles.rowMeta}>
                    <Text style={styles.time}>{item.time}</Text>
                    {item.actionLabel && item.actionHref ? (
                      <Pressable
                        style={styles.actionChip}
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          markAsRead(item.id);
                          openHref(item.actionHref!);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={item.actionLabel}>
                        <Text style={styles.actionChipText}>{item.actionLabel}</Text>
                        <Feather name="arrow-right" size={12} color={colors.gold} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.placeholder} />
              </Pressable>
            ))
          )}
        </ScrollView>
      </Page>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screen,
      paddingVertical: 12,
      gap: 8,
    },
    headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
    headerSpacer: { width: 64 },
    markAll: { color: colors.gold, fontSize: 13, fontWeight: '700', width: 64, textAlign: 'right' },
    title: { color: colors.text, fontSize: 18, ...displayFont('700') },
    sub: { color: colors.muted, fontSize: 12 },
    content: { padding: 20, gap: 10, paddingBottom: 32 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 14,
      minHeight: 72,
    },
    rowUnread: {
      backgroundColor: colors.selectSoft,
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
    rowMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 2,
      flexWrap: 'wrap',
    },
    time: { color: colors.placeholder, fontSize: 11 },
    actionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.cream,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      minHeight: 28,
    },
    actionChipText: { color: colors.gold, fontSize: 11, fontWeight: '700' },
    empty: {
      alignItems: 'center',
      gap: 10,
      paddingVertical: 48,
      paddingHorizontal: spacing.screenLg,
    },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    emptySub: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  });
}
