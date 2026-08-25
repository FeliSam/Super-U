import { CtaButton, IconCircle, Screen, Page } from '@/components/ui';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { getNotification } from '@/data/notifications';
import { navigateTab } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function NotificationDetailScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const notification = getNotification(id ?? '');

  if (!notification) {
    return (
      <Screen>
        <Page style={styles.flex}>
          <View style={styles.header}>
            <IconCircle name="chevron-left" onPress={() => router.back()} />
            <Text style={styles.title}>Notification</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Notification introuvable.</Text>
          </View>
        </Page>
      </Screen>
    );
  }

  const onAction = () => {
    if (!notification.actionHref) return;
    if (notification.actionHref.startsWith('/(tabs)')) {
      navigateTab(notification.actionHref);
      return;
    }
    router.push(notification.actionHref as never);
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <Text style={styles.title}>Détail</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.iconWrap}>
              <Feather name={notification.icon} size={22} color={colors.gold} />
            </View>
            <Text style={styles.notifTitle}>{notification.title}</Text>
            <Text style={styles.time}>{notification.time}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.body}>{notification.body}</Text>
          </View>

          {notification.actionLabel && notification.actionHref ? (
            <CtaButton label={notification.actionLabel} onPress={onAction} />
          ) : null}
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 18, ...displayFont('700') },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  hero: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  time: { color: colors.placeholder, fontSize: 13 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
  },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { color: colors.muted, fontSize: 15 },
});
}
