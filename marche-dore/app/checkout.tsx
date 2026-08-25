import { IconCircle, Screen, Page } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { SwipeToConfirm } from '@/components/SwipeToConfirm';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useCart } from '@/context/CartContext';
import { useCheckoutPayment, type PaymentId } from '@/context/CheckoutPaymentContext';
import { useOrders } from '@/context/OrdersContext';
import { formatFcfa } from '@/lib/format';
import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type DayId = 'today' | 'tomorrow' | 'day2';

type TimeSlot = {
  id: string;
  label: string;
  hint?: string;
  feeNote?: string;
  urgent?: boolean;
  express?: boolean;
};

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

const EXPRESS_SLOTS: TimeSlot[] = [
  { id: 'after-1-2', label: '1h – 2h', hint: 'Après commande', express: true },
  {
    id: 'urgent',
    label: '30 – 45 min',
    hint: 'Livraison urgente',
    feeNote: '+ double frais de livraison',
    urgent: true,
    express: true,
  },
];

type PaymentIdLocal = PaymentId;

function buildPayments(colors: AppColors) {
  return [
    { id: 'om' as const, label: 'Orange Money', hint: 'Mobile Money', icon: 'smartphone' as const, accent: '#ff7900', soft: '#fff3e8' },
    { id: 'wave' as const, label: 'MTN MoMo', hint: 'Mobile Money', icon: 'zap' as const, accent: '#1c64f2', soft: '#e8f0fe' },
    { id: 'card' as const, label: 'Carte', hint: 'Visa · Mastercard', icon: 'credit-card' as const, accent: colors.gold, soft: colors.cream },
    { id: 'cod' as const, label: 'Livraison', hint: 'Espèces au livreur', icon: 'package' as const, accent: colors.green, soft: '#eaf4ec' },
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
  const days = useMemo(() => buildDays(), []);
  const [dayId, setDayId] = useState<DayId>('today');
  const hourSlots = useMemo(() => buildHourSlots(dayId), [dayId]);
  const [slotId, setSlotId] = useState('after-1-2');
  const [pay, setPay] = useState<PaymentIdLocal>(setup?.methodId ?? 'om');
  const [comment, setComment] = useState('');
  const placingRef = useRef(false);

  const allSlots = useMemo(() => {
    if (dayId === 'today') return [...EXPRESS_SLOTS, ...hourSlots];
    return hourSlots;
  }, [dayId, hourSlots]);

  useEffect(() => {
    if (!allSlots.some((s) => s.id === slotId)) {
      setSlotId(allSlots[0]?.id ?? 'after-1-2');
    }
  }, [allSlots, slotId]);

  useEffect(() => {
    if (setup?.ready && setup.methodId) setPay(setup.methodId);
  }, [setup]);

  const selectedPay = payments.find((p) => p.id === pay) ?? payments[0];
  const selectedDay = days.find((d) => d.id === dayId) ?? days[0];
  const selectedSlot = allSlots.find((s) => s.id === slotId) ?? allSlots[0];
  const payReady = isReady(pay);
  const payDetail = detailFor(pay);
  const isUrgent = slotId === 'urgent';
  const deliveryFee = delivery > 0 && isUrgent ? delivery * 2 : delivery;
  const checkoutTotal = Math.max(0, subtotal + deliveryFee - discount);

  const openPaymentSetup = (id: PaymentIdLocal) => {
    setPay(id);
    router.push(`/payment-setup/${id}` as Href);
  };

  const confirmOrder = () => {
    if (!lines.length || !selectedSlot || placingRef.current) return;
    const order = placeOrder({
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
      comment,
    });
    if (!order) return;
    // Prevent the empty-cart effect from stealing navigation to /cart.
    placingRef.current = true;
    clear();
    clearSetup();
    router.replace(`/order-success?id=${order.id}` as Href);
  };

  useEffect(() => {
    if (placingRef.current) return;
    if (cartReady && count === 0) {
      router.replace('/(tabs)/cart');
    }
  }, [cartReady, count]);

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={[styles.header, { paddingTop: Math.max(8, insets.top ? 4 : 8) }]}>
          <IconCircle name="arrow-left" onPress={() => router.back()} />
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Finaliser la commande</Text>
            <Text style={styles.headerSub}>
              {count} article{count > 1 ? 's' : ''} · {formatFcfa(checkoutTotal)}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

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
                  <Text style={styles.name}>Amina Diallo</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Par défaut</Text>
                  </View>
                </View>
                <Text style={styles.meta}>Rue 12, Ganhi</Text>
                <Text style={styles.meta}>+229 97 12 34 56</Text>
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
                    {EXPRESS_SLOTS.map((slot, i) => {
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
                            scaleTo={0.97}>
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
                      style={[styles.payCard, on && { borderColor: p.accent, backgroundColor: p.soft }]}
                      onPress={() => openPaymentSetup(p.id)}
                      scaleTo={0.97}>
                      <View style={[styles.payIcon, { backgroundColor: on ? p.accent : colors.white }]}>
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
                          on && { backgroundColor: p.accent, borderColor: p.accent },
                          ready && !on && { borderColor: colors.green, backgroundColor: colors.green },
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
                style={styles.commentInput}
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
              value={deliveryFee === 0 ? 'Offerte' : formatFcfa(deliveryFee)}
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
          {!payReady ? (
            <PressScale style={styles.setupCta} onPress={() => openPaymentSetup(pay)} scaleTo={0.98}>
              <Feather name={selectedPay.icon} size={18} color={colors.white} />
              <Text style={styles.setupCtaText}>Configurer {selectedPay.label}</Text>
            </PressScale>
          ) : (
            <SwipeToConfirm
              title="Glisser pour payer"
              subtitle={`${selectedSlot?.label} · ${selectedPay.label}`}
              amount={formatFcfa(checkoutTotal)}
              onConfirm={confirmOrder}
            />
          )}
        </View>
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
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 17, ...displayFont('700') },
  headerSub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 28, gap: 22 },
  section: { gap: 10 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  h: { color: colors.text, fontSize: 16, fontWeight: '800' },
  link: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  sectionHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
  },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  badge: {
    backgroundColor: colors.blush,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { color: colors.terracotta, fontSize: 10, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13 },
  block: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  blockLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  blockLabelSpaced: { marginTop: 4 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pillOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  pillText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  pillTextOn: { color: colors.white },
  expressRow: { flexDirection: 'row', gap: 10 },
  expressCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 12,
    gap: 6,
  },
  expressCardOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  expressUrgent: {
    borderColor: colors.terracotta,
    backgroundColor: colors.blush,
  },
  expressUrgentOn: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
  },
  expressIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  expressLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  expressLabelOn: { color: colors.white },
  expressHint: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  expressHintOn: { color: 'rgba(255,255,255,0.88)' },
  expressFee: { color: colors.terracotta, fontSize: 10, fontWeight: '700', marginTop: 2 },
  expressFeeOn: { color: 'rgba(255,255,255,0.95)' },
  slotRow: { gap: 8, paddingRight: 2 },
  slotPill: {
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHours: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  payRow: { gap: 10, paddingRight: 4 },
  payCard: {
    width: 124,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 5,
  },
  payIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 2,
  },
  payLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  payHint: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  payDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  paySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
  },
  paySummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    gap: 10,
  },
  setupCtaText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  commentCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  commentCount: { color: colors.placeholder, fontSize: 11, fontWeight: '600' },
  commentInput: {
    minHeight: 84,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    padding: 0,
  },
  summary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  summaryTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  recapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recapChipText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLabel: { color: colors.muted, fontSize: 14 },
  sumVal: { color: colors.text, fontWeight: '700', fontSize: 14 },
  hr: { height: 1, backgroundColor: colors.border },
  totalLabel: { color: colors.text, fontSize: 16, fontWeight: '800' },
  total: { color: colors.terracotta, fontSize: 20, fontWeight: '800' },
  secure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  secureText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
});
}
