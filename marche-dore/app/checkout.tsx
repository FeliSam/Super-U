import { IconCircle, Screen, Page } from '@/components/ui';
import { goBack } from '@/lib/navigation';
import { MotionView, PressScale } from '@/components/motion';
import { SwipeToConfirm } from '@/components/SwipeToConfirm';
import { displayFont, type AppColors, spacing } from '@/constants/theme';
import { useAddresses } from '@/context/AddressesContext';
import { useColors } from '@/context/ThemeContext';
import { useCart } from '@/context/CartContext';
import { useCatalog } from '@/context/CatalogContext';
import { useCheckoutPayment, type PaymentId } from '@/context/CheckoutPaymentContext';
import { useOrders } from '@/context/OrdersContext';
import { usePayments } from '@/context/PaymentsContext';
import { useStores } from '@/context/StoresContext';
import { useProfile } from '@/context/ProfileContext';
import { formatBeninPhone } from '@/lib/beninPhone';
import { SUPER_U_BRAND } from '@/data/superU';
import { formatDistanceKm, formatDurationMin } from '@/lib/deliveryRouting';
import { formatFcfa } from '@/lib/format';
import { noZoomInputStyle } from '@/lib/noZoomInput';
import { ApiError } from '@/lib/api/http';
import { useDeliveryEstimate } from '@/lib/useDeliveryEstimate';
import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type DayId = 'today' | 'tomorrow' | 'day2';

type TimeSlot = {
  id: string;
  label: string;
  hint?: string;
  /** Heure d’arrivée estimée (ramassage + trajet + marge) */
  etaNote?: string;
  feeNote?: string;
  urgent?: boolean;
  express?: boolean;
};

