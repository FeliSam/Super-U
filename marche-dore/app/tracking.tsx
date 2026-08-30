import { AppImage } from '@/components/AppImage';
import { DeliveryIssueCard } from '@/components/DeliveryIssueCard';
import { HandoffCodeCard } from '@/components/HandoffCodeCard';
import { EmptyStateHero } from '@/components/EmptyStateHero';
import { LibreMap } from '@/components/LibreMap';
import { CourierTipPicker } from '@/components/CourierTipPicker';
import { StarRating } from '@/components/StarRating';
import { CtaButton, IconCircle, Screen } from '@/components/ui';
import { PressScale } from '@/components/motion';
import { cotonouMap, mapStyles, type LngLat } from '@/constants/map';
import { displayFont, type AppColors } from '@/constants/theme';
import { useCall } from '@/context/CallContext';
import { useCart } from '@/context/CartContext';
import { useReviews } from '@/context/ReviewsContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import { getProduct } from '@/data/catalog';
import {
  formatOrderId,
  statusLabel,
  useOrders,
  canCancelOrder,
  type Order } from '@/context/OrdersContext';
import { SUPER_U_BRAND } from '@/data/superU';
import { courierThreadId } from '@/lib/api/chat';
import { staffPhotoSource } from '@/lib/staffPhoto';
import { formatBeninPhone } from '@/lib/beninPhone';
import {
  formatDistanceKm,
  formatDurationMin,
  routeBoundsCenter } from '@/lib/deliveryRouting';
import { SHEET_OPEN, SHEET_SPRING } from '@/lib/expandableSheet';
import { formatFcfa, formatOrderAddress } from '@/lib/format';
import {
  courierMapCoordinate,
  fulfillmentPhase,
  isCourierAssigned,
  isCourseStarted,
  opsEtaCaption,
  opsPhaseLabel,
  opsProgressPercent,
  remainingEnRouteSeconds } from '@/lib/orderOps';
import { goBack, navigateTab, tabPaths } from '@/lib/navigation';
import { softShadow } from '@/lib/shadow';
import { statusTone } from '@/lib/statusTone';
import { Feather } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View } from 'react-native';
import { GestureRoot } from '@/components/GestureRoot';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WINDOW_H = Dimensions.get('window').height;
const SHEET_MIN = Math.round(WINDOW_H * 0.38);
const SHEET_MAX = Math.round(WINDOW_H * 0.82);
const SHEET_MID = Math.round((SHEET_MIN + SHEET_MAX) / 2);

type StepState = 'done' | 'active' | 'pending';

type TimelineStep = {
  label: string;
  hint: string;
  time: string;
  state: StepState;
  icon: ComponentProps<typeof Feather>['name'];
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
  if (order.paymentStatus === 'paid') {
    return label ? `${label} · payé` : 'Paiement confirmé';
  }
  if (order.paymentId === 'cod' || /livraison/i.test(label) || order.paymentStatus === 'cod_pending') {
    return 'Paiement à la livraison';
  }
  if (order.paymentDetail) {
    return label ? `${label} · ${order.paymentDetail}` : order.paymentDetail;
  }
  if (label) return `${label} validé`;
  return 'Paiement validé';
}

