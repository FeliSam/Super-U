import { IconCircle, Screen, Page } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { colors } from '@/constants/theme';
import { formatOrderId, statusLabel, useOrders, type Order } from '@/context/OrdersContext';
import { formatFcfa } from '@/lib/format';
import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function OrderRow({ order }: { order: Order }) {
  const active = order.status === 'confirmed' || order.status === 'preparing' || order.status === 'shipping';
  return (
    <PressScale
      style={styles.row}
      onPress={() =>
        router.push((active ? `/tracking?id=${order.id}` : `/order/${order.id}`) as Href)
      }
      scaleTo={0.985}>
      <View style={[styles.icon, active && styles.iconActive]}>
        <Feather name={active ? 'truck' : 'package'} size={18} color={active ? colors.gold : colors.muted} />
      </View>
      <View style={styles.body}>
        <Text style={styles.id}>{formatOrderId(order.id)}</Text>
        <Text style={styles.meta}>
          {statusLabel(order.status)} · {order.itemCount} article{order.itemCount > 1 ? 's' : ''}
        </Text>
        <Text style={styles.slot}>
          {order.dayLabel} · {order.slotLabel}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.total}>{formatFcfa(order.total)}</Text>
        <Feather name="chevron-right" size={18} color={colors.placeholder} />
      </View>
    </PressScale>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { orders } = useOrders();

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={[styles.header, { paddingTop: Math.max(8, insets.top ? 4 : 8) }]}>
          <IconCircle name="arrow-left" onPress={() => router.back()} />
          <Text style={styles.title}>Mes commandes</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(28, insets.bottom + 16) }]}
          showsVerticalScrollIndicator={false}>
          {orders.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name="box" size={28} color={colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>Pas encore de commande</Text>
              <Text style={styles.emptyText}>Vos commandes apparaîtront ici après le paiement.</Text>
              <PressScale style={styles.emptyBtn} onPress={() => router.replace('/(tabs)')} scaleTo={0.98}>
                <Text style={styles.emptyBtnText}>Découvrir le catalogue</Text>
              </PressScale>
            </View>
          ) : (
            <MotionView preset="down" delay={40} style={styles.list}>
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </MotionView>
          )}
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
    paddingBottom: 8,
    gap: 10,
  },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  content: { paddingHorizontal: 20, flexGrow: 1 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: { backgroundColor: colors.cream },
  body: { flex: 1, gap: 2 },
  id: { color: colors.text, fontSize: 15, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  slot: { color: colors.placeholder, fontSize: 12 },
  right: { alignItems: 'flex-end', gap: 6 },
  total: { color: colors.text, fontSize: 14, fontWeight: '800' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
    paddingTop: 48,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 10,
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  emptyBtnText: { color: colors.white, fontSize: 14, fontWeight: '800' },
});
