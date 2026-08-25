import { AppImage } from '@/components/AppImage';
import { IconCircle, Page, Screen, TabHero } from '@/components/ui';
import { displayFont, tabBarClearance, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { conversations, type Conversation } from '@/data/messages';
import { avatar } from '@/data/catalog';
import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useMemo, memo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const HERO_OVERLAP = 28;

type InboxTab = 'messages' | 'orders';

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

function ChatInboxScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [heroHeight, setHeroHeight] = useState(140);
  const [tab, setTab] = useState<InboxTab>('messages');

  const support = useMemo(() => conversations.find((c) => c.kind === 'support'), []);
  const messageThreads = useMemo(
    () => conversations.filter((c) => c.kind === 'courier'),
    [],
  );
  const orderThreads = useMemo(
    () => conversations.filter((c) => c.kind === 'order'),
    [],
  );

  const messagesUnread =
    (support?.unread ?? 0) + messageThreads.reduce((sum, c) => sum + c.unread, 0);
  const ordersUnread = orderThreads.reduce((sum, c) => sum + c.unread, 0);

  const heroSubtitle =
    tab === 'messages'
      ? messagesUnread > 0
        ? `${messagesUnread} message${messagesUnread > 1 ? 's' : ''} non lu${messagesUnread > 1 ? 's' : ''}`
        : 'Assistance et échanges avec vos livreurs'
      : ordersUnread > 0
        ? `${ordersUnread} mise${ordersUnread > 1 ? 's' : ''} à jour`
        : 'Suivi et notifications de vos commandes';

  return (
    <Screen>
      <Page style={styles.flex}>
        <View
          style={styles.heroBackdrop}
          onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
          pointerEvents="box-none">
          <TabHero
            title={tab === 'messages' ? 'Messages' : 'Suivi'}
            subtitle={heroSubtitle}
            right={
              tab === 'messages' ? (
                <IconCircle
                  name="edit-3"
                  variant="hero"
                  accessibilityLabel="Contacter l’assistance"
                  onPress={() => router.push('/chat/support' as Href)}
                />
              ) : (
                <IconCircle
                  name="package"
                  variant="hero"
                  accessibilityLabel="Voir mes commandes"
                  onPress={() => router.push('/orders' as Href)}
                />
              )
            }
          />
        </View>

        <ScrollView
          style={styles.scrollLayer}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(0, heroHeight - HERO_OVERLAP) },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.bodySheet}>
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
                    <Text style={[styles.menuBadgeText, tab === 'messages' && styles.menuBadgeTextOn]}>
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
                {ordersUnread > 0 ? (
                  <View style={[styles.menuBadge, tab === 'orders' && styles.menuBadgeOn]}>
                    <Text style={[styles.menuBadgeText, tab === 'orders' && styles.menuBadgeTextOn]}>
                      {ordersUnread}
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
                      <Text style={styles.supportSub}>Aide commandes, paiement, livraison · 7j/7</Text>
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
                      Vos livreurs apparaîtront ici dès qu’une commande est en route.
                    </Text>
                  </View>
                )}

                <View style={styles.tip}>
                  <AppImage source={avatar} frameStyle={styles.tipAvatar} />
                  <Text style={styles.tipText}>
                    Votre livreur vous contacte ici dès qu’une commande est en préparation ou en route.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Suivi de commande</Text>
                  <Text style={styles.sectionMeta}>{orderThreads.length}</Text>
                </View>

                {orderThreads.length > 0 ? (
                  <View style={styles.list}>
                    {orderThreads.map((item) => (
                      <ConversationRow key={item.id} item={item} />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Feather name="package" size={22} color={colors.gold} />
                    <Text style={styles.emptyTitle}>Aucun suivi</Text>
                    <Text style={styles.emptyText}>
                      Les mises à jour de vos commandes s’afficheront ici.
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
        </ScrollView>
      </Page>
    </Screen>
  );
}

export default memo(ChatInboxScreen);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    heroBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 0 },
    scrollLayer: {
      flex: 1,
      zIndex: 1 },
    scrollContent: { paddingBottom: tabBarClearance },
    bodySheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 20,
      gap: 14,
      minHeight: Dimensions.get('window').height },
    menu: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 5 },
    menuTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      paddingHorizontal: 8,
      borderRadius: 12 },
    menuTabOn: {
      backgroundColor: colors.terracotta },
    menuTabText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '700' },
    menuTabTextOn: {
      color: '#ffffff' },
    menuBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4 },
    menuBadgeOn: {
      backgroundColor: 'rgba(255,255,255,0.22)' },
    menuBadgeText: {
      color: colors.terracotta,
      fontSize: 10,
      fontWeight: '800' },
    menuBadgeTextOn: {
      color: '#ffffff' },
    supportCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14 },
    supportIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.terracotta,
      alignItems: 'center',
      justifyContent: 'center' },
    supportText: { flex: 1, gap: 3 },
    supportTitle: { color: colors.text, fontSize: 15, ...displayFont('700') },
    supportSub: { color: colors.muted, fontSize: 12 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4 },
    sectionTitle: { color: colors.text, fontSize: 16, ...displayFont('700') },
    sectionMeta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    list: {
      backgroundColor: colors.white,
      borderRadius: 18,
      overflow: 'hidden' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border },
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
      justifyContent: 'center' },
    avatarSupport: { backgroundColor: colors.terracotta },
    onlineDot: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.green,
      borderColor: colors.white },
    rowBody: { flex: 1, gap: 2 },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
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
      paddingHorizontal: 5 },
    unreadText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
    emptyCard: {
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.white,
      borderRadius: 18,
      paddingVertical: 28,
      paddingHorizontal: 20 },
    emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
    emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
    ordersLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14 },
    ordersLinkText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
    tip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.cream,
      borderRadius: 14,
      padding: 12 },
    tipAvatar: { width: 36, height: 36, borderRadius: 18 },
    tipIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center' },
    tipText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 } });
}
