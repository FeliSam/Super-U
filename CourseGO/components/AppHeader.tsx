import { IconBtn } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useStaffNotifications } from '@/context/NotificationsContext';
import { staffPhotoSource } from '@/lib/staffPhoto';
import { router } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';

export function AppHeader({
  hello,
  title,
  subtitle,
}: {
  hello?: string;
  title: string;
  subtitle?: string;
}) {
  const { staff } = useStaffAuth();
  const { unreadCount } = useStaffNotifications();
  return (
    <View style={styles.top}>
      <View style={styles.user}>
        <Image source={staffPhotoSource(staff?.photoUrl)} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          {hello ? <Text style={styles.hello}>{hello}</Text> : null}
          <Text style={styles.name} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        <IconBtn name="bell" bg={colors.white} badge={unreadCount} onPress={() => router.push('/notifications')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    gap: 12,
  },
  user: { flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  hello: { ...bodyFont('400'), fontSize: 13, color: colors.muted },
  name: { ...displayFont('800'), fontSize: 18, color: colors.text },
  sub: { ...bodyFont('500'), fontSize: 12, color: colors.muted, marginTop: 2 },
});
