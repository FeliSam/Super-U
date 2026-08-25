import { AppImage } from '@/components/AppImage';
import { IconCircle, Screen, Page } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { avatar } from '@/data/catalog';
import { formatOrderId, statusLabel, useOrders, canCancelOrder, DEMO_STATUS_TIMELINE, type Order, type OrderStatus } from '@/context/OrdersContext';
import { formatFcfa } from '@/lib/format';
import { softShadow } from '@/lib/shadow';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type StepState = 'done' | 'active' | 'pending';

type TimelineStep = {
  label: string;
  hint: string;
  time: string;
  state: StepState;
  icon: React.ComponentProps<typeof Feather>['name'];
};

function parseOrderDate(raw: string | undefined) {
  const d = raw ? new Date(raw) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatClock(d: Date) {
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function paymentHint(order: Order) {
  const label = (order.paymentLabel || '').trim();
  if (order.paymentId === 'cod' || /livraison/i.test(label)) return 'Paiement à la livraison';
  if (order.paymentDetail) {
    return label ? `${label} · ${order.paymentDetail}` : order.paymentDetail;
  }
  if (label) return `${label} validé`;
  return 'Paiement validé';
}

function statusRank(status: OrderStatus) {
  switch (status) {
    case 'delivered':
      return 3;
    case 'shipping':
      return 2;
    case 'preparing':
      return 1;
    case 'confirmed':
      return 0;
    case 'cancelled':
      return -1;
    default:
      return 0;
  }
}

function buildSteps(order: Order): TimelineStep[] {
  const t = parseOrderDate(order.createdAt);
  const at = (status: OrderStatus) => {
    const step = DEMO_STATUS_TIMELINE.find((s) => s.status === status);
    return new Date(t.getTime() + (step?.afterMs ?? 0));
  };

  const defs: Omit<TimelineStep, 'state' | 'time'>[] = [
    { label: 'Commande confirmée', hint: paymentHint(order), icon: 'check' },
    { label: 'Préparation en cours', hint: 'Assemblage de votre panier', icon: 'package' },
    { label: 'En route', hint: 'Votre livreur est en chemin', icon: 'truck' },
    { label: 'Livrée', hint: 'Bon appétit !', icon: 'home' },
  ];

  if (order.status === 'cancelled') {
    return [
      {
        label: 'Commande annulée',
        hint: 'Annulée avant la préparation',
        icon: 'x',
        time: formatClock(t),
        state: 'active' as const,
      },
      ...defs.slice(1).map((d) => ({ ...d, time: '', state: 'pending' as const })),
    ];
  }

  const rank = statusRank(order.status);
  const times = [
    formatClock(at('confirmed')),
    rank >= 1 ? formatClock(at('preparing')) : '',
    rank >= 2 ? formatClock(at('shipping')) : '',
    rank >= 3 ? formatClock(at('delivered')) : '',
  ];

  return defs.map((d, i) => ({
    ...d,
    time: times[i],
    state: i < rank ? 'done' : i === rank ? 'active' : 'pending',
  }));
}

function mapBadgeText(status: OrderStatus) {
  switch (status) {
    case 'confirmed':
      return 'Commande reçue par le magasin';
    case 'preparing':
      return 'Préparation de votre panier';
    case 'shipping':
      return 'Livreur en route vers vous';
    case 'delivered':
      return 'Commande livrée';
    case 'cancelled':
      return 'Commande annulée';
    default:
      return 'Suivi de votre commande';
  }
}

function statusTone(status: OrderStatus, colors: AppColors) {
  switch (status) {
    case 'confirmed':
      return { bg: '#eaf4ec', text: colors.green, dot: colors.green };
    case 'preparing':
      return { bg: colors.cream, text: colors.gold, dot: colors.gold };
    case 'shipping':
      return { bg: colors.blush, text: colors.terracotta, dot: colors.terracotta };
    case 'delivered':
      return { bg: '#eaf4ec', text: colors.green, dot: colors.green };
    case 'cancelled':
      return { bg: '#f3eeeb', text: colors.muted, dot: colors.muted };
    default:
      return { bg: colors.cream, text: colors.gold, dot: colors.gold };
  }
}

function courierLeftPct(status: OrderStatus) {
  switch (status) {
    case 'confirmed':
      return 22;
    case 'preparing':
      return 38;
    case 'shipping':
      return 58;
    case 'delivered':
      return 72;
    default:
      return 30;
  }
}

function PulseDot({ color }: { color?: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const resolvedColor = color ?? colors.terracotta;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.7, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0.15, { duration: 900 }), withTiming(0.55, { duration: 900 })),
      -1,
      false,
    );
  }, [opacity, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { backgroundColor: resolvedColor }, ringStyle]} />
      <View style={[styles.pulseCore, { backgroundColor: resolvedColor }]} />
    </View>
  );
}

