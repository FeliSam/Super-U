import { IconCircle, Screen, Page } from '@/components/ui';
import { PressScale } from '@/components/motion';
import { displayFont, heroChrome, tabBarClearance, type AppColors } from '@/constants/theme';
import { useAddresses } from '@/context/AddressesContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useNotifications } from '@/context/NotificationsContext';
import { formatOrderId, statusLabel, useOrders } from '@/context/OrdersContext';
import { usePayments } from '@/context/PaymentsContext';
import { useStores } from '@/context/StoresContext';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { avatar } from '@/data/catalog';
import { useExpandableSheet } from '@/lib/expandableSheet';
import { useLiveLoyalty } from '@/lib/loyalty';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useMemo, memo, type ComponentProps } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const LOYALTY_TARGET = 500;
const ICON_BG = 'rgba(255,255,255,0.92)';

function MenuRow({ item }: { item: MenuItem }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const { scheme } = useTheme();
  const colors = useColors();
  const chrome = useMemo(() => heroChrome(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const {
    sheetMin,
    sheetMax,
    sheetAnimStyle,
    sheetHandleGesture,
    sheetPullDownGesture,
    sheetScrollRef,
    onSheetScroll,
    onSheetScrollBeginDrag,
    onSheetScrollEndDrag,
  } = useExpandableSheet();
  const sheetScrollGesture = useMemo(
    () => Gesture.Simultaneous(sheetPullDownGesture, Gesture.Native()),
    [sheetPullDownGesture],
  );

  const { count } = useCart();
  const { count: favoritesCount } = useFavorites();
  const { activeOrder, orders } = useOrders();
  const { defaultAddress } = useAddresses();
  const { selectedStore } = useStores();
  const { profileSubtitle: paymentSubtitle } = usePayments();
  const { unreadCount } = useNotifications();
  const { profile } = useProfile();
  const { signOut, session } = useAuth();
  const loyalty = useLiveLoyalty();

  const unreadNotifications = unreadCount;
  const loyaltyProgress = Math.min(1, loyalty.points / Math.max(1, loyalty.nextRewardAt || LOYALTY_TARGET));

  const confirmSignOut = () => {
    const run = async () => {
      await signOut();
    };
    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined' &&
        typeof window.confirm === 'function' &&
        window.confirm('Se déconnecter de Marché Doré ?');
      if (ok) void run();
      return;
    }
    Alert.alert('Déconnexion', 'Se déconnecter de Marché Doré ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => void run() },
    ]);
  };

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
          subtitle: `${profile.firstName} ${profile.lastName} · ${profile.phone}`,
          onPress: () => router.push('/account/personal-info'),
        },
        {
          icon: 'map-pin',
          label: 'Adresses de livraison',
          subtitle: defaultAddress.line,
          onPress: () => router.push('/account/addresses'),
        },
        {
          icon: 'package',
          label: 'Magasin Super U',
          subtitle: selectedStore.name,
          onPress: () => router.push('/account/stores'),
        },
        {
          icon: 'credit-card',
          label: 'Moyens de paiement',
          subtitle: paymentSubtitle,
          onPress: () => router.push('/account/payment-methods'),
        },
        {
          icon: 'award',
          label: 'Carte de fidélité',
          subtitle: loyalty.profileSubtitle,
          onPress: () => router.push('/account/loyalty'),
        },
        {
          icon: 'bell',
          label: 'Centre de notifications',
          subtitle:
            unreadNotifications > 0
              ? `${unreadNotifications} non lue${unreadNotifications > 1 ? 's' : ''}`
              : 'Commandes, promos, livraisons',
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
          onPress: () => router.push('/tracking' as Href),
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
          subtitle: '+229 21 00 00 00',
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
      <Page style={styles.flex} edgeToEdge>
        <GestureHandlerRootView style={styles.flex}>
          <View style={styles.hero} pointerEvents="box-none">
            <LinearGradient colors={chrome.gradient} style={StyleSheet.absoluteFill} />
            <View style={[styles.heroOrb, { backgroundColor: chrome.orb }]} />

            <View style={[styles.heroBar, { paddingTop: Math.max(10, insets.top + 6) }]}>
              <IconCircle
                name="bell"
                bg={ICON_BG}
                badge={unreadNotifications}
                accessibilityLabel="Notifications"
                onPress={() => router.push('/notifications')}
              />
              <IconCircle
                name="settings"
                bg={ICON_BG}
                accessibilityLabel="Paramètres"
                onPress={() => router.push('/account/settings')}
              />
            </View>

            <View
              style={[
                styles.heroTitleBlock,
                { paddingTop: Math.max(10, insets.top + 6) + 52 },
              ]}
              pointerEvents="none">
              <Text style={[styles.heroTitle, { color: chrome.ink }]}>Profil</Text>
            </View>

            <View style={[styles.heroIdentityWrap, { bottom: sheetMin + 20 }]} pointerEvents="box-none">
              <View style={styles.heroIdentity}>
                <PressScale
                  onPress={() => router.push('/account/personal-info')}
                  scaleTo={0.98}
                  accessibilityLabel="Modifier le profil"
                  style={styles.heroIdentityHit}>
                  <View
                    style={[
                      styles.avatarRing,
                      {
                        backgroundColor: scheme === 'dark' ? colors.white : '#ffffff',
                        borderColor: chrome.surfaceBorder,
                      },
                    ]}>
                    <Image source={avatar} style={styles.avatarHero} />
                  </View>
                  <Text style={[styles.heroName, { color: chrome.ink }]}>
                    {profile.firstName} {profile.lastName}
                  </Text>
                </PressScale>
                <PressScale
                  style={styles.heroMetaRow}
                  onPress={() => router.push('/account/addresses')}
                  scaleTo={0.97}
                  accessibilityLabel="Adresses de livraison">
                  <Feather name="map-pin" size={13} color={colors.gold} />
                  <Text style={[styles.heroMeta, { color: chrome.muted }]} numberOfLines={1}>
                    {defaultAddress.line}
                  </Text>
                  <Feather name="chevron-down" size={13} color={chrome.muted} />
                </PressScale>
                <PressScale
                  style={[
                    styles.memberBadge,
                    { backgroundColor: chrome.surface, borderColor: chrome.surfaceBorder },
                  ]}
                  onPress={() => router.push('/account/loyalty')}
                  scaleTo={0.96}
                  accessibilityLabel="Programme fidélité">
                  <Feather name="award" size={12} color={colors.gold} />
                  <Text style={[styles.memberText, { color: chrome.ink }]}>
                    {loyalty.profileSubtitle}
                  </Text>
                </PressScale>
              </View>
            </View>
          </View>

          <Animated.View
            style={[
              styles.sheet,
              { height: sheetMax },
              sheetAnimStyle,
              { paddingBottom: Math.max(8, insets.bottom) },
            ]}>
            <GestureDetector gesture={sheetHandleGesture}>
              <Animated.View
                style={styles.sheetHandle}
                accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
                accessibilityLabel="Agrandir ou réduire la feuille"
                accessibilityHint="Glisser pour redimensionner, toucher pour basculer">
                <View style={styles.sheetHandleBar} />
              </Animated.View>
            </GestureDetector>

            <GestureDetector gesture={sheetScrollGesture}>
            <ScrollView
              ref={sheetScrollRef}
              style={styles.sheetScroll}
              contentContainerStyle={[styles.sheetScrollContent, { paddingBottom: tabBarClearance }]}
              showsVerticalScrollIndicator={false}
              bounces
              overScrollMode="auto"
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={onSheetScroll}
              onScrollBeginDrag={onSheetScrollBeginDrag}
              onScrollEndDrag={onSheetScrollEndDrag}>
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
                  <Text style={styles.statValue}>{loyalty.points}</Text>
                  <Text style={styles.statLabel}>Points</Text>
                </Pressable>
              </View>

              <Pressable style={styles.loyalty} onPress={() => router.push('/account/loyalty')}>
                <View style={styles.loyaltyTop}>
                  <View style={styles.loyaltyIcon}>
                    <Feather name="gift" size={20} color={colors.gold} />
                  </View>
                  <View style={styles.loyaltyText}>
                    <Text style={styles.loyaltyTitle}>Programme fidélité · {loyalty.tier.name}</Text>
                    <Text style={styles.loyaltySub}>
                      {loyalty.points} / {loyalty.nextRewardAt} pts
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.placeholder} />
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${loyaltyProgress * 100}%` }]} />
                </View>
                <Text style={styles.loyaltyHint}>
                  {loyalty.pointsLeft > 0
                    ? `${loyalty.pointsLeft} pts avant votre prochaine récompense`
                    : 'Récompense débloquée — consultez votre carte'}
                </Text>
              </Pressable>

              <View style={styles.quickRow}>
                <Pressable style={styles.quickAction} onPress={() => router.push('/tracking' as Href)}>
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

              <Pressable style={styles.logout} onPress={confirmSignOut} accessibilityRole="button">
                <Feather name="log-out" size={18} color={colors.terracotta} />
                <Text style={styles.logoutText}>Se déconnecter</Text>
              </Pressable>

              <Text style={styles.footer}>
                {session?.email ? `${session.email} · ` : ''}Marché Doré · v1.0.0 · Cotonou, Bénin
              </Text>
            </ScrollView>
            </GestureDetector>
          </Animated.View>
        </GestureHandlerRootView>
      </Page>
    </Screen>
  );
}

export default memo(ProfileScreen);

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
    heroBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    heroTitleBlock: {
      paddingHorizontal: 20,
      gap: 4,
      zIndex: 1,
    },
    heroTitle: {
      ...displayFont('800'),
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.4,
    },
    heroIdentityWrap: {
      position: 'absolute',
      left: 20,
      right: 20,
      zIndex: 1,
    },
    heroIdentity: { alignItems: 'center', gap: 10 },
    heroIdentityHit: { alignItems: 'center', gap: 10 },
    avatarRing: {
      padding: 4,
      borderRadius: 999,
      shadowColor: '#1c1613',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
    },
    avatarHero: { width: 80, height: 80, borderRadius: 40 },
    heroName: { fontSize: 22, ...displayFont('800') },
    heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heroMeta: { fontSize: 14, flexShrink: 1 },
    memberBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 6,
      marginTop: 2,
    },
    memberText: { fontSize: 12, fontWeight: '600' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 8,
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
    sheetHandle: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      zIndex: 8,
      ...(Platform.OS === 'web'
        ? ({ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'grab' } as object)
        : {}),
    },
    sheetHandleBar: {
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
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
      gap: 16,
    },
    activeOrder: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.white,
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
    activeOrderHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    activeOrderTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.successSoft,
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
    sectionTitle: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    sectionCard: {
      backgroundColor: colors.white,
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
}
