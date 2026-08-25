import { AppImage } from '@/components/AppImage';
import { IconCircle, Screen, Page } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { getProduct } from '@/data/catalog';
import { useCart } from '@/context/CartContext';
import {
  formatOrderId,
  statusLabel,
  useOrders,
  canCancelOrder,
  type OrderStatus } from '@/context/OrdersContext';
import { useReviews } from '@/context/ReviewsContext';
import { formatFcfa } from '@/lib/format';
import { formatDistanceKm, formatDurationMin } from '@/lib/deliveryRouting';
import { softShadow } from '@/lib/shadow';
import { statusTone } from '@/lib/statusTone';
import { Feather } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Sum({ label, value, green, bold }: { label: string; value: string; green?: boolean; bold?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, bold && styles.sumLabelBold]}>{label}</Text>
      <Text style={[styles.sumVal, green && { color: colors.green }, bold && styles.sumValBold]}>{value}</Text>
    </View>
  );
}

function formatOrderDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit' });
}

function InfoRow({
  icon,
  title,
  lines }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  lines: string[];
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Feather name={icon} size={15} color={colors.gold} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoTitle}>{title}</Text>
        {lines.filter(Boolean).map((line) => (
          <Text key={line} style={styles.infoMeta}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function OrderDetailsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getOrder, activeOrder, orders, setStatus } = useOrders();
  const { add } = useCart();
  const { courierReviewForOrder, hasUserReviewedProduct } = useReviews();
  const [menuOpen, setMenuOpen] = useState(false);
  const orderId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
  const order = (orderId ? getOrder(orderId) : null) ?? activeOrder ?? orders[0] ?? null;

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
  const canReorder = order.status === 'delivered' || order.status === 'cancelled';
  const delivered = order.status === 'delivered';
  const cancellable = canCancelOrder(order.status);
  const tone = statusTone(order.status, colors);
  const placedAt = formatOrderDate(order.createdAt);
  const addressLine = [order.addressLine, order.addressCity].filter(Boolean).join(', ');
  const courierReview = courierReviewForOrder(order.id);

  const closeMenu = () => setMenuOpen(false);
  const runMenu = (action: () => void) => {
    closeMenu();
    requestAnimationFrame(action);
  };

  const confirmCancel = () => {
    closeMenu();
    Alert.alert(
      'Annuler la commande ?',
      'Possible uniquement avant le début de la préparation. Cette action est définitive.',
      [
        { text: 'Garder', style: 'cancel' },
        {
          text: 'Annuler la commande',
          style: 'destructive',
          onPress: () => {
            setStatus(order.id, 'cancelled');
            router.replace('/orders' as Href);
          } },
      ],
    );
  };

  const reorder = () => {
    order.lines.forEach((line) => {
      if (getProduct(line.productId)) add(line.productId, line.qty);
    });
    router.push('/(tabs)/cart' as Href);
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={[styles.header, { paddingTop: Math.max(8, insets.top ? 4 : 8) }]}>
          <IconCircle name="arrow-left" onPress={() => router.back()} />
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Détails de commande</Text>
            <Text style={styles.sub}>{formatOrderId(order.id)}</Text>
          </View>
          <IconCircle name="more-vertical" onPress={() => setMenuOpen(true)} />
        </View>

        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
          <View style={styles.menuRoot}>
            <Pressable style={styles.menuBackdrop} onPress={closeMenu} />
            <View
              style={[
                styles.menuPanel,
                softShadow({ y: 10, blur: 24, opacity: 0.14 }),
                { top: Math.max(8, insets.top ? 4 : 8) + 48, right: 16 },
              ]}>
              {canTrack ? (
                <Pressable
                  style={styles.menuItem}
                  onPress={() => runMenu(() => router.push(`/tracking?id=${order.id}` as Href))}>
                  <Feather name="navigation" size={16} color={colors.text} />
                  <Text style={styles.menuItemText}>Suivre la livraison</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.menuItem} onPress={() => runMenu(() => router.push('/orders' as Href))}>
                <Feather name="list" size={16} color={colors.text} />
                <Text style={styles.menuItemText}>Mes commandes</Text>
              </Pressable>
              {canReorder ? (
                <Pressable style={styles.menuItem} onPress={() => runMenu(reorder)}>
                  <Feather name="refresh-cw" size={16} color={colors.text} />
                  <Text style={styles.menuItemText}>Commander à nouveau</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.menuItem}
                onPress={() => runMenu(() => Linking.openURL(`tel:${order.addressPhone}`))}>
                <Feather name="phone" size={16} color={colors.text} />
                <Text style={styles.menuItemText}>Appeler le contact</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={() => runMenu(() => router.push('/help' as Href))}>
                <Feather name="help-circle" size={16} color={colors.text} />
                <Text style={styles.menuItemText}>Aide & support</Text>
              </Pressable>
              {cancellable ? (
                <>
                  <View style={styles.menuDivider} />
                  <Pressable style={styles.menuItem} onPress={confirmCancel}>
                    <Feather name="x-circle" size={16} color={colors.terracotta} />
                    <Text style={[styles.menuItemText, styles.menuItemDanger]}>Annuler la commande</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        </Modal>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(28, insets.bottom + 16) }]}
          showsVerticalScrollIndicator={false}>
          <MotionView preset="down" delay={40}>
            <View style={[styles.statusCard, softShadow({ y: 6, blur: 16, opacity: 0.06 })]}>
              <View style={styles.statusTop}>
                <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
                  <Text style={[styles.statusText, { color: tone.text }]}>{statusLabel(order.status)}</Text>
                </View>
                <Text style={styles.statusTotal}>{formatFcfa(order.total)}</Text>
              </View>
              <Text style={styles.statusEta}>
                {order.dayLabel} · {order.slotLabel}
              </Text>
              <Text style={styles.statusMeta}>
                {order.itemCount} article{order.itemCount > 1 ? 's' : ''}
                {placedAt ? ` · ${placedAt}` : ''}
              </Text>
              {canTrack ? (
                <PressScale
                  style={styles.statusTrack}
                  onPress={() => router.push(`/tracking?id=${order.id}` as Href)}
                  scaleTo={0.98}>
                  <Feather name="navigation" size={14} color={colors.onAccent} />
                  <Text style={styles.statusTrackText}>Suivre en direct</Text>
                </PressScale>
              ) : null}
            </View>
          </MotionView>

          <MotionView preset="down" delay={80}>
            <View style={styles.section}>
              <Text style={styles.h}>Articles</Text>
              <View style={[styles.card, softShadow({ y: 4, blur: 14, opacity: 0.05 })]}>
                {order.lines.map((line, i) => {
                  const product = getProduct(line.productId);
                  const lineTotal = line.unitPrice * line.qty;
                  const reviewed = hasUserReviewedProduct(line.productId);
                  return (
                    <View key={`${line.productId}-${i}`}>
                      {i > 0 ? <View style={styles.divider} /> : null}
                      <Pressable
                        style={styles.line}
                        onPress={() => product && router.push(`/product/${product.id}`)}>
                        {product?.image ? (
                          <AppImage source={product.image} frameStyle={styles.thumb} />
                        ) : (
                          <View style={[styles.thumb, styles.thumbFallback]}>
                            <Feather name="package" size={18} color={colors.placeholder} />
                          </View>
                        )}
                        <View style={styles.lineBody}>
                          <Text style={styles.lineName} numberOfLines={2}>
                            {line.name}
                          </Text>
                          <Text style={styles.lineUnit}>
                            {line.unit} · {formatFcfa(line.unitPrice)}
                          </Text>
                          <Text style={styles.linePrice}>{formatFcfa(lineTotal)}</Text>
                          {delivered ? (
                            <Pressable
                              style={[
                                styles.lineReview,
                                reviewed ? styles.lineReviewDone : styles.lineReviewCta,
                              ]}
                              onPress={() =>
                                router.push(`/product/reviews/${line.productId}` as Href)
                              }
                              hitSlop={6}>
                              <Feather
                                name={reviewed ? 'check-circle' : 'edit-3'}
                                size={14}
                                color={reviewed ? colors.green : colors.onAccent}
                              />
                              <Text
                                style={[
                                  styles.lineReviewText,
                                  { color: reviewed ? colors.green : colors.onAccent },
                                ]}>
                                {reviewed ? 'Avis publié' : 'Laisser un avis'}
                              </Text>
                            </Pressable>
                          ) : null}
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

          {delivered ? (
            <MotionView preset="down" delay={95}>
              <View style={styles.section}>
                <Text style={styles.h}>Avis livraison</Text>
                <PressScale
                  style={[
                    styles.reviewCard,
                    !courierReview && styles.reviewCardCta,
                    softShadow({ y: 4, blur: 14, opacity: 0.05 }),
                  ]}
                  onPress={() => router.push(`/tracking?id=${order.id}` as Href)}
                  scaleTo={0.98}>
                  <View
                    style={[
                      styles.reviewIcon,
                      { backgroundColor: courierReview ? colors.cream : 'rgba(255,255,255,0.2)' },
                    ]}>
                    <Feather
                      name="star"
                      size={18}
                      color={courierReview ? colors.gold : colors.onAccent}
                    />
                  </View>
                  <View style={styles.reviewBody}>
                    <Text
                      style={[
                        styles.reviewTitle,
                        !courierReview && { color: colors.onAccent },
                      ]}>
                      {courierReview
                        ? `Livreur noté ${courierReview.rating}/5`
                        : `Noter ${order.courierName}`}
                    </Text>
                    <Text
                      style={[
                        styles.reviewMeta,
                        !courierReview && { color: 'rgba(255,255,255,0.75)' },
                      ]}>
                      {courierReview
                        ? 'Merci pour votre retour'
                        : 'Évaluez la qualité de la livraison'}
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={courierReview ? colors.placeholder : colors.onAccent}
                  />
                </PressScale>
              </View>
            </MotionView>
          ) : null}

          <MotionView preset="down" delay={110}>
            <View style={styles.section}>
              <Text style={styles.h}>Livraison</Text>
              <View style={[styles.card, softShadow({ y: 4, blur: 14, opacity: 0.05 })]}>
                <InfoRow
                  icon="map-pin"
                  title={order.addressLabel || 'Adresse'}
                  lines={[addressLine, order.addressPhone]}
                />
                <View style={styles.dividerInset} />
                <InfoRow icon="clock" title="Créneau" lines={[`${order.dayLabel} · ${order.slotLabel}`]} />
                <View style={styles.dividerInset} />
                <InfoRow
                  icon="navigation"
                  title="Trajet estimé"
                  lines={[
                    `${order.storeName || 'Super U'} → ${order.addressLabel || 'Adresse'}`,
                    `${formatDistanceKm(order.routeDistanceMeters)} · ~${formatDurationMin(order.routeDurationSeconds)} (route)`,
                  ]}
                />
                {order.comment ? (
                  <>
                    <View style={styles.dividerInset} />
                    <InfoRow icon="message-circle" title="Instructions" lines={[order.comment]} />
                  </>
                ) : null}
              </View>
            </View>
          </MotionView>

          <MotionView preset="down" delay={140}>
            <View style={styles.section}>
              <Text style={styles.h}>Paiement</Text>
              <View style={[styles.card, softShadow({ y: 4, blur: 14, opacity: 0.05 })]}>
                <InfoRow
                  icon={order.paymentId === 'cod' ? 'package' : 'credit-card'}
                  title={order.paymentLabel || 'Paiement'}
                  lines={[order.paymentDetail || (order.paymentId === 'cod' ? 'Espèces au livreur' : 'Paiement validé')]}
                />
                {order.promoCode ? (
                  <>
                    <View style={styles.dividerInset} />
                    <InfoRow icon="tag" title="Code promo" lines={[order.promoCode]} />
                  </>
                ) : null}
              </View>
            </View>
          </MotionView>

          <MotionView preset="down" delay={170}>
            <View style={[styles.summary, softShadow({ y: 4, blur: 14, opacity: 0.05 })]}>
              <Text style={styles.h}>Récapitulatif</Text>
              <Sum label="Sous-total" value={formatFcfa(order.subtotal)} />
              <Sum label="Livraison" value={order.delivery === 0 ? 'Offerte' : formatFcfa(order.delivery)} />
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
              <Feather name="truck" size={18} color={colors.onAccent} />
              <Text style={styles.trackBtnText}>Suivre la livraison</Text>
            </PressScale>
          ) : null}

          {canReorder ? (
            <PressScale style={styles.reorderBtn} onPress={reorder} scaleTo={0.98}>
              <Feather name="refresh-cw" size={16} color={colors.onAccent} />
              <Text style={styles.reorderBtnText}>Commander à nouveau</Text>
            </PressScale>
          ) : null}

          {cancellable ? (
            <PressScale style={styles.cancelBtn} onPress={confirmCancel} scaleTo={0.98}>
              <Feather name="x-circle" size={16} color={colors.terracotta} />
              <Text style={styles.cancelBtnText}>Annuler la commande</Text>
            </PressScale>
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
    paddingBottom: 8,
    gap: 10 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 40 },
  title: { ...displayFont('700'), color: colors.text, fontSize: 18 },
  sub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  content: { paddingHorizontal: 20, gap: 18 },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 16,
    gap: 8 },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '800' },
  statusTotal: { ...displayFont('700'), color: colors.text, fontSize: 18 },
  statusEta: { ...displayFont('700'), color: colors.text, fontSize: 20 },
  statusMeta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  statusTrack: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10 },
  statusTrackText: { color: colors.onAccent, fontSize: 13, fontWeight: '800' },
  section: { gap: 10 },
  h: { ...displayFont('700'), color: colors.text, fontSize: 17 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14 },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: colors.bg },
  thumbFallback: {
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center' },
  lineBody: { flex: 1, gap: 2 },
  lineName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  lineUnit: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  linePrice: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  lineReview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7 },
  lineReviewCta: { backgroundColor: colors.gold },
  lineReviewDone: { backgroundColor: colors.successSoft },
  lineReviewText: { fontSize: 12, fontWeight: '700' },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14 },
  reviewCardCta: { backgroundColor: colors.gold },
  reviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center' },
  reviewBody: { flex: 1, gap: 2 },
  reviewTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  reviewMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  qtyBadge: {
    minWidth: 36,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8 },
  qtyText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 90 },
  dividerInset: { height: 1, backgroundColor: colors.border, marginLeft: 58 },
  infoRow: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center' },
  infoText: { flex: 1, gap: 2, paddingTop: 2 },
  infoTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  infoMeta: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  summary: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    gap: 10 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLabel: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  sumLabelBold: { ...displayFont('700'), color: colors.text, fontSize: 16 },
  sumVal: { color: colors.text, fontSize: 14, fontWeight: '700' },
  sumValBold: { ...displayFont('700'), fontSize: 20 },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingVertical: 16 },
  trackBtnText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.text,
    borderRadius: 16,
    paddingVertical: 16 },
  reorderBtnText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.blush,
    borderColor: 'rgba(200,75,49,0.22)',
    borderRadius: 16,
    paddingVertical: 14 },
  cancelBtnText: { color: colors.terracotta, fontSize: 14, fontWeight: '800' },
  menuRoot: { flex: 1 },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,22,19,0.28)' },
  menuPanel: {
    position: 'absolute',
    minWidth: 220,
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 6,
    overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13 },
  menuItemText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  menuItemDanger: { color: colors.terracotta },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
    marginHorizontal: 12 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6 },
  emptyTitle: { ...displayFont('700'), color: colors.text, fontSize: 18 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 10,
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14 },
  emptyBtnText: { color: colors.onAccent, fontSize: 14, fontWeight: '800' } });
}