function CourierMarker() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [bob]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  return (
    <Animated.View style={[styles.courierPin, style]}>
      <View style={styles.courierPinGlow} />
      <View style={styles.courierPinInner}>
        <Feather name="navigation" size={15} color={colors.white} />
      </View>
    </Animated.View>
  );
}

function InfoRow({
  icon,
  title,
  lines,
}: {
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

export default function TrackingScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getOrder, activeOrder, orders, ready, setStatus } = useOrders();
  const orderId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
  const order = (orderId ? getOrder(orderId) : null) ?? activeOrder ?? orders[0] ?? null;

  const steps = useMemo(() => (order ? buildSteps(order) : []), [order]);
  const activeStep = steps.findIndex((s) => s.state === 'active');
  const activeIndex = activeStep >= 0 ? activeStep : Math.max(0, steps.findIndex((s) => s.state === 'done'));
  const progress = steps.length > 1 ? ((activeIndex + 0.15) / (steps.length - 1)) * 100 : 0;
  const tone = order ? statusTone(order.status, colors) : statusTone('confirmed', colors);
  const cancellable = order ? canCancelOrder(order.status) : false;
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const confirmCancel = () => {
    if (!order || !cancellable) return;
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
          },
        },
      ],
    );
  };

  const runMenu = (action: () => void) => {
    closeMenu();
    // Let the modal close before navigating / alerting.
    requestAnimationFrame(action);
  };

  if (!ready) {
    return (
      <Screen>
        <Page style={styles.flex} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <Page style={styles.flex}>
          <View style={[styles.header, { paddingTop: Math.max(8, insets.top ? 4 : 8) }]}>
            <IconCircle name="chevron-left" onPress={() => router.back()} />
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Suivi de commande</Text>
              <Text style={styles.sub}>Aucune commande active</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="truck" size={28} color={colors.gold} />
            </View>
            <Text style={styles.emptyTitle}>Rien à suivre pour le moment</Text>
            <Text style={styles.emptyText}>
              Ajoutez des produits au panier, validez le paiement, puis suivez votre livraison ici.
            </Text>
            <PressScale style={styles.emptyBtn} onPress={() => router.replace('/(tabs)/cart')} scaleTo={0.98}>
              <Text style={styles.emptyBtnText}>Voir mon panier</Text>
            </PressScale>
            <PressScale style={styles.emptyGhost} onPress={() => router.push('/orders' as Href)} scaleTo={0.98}>
              <Text style={styles.emptyGhostText}>Historique des commandes</Text>
            </PressScale>
          </View>
        </Page>
      </Screen>
    );
  }

  const etaLabel = [order.dayLabel, order.slotLabel].filter(Boolean).join(' · ');
  const addressLine = [order.addressLine, order.addressCity].filter(Boolean).join(', ');
  const paymentLines = [order.paymentDetail].filter(Boolean) as string[];
  const pinLeft = `${courierLeftPct(order.status)}%`;

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={[styles.header, { paddingTop: Math.max(8, insets.top ? 4 : 8) }]}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Suivi de commande</Text>
            <Text style={styles.sub}>N° {formatOrderId(order.id)}</Text>
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
              <Pressable
                style={styles.menuItem}
                onPress={() => runMenu(() => router.push(`/order/${order.id}` as Href))}>
                <Feather name="file-text" size={16} color={colors.text} />
                <Text style={styles.menuItemText}>Voir le détail</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() => runMenu(() => router.push('/orders' as Href))}>
                <Feather name="list" size={16} color={colors.text} />
                <Text style={styles.menuItemText}>Mes commandes</Text>
              </Pressable>
              {order.status !== 'cancelled' ? (
                <Pressable
                  style={styles.menuItem}
                  onPress={() => runMenu(() => Linking.openURL(`tel:${order.courierPhone}`))}>
                  <Feather name="phone" size={16} color={colors.text} />
                  <Text style={styles.menuItemText}>Appeler le livreur</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.menuItem}
                onPress={() => runMenu(() => router.push('/help' as Href))}>
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
            <LinearGradient colors={['#eef5ea', '#e4eee0', '#f3f7f0']} style={styles.map}>
              <View style={styles.mapParkA} />
              <View style={styles.mapParkB} />
              <View style={styles.roadShadow} />
              <View style={styles.road} />
              <View style={styles.roadDash} />

              <View style={[styles.mapLabel, styles.mapLabelStore]}>
                <View style={[styles.mapLabelDot, { backgroundColor: colors.green }]} />
                <Text style={styles.mapLabelText}>Marché Doré</Text>
              </View>
              <View style={[styles.mapLabel, styles.mapLabelHome]}>
                <View style={[styles.mapLabelDot, { backgroundColor: colors.gold }]} />
                <Text style={styles.mapLabelText} numberOfLines={1}>
                  {order.addressLabel || 'Chez vous'}
                </Text>
              </View>

              <View style={[styles.marker, styles.markerHome]}>
                <Feather name="home" size={14} color={colors.white} />
              </View>
              <View style={[styles.courierPinWrap, { left: pinLeft }]}>
                <CourierMarker />
              </View>
              <View style={[styles.marker, styles.markerStore]}>
                <Feather name="shopping-bag" size={13} color={colors.white} />
              </View>

              <View style={styles.mapBadge}>
                <PulseDot color={tone.dot} />
                <Text style={styles.mapBadgeText}>{mapBadgeText(order.status)}</Text>
              </View>
            </LinearGradient>
          </MotionView>

          <MotionView preset="down" delay={60}>
            <PressScale
              style={[styles.details, softShadow({ y: 4, blur: 14, opacity: 0.05 })]}
              onPress={() => router.push(`/order/${order.id}` as Href)}
              scaleTo={0.985}>
              <View style={styles.detailsIcon}>
                <Feather name="shopping-bag" size={18} color={colors.gold} />
              </View>
              <View style={styles.detailsText}>
                <Text style={styles.detailsLeft}>Articles & total</Text>
                <Text style={styles.detailsRight}>
                  {order.itemCount} article{order.itemCount > 1 ? 's' : ''} · {formatFcfa(order.total)}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.placeholder} />
            </PressScale>
          </MotionView>

          <MotionView preset="down" delay={80}>
            <View style={[styles.card, softShadow({ y: 6, blur: 18, opacity: 0.06 })]}>
              <View style={styles.etaRow}>
                <View style={styles.etaTextBlock}>
                  <Text style={styles.meta}>Livraison estimée</Text>
                  <Text style={styles.eta}>{etaLabel || 'Créneau à confirmer'}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: tone.bg }]}>
                  <View style={[styles.tagDot, { backgroundColor: tone.dot }]} />
                  <Text style={[styles.tagText, { color: tone.text }]}>{statusLabel(order.status)}</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(8, progress))}%` }]} />
              </View>
              <View style={styles.progressMeta}>
                <Text style={styles.progressLabel}>
                  Étape {activeIndex + 1}/{steps.length}
                </Text>
                <Text style={styles.progressLabel}>{Math.round(Math.min(100, progress))} %</Text>
              </View>

              <View style={styles.hr} />
              <View style={styles.current}>
                <PulseDot color={tone.dot} />
                <Text style={styles.currentText}>
                  {steps[activeIndex]?.hint ?? 'Votre commande est en cours de traitement.'}
                </Text>
              </View>
            </View>
          </MotionView>

          <MotionView preset="down" delay={110}>
            <View style={[styles.card, softShadow({ y: 6, blur: 18, opacity: 0.06 })]}>
              <Text style={styles.cardTitle}>Récapitulatif</Text>
              <InfoRow icon="map-pin" title={order.addressLabel || 'Adresse'} lines={[addressLine, order.addressPhone]} />
              <View style={styles.hr} />
              <InfoRow icon="clock" title="Créneau" lines={[etaLabel]} />
              <View style={styles.hr} />
              <InfoRow
                icon={order.paymentId === 'cod' ? 'package' : 'credit-card'}
                title={order.paymentLabel || 'Paiement'}
                lines={paymentLines.length ? paymentLines : [paymentHint(order)]}
              />
              {order.comment ? (
                <>
                  <View style={styles.hr} />
                  <InfoRow icon="message-circle" title="Instructions" lines={[order.comment]} />
                </>
              ) : null}
            </View>
          </MotionView>

          <MotionView preset="down" delay={140}>
            <Text style={styles.h}>Étapes de livraison</Text>
            <View style={[styles.timeline, softShadow({ y: 6, blur: 18, opacity: 0.06 })]}>
              {steps.map((step, i) => {
                const isLast = i === steps.length - 1;
                return (
                  <MotionView key={step.label} index={i} preset="right" style={styles.step}>
                    <View style={styles.col}>
                      <View
                        style={[
                          styles.node,
                          step.state === 'done' && styles.nodeDone,
                          step.state === 'active' && styles.nodeActive,
                          step.state === 'pending' && styles.nodePending,
                        ]}>
                        {step.state === 'done' ? (
                          <Feather name="check" size={12} color={colors.white} />
                        ) : (
                          <Feather
                            name={step.icon}
                            size={step.state === 'active' ? 12 : 11}
                            color={step.state === 'active' ? colors.white : colors.placeholder}
                          />
                        )}
                      </View>
                      {!isLast ? (
                        <View
                          style={[
                            styles.vline,
                            step.state === 'done' && styles.vlineDone,
                            step.state === 'active' && styles.vlineActive,
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={styles.stepBody}>
                      <Text
                        style={[
                          styles.stepLabel,
                          step.state === 'pending' && styles.stepLabelPending,
                          step.state === 'active' && styles.stepLabelActive,
                        ]}>
                        {step.label}
                      </Text>
                      <Text style={[styles.stepHint, step.state === 'pending' && styles.stepHintPending]}>
                        {step.hint}
                      </Text>
                    </View>
                    <Text style={[styles.time, step.state === 'active' && styles.timeActive]}>
                      {step.time || '—'}
                    </Text>
                  </MotionView>
                );
              })}
            </View>
          </MotionView>

          <MotionView preset="down" delay={180}>
            {order.status === 'cancelled' ? (
              <View style={[styles.cancelledBanner, softShadow({ y: 4, blur: 12, opacity: 0.05 })]}>
                <Feather name="x-circle" size={18} color={colors.muted} />
                <View style={styles.cancelledText}>
                  <Text style={styles.cancelledTitle}>Commande annulée</Text>
                  <Text style={styles.cancelledMeta}>Aucun livreur ne sera envoyé pour cette commande.</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.courier, softShadow({ y: 6, blur: 18, opacity: 0.06 })]}>
                <View style={styles.avatarWrap}>
                  <AppImage source={avatar} frameStyle={styles.avatar} />
                  <View style={styles.onlineDot} />
                </View>
                <View style={styles.courierText}>
                  <Text style={styles.name}>{order.courierName}</Text>
                  <Text style={styles.meta}>Livreur Marché Doré · 4.9 ★</Text>
                </View>
                <View style={styles.courierActions}>
                  <IconCircle name="message-circle" onPress={() => router.push('/chat/courier-moussa' as Href)} />
                  <IconCircle name="phone" onPress={() => Linking.openURL(`tel:${order.courierPhone}`)} />
                </View>
              </View>
            )}
          </MotionView>

          <PressScale style={styles.help} onPress={() => router.push('/help')} scaleTo={0.98}>
            <Feather name="help-circle" size={15} color={colors.muted} />
            <Text style={styles.helpText}>Besoin d’aide ? Contacter le support</Text>
          </PressScale>
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
    gap: 10,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { ...displayFont('700'), color: colors.text, fontSize: 18 },
  sub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  content: { paddingHorizontal: 20, gap: 16 },
  map: {
    height: 216,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(73,140,83,0.14)',
  },
  mapParkA: {
    position: 'absolute',
    width: 70,
    height: 48,
    borderRadius: 20,
    backgroundColor: 'rgba(73,140,83,0.12)',
    top: 28,
    left: 24,
  },
  mapParkB: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(226,147,29,0.12)',
    bottom: 70,
    right: 36,
  },
  roadShadow: {
    position: 'absolute',
    left: 28,
    top: 58,
    width: 300,
    height: 18,
    backgroundColor: 'rgba(28,22,19,0.08)',
    borderRadius: 10,
    transform: [{ rotate: '-16deg' }],
  },
  road: {
    position: 'absolute',
    left: 26,
    top: 54,
    width: 300,
    height: 14,
    backgroundColor: '#cfc8bc',
    borderRadius: 8,
    transform: [{ rotate: '-16deg' }],
  },
  roadDash: {
    position: 'absolute',
    left: 40,
    top: 59,
    width: 260,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-16deg' }],
  },
  mapLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 140,
  },
  mapLabelDot: { width: 6, height: 6, borderRadius: 3 },
  mapLabelStore: { top: 16, right: 48 },
  mapLabelHome: { bottom: 58, left: 44 },
  mapLabelText: { color: colors.text, fontSize: 10, fontWeight: '700', flexShrink: 1 },
  marker: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    ...softShadow({ y: 3, blur: 8, opacity: 0.16, elevation: 3 }),
  },
  markerHome: { left: 72, bottom: 46, backgroundColor: colors.gold },
  markerStore: { right: 72, top: 40, backgroundColor: colors.green },
  courierPinWrap: { position: 'absolute', top: 64, marginLeft: -19 },
  courierPin: { alignItems: 'center', justifyContent: 'center' },
  courierPinGlow: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(200,75,49,0.22)',
  },
  courierPinInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  mapBadge: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mapBadgeText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
  pulseWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  pulseCore: { width: 8, height: 8, borderRadius: 4 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  cardTitle: { ...displayFont('700'), color: colors.text, fontSize: 16 },
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  etaTextBlock: { flex: 1 },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  eta: { ...displayFont('700'), color: colors.text, fontSize: 22, marginTop: 4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagDot: { width: 7, height: 7, borderRadius: 4 },
  tagText: { fontWeight: '800', fontSize: 12 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.terracotta,
  },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: colors.placeholder, fontSize: 11, fontWeight: '700' },
  hr: { height: 1, backgroundColor: colors.border },
  current: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  currentText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1, gap: 2, paddingTop: 2 },
  infoTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  infoMeta: { color: colors.muted, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  h: { ...displayFont('700'), color: colors.text, fontSize: 17, marginBottom: 2 },
  timeline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 64, gap: 10 },
  col: { width: 28, alignItems: 'center' },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  nodeDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  nodeActive: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  nodePending: { backgroundColor: colors.bg, borderColor: colors.border },
  vline: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  vlineDone: { backgroundColor: colors.gold },
  vlineActive: { backgroundColor: 'rgba(200,75,49,0.35)' },
  stepBody: { flex: 1, paddingTop: 3, gap: 2 },
  stepLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  stepLabelActive: { color: colors.terracotta },
  stepLabelPending: { color: colors.placeholder },
  stepHint: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  stepHintPending: { color: colors.placeholder },
  time: { color: colors.muted, fontSize: 12, fontWeight: '700', paddingTop: 6, minWidth: 36, textAlign: 'right' },
  timeActive: { color: colors.terracotta },
  courier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 14,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.white,
  },
  courierText: { flex: 1, gap: 2 },
  name: { color: colors.text, fontWeight: '800', fontSize: 15 },
  courierActions: { flexDirection: 'row', gap: 8 },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  detailsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsText: { flex: 1, gap: 2 },
  detailsLeft: { color: colors.text, fontWeight: '700', fontSize: 14 },
  detailsRight: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 14,
  },
  cancelledText: { flex: 1, gap: 2 },
  cancelledTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  cancelledMeta: { color: colors.muted, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  menuRoot: { flex: 1 },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,22,19,0.28)',
  },
  menuPanel: {
    position: 'absolute',
    minWidth: 220,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuItemText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  menuItemDanger: { color: colors.terracotta },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
    marginHorizontal: 12,
  },
  help: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  helpText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
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
  emptyTitle: { ...displayFont('700'), color: colors.text, fontSize: 18 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 10,
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  emptyBtnText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  emptyGhost: { paddingVertical: 10, paddingHorizontal: 12 },
  emptyGhostText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
});
}
