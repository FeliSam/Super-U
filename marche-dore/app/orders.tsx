import { AppImage } from '@/components/AppImage';
import { EmptyStateHero } from '@/components/EmptyStateHero';
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
  type Order,
  type OrderStatus } from '@/context/OrdersContext';
import { formatFcfa } from '@/lib/format';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { softShadow } from '@/lib/shadow';
import { statusTone } from '@/lib/statusTone';
import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FilterId = 'all' | 'active' | 'done';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'En cours' },
  { id: 'done', label: 'Terminées' },
];

const ACTION_W = 88;
const OPEN_LEFT = ACTION_W;
const OPEN_RIGHT = -ACTION_W;
const OVERSWIPE = 24;

function isActiveStatus(status: OrderStatus) {
  return status === 'confirmed' || status === 'preparing' || status === 'shipping';
}

function formatOrderDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function OrderCard({ order, index }: { order: Order; index: number }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { add } = useCart();
  const active = isActiveStatus(order.status);
  const tone = statusTone(order.status, colors);
  const first = order.lines[0];
  const product = first ? getProduct(first.productId) : undefined;
  const extra = Math.max(0, order.lines.length - 1);

  const translateX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);

  const snapTo = (toValue: number) => {
    offset.current = toValue;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 68 }).start();
  };

  const close = () => snapTo(0);

  const openPrimary = () => {
    router.push((active ? `/tracking?id=${order.id}` : `/order/${order.id}`) as Href);
    close();
  };

  const onHelp = () => {
    close();
    router.push('/help' as Href);
  };

  const onPrimaryAction = () => {
    if (active) {
      close();
      router.push(`/tracking?id=${order.id}` as Href);
      return;
    }
    order.lines.forEach((line) => {
      if (getProduct(line.productId)) add(line.productId, line.qty);
    });
    close();
    router.push('/(tabs)/cart' as Href);
  };

  const leftProgress = translateX.interpolate({
    inputRange: [0, OPEN_LEFT],
    outputRange: [0, 1],
    extrapolate: 'clamp' });
  const rightProgress = translateX.interpolate({
    inputRange: [OPEN_RIGHT, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp' });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateX.stopAnimation((v) => {
          offset.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        const raw = offset.current + g.dx;
        let next = raw;
        if (raw > OPEN_LEFT) {
          next = OPEN_LEFT + (raw - OPEN_LEFT) * 0.3;
        } else if (raw < OPEN_RIGHT) {
          next = OPEN_RIGHT - (OPEN_RIGHT - raw) * 0.3;
        }
        translateX.setValue(Math.max(OPEN_RIGHT - OVERSWIPE, Math.min(OPEN_LEFT + OVERSWIPE, next)));
      },
      onPanResponderRelease: (_, g) => {
        const projected = offset.current + g.dx + g.vx * 36;
        if (projected > OPEN_LEFT / 2 || g.vx > 0.45) {
          snapTo(OPEN_LEFT);
          return;
        }
        if (projected < OPEN_RIGHT / 2 || g.vx < -0.45) {
          snapTo(OPEN_RIGHT);
          return;
        }
        snapTo(0);
      } }),
  ).current;

  const primaryLabel = active ? 'Suivre' : 'Recommander';
  const primaryIcon = active ? ('navigation' as const) : ('refresh-cw' as const);
  const primaryBg = active ? colors.terracotta : colors.gold;

  return (
    <MotionView preset="down" delay={40 + index * 40}>
      <View style={styles.swipeWrap}>
        <Animated.View style={[styles.leftRail, { opacity: leftProgress }]}>
          <Pressable style={styles.helpBtn} onPress={onHelp}>
            <Feather name="help-circle" size={20} color={colors.onAccent} />
            <Text style={styles.railLabel}>Aide</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.rightRail, { opacity: rightProgress }]}>
          <Pressable style={[styles.primaryBtn, { backgroundColor: primaryBg }]} onPress={onPrimaryAction}>
            <Feather name={primaryIcon} size={18} color={colors.onAccent} />
            <Text style={styles.railLabel}>{primaryLabel}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[styles.card, softShadow({ y: 6, blur: 16, opacity: 0.06 }), { transform: [{ translateX }] }]}
          {...panResponder.panHandlers}>
          <Pressable onPress={openPrimary}>
            <View style={styles.cardTop}>
              <View style={styles.thumbs}>
                {product?.image ? (
                  <AppImage source={product.image} frameStyle={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Feather name={tone.icon} size={18} color={tone.text} />
                  </View>
                )}
                {extra > 0 ? (
                  <View style={styles.thumbBadge}>
                    <Text style={styles.thumbBadgeText}>+{extra}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.cardBody}>
                <View style={styles.idRow}>
                  <Text style={styles.id}>{formatOrderId(order.id)}</Text>
                  <Text style={styles.total}>{formatFcfa(order.total)}</Text>
                </View>

                <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                  <View style={[styles.badgeDot, { backgroundColor: tone.text }]} />
                  <Text style={[styles.badgeText, { color: tone.text }]}>{statusLabel(order.status)}</Text>
                </View>

                <Text style={styles.slot} numberOfLines={1}>
                  {order.dayLabel} · {order.slotLabel}
                </Text>
                <Text style={styles.meta}>
                  {order.itemCount} article{order.itemCount > 1 ? 's' : ''}
                  {formatOrderDate(order.createdAt) ? ` · ${formatOrderDate(order.createdAt)}` : ''}
                </Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.footerHint}>
                {active ? 'Suivre la livraison' : 'Voir le détail'} · glissez pour actions
              </Text>
              <View style={[styles.footerBtn, active && styles.footerBtnActive]}>
                <Feather
                  name={active ? 'navigation' : 'chevron-right'}
                  size={14}
                  color={active ? colors.white : colors.muted}
                />
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </MotionView>
  );
}

