import { AppImage } from '@/components/AppImage';
import { FrostedTopBar, frostedBarClearance, IconCircle, Page, Screen, SmartNavbarChip, smartNavbarClearance } from '@/components/ui';
import { displayFont, heroChrome, tabBarClearance, type AppColors, spacing } from '@/constants/theme';
import { useChat } from '@/context/ChatContext';
import { useProfile } from '@/context/ProfileContext';
import {
  formatOrderId,
  statusLabel,
  useOrders,
  type Order,
  type OrderStatus,
} from '@/context/OrdersContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import { type Conversation } from '@/data/messages';
import { formatFcfa } from '@/lib/format';
import { opsPhaseLabel } from '@/lib/orderOps';
import { profilePhotoSource } from '@/lib/profilePhoto';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useMemo, memo, useState, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAV_SPRING = { damping: 20, stiffness: 240, mass: 0.55, overshootClamping: false } as const;

type InboxTab = 'messages' | 'orders';

function isActiveStatus(status: OrderStatus) {
  return status === 'confirmed' || status === 'preparing' || status === 'shipping';
}

function orderTimeLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startToday - startThat) / 86_400_000);
  if (dayDiff <= 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (dayDiff === 1) return 'Hier';
  if (dayDiff < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function orderPreview(order: Order) {
  const label = formatOrderId(order.id);
  if (order.status === 'delivered') return `${label} livrée · ${formatFcfa(order.total)}`;
  if (order.status === 'cancelled') return `${label} annulée`;
  return `${label} · ${opsPhaseLabel(order)}`;
}

function orderIcon(status: OrderStatus): ComponentProps<typeof Feather>['name'] {
  switch (status) {
    case 'confirmed':
      return 'check-circle';
    case 'preparing':
      return 'shopping-bag';
    case 'shipping':
      return 'truck';
    case 'delivered':
      return 'package';
    case 'cancelled':
      return 'x-circle';
  }
}

function ConversationRow({ item }: { item: Conversation }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, item.unread > 0 && styles.rowUnread, pressed && styles.rowPressed]}
      onPress={() => router.push(`/chat/${item.id}` as Href)}>
      <View style={styles.avatarWrap}>
        {item.avatar ? (
          <AppImage source={item.avatar} frameStyle={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, item.kind === 'support' && styles.avatarSupport]}>
            <Feather
              name={item.icon ?? 'message-circle'}
              size={20}
              color={item.kind === 'support' ? '#ffffff' : colors.gold}
            />
          </View>
        )}
        {item.online ? <View style={styles.onlineDot} /> : null}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, item.unread > 0 && styles.rowNameUnread]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.rowTime}>{item.time}</Text>
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.subtitle}
        </Text>
        <Text style={[styles.rowPreview, item.unread > 0 && styles.rowPreviewUnread]} numberOfLines={1}>
          {item.preview}
        </Text>
      </View>
      {item.unread > 0 ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread}</Text>
        </View>
      ) : (
        <Feather name="chevron-right" size={18} color={colors.placeholder} />
      )}
    </Pressable>
  );
}

function OrderSuiviRow({ order }: { order: Order }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const active = isActiveStatus(order.status);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, active && styles.rowUnread, pressed && styles.rowPressed]}
      onPress={() =>
        router.push((active ? `/tracking?id=${order.id}` : `/order/${order.id}`) as Href)
      }>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarFallback}>
          <Feather name={orderIcon(order.status)} size={20} color={colors.gold} />
        </View>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, active && styles.rowNameUnread]} numberOfLines={1}>
            Suivi commande {formatOrderId(order.id)}
          </Text>
          <Text style={styles.rowTime}>{orderTimeLabel(order.createdAt)}</Text>
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {statusLabel(order.status)} · {order.dayLabel}
        </Text>
        <Text style={[styles.rowPreview, active && styles.rowPreviewUnread]} numberOfLines={1}>
          {orderPreview(order)}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.placeholder} />
    </Pressable>
  );
}

