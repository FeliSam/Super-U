import { IconCircle, Screen, Page } from '@/components/ui';
import { colors, displayFont, tabBarClearance } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { formatOrderId, statusLabel, useOrders } from '@/context/OrdersContext';
import { avatar } from '@/data/catalog';
import { notifications } from '@/data/notifications';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { memo, type ComponentProps } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type FeatherIcon = ComponentProps<typeof Feather>['name'];

type MenuItem = {
  icon: FeatherIcon;
  label: string;
  subtitle?: string;
  badge?: string;
  onPress?: () => void;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const LOYALTY_POINTS = 450;
const LOYALTY_TARGET = 500;

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={item.onPress}>
      <View style={styles.rowLeft}>
        <View style={styles.icon}>
          <Feather name={item.icon} size={18} color={colors.gold} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          {item.subtitle ? <Text style={styles.rowSub}>{item.subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        {item.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : null}
        <Feather name="chevron-right" size={18} color={colors.placeholder} />
      </View>
    </Pressable>
  );
}

function ProfileScreen() {
  const { count } = useCart();
  const { count: favoritesCount } = useFavorites();
  const { activeOrder, orders } = useOrders();

  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const loyaltyProgress = LOYALTY_POINTS / LOYALTY_TARGET;

  const openPromos = () => {
    router.push('/promotions');
  };

  const sections: MenuSection[] = [
    {
      title: 'Mon compte',
      items: [
        {
          icon: 'user',
          label: 'Informations personnelles',
          subtitle: 'Amina Diallo · +221 77 123 45 67',
          onPress: () => router.push('/account/personal-info'),
        },
        {
          icon: 'map-pin',
          label: 'Adresses de livraison',
          subtitle: 'Rue 23, Dakar Plateau',
          onPress: () => router.push('/account/addresses'),
        },
        {
          icon: 'credit-card',
          label: 'Moyens de paiement',
          subtitle: 'Orange Money · Wave',
          onPress: () => router.push('/account/payment-methods'),
        },
        {
          icon: 'award',
          label: 'Carte de fidélité',
          subtitle: 'Cliente Or · 450 pts',
          onPress: () => router.push('/account/loyalty'),
        },
        {
          icon: 'bell',
          label: 'Centre de notifications',
          subtitle: 'Commandes, promos, livraisons',
          badge: unreadNotifications > 0 ? String(unreadNotifications) : undefined,
          onPress: () => router.push('/notifications'),
        },
      ],
    },
    {
      title: 'Mes achats',
      items: [
        {
          icon: 'shopping-bag',
          label: 'Mon panier',
          subtitle: count > 0 ? `${count} article${count > 1 ? 's' : ''}` : 'Panier vide',
          badge: count > 0 ? String(count) : undefined,
          onPress: () => navigateTab(tabPaths.cart),
        },
        {
          icon: 'box',
          label: 'Suivi de commande',
          subtitle: activeOrder
            ? `${formatOrderId(activeOrder.id)} · ${statusLabel(activeOrder.status)}`
            : 'Aucune commande en cours',
          onPress: () =>
            router.push((activeOrder ? `/tracking?id=${activeOrder.id}` : '/orders') as Href),
        },
        {
          icon: 'clock',
          label: 'Historique des commandes',
          subtitle:
            orders.length > 0
              ? `${orders.length} commande${orders.length > 1 ? 's' : ''}`
              : 'Aucune commande',
          onPress: () => router.push('/orders' as Href),
        },
        {
          icon: 'heart',
          label: 'Mes favoris',
          subtitle:
            favoritesCount > 0
              ? `${favoritesCount} produit${favoritesCount > 1 ? 's' : ''} liké${favoritesCount > 1 ? 's' : ''}`
              : 'Aucun produit liké',
          badge: favoritesCount > 0 ? String(favoritesCount) : undefined,
          onPress: () => router.push('/account/favorites'),
        },
        {
          icon: 'tag',
          label: 'Promotions',
          subtitle: 'Offres actives cette semaine',
          onPress: openPromos,
        },
      ],
    },
    {
      title: 'Réglages',
      items: [
        {
          icon: 'settings',
          label: 'Préférences',
          subtitle: 'Notifications, langue, confidentialité',
          onPress: () => router.push('/account/settings'),
        },
      ],
    },
    {
      title: 'Aide & informations',
      items: [
        {
          icon: 'help-circle',
          label: "Centre d'aide",
          subtitle: 'FAQ et assistance',
          onPress: () => router.push('/help'),
        },
        {
          icon: 'phone',
          label: 'Nous contacter',
          subtitle: '+221 33 000 00 00',
          onPress: () => router.push('/contact'),
        },
        {
          icon: 'file-text',
          label: 'Conditions & confidentialité',
          onPress: () => router.push('/legal'),
        },
        {
          icon: 'info',
          label: 'À propos de Marché Doré',
          subtitle: 'Version 1.0.0',
          onPress: () => router.push('/about'),
        },
      ],
    },
  ];

  return (
    <Screen>
      <Page style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['#f8e4c4', colors.cream, colors.bg]} style={styles.hero}>
            <View style={styles.heroBar}>
              <Text style={styles.heroTitle}>Profil</Text>
              <IconCircle name="settings" onPress={() => router.push('/account/settings')} bg="rgba(255,255,255,0.88)" />
            </View>

            <Pressable style={styles.heroIdentity} onPress={() => router.push('/account/personal-info')}>
              <View style={styles.avatarRing}>
                <Image source={avatar} style={styles.avatarHero} />
              </View>
              <Text style={styles.heroName}>Amina Diallo</Text>
              <View style={styles.heroMetaRow}>
                <Feather name="map-pin" size={13} color={colors.muted} />
                <Text style={styles.heroMeta}>Dakar, Plateau</Text>
              </View>
              <View style={styles.memberBadge}>
                <Feather name="award" size={12} color={colors.gold} />
                <Text style={styles.memberText}>Cliente fidèle · {LOYALTY_POINTS} pts</Text>
              </View>
            </Pressable>
          </LinearGradient>

          <View style={styles.bodySheet}>
            {activeOrder ? (
              <Pressable
                style={styles.activeOrder}
                onPress={() => router.push(`/tracking?id=${activeOrder.id}` as Href)}>
                <View style={styles.activeOrderIcon}>
                  <Feather name="package" size={20} color={colors.gold} />
                </View>
                <View style={styles.activeOrderText}>
                  <View style={styles.activeOrderHead}>
                    <Text style={styles.activeOrderTitle}>Commande en cours</Text>
                    <View style={styles.statusPill}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>{statusLabel(activeOrder.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.activeOrderSub}>
                    {formatOrderId(activeOrder.id)} · {activeOrder.dayLabel} {activeOrder.slotLabel}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.placeholder} />
              </Pressable>
            ) : null}

            <View style={styles.stats}>
              <Pressable style={styles.stat} onPress={() => router.push('/orders' as Href)}>
                <Feather name="shopping-cart" size={16} color={colors.gold} />
                <Text style={styles.statValue}>{orders.length}</Text>
                <Text style={styles.statLabel}>Commandes</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <Pressable style={styles.stat} onPress={() => router.push('/account/favorites')}>
                <Feather name="heart" size={16} color={colors.terracotta} />
                <Text style={styles.statValue}>{favoritesCount}</Text>
                <Text style={styles.statLabel}>Favoris</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <Pressable style={styles.stat} onPress={() => router.push('/account/loyalty')}>
                <Feather name="award" size={16} color={colors.green} />
                <Text style={styles.statValue}>{LOYALTY_POINTS}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </Pressable>
            </View>

            <Pressable style={styles.loyalty} onPress={() => router.push('/account/loyalty')}>
              <View style={styles.loyaltyTop}>
                <View style={styles.loyaltyIcon}>
                  <Feather name="gift" size={20} color={colors.gold} />
                </View>
                <View style={styles.loyaltyText}>
                  <Text style={styles.loyaltyTitle}>Programme fidélité · Cliente Or</Text>
                  <Text style={styles.loyaltySub}>
                    {LOYALTY_POINTS} / {LOYALTY_TARGET} pts
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.placeholder} />
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${loyaltyProgress * 100}%` }]} />
              </View>
              <Text style={styles.loyaltyHint}>50 pts avant votre prochaine récompense</Text>
            </Pressable>

            <View style={styles.quickRow}>
              <Pressable
                style={styles.quickAction}
                onPress={() =>
                  router.push((activeOrder ? `/tracking?id=${activeOrder.id}` : '/orders') as Href)
                }>
                <Feather name="truck" size={18} color={colors.gold} />
                <Text style={styles.quickLabel}>Livraison</Text>
              </Pressable>
              <Pressable style={styles.quickAction} onPress={() => router.push('/notifications')}>
                <Feather name="bell" size={18} color={colors.gold} />
                <Text style={styles.quickLabel}>Alertes</Text>
                {unreadNotifications > 0 ? (
                  <View style={styles.quickBadge}>
                    <Text style={styles.quickBadgeText}>{unreadNotifications}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable style={styles.quickAction} onPress={() => navigateTab(tabPaths.chat)}>
                <Feather name="message-circle" size={18} color={colors.gold} />
                <Text style={styles.quickLabel}>Messages</Text>
              </Pressable>
              <Pressable style={styles.quickAction} onPress={() => navigateTab(tabPaths.search)}>
                <Feather name="search" size={18} color={colors.gold} />
                <Text style={styles.quickLabel}>Recherche</Text>
              </Pressable>
            </View>

            {sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionCard}>
                  {section.items.map((item, itemIndex) => (
                    <View key={item.label}>
                      <MenuRow item={item} />
                      {itemIndex < section.items.length - 1 ? <View style={styles.separator} /> : null}
                    </View>
                  ))}
                </View>
              </View>
            ))}

            <Pressable style={styles.logout} onPress={() => navigateTab(tabPaths.home)}>
              <Feather name="log-out" size={18} color={colors.terracotta} />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </Pressable>

            <Text style={styles.footer}>Marché Doré · v1.0.0 · Dakar, Sénégal</Text>
          </View>
        </ScrollView>
      </Page>
    </Screen>
  );
}

export default memo(ProfileScreen);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: tabBarClearance },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
  },
  heroBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: { color: colors.text, fontSize: 28, ...displayFont('700') },
  heroIdentity: { alignItems: 'center', gap: 10 },
  avatarRing: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.white,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarHero: { width: 96, height: 96, borderRadius: 48 },
  heroName: { color: colors.text, fontSize: 24, ...displayFont('800') },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMeta: { color: colors.muted, fontSize: 14 },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  memberText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  bodySheet: {
    marginTop: -24,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  activeOrder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  activeOrderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeOrderText: { flex: 1, gap: 4 },
  activeOrderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  activeOrderTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#edf7ef',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  statusText: { color: colors.green, fontSize: 11, fontWeight: '700' },
  activeOrderSub: { color: colors.muted, fontSize: 12 },
  stats: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 16,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  stat: { flex: 1, alignItems: 'center', gap: 5 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  loyalty: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  loyaltyTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loyaltyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyText: { flex: 1, gap: 2 },
  loyaltyTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  loyaltySub: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.gold },
  loyaltyHint: { color: colors.muted, fontSize: 11, fontWeight: '500' },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 12,
    position: 'relative',
  },
  quickLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  quickBadge: {
    position: 'absolute',
    top: 8,
    right: 10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  section: { gap: 10 },
  sectionTitle: { color: colors.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  sectionCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowPressed: { backgroundColor: colors.bg },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowText: { flex: 1, gap: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: colors.muted, fontSize: 12 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 66 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.blush,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 14,
  },
  logoutText: { color: colors.terracotta, fontSize: 15, fontWeight: '700' },
  footer: {
    textAlign: 'center',
    color: colors.placeholder,
    fontSize: 11,
    fontWeight: '500',
    paddingBottom: 8,
  },
});
