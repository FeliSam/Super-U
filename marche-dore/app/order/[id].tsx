import { AppImage } from '@/components/AppImage';
import { IconCircle, Screen, Page } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { colors } from '@/constants/theme';
import { getProduct } from '@/data/catalog';
import { formatOrderId, statusLabel, useOrders } from '@/context/OrdersContext';
import { formatFcfa } from '@/lib/format';
import { Feather } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Sum({ label, value, green, bold }: { label: string; value: string; green?: boolean; bold?: boolean }) {
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, bold && styles.sumLabelBold]}>{label}</Text>
      <Text style={[styles.sumVal, green && { color: colors.green }, bold && styles.sumValBold]}>{value}</Text>
    </View>
  );
}

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getOrder, activeOrder, orders } = useOrders();
  const order = (id ? getOrder(id) : null) ?? activeOrder ?? orders[0] ?? null;

  if (!order) {
    return (
      <Screen>
        <Page style={styles.flex}>
          <View style={[styles.header, { paddingTop: Math.max(8, insets.top ? 4 : 8) }]}>
            <IconCircle name="arrow-left" onPress={() => router.back()} />
            <Text style={styles.title}>Détails de commande</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="shopping-bag" size={28} color={colors.gold} />
            </View>
            <Text style={styles.emptyTitle}>Aucune commande</Text>
            <Text style={styles.emptyText}>Passez une commande pour voir les détails ici.</Text>
            <PressScale style={styles.emptyBtn} onPress={() => router.replace('/(tabs)')} scaleTo={0.98}>
              <Text style={styles.emptyBtnText}>Continuer vos achats</Text>
            </PressScale>
          </View>
        </Page>
      </Screen>
    );
  }

  const canTrack = order.status === 'confirmed' || order.status === 'preparing' || order.status === 'shipping';

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={[styles.header, { paddingTop: Math.max(8, insets.top ? 4 : 8) }]}>
          <IconCircle name="arrow-left" onPress={() => router.back()} />
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Détails de commande</Text>
            <Text style={styles.sub}>{formatOrderId(order.id)}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(28, insets.bottom + 16) }]}
          showsVerticalScrollIndicator={false}>
          <MotionView preset="down" delay={40}>
            <View style={styles.statusCard}>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{statusLabel(order.status)}</Text>
              </View>
              <Text style={styles.statusEta}>
                {order.dayLabel} · {order.slotLabel}
              </Text>
              <Text style={styles.statusMeta}>
                {order.itemCount} article{order.itemCount > 1 ? 's' : ''} · {formatFcfa(order.total)}
              </Text>
            </View>
          </MotionView>

          <MotionView preset="down" delay={80}>
            <View style={styles.section}>
              <Text style={styles.h}>Articles</Text>
              <View style={styles.card}>
                {order.lines.map((line, i) => {
                  const product = getProduct(line.productId);
                  return (
                    <View key={`${line.productId}-${i}`}>
                      {i > 0 ? <View style={styles.divider} /> : null}
                      <Pressable
                        style={styles.line}
                        onPress={() => product && router.push(`/product/${product.id}`)}>
                        {product?.image ? (
                          <AppImage source={product.image} frameStyle={styles.thumb} />
                        ) : (
                          <View style={[styles.thumb, styles.thumbFallback]} />
                        )}
                        <View style={styles.lineBody}>
                          <Text style={styles.lineName} numberOfLines={2}>
                            {line.name}
                          </Text>
                          <Text style={styles.lineUnit}>{line.unit}</Text>
                          <Text style={styles.linePrice}>{formatFcfa(line.unitPrice)}</Text>
                        </View>
                        <View style={styles.qtyBadge}>
                          <Text style={styles.qtyText}>×{line.qty}</Text>
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          </MotionView>

          <MotionView preset="down" delay={110}>
            <View style={styles.section}>
              <Text style={styles.h}>Livraison</Text>
              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <Feather name="map-pin" size={16} color={colors.gold} />
                  <View style={styles.infoText}>
                    <Text style={styles.infoTitle}>{order.addressLabel}</Text>
                    <Text style={styles.infoMeta}>
                      {order.addressLine}, {order.addressCity}
                    </Text>
                    <Text style={styles.infoMeta}>{order.addressPhone}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Feather name="clock" size={16} color={colors.gold} />
                  <View style={styles.infoText}>
                    <Text style={styles.infoTitle}>Créneau</Text>
                    <Text style={styles.infoMeta}>
                      {order.dayLabel} · {order.slotLabel}
                    </Text>
                  </View>
                </View>
                {order.comment ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Feather name="message-circle" size={16} color={colors.gold} />
                      <View style={styles.infoText}>
                        <Text style={styles.infoTitle}>Instructions</Text>
                        <Text style={styles.infoMeta}>{order.comment}</Text>
                      </View>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          </MotionView>

          <MotionView preset="down" delay={140}>
            <View style={styles.section}>
              <Text style={styles.h}>Paiement</Text>
              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <Feather name="credit-card" size={16} color={colors.gold} />
                  <View style={styles.infoText}>
                    <Text style={styles.infoTitle}>{order.paymentLabel}</Text>
                    {order.paymentDetail ? <Text style={styles.infoMeta}>{order.paymentDetail}</Text> : null}
                  </View>
                </View>
              </View>
            </View>
          </MotionView>

          <MotionView preset="down" delay={170}>
            <View style={styles.summary}>
              <Text style={styles.h}>Récapitulatif</Text>
              <Sum label="Sous-total" value={formatFcfa(order.subtotal)} />
              <Sum
                label="Livraison"
                value={order.delivery === 0 ? 'Offerte' : formatFcfa(order.delivery)}
              />
              {order.discount > 0 ? (
                <Sum label="Réduction" value={`−${formatFcfa(order.discount)}`} green />
              ) : null}
              <View style={styles.hr} />
              <Sum label="Total" value={formatFcfa(order.total)} bold />
            </View>
          </MotionView>

          {canTrack ? (
            <PressScale
              style={styles.trackBtn}
              onPress={() => router.push(`/tracking?id=${order.id}` as Href)}
              scaleTo={0.98}>
              <Feather name="truck" size={18} color={colors.white} />
              <Text style={styles.trackBtnText}>Suivre la livraison</Text>
            </PressScale>
          ) : null}
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  content: { paddingHorizontal: 20, gap: 18 },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cream,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold },
  statusText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  statusEta: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statusMeta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  section: { gap: 10 },
  h: { color: colors.text, fontSize: 16, fontWeight: '800' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: colors.bg },
  thumbFallback: { backgroundColor: colors.border },
  lineBody: { flex: 1, gap: 2 },
  lineName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  lineUnit: { color: colors.muted, fontSize: 12 },
  linePrice: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  qtyBadge: {
    minWidth: 36,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  qtyText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 90 },
  infoRow: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  infoText: { flex: 1, gap: 2 },
  infoTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  infoMeta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  summary: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLabel: { color: colors.muted, fontSize: 14 },
  sumLabelBold: { color: colors.text, fontWeight: '800', fontSize: 16 },
  sumVal: { color: colors.text, fontSize: 14, fontWeight: '700' },
  sumValBold: { fontSize: 18, fontWeight: '800' },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
  },
  trackBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
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
