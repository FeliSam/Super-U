import { IconCircle, Screen, Page } from '@/components/ui';
import { colors, tabBarClearance } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { useUiState } from '@/context/UiStateContext';
import { avatar } from '@/data/catalog';
import { notifications } from '@/data/notifications';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useRef, useState, type ComponentProps } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

type FeatherIcon = ComponentProps<typeof Feather>['name'];

type MenuItem = {
  icon: FeatherIcon;
  label: string;
  subtitle?: string;
  badge?: string;
  onPress?: () => void;
  toggle?: boolean;
  value?: boolean;
  onToggle?: (next: boolean) => void;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const LOYALTY_POINTS = 450;
const LOYALTY_TARGET = 500;

function MenuRow({ item }: { item: MenuItem }) {
  const content = (
    <>
      <View style={styles.rowLeft}>
        <View style={styles.icon}>
          <Feather name={item.icon} size={18} color={colors.gold} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          {item.subtitle ? <Text style={styles.rowSub}>{item.subtitle}</Text> : null}
        </View>
      </View>
      {item.toggle ? (
        <Switch
          value={item.value}
          onValueChange={item.onToggle}
          trackColor={{ false: colors.border, true: colors.gold }}
          thumbColor={colors.white}
        />
      ) : (
        <View style={styles.rowRight}>
          {item.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          ) : null}
          <Feather name="chevron-right" size={18} color={colors.placeholder} />
        </View>
      )}
    </>
  );

  if (item.toggle) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={item.onPress}>
      {content}
    </Pressable>
  );
}

function ProfileScreen() {
  const { count } = useCart();
  const { setSearchPromoOnly } = useUiState();
  const scrollRef = useRef<ScrollView>(null);
  const preferencesY = useRef(0);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);

  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const loyaltyProgress = LOYALTY_POINTS / LOYALTY_TARGET;

  const openPromos = () => {
    setSearchPromoOnly(true);
    navigateTab(tabPaths.search);
  };

  const scrollToPreferences = () => {
    scrollRef.current?.scrollTo({ y: preferencesY.current, animated: true });
  };

  const onPreferencesLayout = (event: LayoutChangeEvent) => {
    preferencesY.current = event.nativeEvent.layout.y;
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
          subtitle: 'Commande #MD-2024-0847 en cours',
          onPress: () => router.push('/tracking'),
        },
        {
          icon: 'clock',
          label: 'Historique des commandes',
          subtitle: '12 commandes passées',
          onPress: () => router.push('/tracking'),
        },
        {
          icon: 'heart',
          label: 'Mes favoris',
          subtitle: 'Produits enregistrés',
          onPress: () => navigateTab(tabPaths.explore),
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
      title: 'Préférences',
      items: [
        {
          icon: 'smartphone',
          label: 'Notifications push',
          subtitle: 'Alertes de livraison',
          toggle: true,
          value: pushEnabled,
          onToggle: setPushEnabled,
        },
        {
          icon: 'message-circle',
          label: 'Offres par SMS',
          toggle: true,
          value: smsEnabled,
          onToggle: setSmsEnabled,
        },
        {
          icon: 'mail',
          label: 'Newsletter',
          toggle: true,
          value: emailEnabled,
          onToggle: setEmailEnabled,
        },
        {
          icon: 'globe',
          label: 'Langue',
          subtitle: 'Français',
          onPress: () => {},
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
          onPress: () => router.push('/tracking'),
        },
        {
          icon: 'phone',
          label: 'Nous contacter',
          subtitle: '+221 33 000 00 00',
          onPress: () => router.push('/notifications'),
        },
        {
          icon: 'file-text',
          label: 'Conditions & confidentialité',
          onPress: () => router.push('/checkout'),
        },
        {
          icon: 'info',
          label: 'À propos de Marché Doré',
          subtitle: 'Version 1.0.0',
          onPress: () => navigateTab(tabPaths.home),
        },
      ],
    },
  ];

  return (
    <Screen>
      <Page style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['#f8e4c4', colors.cream, colors.bg]} style={styles.hero}>
            <View style={styles.heroBar}>
              <Text style={styles.heroTitle}>Profil</Text>
              <IconCircle name="settings" onPress={scrollToPreferences} bg="rgba(255,255,255,0.88)" />
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
            <Pressable style={styles.activeOrder} onPress={() => router.push('/tracking')}>
              <View style={styles.activeOrderIcon}>
                <Feather name="package" size={20} color={colors.gold} />
              </View>
              <View style={styles.activeOrderText}>
                <View style={styles.activeOrderHead}>
                  <Text style={styles.activeOrderTitle}>Commande en cours</Text>
                  <View style={styles.statusPill}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Préparation</Text>
                  </View>
                </View>
                <Text style={styles.activeOrderSub}>#MD-2024-0847 · Livraison aujourd'hui 14h–16h</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.placeholder} />
            </Pressable>

            <View style={styles.stats}>
              <Pressable style={styles.stat} onPress={() => router.push('/tracking')}>
                <Feather name="shopping-cart" size={16} color={colors.gold} />
                <Text style={styles.statValue}>12</Text>
                <Text style={styles.statLabel}>Commandes</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <Pressable style={styles.stat} onPress={() => navigateTab(tabPaths.explore)}>
                <Feather name="heart" size={16} color={colors.terracotta} />
                <Text style={styles.statValue}>8</Text>
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
              <Pressable style={styles.quickAction} onPress={() => router.push('/tracking')}>
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
              <Pressable style={styles.quickAction} onPress={() => navigateTab(tabPaths.cart)}>
                <Feather name="shopping-bag" size={18} color={colors.gold} />
                <Text style={styles.quickLabel}>Panier</Text>
                {count > 0 ? (
                  <View style={styles.quickBadge}>
                    <Text style={styles.quickBadgeText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable style={styles.quickAction} onPress={() => navigateTab(tabPaths.search)}>
                <Feather name="search" size={18} color={colors.gold} />
                <Text style={styles.quickLabel}>Recherche</Text>
              </Pressable>
            </View>

            {sections.map((section) => (
              <View
                key={section.title}
                style={styles.section}
                onLayout={section.title === 'Préférences' ? onPreferencesLayout : undefined}>
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
  heroTitle: { color: colors.text, fontSize: 28, fontWeight: '700' },
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
  heroName: { color: colors.text, fontSize: 24, fontWeight: '800' },
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