function buildSteps(order: Order, now: number): TimelineStep[] {
  const t = parseOrderDate(order.createdAt);
  const pick = order.pickStatus;
  const del = order.deliveryStatus;
  const phase = fulfillmentPhase(order);
  const accepted = phase !== 'wait' && phase !== 'cancelled' && phase !== 'failed';
  const assembled = pick === 'packed' || isCourseStarted(order);
  const onRoad = isCourseStarted(order) && del !== 'delivered';
  const delivered = order.status === 'delivered' || del === 'delivered';
  const store = order.storeName || 'Super U';
  const who = order.pickerName || order.courierName;
  const roadEta = formatDurationMin(order.routeDurationSeconds || 0);
  const roadDist = formatDistanceKm(order.routeDistanceMeters || 0);
  const remSec = onRoad ? remainingEnRouteSeconds(order, now) : null;
  const slot = [order.dayLabel, order.slotLabel].filter(Boolean).join(' · ');

  const defs: Omit<TimelineStep, 'state' | 'time'>[] = [
    { label: 'Commande reçue', hint: paymentHint(order), icon: 'check' },
    {
      label: 'Acceptée',
      hint: accepted
        ? who
          ? `${who} a pris la commande chez ${store}`
          : pick === 'picking'
            ? `${store} · rassemblement du panier`
            : `${store} · prise en charge`
        : `${store} · en attente de l’app course`,
      icon: 'user',
    },
    {
      label: 'Rassemblée',
      hint: assembled
        ? del === 'at_store'
          ? 'Colis prêt · coursier au magasin'
          : del === 'assigned'
            ? 'Colis prêt · course acceptée'
            : `${store} · panier prêt`
        : accepted
          ? `${store} · constitution du panier`
          : 'Après acceptation par le magasin',
      icon: 'package',
    },
    {
      label: 'Course',
      hint: delivered
        ? 'Course terminée'
        : del === 'arrived'
          ? 'Livreur à votre adresse'
          : onRoad && remSec
            ? `${roadDist} · encore ~${formatDurationMin(remSec)}`
            : assembled
              ? 'En attente du départ en course'
              : `${roadDist} · ~${roadEta} une fois en route`,
      icon: 'truck',
    },
    {
      label: 'Livrée',
      hint: slot ? `Colis remis · ${slot}` : 'Colis remis à votre adresse',
      icon: 'home',
    },
  ];

  if (order.status === 'cancelled' || del === 'cancelled') {
    return [
      {
        label: 'Commande annulée',
        hint: 'Annulée avant la fin de la course',
        icon: 'x',
        time: formatClock(t),
        state: 'active' as const,
      },
      ...defs.slice(1).map((d) => ({ ...d, time: '', state: 'pending' as const })),
    ];
  }

  const acceptState: StepState = assembled || onRoad || delivered ? 'done' : accepted ? 'active' : 'pending';
  const packState: StepState = onRoad || delivered ? 'done' : assembled ? 'active' : 'pending';
  const courseState: StepState = delivered ? 'done' : onRoad ? 'active' : 'pending';
  const doneState: StepState = delivered ? 'done' : 'pending';
  const times = [
    formatClock(t),
    accepted ? formatClock(t) : '',
    order.packedAt ? formatClock(new Date(order.packedAt)) : '',
    '',
    delivered ? formatClock(new Date()) : '',
  ];

  return defs.map((d, i) => ({
    ...d,
    time: times[i],
    state: i === 0 ? 'done' : i === 1 ? acceptState : i === 2 ? packState : i === 3 ? courseState : doneState,
  }));
}

function mapBadgeText(order: Order) {
  return opsPhaseLabel(order);
}

function zoomForRoute(meters: number): number {
  if (meters < 1200) return 14.4;
  if (meters < 3000) return 13.4;
  if (meters < 7000) return 12.5;
  if (meters < 14000) return 11.6;
  return 11.0;
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
    opacity: opacity.value }));

  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { backgroundColor: resolvedColor }, ringStyle]} />
      <View style={[styles.pulseCore, { backgroundColor: resolvedColor }]} />
    </View>
  );
}