function formatArrivalClock(date: Date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function alertUser(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

function arrivalWindowLabel(fromMin: number, toMin: number) {
  const now = Date.now();
  const a = new Date(now + fromMin * 60_000);
  const b = new Date(now + toMin * 60_000);
  return `Arrivée ≈ ${formatArrivalClock(a)} – ${formatArrivalClock(b)}`;
}

const EXPRESS_SLOTS: TimeSlot[] = [
  { id: 'after-1-2', label: '1h – 2h', hint: 'Après commande', express: true },
  {
    id: 'urgent',
    label: 'Express',
    hint: 'Dès que possible',
    feeNote: '+ double frais de livraison',
    urgent: true,
    express: true,
  },
];

/** Créneaux express : libellés fixes + ETA (préparation + trajet OSRM + marge). */
function buildExpressSlots(opts: {
  distanceMeters: number;
  durationSeconds: number;
  loading: boolean;
  unavailable: boolean;
  approximated: boolean;
}): TimeSlot[] {
  const { distanceMeters, durationSeconds, loading, unavailable, approximated } = opts;
  const [comfort, urgent] = EXPRESS_SLOTS;

  if (loading) {
    return [
      { ...comfort, etaNote: 'Calcul du trajet…' },
      { ...urgent, etaNote: 'Calcul du trajet…' },
    ];
  }

  // Fallback si pas de coords / échec : fenêtre 1h–2h générique
  if (unavailable || !durationSeconds || durationSeconds <= 0) {
    return [
      { ...comfort, etaNote: arrivalWindowLabel(60, 120) },
      { ...urgent, etaNote: arrivalWindowLabel(35, 55) },
    ];
  }

  const roadMin = Math.max(1, Math.round(durationSeconds / 60));
  const pickupMin = 20; // ramassage / préparation magasin
  const marginComfort = 15;
  const marginUrgent = 5;

  const comfortLow = pickupMin + roadMin + marginComfort;
  const comfortHigh = Math.max(comfortLow + 25, pickupMin + roadMin + 55);
  const urgentLow = Math.max(18, pickupMin + roadMin + marginUrgent - 5);
  const urgentHigh = pickupMin + roadMin + marginUrgent + 12;

  const approx = approximated ? ' · approx.' : '';
  const dist = formatDistanceKm(distanceMeters);

  return [
    {
      ...comfort,
      hint: 'Après commande',
      etaNote: `${arrivalWindowLabel(comfortLow, comfortHigh)}${approx}`,
    },
    {
      ...urgent,
      hint: `${dist} · trajet ~${formatDurationMin(durationSeconds)}`,
      etaNote: `${arrivalWindowLabel(urgentLow, urgentHigh)}${approx}`,
      feeNote: '+ double frais de livraison',
    },
  ];
}

function buildDays(now = new Date()) {
  const short = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const day2 = new Date(now);
  day2.setDate(now.getDate() + 2);
  return [
    { id: 'today' as const, label: "Aujourd'hui" },
    { id: 'tomorrow' as const, label: 'Demain' },
    { id: 'day2' as const, label: `${short[day2.getDay()]} ${day2.getDate()}` },
  ];
}

const SLOT_FIRST = 8;
const SLOT_LAST_START = 20; // dernier créneau : 20h–22h

/** Prochain début de créneau 2h (grille paire) à partir de maintenant. */
function nextSlotStartHour(now: Date) {
  let h = now.getHours();
  if (now.getMinutes() > 0 || now.getSeconds() > 0 || now.getMilliseconds() > 0) {
    h += 1;
  }
  if (h % 2 !== 0) h += 1;
  return Math.max(h, SLOT_FIRST);
}

function buildHourSlots(dayId: DayId, now = new Date()): TimeSlot[] {
  const start = dayId === 'today' ? nextSlotStartHour(now) : SLOT_FIRST;
  const slots: TimeSlot[] = [];
  for (let h = start; h <= SLOT_LAST_START; h += 2) {
    slots.push({ id: `h-${h}`, label: `${h}h-${h + 2}h` });
  }
  return slots;
}

type PaymentIdLocal = PaymentId;

function buildPayments(colors: AppColors) {
  return [
    { id: 'om' as const, label: 'Orange Money', hint: 'Mobile Money', icon: 'smartphone' as const, accent: '#ff7900', soft: colors.blush },
    { id: 'wave' as const, label: 'MTN MoMo', hint: 'Mobile Money', icon: 'zap' as const, accent: '#1c64f2', soft: colors.cream },
    { id: 'card' as const, label: 'Carte', hint: 'Visa · Mastercard', icon: 'credit-card' as const, accent: colors.gold, soft: colors.cream },
    { id: 'cod' as const, label: 'Livraison', hint: 'Espèces au livreur', icon: 'package' as const, accent: colors.green, soft: colors.successSoft },
  ];
}

export default function CheckoutScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const payments = useMemo(() => buildPayments(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { subtotal, delivery, discount, count, lines, promoCode, clear, ready: cartReady } = useCart();
  const { isReady, detailFor, setup, clearSetup } = useCheckoutPayment();
  const { placeOrder } = useOrders();
  const { resync } = useCatalog();
  const { defaultAddress } = useAddresses();
  const { selectedStore } = useStores();
  const { defaultMethod, methodById } = usePayments();
  const { profile } = useProfile();
  const routeEstimate = useDeliveryEstimate(
    selectedStore.coordinate,
    defaultAddress?.coordinate ?? null,
  );
  const days = useMemo(() => buildDays(), []);
  const [dayId, setDayId] = useState<DayId>('today');
  const hourSlots = useMemo(() => buildHourSlots(dayId), [dayId]);
  const expressSlots = useMemo(
    () =>
      buildExpressSlots({
        distanceMeters: routeEstimate.distanceMeters,
        durationSeconds: routeEstimate.durationSeconds,
        loading: routeEstimate.loading,
        unavailable: routeEstimate.unavailable,
        approximated: routeEstimate.approximated,
      }),
    [
      routeEstimate.distanceMeters,
      routeEstimate.durationSeconds,
      routeEstimate.loading,
      routeEstimate.unavailable,
      routeEstimate.approximated,
    ],
  );
  const [slotId, setSlotId] = useState('after-1-2');
  const [pay, setPay] = useState<PaymentIdLocal>(
    (setup?.methodId ?? (defaultMethod?.id as PaymentIdLocal) ?? 'om') as PaymentIdLocal,
  );
  const [comment, setComment] = useState('');
  const [phase, setPhase] = useState<'review' | 'payment'>('review');
  const [payError, setPayError] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const placingRef = useRef(false);
  const leavingRef = useRef(false);

  const allSlots = useMemo(() => {
    if (dayId === 'today') return [...expressSlots, ...hourSlots];
    return hourSlots;
  }, [dayId, hourSlots, expressSlots]);

  useEffect(() => {
    if (!allSlots.some((s) => s.id === slotId)) {
      setSlotId(allSlots[0]?.id ?? 'after-1-2');
    }
  }, [allSlots, slotId]);

  useEffect(() => {
    if (setup?.ready && setup.methodId) setPay(setup.methodId);
    else if (defaultMethod?.id) setPay(defaultMethod.id as PaymentIdLocal);
  }, [setup, defaultMethod?.id]);

  const selectedPay = payments.find((p) => p.id === pay) ?? payments[0];
  const selectedDay = days.find((d) => d.id === dayId) ?? days[0];
  const selectedSlot = allSlots.find((s) => s.id === slotId) ?? allSlots[0];
  const payReady = isReady(pay);
  const walletDetail = methodById(pay)?.detail;
  const payDetail = detailFor(pay) ?? walletDetail ?? null;
  const isUrgent = slotId === 'urgent';
  const deliveryFee = delivery > 0 && isUrgent ? delivery * 2 : delivery;
  const checkoutTotal = Math.max(0, subtotal + deliveryFee - discount);

  const openPaymentSetup = (id: PaymentIdLocal) => {
    setPay(id);
    router.push(`/payment-setup/${id}` as Href);
  };

  const commitOrder = async (paymentStatus: 'paid' | 'cod_pending', paymentRef: string | null) => {
    if (!defaultAddress) {
      leavingRef.current = false;
      return false;
    }
    leavingRef.current = true;
    if (!selectedSlot) {
      leavingRef.current = false;
      return false;
    }
    let order;
    try {
      order = await placeOrder({
      lines,
      subtotal,
      delivery: deliveryFee,
      discount,
      total: checkoutTotal,
      promoCode,
      dayId,
      dayLabel: selectedDay.label,
      slotId: selectedSlot.id,
      slotLabel: selectedSlot.label,
      paymentId: selectedPay.id,
      paymentLabel: selectedPay.label,
      paymentDetail: payDetail,
      paymentStatus,
      paymentRef,
      comment,
      addressLabel: defaultAddress.label,
      addressLine: defaultAddress.line,
      addressCity: defaultAddress.city,
      addressPhone: formatBeninPhone(defaultAddress.phone || profile.phone),
      addressCoordinate: defaultAddress.coordinate,
      storeId: selectedStore.id,
    });
    } catch (error) {
      leavingRef.current = false;
      const message =
        error instanceof ApiError
          ? error.message
          : 'Connectez-vous et vérifiez que l’API SuperU tourne (port 8787).';
      alertUser('Commande non envoyée', message);
      return false;
    }
    if (!order) {
      leavingRef.current = false;
      alertUser(
        'Commande non envoyée',
        'Connectez-vous et vérifiez que l’API SuperU tourne (port 8787). Sur téléphone, ouvrez l’app via l’IP du PC (pas localhost) et laissez l’API allumée.',
      );
      return false;
    }
    void resync({ force: true, full: true });
    clear();
    clearSetup();
    router.replace(`/order-success?id=${order.id}` as Href);
    return true;
  };

  /** Valider le récap : commande tout de suite, sans FedaPay ni page de vérification. */
  const confirmReview = async () => {
    if (!lines.length || !selectedSlot || placingRef.current || leavingRef.current) return;
    if (!defaultAddress?.line?.trim()) {
      alertUser('Adresse requise', 'Choisissez une adresse de livraison avant de confirmer.');
      return;
    }
    placingRef.current = true;
    try {
      if (pay === 'cod') {
        await commitOrder('cod_pending', null);
      } else {
        await commitOrder('paid', `skip-${Date.now()}`);
      }
    } finally {
      placingRef.current = false;
    }
  };

  /** Ancienne étape paiement : même chemin, toujours sans appel API. */
  const confirmPayment = async () => {
    if (placingRef.current || leavingRef.current || payBusy) return;
    placingRef.current = true;
    setPayBusy(true);
    setPayError(null);
    try {
      if (pay === 'cod') {
        await commitOrder('cod_pending', null);
      } else {
        await commitOrder('paid', `skip-${Date.now()}`);
      }
    } finally {
      placingRef.current = false;
      setPayBusy(false);
    }
  };

  useEffect(() => {
    if (leavingRef.current || placingRef.current || phase === 'payment') return;
    if (cartReady && count === 0) {
      router.replace('/(tabs)/cart');
    }
  }, [cartReady, count, phase]);

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={[styles.header, { paddingTop: Math.max(8, insets.top ? 4 : 8) }]}>
          <IconCircle
            name="arrow-left"
            onPress={() => (phase === 'payment' ? setPhase('review') : goBack('/(tabs)/cart'))}
          />
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{phase === 'payment' ? 'Paiement' : 'Finaliser la commande'}</Text>
            <Text style={styles.headerSub}>
              {phase === 'payment'
                ? `Étape 2/3 · ${selectedPay.label}`
                : `${count} article${count > 1 ? 's' : ''} · ${formatFcfa(checkoutTotal)}`}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {phase === 'payment' ? (
          <>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.steps}>
                <Text style={[styles.step, styles.stepDone]}>1. Commande</Text>
                <Text style={styles.stepSep}>→</Text>
                <Text style={[styles.step, styles.stepOn]}>2. Paiement</Text>
                <Text style={styles.stepSep}>→</Text>
                <Text style={styles.step}>3. Confirmation</Text>
              </View>
              <View style={styles.payHero}>
                <View style={[styles.payHeroIcon, { backgroundColor: selectedPay.soft }]}>
                  <Feather name={selectedPay.icon} size={28} color={selectedPay.accent} />
                </View>
                <Text style={styles.payHeroAmount}>{formatFcfa(checkoutTotal)}</Text>
                <Text style={styles.payHeroMethod}>
                  {selectedPay.label}
                  {payDetail ? ` · ${payDetail}` : ''}
                </Text>
                <Text style={styles.payHeroHint}>
                  {payBusy
                    ? 'Enregistrement de la commande…'
                    : 'Aucune vérification FedaPay. Glissez pour envoyer la commande à CourseGO.'}
                </Text>
                {payError ? <Text style={styles.payError}>{payError}</Text> : null}
                {payBusy ? <ActivityIndicator color={colors.gold} style={{ marginTop: 12 }} /> : null}
              </View>
            </ScrollView>
            <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 10) }]}>
              <SwipeToConfirm
                title={payBusy ? 'Paiement en cours…' : 'Glisser pour payer'}
                subtitle={selectedPay.label}
                amount={formatFcfa(checkoutTotal)}
                disabled={payBusy}
                onConfirm={confirmPayment}
              />
            </View>
          </>
        ) : (
          <>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Adresse */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.h}>Adresse de livraison</Text>
              <Pressable onPress={() => router.push('/account/addresses')}>
                <Text style={styles.link}>Modifier</Text>
              </Pressable>
            </View>
            <Pressable style={styles.addressCard} onPress={() => router.push('/account/addresses')}>
              <View style={styles.pin}>
                <Feather name="map-pin" size={20} color={colors.gold} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>
                    {profile.firstName} {profile.lastName}
                  </Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{defaultAddress?.label ?? 'Adresse'}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>{defaultAddress?.line ?? 'Ajoutez une adresse de livraison'}</Text>
                <Text style={styles.meta}>{defaultAddress?.phone ?? ''}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.placeholder} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.h}>Magasin Super U</Text>
              <Pressable onPress={() => router.push('/account/stores')}>
                <Text style={styles.link}>Choisir</Text>
              </Pressable>
            </View>
            <Pressable style={styles.addressCard} onPress={() => router.push('/account/stores')}>
              <View style={[styles.pin, { backgroundColor: SUPER_U_BRAND.red }]}>
                <Text style={styles.storePinText}>U</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{selectedStore.name}</Text>
                <Text style={styles.meta}>
                  {selectedStore.cityLabel} · {selectedStore.address}
                </Text>
                <View style={styles.routePill}>
                  <Feather name="navigation" size={12} color={colors.gold} />
                  <Text style={styles.routePillText} numberOfLines={2}>
                    {routeEstimate.loading
                      ? 'Calcul distance / durée…'
                      : routeEstimate.unavailable
                        ? 'Préparation & départ livreur'
                        : routeEstimate.approximated
                          ? `Approx. ${formatDistanceKm(routeEstimate.distanceMeters)} · ~${formatDurationMin(routeEstimate.durationSeconds)}`
                          : `${formatDistanceKm(routeEstimate.distanceMeters)} · ~${formatDurationMin(routeEstimate.durationSeconds)} → ${defaultAddress?.label ?? 'votre adresse'}`}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.placeholder} />
            </Pressable>
          </View>

          {/* Créneau */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.h}>Créneau de livraison</Text>
              <Text style={styles.sectionHint} numberOfLines={1}>
                {selectedDay.label} · {selectedSlot?.label}
              </Text>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockLabel}>Jour</Text>
              <View style={styles.pills}>
                {days.map((d) => {
                  const on = dayId === d.id;
                  return (
                    <Pressable key={d.id} style={[styles.pill, on && styles.pillOn]} onPress={() => setDayId(d.id)}>
                      <Text style={[styles.pillText, on && styles.pillTextOn]}>{d.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {dayId === 'today' ? (
                <>
                  <Text style={[styles.blockLabel, styles.blockLabelSpaced]}>Express</Text>
                  <View style={styles.expressRow}>
                    {expressSlots.map((slot, i) => {
                      const on = slotId === slot.id;
                      return (
                        <MotionView key={slot.id} index={i} preset="zoom" style={{ flex: 1 }}>
                          <PressScale
                            style={[
                              styles.expressCard,
                              { flex: 1 },
                              on && styles.expressCardOn,
                              slot.urgent && !on && styles.expressUrgent,
                              on && slot.urgent && styles.expressUrgentOn,
                            ]}
                            onPress={() => setSlotId(slot.id)}
                            scaleTo={0.97}
                            accessibilityLabel={`${slot.label}. ${slot.hint ?? ''}. ${slot.etaNote ?? ''}`}>
                            <View
                              style={[
                                styles.expressIcon,
                                on && { backgroundColor: slot.urgent ? colors.white : 'rgba(255,255,255,0.22)' },
                              ]}>
                              <Feather
                                name={slot.urgent ? 'zap' : 'clock'}
                                size={16}
                                color={
                                  on
                                    ? slot.urgent
                                      ? colors.terracotta
                                      : colors.white
                                    : slot.urgent
                                      ? colors.terracotta
                                      : colors.gold
                                }
                              />
                            </View>
                            <Text style={[styles.expressLabel, on && styles.expressLabelOn]}>{slot.label}</Text>
                            <Text style={[styles.expressHint, on && styles.expressHintOn]}>{slot.hint}</Text>
                            {slot.etaNote ? (
                              <Text style={[styles.expressEta, on && styles.expressEtaOn]}>{slot.etaNote}</Text>
                            ) : null}
                            {slot.feeNote ? (
                              <Text style={[styles.expressFee, on && styles.expressFeeOn]}>{slot.feeNote}</Text>
                            ) : null}
                          </PressScale>
                        </MotionView>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {hourSlots.length > 0 ? (
                <>
                  <Text style={[styles.blockLabel, styles.blockLabelSpaced]}>
                    {dayId === 'today' ? 'Choisir une heure' : 'Créneaux disponibles'}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
                    {hourSlots.map((slot) => {
                      const on = slotId === slot.id;
                      return (
                        <Pressable
                          key={slot.id}
                          style={[styles.slotPill, on && styles.pillOn]}
                          onPress={() => setSlotId(slot.id)}>
                          <Text style={[styles.pillText, on && styles.pillTextOn]}>{slot.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              ) : dayId === 'today' ? (
                <Text style={styles.emptyHours}>Plus de créneaux horaires aujourd’hui — choisissez Express ou un autre jour.</Text>
              ) : null}
            </View>
          </View>

          {/* Paiement */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.h}>Moyen de paiement</Text>
              <Text style={styles.sectionHint}>{selectedPay.label}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.payRow}
              decelerationRate="fast">
              {payments.map((p, i) => {
                const on = pay === p.id;
                const ready = isReady(p.id);
                return (
                  <MotionView key={p.id} index={i} preset="right">
                    <PressScale
                      style={[styles.payCard, on && { backgroundColor: p.soft }]}
                      onPress={() => setPay(p.id)}
                      scaleTo={0.97}>
                      <View style={[styles.payIcon, { backgroundColor: on ? p.accent : colors.cream }]}>
                        <Feather name={p.icon} size={20} color={on ? colors.white : p.accent} />
                      </View>
                      <Text style={styles.payLabel} numberOfLines={1}>
                        {p.label}
                      </Text>
                      <Text style={styles.payHint} numberOfLines={1}>
                        {ready ? detailFor(p.id) ?? p.hint : p.hint}
                      </Text>
                      <View
                        style={[
                          styles.payDot,
                          on && { backgroundColor: p.accent },
                          ready && !on && { backgroundColor: colors.green },
                        ]}
                      />
                    </PressScale>
                  </MotionView>
                );
              })}
            </ScrollView>

            <PressScale style={styles.paySummary} onPress={() => openPaymentSetup(pay)} scaleTo={0.985}>
              <View style={[styles.paySummaryIcon, { backgroundColor: selectedPay.soft }]}>
                <Feather name={selectedPay.icon} size={18} color={selectedPay.accent} />
              </View>
              <View style={styles.paySummaryText}>
                <Text style={styles.paySummaryTitle}>{selectedPay.label}</Text>
                <Text style={styles.paySummaryDetail}>
                  {payReady
                    ? payDetail
                    : pay === 'cod'
                      ? 'Prêt · paiement au livreur'
                      : 'Configurer pour finaliser le paiement'}
                </Text>
              </View>
              <View style={styles.paySummaryAction}>
                <Text style={[styles.paySummaryLink, { color: selectedPay.accent }]}>
                  {payReady ? 'Modifier' : 'Configurer'}
                </Text>
                <Feather name="chevron-right" size={16} color={selectedPay.accent} />
              </View>
            </PressScale>
          </View>

          {/* Commentaire */}
          <View style={styles.section}>
            <Text style={styles.h}>Commentaire</Text>
            <View style={styles.commentCard}>
              <View style={styles.commentHead}>
                <View style={styles.commentIcon}>
                  <Feather name="message-circle" size={16} color={colors.gold} />
                </View>
                <Text style={styles.commentTitle}>Note pour le livreur</Text>
                <Text style={styles.commentCount}>{comment.length}/160</Text>
              </View>
              <TextInput
                style={[styles.commentInput, noZoomInputStyle]}
                value={comment}
                onChangeText={(t) => setComment(t.slice(0, 160))}
                placeholder="Ex. Sonnez à l’interphone, laissez au gardien…"
                placeholderTextColor={colors.placeholder}
                multiline
                textAlignVertical="top"
                maxLength={160}
              />
            </View>
          </View>

          {/* Récap */}
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Récapitulatif</Text>
            <View style={styles.recapChips}>
              <View style={styles.recapChip}>
                <Feather name="calendar" size={12} color={colors.gold} />
                <Text style={styles.recapChipText}>
                  {selectedDay.label} · {selectedSlot?.label}
                </Text>
              </View>
              <View style={styles.recapChip}>
                <Feather name={selectedPay.icon} size={12} color={selectedPay.accent} />
                <Text style={styles.recapChipText}>
                  {selectedPay.label}
                  {payDetail ? ` · ${payDetail}` : ''}
                </Text>
              </View>
            </View>
            <Sum label="Sous-total" value={formatFcfa(subtotal)} />
            <Sum
              label={isUrgent ? 'Livraison (urgente ×2)' : 'Livraison'}
              value={formatFcfa(deliveryFee)}
            />
            {discount > 0 ? <Sum label="Réduction" value={`−${formatFcfa(discount)}`} green /> : null}
            <View style={styles.hr} />
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.total}>{formatFcfa(checkoutTotal)}</Text>
            </View>
          </View>

          <View style={styles.secure}>
            <Feather name="shield" size={14} color={colors.green} />
            <Text style={styles.secureText}>Paiement sécurisé · Confirmation immédiate</Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 10) }]}>
          <SwipeToConfirm
            title="Glisser pour confirmer"
            subtitle={`${selectedSlot?.label} · ${selectedPay.label}`}
            amount={formatFcfa(checkoutTotal)}
            onConfirm={confirmReview}
          />
        </View>
          </>
        )}
      </Page>
    </Screen>
  );
}

function Sum({ label, value, green }: { label: string; value: string; green?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumVal, green && { color: colors.green }]}>{value}</Text>
    </View>
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
    paddingBottom: 10,
    gap: 10 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 17, ...displayFont('700') },
  headerSub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 4,
  },
  step: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  stepOn: { color: colors.terracotta },
  stepDone: { color: colors.green },
  stepSep: { color: colors.placeholder, fontSize: 12, fontWeight: '700' },
  payHero: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  payHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  payHeroAmount: { color: colors.text, fontSize: 28, fontWeight: '800' },
  payHeroMethod: { color: colors.muted, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  payHeroHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  payError: {
    color: colors.terracotta,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
  },
  content: { paddingHorizontal: spacing.screen, paddingBottom: 28, gap: 22 },
  section: { gap: 10 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8 },
  h: { color: colors.text, fontSize: 16, fontWeight: '800' },
  link: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  sectionHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right' },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14 },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center' },
  storePinText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900' },
  cardBody: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  badge: {
    backgroundColor: colors.blush,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2 },
  badgeText: { color: colors.terracotta, fontSize: 10, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13 },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: colors.cream,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6 },
  routePillText: { color: colors.text, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  block: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    gap: 10 },
  blockLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase' },
  blockLabelSpaced: { marginTop: 4 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8 },
  pillOn: { backgroundColor: colors.gold },
  pillText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  pillTextOn: { color: colors.onAccent },
  expressRow: { flexDirection: 'row', gap: 10 },
  expressCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.bg,
    padding: 12,
    gap: 6 },
  expressCardOn: {
    backgroundColor: colors.gold },
  expressUrgent: {
    backgroundColor: colors.blush },
  expressUrgentOn: {
    backgroundColor: colors.terracotta },
  expressIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2 },
  expressLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  expressLabelOn: { color: colors.onAccent },
  expressHint: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  expressHintOn: { color: 'rgba(255,255,255,0.88)' },
  expressEta: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 14,
  },
  expressEtaOn: { color: colors.onAccent },
  expressFee: { color: colors.terracotta, fontSize: 10, fontWeight: '700', marginTop: 2 },
  expressFeeOn: { color: 'rgba(255,255,255,0.95)' },
  slotRow: { gap: 8, paddingRight: 2 },
  slotPill: {
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center' },
  emptyHours: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  payRow: { gap: 10, paddingRight: 4 },
  payCard: {
    width: 124,
    borderRadius: 18,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 5 },
  payIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2 },
  payLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  payHint: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  payDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border },
  paySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12 },
  paySummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center' },
  paySummaryText: { flex: 1, gap: 2 },
  paySummaryTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  paySummaryDetail: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  paySummaryAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  paySummaryLink: { fontSize: 12, fontWeight: '800' },
  setupCta: {
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.terracotta,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10 },
  setupCtaText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  commentCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    gap: 10 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center' },
  commentTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  commentCount: { color: colors.placeholder, fontSize: 11, fontWeight: '600' },
  commentInput: {
    minHeight: 84,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
    ...(Platform.OS === 'web' ? ({ fontSize: '16px' } as object) : null),
  },
  summary: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    gap: 12 },
  summaryTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  recapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6 },
  recapChipText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLabel: { color: colors.muted, fontSize: 14 },
  sumVal: { color: colors.text, fontWeight: '700', fontSize: 14 },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  totalLabel: { color: colors.text, fontSize: 16, fontWeight: '800' },
  total: { color: colors.terracotta, fontSize: 20, fontWeight: '800' },
  secure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 4 },
  secureText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  footer: {
    paddingHorizontal: spacing.screenMd,
    paddingTop: 0,
    backgroundColor: 'transparent',
    zIndex: 4,
  },
  });
}
