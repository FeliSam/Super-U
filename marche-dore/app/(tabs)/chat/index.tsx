import { AppImage } from '@/components/AppImage';
import { IconCircle, Page, Screen } from '@/components/ui';
import { colors, displayFont, tabBarClearance } from '@/constants/theme';
import { conversations, unreadMessagesCount, type Conversation } from '@/data/messages';
import { avatar } from '@/data/catalog';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function ConversationRow({ item }: { item: Conversation }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, item.unread > 0 && styles.rowUnread, pressed && styles.rowPressed]}
      onPress={() => router.push(`/chat/${item.id}` as Href)}>
      <View style={styles.avatarWrap}>
        {item.avatar ? (
          <AppImage source={item.avatar} frameStyle={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, item.kind === 'support' && styles.avatarSupport]}>
            <Feather name={item.icon ?? 'message-circle'} size={20} color={item.kind === 'support' ? colors.white : colors.gold} />
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
  const unread = unreadMessagesCount();
  const support = conversations.find((c) => c.kind === 'support');
  const others = conversations.filter((c) => c.kind !== 'support');

  return (
    <Screen>
      <Page style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['#f8e4c4', colors.cream, colors.bg]} style={styles.hero}>
            <View style={styles.heroBar}>
              <Text style={styles.heroTitle}>Messages</Text>
              <IconCircle name="edit-3" bg="rgba(255,255,255,0.88)" onPress={() => router.push('/chat/support' as Href)} />
            </View>
            <Text style={styles.heroSub}>
              {unread > 0
                ? `${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}`
                : 'Assistance et conversations de livraison'}
            </Text>
          </LinearGradient>

          <View style={styles.body}>
            {support ? (
              <Pressable style={styles.supportCard} onPress={() => router.push(`/chat/${support.id}` as Href)}>
                <View style={styles.supportIcon}>
                  <Feather name="headphones" size={22} color={colors.white} />
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
              <Text style={styles.sectionTitle}>Conversations</Text>
              <Text style={styles.sectionMeta}>{others.length}</Text>
            </View>

            <View style={styles.list}>
              {others.map((item) => (
                <ConversationRow key={item.id} item={item} />
              ))}
            </View>

            <View style={styles.tip}>
              <AppImage source={avatar} frameStyle={styles.tipAvatar} />
              <Text style={styles.tipText}>
                Votre livreur vous contacte ici dès qu’une commande est en préparation ou en route.
              </Text>
            </View>
          </View>
        </ScrollView>
      </Page>
    </Screen>
  );
}

export default memo(ChatInboxScreen);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: tabBarClearance },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 8 },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between' },
  heroTitle: { color: colors.text, fontSize: 28, ...displayFont('800') },
  heroSub: { color: colors.muted, fontSize: 14 },
  body: {
    marginTop: -16,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 14 },
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

    borderBottomColor: colors.border },
  rowUnread: { backgroundColor: '#fffdfb' },
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
    backgroundColor: colors.green },
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
  unreadText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cream,
    borderRadius: 14,
    padding: 12 },
  tipAvatar: { width: 36, height: 36, borderRadius: 18 },
  tipText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 } });