function InfoRow({
  icon,
  title,
  lines }: {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  lines: string[];
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.cream }]}>
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
  const { scheme } = useTheme();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getOrder, activeOrder, orders, ready, setStatus, setTrackingFocus } = useOrders();
  const { startOutgoing, phase } = useCall();
  const { count: cartCount } = useCart();
  const {
    addCourierReview,
    courierReviewForOrder,
    hasUserReviewedProduct } = useReviews();
  const orderId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
  const order = (orderId ? getOrder(orderId) : null) ?? activeOrder ?? null;
  const [now, setNow] = useState(Date.now());

  const recentDone = useMemo(
    () => orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled').slice(0, 3),
    [orders],
  );

  const steps = useMemo(() => (order ? buildSteps(order, now) : []), [order, now]);
  const activeStep = steps.findIndex((s) => s.state === 'active');
  const activeIndex =
    activeStep >= 0 ? activeStep : Math.max(0, steps.findIndex((s) => s.state === 'done'));
  const tone = order ? statusTone(order.status, colors) : statusTone('confirmed', colors);
  const cancellable = order ? canCancelOrder(order.status) : false;
  const delivered = order?.status === 'delivered';
  const failed = order ? fulfillmentPhase(order) === 'failed' : false;
  const existingCourierReview = order ? courierReviewForOrder(order.id) : undefined;
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [courierRating, setCourierRating] = useState(5);
  const [courierComment, setCourierComment] = useState('');
  const [courierTip, setCourierTip] = useState(0);
  const [courierSubmitted, setCourierSubmitted] = useState(false);

  const sheetH = useSharedValue(SHEET_MIN);
  const dragStartH = useSharedValue(SHEET_MIN);

  useEffect(() => {
    setTrackingFocus(order?.id ?? null);
    return () => setTrackingFocus(null);
  }, [order?.id, setTrackingFocus]);

  useEffect(() => {
    if (!order || order.status === 'delivered' || order.status === 'cancelled' || fulfillmentPhase(order) === 'failed') return;
    const timer = setInterval(() => setNow(Date.now()), isCourseStarted(order) ? 250 : 2000);
    return () => clearInterval(timer);
  }, [order?.id, order?.status]);

  useEffect(() => {
    if (!delivered && !failed) return;
    sheetH.value = withTiming(SHEET_MAX, SHEET_OPEN);
  }, [delivered, failed, sheetH]);

  useEffect(() => {
    setCourierRating(5);
    setCourierComment('');
    setCourierTip(0);
    setCourierSubmitted(false);
  }, [order?.id]);

  const submitCourierReview = () => {
    if (!order || existingCourierReview || courierSubmitted) return;
    const comment = courierComment.trim();
    if (courierRating < 1) return;
    addCourierReview({
      orderId: order.id,
      courierName: order.courierName,
      rating: courierRating,
      comment: comment || 'Livraison impeccable.',
      tipAmount: courierTip,
    });
    setCourierSubmitted(true);
  };

  const sheetPan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY([-8, 8])
        .onStart(() => {
          dragStartH.value = sheetH.value;
        })
        .onUpdate((e) => {
          const next = dragStartH.value - e.translationY;
          sheetH.value = Math.min(SHEET_MAX, Math.max(SHEET_MIN, next));
        })
        .onEnd((e) => {
          const projected = sheetH.value - e.velocityY * 0.12;
          const target =
            projected > SHEET_MID || (sheetH.value > SHEET_MID && e.velocityY < -400)
              ? SHEET_MAX
              : SHEET_MIN;
          sheetH.value = withSpring(target, { ...SHEET_SPRING, velocity: -e.velocityY });
        }),
    [dragStartH, sheetH],
  );

  const sheetAnimStyle = useAnimatedStyle(() => ({
    height: sheetH.value }));

  const mapModel = useMemo(() => {
    if (!order) return null;
    const store = order.storeCoordinate ?? cotonouMap.store;
    const home = order.addressCoordinate ?? cotonouMap.home;
    const poly: LngLat[] =
      order.routeCoordinates?.length >= 2 ? order.routeCoordinates : [store, home];
    const courier = courierMapCoordinate(order, poly, store, now);
    const courierLabel = opsPhaseLabel(order);

    return {
      center: routeBoundsCenter(poly),
      zoom: zoomForRoute(order.routeDistanceMeters || 3000),
      route: poly,
      markers: [
        {
          id: 'su-pickup',
          coordinate: store,
          kind: 'superu' as const,
          label: order.storeName?.replace(/^Super U\s+/i, 'U · ') || 'U · Départ',
          color: SUPER_U_BRAND.red },
        {
          id: 'home',
          coordinate: home,
          kind: 'home' as const,
          label: order.addressLabel || 'Chez vous',
          color: colors.gold },
        ...(order.status === 'cancelled' || !isCourierAssigned(order)
          ? []
          : [
              {
                id: 'courier',
                coordinate: courier,
                kind: 'courier' as const,
                vehicle: (order.courierVehicle as 'moto' | 'voiture' | 'velo' | 'tricycle' | 'pied') || 'moto',
                label: courierLabel,
                color: colors.terracotta },
            ]),
      ] };
  }, [order, colors.gold, colors.terracotta, now]);

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
          } },
      ],
    );
  };

  const runMenu = (action: () => void) => {
    closeMenu();
    requestAnimationFrame(action);
  };

  if (!ready) {
    return (
      <Screen>
        <View style={styles.flex} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <View style={[styles.emptyRoot, { paddingTop: Math.max(10, insets.top + 6) }]}>
          <View style={styles.emptyHeader}>
            <IconCircle name="chevron-left" onPress={() => goBack()} />
            <Text style={styles.emptyHeaderTitle}>Suivi de commande</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.emptyScroll,
              { paddingBottom: Math.max(28, insets.bottom + 20) },
            ]}
            showsVerticalScrollIndicator={false}>
            <EmptyStateHero
              icon="truck"
              badge="Livraison live"
              title={'Aucune livraison\nen cours'}
              subtitle="Passez commande pour suivre le livreur en direct : Super U le plus proche, itinéraire routier et ETA."
              primaryLabel={cartCount > 0 ? 'Finaliser mon panier' : 'Découvrir les produits'}
              primaryIcon={cartCount > 0 ? 'shopping-bag' : 'compass'}
              onPrimary={() =>
                cartCount > 0 ? navigateTab(tabPaths.cart) : navigateTab(tabPaths.home)
              }
              secondaryLabel="Historique des commandes"
              secondaryIcon="clock"
              onSecondary={() => router.push('/orders' as Href)}
              perks={[
                { icon: 'map-pin', label: 'Magasin proche', color: colors.gold },
                { icon: 'navigation', label: 'Route rapide', color: colors.green },
                { icon: 'radio', label: 'Suivi live', color: colors.terracotta },
              ]}
              footer={
                recentDone.length > 0 ? (
                  <View style={styles.emptySection}>
                    <View style={styles.emptySectionHead}>
                      <Text style={styles.emptySectionTitle}>Dernières commandes</Text>
                      <Pressable onPress={() => router.push('/orders' as Href)}>
                        <Text style={styles.emptySectionLink}>Voir tout</Text>
                      </Pressable>
                    </View>
                    {recentDone.map((o) => {
                      const first = o.lines[0];
                      const product = first ? getProduct(first.productId) : undefined;
                      return (
                        <PressScale
                          key={o.id}
                          style={styles.recentCard}
                          onPress={() => router.push(`/order/${o.id}` as Href)}
                          scaleTo={0.98}>
                          {product ? (
                            <AppImage source={product.image} frameStyle={styles.recentImg} />
                          ) : (
                            <View style={[styles.recentImg, styles.recentImgFallback]}>
                              <Feather name="package" size={18} color={colors.gold} />
                            </View>
                          )}
                          <View style={styles.recentText}>
                            <Text style={styles.recentId}>{formatOrderId(o.id)}</Text>
                            <Text style={styles.recentMeta} numberOfLines={1}>
                              {statusLabel(o.status)} · {formatFcfa(o.total)}
                            </Text>
                          </View>
                          <Feather name="chevron-right" size={18} color={colors.placeholder} />
                        </PressScale>
                      );
                    })}
                  </View>
                ) : null
              }
            />
          </ScrollView>
        </View>
      </Screen>
    );
  }

  const progress = opsProgressPercent(order);
  const slotLabel = [order.dayLabel, order.slotLabel].filter(Boolean).join(' · ');
  const etaCaption = opsEtaCaption(order);
  const remSec = isCourseStarted(order) ? remainingEnRouteSeconds(order, now) : null;
  const onRoad = isCourseStarted(order) && order.deliveryStatus !== 'delivered';
  const etaPrimary = onRoad
    ? remSec
      ? `~${formatDurationMin(remSec)}`
      : opsPhaseLabel(order)
    : opsPhaseLabel(order);
  const addressLine = formatOrderAddress(order.addressLine, order.addressCity);
  const addressPhone = order.addressPhone ? formatBeninPhone(order.addressPhone) : '';
  const courierPhone = order.courierPhone ? formatBeninPhone(order.courierPhone) : '';
  const destName = order.addressLabel || 'vous';
  const storeName = order.storeName || 'Super U';
  const tripSec = order.routeDurationSeconds || 0;
  const roadMeta = `${formatDistanceKm(order.routeDistanceMeters || 0)} · trajet ${formatDurationMin(tripSec)} · ${storeName} → ${destName}`;
  const roadSub = slotLabel
    ? `${formatDistanceKm(order.routeDistanceMeters || 0)} · ~${formatDurationMin(tripSec)} (itinéraire routier) · ${slotLabel}`
    : `${formatDistanceKm(order.routeDistanceMeters || 0)} · ~${formatDurationMin(tripSec)} (itinéraire routier)`;
  const showCourier = isCourierAssigned(order);

  return (
    <Screen>
      <GestureRoot style={styles.flex}>
        <View style={styles.root}>
          {/* Full-bleed map */}
          <View style={StyleSheet.absoluteFill}>
            {mapModel ? (
              <LibreMap
                style={StyleSheet.absoluteFill}
                mapStyle={scheme === 'dark' ? mapStyles.dark : mapStyles.light}
                center={[...mapModel.center]}
                zoom={mapModel.zoom}
                route={[...mapModel.route]}
                markers={mapModel.markers}
                interactive
                showNavigation
                navigationOffset={{
                  top: Math.max(96, insets.top + 78),
                  right: 14 }}
                onReady={() => {
                  setMapError(false);
                  setMapReady(true);
                }}
                onError={() => {
                  setMapError(true);
                  setMapReady(true);
                }}
              />
            ) : null}
            {mapError ? (
              <View style={styles.mapLoading} pointerEvents="none">
                <Feather name="wifi-off" size={22} color={colors.muted} />
                <Text style={styles.mapLoadingText}>Carte indisponible pour le moment</Text>
                <Text style={styles.mapErrorHint}>Vérifiez votre connexion, puis réessayez.</Text>
              </View>
            ) : !mapReady ? (
              <View style={styles.mapLoading} pointerEvents="none">
                <Text style={styles.mapLoadingText}>Calcul de l’itinéraire…</Text>
              </View>
            ) : null}
          </View>

          {/* Floating header */}
          <View
            style={[styles.topBar, { paddingTop: Math.max(10, insets.top + 4) }]}
            pointerEvents="box-none">
            <IconCircle name="chevron-left" onPress={() => goBack()} variant="hero" />
            <View style={styles.titlePill}>
              <Text style={styles.titlePillMain}>Suivi · {formatOrderId(order.id)}</Text>
              <Text style={styles.titlePillSub}>{mapBadgeText(order)}</Text>
            </View>
            <IconCircle name="more-vertical" onPress={() => setMenuOpen(true)} variant="hero" />
          </View>

          <View
            style={[styles.livePill, { top: Math.max(96, insets.top + 78) }]}
            pointerEvents="none">
            <PulseDot color={tone.dot} />
            <Text style={styles.livePillText}>{mapBadgeText(order)}</Text>
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
                {order.status !== 'cancelled' && showCourier ? (
                  <Pressable
                    style={styles.menuItem}
                    onPress={() =>
                      runMenu(() => {
                        router.push(`/chat/${courierThreadId(order)}` as Href);
                        if (phase === 'idle') startOutgoing(courierThreadId(order), order.courierName);
                      })
                    }>
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

          {/* Bottom sheet — même logique que l’ajout d’adresse */}
          <Animated.View
            style={[
              styles.sheet,
              sheetAnimStyle,
              {
                paddingBottom: Math.max(14, insets.bottom + 8),
                backgroundColor: colors.bg },
            ]}>
            <GestureDetector gesture={sheetPan}>
              <View style={styles.sheetHandle}>
                <View style={[styles.sheetHandleBar, { backgroundColor: colors.grabber }]} />
              </View>
            </GestureDetector>
              <Text style={[styles.sheetEyebrow, { color: colors.muted }]}>
                {failed
                  ? 'Incident de livraison'
                  : delivered
                    ? 'Livraison terminée'
                    : order.status === 'cancelled'
                      ? 'Commande annulée'
                      : opsPhaseLabel(order)}
              </Text>
              {!delivered && !failed && order.status !== 'cancelled' ? (
                <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
                  <HandoffCodeCard code={order.handoffCode} />
                </View>
              ) : null}

              <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetContent}
                bounces
                nestedScrollEnabled>
                {failed ? (
                  <DeliveryIssueCard order={order} />
                ) : delivered ? (
                  <View style={[styles.doneHero, { backgroundColor: colors.successSoft }]}>
                    <View style={[styles.doneIcon, { backgroundColor: colors.green }]}>
                      <Feather name="check" size={22} color={colors.onAccent} />
                    </View>
                    <Text style={styles.doneTitle}>Merci ! Votre commande est livrée</Text>
                    <Text style={styles.doneSub}>
                      Bon appétit. Notez votre livreur et partagez un avis sur les produits reçus.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.statusBlock}>
                    <View style={styles.etaRow}>
                      <View style={styles.etaTextBlock}>
                        <Text style={styles.meta}>{etaCaption}</Text>
                        <Text style={styles.eta}>{etaPrimary}</Text>
                        <Text style={styles.roadMeta}>{roadMeta}</Text>
                      </View>
                      <View style={[styles.tag, { backgroundColor: tone.bg }]}>
                        <View style={[styles.tagDot, { backgroundColor: tone.dot }]} />
                        <Text style={[styles.tagText, { color: tone.text }]}>
                          {statusLabel(order.status)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: colors.cream }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, Math.max(8, progress))}%`,
                            backgroundColor: colors.terracotta },
                        ]}
                      />
                    </View>
                    <View style={styles.current}>
                      <PulseDot color={tone.dot} />
                      <Text style={styles.currentText}>
                        {steps[activeIndex]?.hint ?? 'Votre commande est en cours de traitement.'}
                      </Text>
                    </View>
                  </View>
                )}

                <PressScale
                  style={[styles.softCard, { backgroundColor: colors.white }]}
                  onPress={() => router.push(`/order/${order.id}` as Href)}
                  scaleTo={0.985}>
                  <View style={[styles.detailsIcon, { backgroundColor: colors.cream }]}>
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

                {delivered && order.courierName ? (
                  <View style={[styles.softCardCol, { backgroundColor: colors.white }]}>
                    <Text style={styles.cardTitle}>Noter le livreur</Text>
                    <View style={styles.courierMini}>
                      <AppImage
                        source={staffPhotoSource(order.courierHasPhoto ? order.courierId : undefined)}
                        frameStyle={styles.avatar}
                      />
                      <View style={styles.courierText}>
                        <Text style={styles.name}>{order.courierName}</Text>
                        <Text style={styles.meta}>Coursier CourseGO</Text>
                      </View>
                    </View>
                    {existingCourierReview || courierSubmitted ? (
                      <View style={[styles.reviewDoneBanner, { backgroundColor: colors.successSoft }]}>
                        <Feather name="check-circle" size={16} color={colors.green} />
                        <Text style={[styles.reviewDoneText, { color: colors.green }]}>
                          Merci pour votre avis
                          {existingCourierReview
                            ? ` · ${existingCourierReview.rating}/5`
                            : courierRating
                              ? ` · ${courierRating}/5`
                              : ''}
                          {(existingCourierReview?.tipAmount ?? (courierSubmitted ? courierTip : 0)) > 0
                            ? ` · pourboire ${formatFcfa(existingCourierReview?.tipAmount ?? courierTip)}`
                            : ''}
                          .
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.draftStars}>
                          <StarRating
                            rating={courierRating}
                            size={28}
                            interactive
                            onChange={setCourierRating}
                          />
                          <Text style={styles.draftRatingLabel}>{courierRating}/5</Text>
                        </View>
                        <CourierTipPicker value={courierTip} onChange={setCourierTip} />
                        <TextInput
                          value={courierComment}
                          onChangeText={setCourierComment}
                          placeholder="Comment s’est passée la livraison ?"
                          placeholderTextColor={colors.placeholder}
                          multiline
                          style={styles.reviewInput}
                          textAlignVertical="top"
                        />
                        <CtaButton label="Envoyer mon avis livreur" onPress={submitCourierReview} />
                      </>
                    )}
                  </View>
                ) : null}

                {delivered ? (
                  <View style={[styles.softCardCol, { backgroundColor: colors.white }]}>
                    <Text style={styles.cardTitle}>Avis produits</Text>
                    <Text style={styles.productReviewHint}>
                      Seuls les articles de cette livraison peuvent être notés.
                    </Text>
                    {order.lines.map((line, i) => {
                      const product = getProduct(line.productId);
                      const reviewed = hasUserReviewedProduct(line.productId);
                      return (
                        <View key={`${line.productId}-${i}`}>
                          {i > 0 ? (
                            <View style={[styles.softHr, { backgroundColor: colors.border }]} />
                          ) : null}
                          <Pressable
                            style={styles.productReviewRow}
                            onPress={() =>
                              router.push(
                                `/product/reviews/${encodeURIComponent(line.productId)}?write=1` as Href,
                              )
                            }>
                            {product?.image ? (
                              <AppImage source={product.image} frameStyle={styles.productThumb} />
                            ) : (
                              <View style={[styles.productThumb, styles.productThumbFallback]}>
                                <Feather name="package" size={16} color={colors.placeholder} />
                              </View>
                            )}
                            <View style={styles.productReviewText}>
                              <Text style={styles.productReviewName} numberOfLines={2}>
                                {line.name}
                              </Text>
                              <Text style={styles.productReviewMeta}>
                                {reviewed ? 'Avis déjà publié' : 'Laisser un avis'}
                              </Text>
                            </View>
                            <Feather
                              name={reviewed ? 'check' : 'edit-3'}
                              size={16}
                              color={reviewed ? colors.green : colors.gold}
                            />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {!delivered ? (
                  <View style={[styles.softCardCol, { backgroundColor: colors.white }]}>
                    <Text style={styles.cardTitle}>Parcours</Text>
                    <InfoRow
                      icon="shopping-bag"
                      title={storeName}
                      lines={['Magasin de départ', slotLabel ? `Créneau ${slotLabel}` : 'Point de départ livreur']}
                    />
                    <View style={[styles.softHr, { backgroundColor: colors.border }]} />
                    <InfoRow
                      icon="navigation"
                      title="Itinéraire routier"
                      lines={[
                        roadMeta,
                        order.routeProfile === 'motorcycle'
                          ? 'Profil moto · plus rapide'
                          : 'Profil voiture / moto · plus rapide',
                        roadSub,
                      ]}
                    />
                    <View style={[styles.softHr, { backgroundColor: colors.border }]} />
                    <InfoRow
                      icon="map-pin"
                      title={order.addressLabel || 'Adresse'}
                      lines={[addressLine, addressPhone].filter(Boolean)}
                    />
                  </View>
                ) : null}

                <View style={[styles.softCardCol, { backgroundColor: colors.white }]}>
                  <Text style={styles.cardTitle}>Étapes</Text>
                  {steps.map((step, i) => {
                    const isLast = i === steps.length - 1;
                    return (
                      <View key={step.label} style={styles.step}>
                        <View style={styles.col}>
                          <View
                            style={[
                              styles.node,
                              step.state === 'done' && { backgroundColor: colors.green },
                              step.state === 'active' && { backgroundColor: colors.terracotta },
                              step.state === 'pending' && { backgroundColor: colors.cream },
                            ]}>
                            {step.state === 'done' ? (
                              <Feather name="check" size={12} color={colors.onAccent} />
                            ) : (
                              <Feather
                                name={step.icon}
                                size={11}
                                color={step.state === 'active' ? colors.onAccent : colors.placeholder}
                              />
                            )}
                          </View>
                          {!isLast ? (
                            <View
                              style={[
                                styles.vline,
                                {
                                  backgroundColor:
                                    step.state === 'done' || step.state === 'active'
                                      ? colors.terracotta
                                      : colors.border },
                              ]}
                            />
                          ) : null}
                        </View>
                        <View style={styles.stepBody}>
                          <Text
                            style={[
                              styles.stepLabel,
                              step.state === 'pending' && { color: colors.placeholder },
                              step.state === 'active' && { color: colors.terracotta },
                            ]}>
                            {step.label}
                          </Text>
                          <Text style={styles.stepHint}>{step.hint}</Text>
                        </View>
                        <Text style={styles.time}>{step.time || '—'}</Text>
                      </View>
                    );
                  })}
                </View>

                {order.status === 'cancelled' ? (
                  <View style={[styles.softCard, { backgroundColor: colors.white }]}>
                    <Feather name="x-circle" size={18} color={colors.muted} />
                    <View style={styles.cancelledText}>
                      <Text style={styles.cancelledTitle}>Commande annulée</Text>
                      <Text style={styles.cancelledMeta}>Aucun livreur ne sera envoyé.</Text>
                    </View>
                  </View>
                ) : !delivered && showCourier ? (
                  <View style={[styles.softCard, { backgroundColor: colors.white }]}>
                    <View style={styles.avatarWrap}>
                      <AppImage
                        source={staffPhotoSource(order.courierHasPhoto ? order.courierId : undefined)}
                        frameStyle={styles.avatar}
                      />
                      <View style={[styles.onlineDot, { borderColor: colors.white }]} />
                    </View>
                    <View style={styles.courierText}>
                      <Text style={styles.name}>{order.courierName}</Text>
                      <Text style={styles.meta}>
                        {order.sameHandler
                          ? courierPhone
                            ? `${courierPhone} · prépare et livre`
                            : 'Prépare et livre cette commande'
                          : courierPhone
                            ? `${courierPhone} · en livraison`
                            : 'Livreur assigné'}
                      </Text>
                    </View>
                    <View style={styles.courierActions}>
                      <IconCircle
                        name="message-circle"
                        onPress={() => router.push(`/chat/${courierThreadId(order)}` as Href)}
                      />
                      <IconCircle
                        name="phone"
                        onPress={() => {
                          if (phase === 'idle') startOutgoing(courierThreadId(order), order.courierName);
                        }}
                      />
                    </View>
                  </View>
                ) : !delivered ? (
                  <View style={[styles.softCard, { backgroundColor: colors.white }]}>
                    <Feather name="package" size={18} color={colors.gold} />
                    <View style={styles.cancelledText}>
                      <Text style={styles.cancelledTitle}>En attente du magasin</Text>
                      <Text style={styles.cancelledMeta}>
                        Un préparateur rassemble votre panier. Le livreur apparaîtra une fois assigné.
                      </Text>
                    </View>
                  </View>
                ) : null}

                <PressScale style={styles.help} onPress={() => router.push('/help')} scaleTo={0.98}>
                  <Feather name="help-circle" size={15} color={colors.muted} />
                  <Text style={styles.helpText}>Besoin d’aide ? Contacter le support</Text>
                </PressScale>
              </Animated.ScrollView>
            </Animated.View>
        </View>
      </GestureRoot>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    root: { flex: 1, backgroundColor: colors.bg },
    mapLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.55)',
      gap: 8 },
    mapLoadingText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
    mapErrorHint: { color: colors.placeholder, fontSize: 12, textAlign: 'center', paddingHorizontal: 24 },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      gap: 10,
      zIndex: 5 },
    titlePill: {
      flex: 1,
      backgroundColor: colors.white,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      opacity: 0.96,
      ...Platform.select({
        web: { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
        default: {} }) },
    titlePillMain: { color: colors.text, fontSize: 14, fontWeight: '800' },
    titlePillSub: { color: colors.muted, fontSize: 11, marginTop: 1, fontWeight: '600' },
    livePill: {
      position: 'absolute',
      left: 14,
      right: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(20,17,15,0.78)',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      zIndex: 4 },
    livePillText: { flex: 1, color: '#ffffff', fontSize: 12, fontWeight: '700' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      overflow: 'hidden',
      zIndex: 6,
      ...Platform.select({
        web: { boxShadow: '0 -8px 28px rgba(0,0,0,0.12)' },
        default: {} }) },
    sheetHandle: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
    sheetHandleBar: { width: 40, height: 4, borderRadius: 999 },
    sheetEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      paddingHorizontal: 20,
      marginBottom: 6 },
    sheetScroll: { flex: 1 },
    sheetContent: { paddingHorizontal: 20, gap: 12, paddingBottom: 20 },
    statusBlock: { gap: 10, marginBottom: 4 },
    etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    etaTextBlock: { flex: 1 },
    meta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    eta: { ...displayFont('700'), color: colors.text, fontSize: 22, marginTop: 4 },
    roadMeta: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 4 },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7 },
    tagDot: { width: 7, height: 7, borderRadius: 4 },
    tagText: { fontWeight: '800', fontSize: 12 },
    progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 999 },
    current: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    currentText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '500' },
    doneHero: {
      borderRadius: 18,
      padding: 16,
      gap: 8,
      alignItems: 'flex-start' },
    doneIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2 },
    doneTitle: { ...displayFont('700'), color: colors.text, fontSize: 18 },
    doneSub: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '500' },
    courierMini: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    draftStars: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    draftRatingLabel: { color: colors.gold, fontSize: 15, fontWeight: '800' },
    reviewInput: {
      minHeight: 88,
      borderRadius: 14,
      padding: 12,
      color: colors.text,
      fontSize: 16,
      backgroundColor: colors.bg },
    reviewDoneBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 14,
      padding: 12 },
    reviewDoneText: { flex: 1, fontSize: 13, fontWeight: '600' },
    productReviewHint: { color: colors.muted, fontSize: 12, marginTop: -4, fontWeight: '500' },
    productReviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4 },
    productThumb: { width: 44, height: 44, borderRadius: 12 },
    productThumbFallback: {
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center' },
    productReviewText: { flex: 1, gap: 2 },
    productReviewName: { color: colors.text, fontSize: 14, fontWeight: '700' },
    productReviewMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    softCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 18,
      padding: 14 },
    softCardCol: {
      borderRadius: 18,
      padding: 16,
      gap: 12 },
    softHr: { height: StyleSheet.hairlineWidth },
    cardTitle: { ...displayFont('700'), color: colors.text, fontSize: 16 },
    detailsIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center' },
    detailsText: { flex: 1 },
    detailsLeft: { color: colors.text, fontSize: 14, fontWeight: '700' },
    detailsRight: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    infoIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center' },
    infoText: { flex: 1, gap: 2 },
    infoTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    infoMeta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
    step: { flexDirection: 'row', gap: 12, minHeight: 52 },
    col: { width: 24, alignItems: 'center' },
    node: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center' },
    vline: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },
    stepBody: { flex: 1, paddingBottom: 10 },
    stepLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
    stepHint: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
    time: { color: colors.placeholder, fontSize: 11, fontWeight: '700', marginTop: 2 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 44, height: 44, borderRadius: 16 },
    onlineDot: {
      position: 'absolute',
      right: -1,
      bottom: -1,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.green },
    courierText: { flex: 1 },
    name: { color: colors.text, fontSize: 15, fontWeight: '700' },
    courierActions: { flexDirection: 'row', gap: 8 },
    cancelledText: { flex: 1 },
    cancelledTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    cancelledMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    help: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 8 },
    helpText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    pulseWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
    pulseRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
    pulseCore: { width: 8, height: 8, borderRadius: 4 },
    menuRoot: { flex: 1 },
    menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
    menuPanel: {
      position: 'absolute',
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingVertical: 6,
      minWidth: 220 },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12 },
    menuItemText: { color: colors.text, fontSize: 14, fontWeight: '600' },
    menuItemDanger: { color: colors.terracotta },
    menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
    emptyRoot: { flex: 1 },
    emptyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8 },
    emptyHeaderTitle: { ...displayFont('700'), color: colors.text, fontSize: 17 },
    emptyScroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
    emptySection: { gap: 10, marginTop: 4 },
    emptySectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between' },
    emptySectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
    emptySectionLink: { color: colors.gold, fontSize: 13, fontWeight: '700' },
    recentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 12 },
    recentImg: { width: 48, height: 48, borderRadius: 14 },
    recentImgFallback: {
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center' },
    recentText: { flex: 1, gap: 2 },
    recentId: { color: colors.text, fontSize: 14, fontWeight: '700' },
    recentMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' } });
}