export default function OrdersScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { orders, ready } = useOrders();
  const [filter, setFilter] = useState<FilterId>('all');

  const activeCount = useMemo(() => orders.filter((o) => isActiveStatus(o.status)).length, [orders]);
  const doneCount = useMemo(() => orders.filter((o) => !isActiveStatus(o.status)).length, [orders]);

  const filtered = useMemo(() => {
    if (filter === 'active') return orders.filter((o) => isActiveStatus(o.status));
    if (filter === 'done') return orders.filter((o) => !isActiveStatus(o.status));
    return orders;
  }, [orders, filter]);

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={[styles.header, { paddingTop: Math.max(8, insets.top ? 4 : 8) }]}>
          <IconCircle name="arrow-left" onPress={() => router.back()} />
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Mes commandes</Text>
            {orders.length > 0 ? (
              <Text style={styles.headerSub}>
                {activeCount > 0
                  ? `${activeCount} en cours · ${orders.length} au total`
                  : `${orders.length} commande${orders.length > 1 ? 's' : ''}`}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {orders.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            style={styles.filtersScroll}>
            {FILTERS.map((f) => {
              const on = filter === f.id;
              const count =
                f.id === 'all' ? orders.length : f.id === 'active' ? activeCount : doneCount;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
                  <View style={[styles.chipCount, on && styles.chipCountOn]}>
                    <Text style={[styles.chipCountText, on && styles.chipCountTextOn]}>{count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(28, insets.bottom + 16) }]}
          showsVerticalScrollIndicator={false}>
          {!ready ? null : orders.length === 0 ? (
            <EmptyStateHero
              icon="clock"
              badge="Historique"
              title={'Pas encore\nde commande'}
              subtitle="Vos livraisons apparaîtront ici dès que vous aurez finalisé un panier — suivi live inclus."
              primaryLabel="Découvrir les produits"
              primaryIcon="compass"
              onPrimary={() => navigateTab(tabPaths.home)}
              secondaryLabel="Voir mon panier"
              secondaryIcon="shopping-bag"
              onSecondary={() => navigateTab(tabPaths.cart)}
              perks={[
                { icon: 'package', label: 'Préparation', color: colors.gold },
                { icon: 'truck', label: 'Livraison', color: colors.green },
                { icon: 'award', label: 'Points fidélité', color: colors.terracotta },
              ]}
            />
          ) : filtered.length === 0 ? (
            <EmptyStateHero
              icon="inbox"
              badge="Filtres"
              title={
                filter === 'active'
                  ? 'Aucune livraison\nen cours'
                  : 'Aucune commande\nterminée'
              }
              subtitle={
                filter === 'active'
                  ? 'Passez une nouvelle commande pour activer le suivi live.'
                  : 'Dès qu’une commande sera livrée, elle apparaîtra ici.'
              }
              primaryLabel="Voir toutes les commandes"
              primaryIcon="list"
              onPrimary={() => setFilter('all')}
              secondaryLabel="Suivi de commande"
              secondaryIcon="truck"
              onSecondary={() => router.push('/tracking' as Href)}
            />
          ) : (
            <View style={styles.list}>
              {filtered.map((order, i) => (
                <OrderCard key={order.id} order={order} index={i} />
              ))}
            </View>
          )}
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
  headerSub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  filtersScroll: { flexGrow: 0, marginBottom: 4 },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14 },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.onAccent },
  chipCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center' },
  chipCountOn: { backgroundColor: 'rgba(255,255,255,0.18)' },
  chipCountText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  chipCountTextOn: { color: colors.onAccent },
  content: { paddingHorizontal: 20, flexGrow: 1 },
  list: { gap: 12 },
  swipeWrap: {
    position: 'relative',
    borderRadius: 22,
    overflow: 'hidden' },
  leftRail: {
    ...StyleSheet.absoluteFillObject,
    right: undefined,
    width: ACTION_W,
    justifyContent: 'center',
    alignItems: 'stretch' },
  rightRail: {
    ...StyleSheet.absoluteFillObject,
    left: undefined,
    width: ACTION_W,
    justifyContent: 'center',
    alignItems: 'stretch' },
  helpBtn: {
    flex: 1,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 22 },
  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 22 },
  railLabel: { color: colors.white, fontSize: 11, fontWeight: '800' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 14,
    gap: 12 },
  cardTop: { flexDirection: 'row', gap: 12 },
  thumbs: { position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: 16 },
  thumbFallback: {
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center' },
  thumbBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.white },
  thumbBadgeText: { color: colors.onAccent, fontSize: 11, fontWeight: '800' },
  cardBody: { flex: 1, gap: 6 },
  idRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  id: { ...displayFont('700'), color: colors.text, fontSize: 16, flexShrink: 1 },
  total: { color: colors.text, fontSize: 15, fontWeight: '800' },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  slot: { color: colors.text, fontSize: 13, fontWeight: '600' },
  meta: { color: colors.placeholder, fontSize: 12, fontWeight: '500' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 8 },
  footerHint: { flex: 1, color: colors.muted, fontSize: 12, fontWeight: '600' },
  footerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center' },
  footerBtnActive: { backgroundColor: colors.terracotta },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
    paddingTop: 48 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6 },
  emptyIconSoft: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
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
  emptyBtnText: { color: colors.onAccent, fontSize: 14, fontWeight: '800' },
  emptyGhost: { paddingVertical: 10, paddingHorizontal: 12 },
  emptyGhostText: { color: colors.gold, fontSize: 14, fontWeight: '700' } });
}
