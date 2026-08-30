import { AppImage } from '@/components/AppImage';
import { IconCircle, Page, Screen } from '@/components/ui';
import { bodyFont, displayFont, heroChrome, tabBarClearance, type AppColors } from '@/constants/theme';
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
import { profilePhotoSource } from '@/lib/profilePhoto';
import { formatFcfa } from '@/lib/format';
import { opsPhaseLabel } from '@/lib/orderOps';
import { useExpandableSheet } from '@/lib/expandableSheet';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useMemo, memo, useState, type ComponentProps } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureRoot } from '@/components/GestureRoot';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { conversations } = useChat();
  const { profile } = useProfile();
  const { orders } = useOrders();
  const [tab, setTab] = useState<InboxTab>('messages');

  const {
    sheetMax,
    sheetAnimStyle,
    sheetScrollGesture,
    sheetScrollRef,
    listScrollEnabled,
    onSheetScroll,
    onSheetScrollBeginDrag,
    onSheetScrollEndDrag,
    onSheetWheel,
  } = useExpandableSheet({ initiallyExpanded: true, lockExpanded: true });

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
      <Page style={styles.flex} edgeToEdge>
        <GestureRoot style={styles.flex}>
          <View style={styles.hero} pointerEvents="box-none">
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

            <View style={[styles.heroBar, { paddingTop: Math.max(10, insets.top + 6) }]}>
              <View style={styles.heroTitleCol}>
                <Text style={[styles.heroTitle, { color: chrome.ink }]} numberOfLines={1}>
                  {tab === 'messages' ? 'Messages' : 'Suivi'}
                </Text>
              </View>
              <IconCircle
                name={tab === 'messages' ? 'edit-3' : 'package'}
                variant="hero"
                accessibilityLabel={
                  tab === 'messages' ? 'Contacter l’assistance' : 'Voir mes commandes'
                }
                onPress={() => {
                  if (tab === 'messages') router.push('/chat/support' as Href);
                  else router.push('/orders' as Href);
                }}
              />
            </View>
          </View>

          <Animated.View
            style={[
              styles.sheet,
              { height: sheetMax - 10 },
              sheetAnimStyle,
              { paddingBottom: Math.max(8, insets.bottom) },
            ]}>
            <GestureDetector gesture={sheetScrollGesture}>
            <ScrollView
              ref={sheetScrollRef}
              style={styles.sheetScroll}
              contentContainerStyle={[styles.sheetScrollContent, { paddingBottom: tabBarClearance }]}
              showsVerticalScrollIndicator={false}
              bounces
              overScrollMode="auto"
              keyboardShouldPersistTaps="handled"
              scrollEnabled={listScrollEnabled}
              scrollEventThrottle={1}
              onScroll={onSheetScroll}
              onScrollBeginDrag={onSheetScrollBeginDrag}
              onScrollEndDrag={onSheetScrollEndDrag}
              onWheel={onSheetWheel}>
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
                        <Feather name="headphones" size={22} color="#ffffff" />
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
            </ScrollView>
            </GestureDetector>
          </Animated.View>
        </GestureRoot>
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
    heroBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 12,
    },
    heroTitleCol: { flex: 1, minWidth: 0 },
    heroTitle: {
      ...bodyFont('800'),
      fontSize: 28,
      lineHeight: 34,
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 10,
      zIndex: 5,
      overflow: 'hidden',
      flexDirection: 'column',
      ...Platform.select({
        ios: {
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.14,
          shadowRadius: 16,
        },
        android: { elevation: 8 },
        web: {
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        } as object,
        default: {},
      }),
    },
    sheetScroll: {
      flex: 1,
      minHeight: 0,
      ...(Platform.OS === 'web'
        ? ({ touchAction: 'pan-y', overscrollBehavior: 'contain' } as object)
        : {}),
    },
    sheetScrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      gap: 14,
    },
    menu: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 5,
    },
    menuTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      paddingHorizontal: 8,
      borderRadius: 12,
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
      gap: 12,
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14,
    },
    supportIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
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
      marginTop: 4,
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
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowUnread: { backgroundColor: colors.cream },
    rowPressed: { backgroundColor: colors.bg },
    avatarWrap: { position: 'relative' },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
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
      gap: 8,
      backgroundColor: colors.white,
      borderRadius: 18,
      paddingVertical: 28,
      paddingHorizontal: 20,
    },
    emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
    emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
    ordersLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    ordersLinkText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
    tip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.cream,
      borderRadius: 14,
      padding: 12,
    },
    tipAvatar: { width: 36, height: 36, borderRadius: 18 },
    tipIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  });
}
