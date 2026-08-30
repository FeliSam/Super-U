import { CtaButton, IconCircle, Screen, Page } from '@/components/ui';
import { displayFont, type AppColors } from '@/constants/theme';
import { useNotifications } from '@/context/NotificationsContext';
import { useColors } from '@/context/ThemeContext';
import { goBack, navigateTab } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function NotificationDetailScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getById, markAsRead } = useNotifications();
  const notification = getById(id ?? '');

  useEffect(() => {
    if (id) markAsRead(id);
  }, [id, markAsRead]);

  if (!notification) {
    return (
      <Screen>
        <Page style={styles.flex}>
          <View style={styles.header}>
            <IconCircle name="chevron-left" onPress={() => goBack()} />
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
    if (notification.actionHref) {
      const href = notification.actionHref;
      if (href.startsWith('/(tabs)')) {
        navigateTab(href as Href);
        return;
      }
      router.push(href as Href);
      return;
    }
    if (notification.orderId) {
      router.push(`/tracking?id=${notification.orderId}` as Href);
    }
  };

  const actionLabel =
    notification.actionLabel ||
    (notification.orderId ? 'Suivre la commande' : undefined);
  const canAct = Boolean(notification.actionHref || notification.orderId);

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => goBack()} />
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

          {canAct && actionLabel ? <CtaButton label={actionLabel} onPress={onAction} /> : null}
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
      paddingVertical: 12 },
    headerSpacer: { width: 40 },
    title: { color: colors.text, fontSize: 17, ...displayFont('700') },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyText: { color: colors.muted, fontSize: 14 },
    content: { padding: 20, gap: 16, paddingBottom: 32 },
    hero: { alignItems: 'center', gap: 8, paddingVertical: 8 },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4 },
    notifTitle: {
      ...displayFont('700'),
      color: colors.text,
      fontSize: 20,
      textAlign: 'center' },
    time: { color: colors.muted, fontSize: 12 },
    card: {
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 16 },
    body: { color: colors.text, fontSize: 15, lineHeight: 22 } });
}