function ChatInboxScreen() {
  const { scheme } = useTheme();
  const colors = useColors();
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [sheetMinHeight, setSheetMinHeight] = useState(0);
  const { conversations } = useChat();
  const { profile } = useProfile();
  const { orders } = useOrders();
  const [tab, setTab] = useState<InboxTab>('messages');
  const navMax = smartNavbarClearance(insets.top);
  const lastScrollY = useSharedValue(0);
  const navOffset = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const dy = y - lastScrollY.value;
      lastScrollY.value = y;
      if (y < 12) {
        navOffset.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
        return;
      }
      navOffset.value = Math.min(navMax, Math.max(0, navOffset.value + dy));
    },
    onBeginDrag: () => {},
    onEndDrag: (event) => {
      const v = event.velocity?.y ?? 0;
      if (event.contentOffset.y < 12) {
        navOffset.value = withSpring(0, NAV_SPRING);
        return;
      }
      navOffset.value = withSpring(v > 0.35 || navOffset.value > navMax * 0.38 ? navMax : 0, NAV_SPRING);
    },
    onMomentumEnd: (event) => {
      const v = event.velocity?.y ?? 0;
      if (event.contentOffset.y < 12) {
        navOffset.value = withSpring(0, NAV_SPRING);
        return;
      }
      navOffset.value = withSpring(v > 0.15 || navOffset.value > navMax * 0.38 ? navMax : 0, NAV_SPRING);
    },
  });

  const support = useMemo(() => conversations.find((c) => c.kind === 'support'), [conversations]);
  const messageThreads = useMemo(
    () => conversations.filter((c) => c.kind === 'courier'),
    [conversations],
  );
  const orderList = orders;
  const activeOrdersCount = useMemo(
    () => orderList.filter((o) => isActiveStatus(o.status)).length,
    [orderList],
  );

  const messagesUnread =
    (support?.unread ?? 0) + messageThreads.reduce((sum, c) => sum + c.unread, 0);

  return (
    <Screen>
      <Page style={styles.flex}>
          <View style={styles.hero} pointerEvents="none">
            <LinearGradient colors={chrome.gradient} style={StyleSheet.absoluteFill} />
            <View
              style={[styles.heroGlowA, { backgroundColor: scheme === 'dark' ? 'rgba(232,166,58,0.22)' : 'rgba(226,147,29,0.28)' }]}
              pointerEvents="none"
            />
            <View
              style={[styles.heroGlowB, { backgroundColor: scheme === 'dark' ? 'rgba(224,106,82,0.18)' : 'rgba(200,75,49,0.2)' }]}
              pointerEvents="none"
            />
            <View style={[styles.heroOrb, { backgroundColor: chrome.orb }]} pointerEvents="none" />
            <View style={[styles.heroRing, { borderColor: chrome.surfaceBorder }]} pointerEvents="none" />
            <View style={styles.heroWatermark} pointerEvents="none">
              <Feather name="message-circle" size={168} color={chrome.ink} />
            </View>
            <View style={[styles.heroSpark, { backgroundColor: colors.gold }]} pointerEvents="none" />
          </View>

          <Animated.ScrollView
            style={styles.flex}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height - frostedBarClearance(insets.top);
              setSheetMinHeight((prev) => (Math.abs(prev - h) < 1 ? prev : Math.max(0, h)));
            }}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: frostedBarClearance(insets.top) },
            ]}
            showsVerticalScrollIndicator={false}
            bounces
            overScrollMode="auto"
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={onScroll}>
            <View style={[styles.bodySheet, { minHeight: sheetMinHeight, paddingBottom: tabBarClearance + 8 }]}>
              <View style={styles.menu}>
                <Pressable
                  style={[styles.menuTab, tab === 'messages' && styles.menuTabOn]}
                  onPress={() => setTab('messages')}>
                  <Feather
                    name="message-circle"
                    size={15}
                    color={tab === 'messages' ? colors.white : colors.muted}
                  />
                  <Text style={[styles.menuTabText, tab === 'messages' && styles.menuTabTextOn]}>
                    Messages
                  </Text>
                  {messagesUnread > 0 ? (
                    <View style={[styles.menuBadge, tab === 'messages' && styles.menuBadgeOn]}>
                      <Text
                        style={[styles.menuBadgeText, tab === 'messages' && styles.menuBadgeTextOn]}>
                        {messagesUnread}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  style={[styles.menuTab, tab === 'orders' && styles.menuTabOn]}
                  onPress={() => setTab('orders')}>
                  <Feather
                    name="package"
                    size={15}
                    color={tab === 'orders' ? colors.white : colors.muted}
                  />
                  <Text style={[styles.menuTabText, tab === 'orders' && styles.menuTabTextOn]}>
                    Suivi commande
                  </Text>
                  {activeOrdersCount > 0 ? (
                    <View style={[styles.menuBadge, tab === 'orders' && styles.menuBadgeOn]}>
                      <Text style={[styles.menuBadgeText, tab === 'orders' && styles.menuBadgeTextOn]}>
                        {activeOrdersCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>

              {tab === 'messages' ? (
                <>
                  {support ? (
                    <Pressable
                      style={styles.supportCard}
                      onPress={() => router.push(`/chat/${support.id}` as Href)}>
                      <View style={styles.supportIcon}>
                        <Feather name="headphones" size={18} color="#ffffff" />
                      </View>
                      <View style={styles.supportText}>
                        <Text style={styles.supportTitle}>Assistance Marché Doré</Text>
                        <Text style={styles.supportSub}>
                          Aide commandes, paiement, livraison · 7j/7
                        </Text>
                      </View>
                      {support.unread > 0 ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>{support.unread}</Text>
                        </View>
                      ) : (
                        <Feather name="chevron-right" size={18} color={colors.placeholder} />
                      )}
                    </Pressable>
                  ) : null}

                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Livreurs</Text>
                    <Text style={styles.sectionMeta}>{messageThreads.length}</Text>
                  </View>

                  {messageThreads.length > 0 ? (
                    <View style={styles.list}>
                      {messageThreads.map((item) => (
                        <ConversationRow key={item.id} item={item} />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyCard}>
                      <Feather name="message-circle" size={22} color={colors.gold} />
                      <Text style={styles.emptyTitle}>Aucun message livreur</Text>
                      <Text style={styles.emptyText}>
                        Le chat avec le coursier s’ouvre lorsqu’un livreur CourseGO prend votre course.
                      </Text>
                    </View>
                  )}

                  <View style={styles.tip}>
                    <AppImage source={profilePhotoSource(profile.photoUri)} frameStyle={styles.tipAvatar} />
                    <Text style={styles.tipText}>
                      Votre livreur vous contacte ici dès qu’une commande est en préparation ou en
                      route.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Suivi de commande</Text>
                    <Text style={styles.sectionMeta}>{orderList.length}</Text>
                  </View>

                  {orderList.length > 0 ? (
                    <View style={styles.list}>
                      {orderList.map((order) => (
                        <OrderSuiviRow key={order.id} order={order} />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyCard}>
                      <Feather name="package" size={22} color={colors.gold} />
                      <Text style={styles.emptyTitle}>Aucune commande</Text>
                      <Text style={styles.emptyText}>
                        Vos commandes Marché Doré apparaîtront ici, comme sur votre profil.
                      </Text>
                    </View>
                  )}

                  <Pressable style={styles.ordersLink} onPress={() => router.push('/orders' as Href)}>
                    <Feather name="list" size={16} color={colors.gold} />
                    <Text style={styles.ordersLinkText}>Voir toutes mes commandes</Text>
                    <Feather name="chevron-right" size={16} color={colors.placeholder} />
                  </Pressable>

                  <View style={styles.tip}>
                    <View style={styles.tipIcon}>
                      <Feather name="bell" size={16} color={colors.gold} />
                    </View>
                    <Text style={styles.tipText}>
                      Recevez ici les alertes de préparation, d’expédition et de livraison.
                    </Text>
                  </View>
                </>
              )}
            </View>
          </Animated.ScrollView>
          <FrostedTopBar
            hideOffset={navOffset}
            right={
              <SmartNavbarChip round>
              <IconCircle
                name={tab === 'messages' ? 'edit-3' : 'package'}
                variant="ghost"
                size="lg"
                accessibilityLabel={
                  tab === 'messages' ? 'Contacter l’assistance' : 'Voir mes commandes'
                }
                onPress={() => {
                  if (tab === 'messages') router.push('/chat/support' as Href);
                  else router.push('/orders' as Href);
                }}
              />
              </SmartNavbarChip>
            }>
            <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>
              {tab === 'messages' ? 'Messages' : 'Suivi'}
            </Text>
          </FrostedTopBar>
      </Page>
    </Screen>
  );
}

export default memo(ChatInboxScreen);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    hero: {
      ...StyleSheet.absoluteFill,
    },
    heroOrb: {
      position: 'absolute',
      top: -40,
      right: -30,
      width: 180,
      height: 180,
      borderRadius: 90,
      opacity: 0.55,
    },
    heroGlowA: {
      position: 'absolute',
      top: -80,
      left: -60,
      width: 240,
      height: 240,
      borderRadius: 120,
      opacity: 0.85,
    },
    heroGlowB: {
      position: 'absolute',
      top: 80,
      right: -50,
      width: 200,
      height: 200,
      borderRadius: 100,
      opacity: 0.7,
    },
    heroRing: {
      position: 'absolute',
      top: 28,
      right: 72,
      width: 92,
      height: 92,
      borderRadius: 46,
      borderWidth: 1.5,
      opacity: 0.7,
    },
    heroWatermark: {
      position: 'absolute',
      right: -12,
      top: 36,
      opacity: 0.07,
      transform: [{ rotate: '-12deg' }],
    },
    heroSpark: {
      position: 'absolute',
      top: 96,
      left: 28,
      width: 8,
      height: 8,
      borderRadius: 4,
      opacity: 0.55,
    },
    heroTitle: {
      ...displayFont('800'),
      fontSize: 16,
      lineHeight: 20,
      letterSpacing: -0.3,
      flexShrink: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    bodySheet: {
      flexGrow: 1,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: spacing.screen,
      gap: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: -8 },
          shadowRadius: 18,
          shadowOpacity: 0.14,
        },
        android: { elevation: 8 },
        default: {},
      }),
    },
    menu: {
      flexDirection: 'row',
      gap: 6,
      backgroundColor: colors.white,
      borderRadius: 14,
      padding: 4,
    },
    menuTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 10,
    },
    menuTabOn: {
      backgroundColor: colors.terracotta,
    },
    menuTabText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '700',
    },
    menuTabTextOn: {
      color: '#ffffff',
    },
    menuBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    menuBadgeOn: {
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    menuBadgeText: {
      color: colors.terracotta,
      fontSize: 10,
      fontWeight: '800',
    },
    menuBadgeTextOn: {
      color: '#ffffff',
    },
    supportCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.white,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    supportIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.terracotta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    supportText: { flex: 1, gap: 3 },
    supportTitle: { color: colors.text, fontSize: 15, ...displayFont('700') },
    supportSub: { color: colors.muted, fontSize: 12 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: { color: colors.text, fontSize: 16, ...displayFont('700') },
    sectionMeta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    list: {
      backgroundColor: colors.white,
      borderRadius: 18,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowUnread: { backgroundColor: colors.cream },
    rowPressed: { backgroundColor: colors.bg },
    avatarWrap: { position: 'relative' },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarSupport: { backgroundColor: colors.terracotta },
    onlineDot: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.green,
      borderColor: colors.white,
    },
    rowBody: { flex: 1, gap: 2 },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
    rowNameUnread: { fontWeight: '800' },
    rowTime: { color: colors.placeholder, fontSize: 11, fontWeight: '600' },
    rowSub: { color: colors.muted, fontSize: 11 },
    rowPreview: { color: colors.placeholder, fontSize: 12, marginTop: 1 },
    rowPreviewUnread: { color: colors.muted, fontWeight: '600' },
    unreadBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.terracotta,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    unreadText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
    emptyCard: {
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.white,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: spacing.screen,
    },
    emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
    emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
    ordersLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    ordersLinkText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
    tip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.cream,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    tipAvatar: { width: 28, height: 28, borderRadius: 14 },
    tipIcon: {
      width: 28,
      height: 28,
      borderRadius: 10,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  });
}
