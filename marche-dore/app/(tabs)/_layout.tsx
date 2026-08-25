import { colors, fontFamilies } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { unreadMessagesCount } from '@/data/messages';
import { Feather } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Prefetch main tabs only — chat thread loads on demand. */
import './index';
import './explore';
import './cart';
import './profile';
import './chat/index';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

function TabBarItem({
  icon,
  label,
  focused,
  badge,
}: {
  icon: FeatherIcon;
  label: string;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={[styles.tabItemInner, focused && styles.tabItemInnerActive]}>
      <View style={styles.iconWrap}>
        <Feather
          name={icon}
          size={focused ? 21 : 20}
          color={focused ? colors.terracotta : colors.placeholder}
        />
        {badge && badge > 0 ? (
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function CartTabBarItem({ focused }: { focused: boolean }) {
  const { count } = useCart();
  return <TabBarItem icon="shopping-bag" label="Panier" focused={focused} badge={count} />;
}

function ChatTabBarItem({ focused }: { focused: boolean }) {
  const unread = unreadMessagesCount();
  return <TabBarItem icon="message-circle" label="Chat" focused={focused} badge={unread} />;
}

const keepTabMounted = {
  lazy: false,
  freezeOnBlur: Platform.OS !== 'web',
} as const;

function isChatConversation(pathname: string) {
  return pathname.startsWith('/chat/') && pathname !== '/chat/';
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const hideTabBar = isChatConversation(pathname);
  const bottomOffset = Math.max(12, insets.bottom + 4);

  return (
    <Tabs
      detachInactiveScreens={false}
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        lazy: false,
        freezeOnBlur: Platform.OS !== 'web',
        animation: 'none',
        tabBarHideOnKeyboard: true,
        tabBarStyle: hideTabBar
          ? { display: 'none', height: 0, overflow: 'hidden' }
          : [styles.bar, { bottom: bottomOffset }],
        tabBarItemStyle: styles.tabSlot,
        tabBarIconStyle: styles.tabIcon,
        tabBarButton: (props) => (
          <Pressable
            {...props}
            href={undefined}
            style={({ pressed }) => [props.style, styles.tabButton, pressed && styles.tabButtonPressed]}
          />
        ),
        sceneContainerStyle: styles.scene,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          ...keepTabMounted,
          tabBarIcon: ({ focused }) => <TabBarItem icon="home" label="Accueil" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorer',
          ...keepTabMounted,
          tabBarIcon: ({ focused }) => <TabBarItem icon="grid" label="Explorer" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Panier',
          ...keepTabMounted,
          tabBarIcon: ({ focused }) => <CartTabBarItem focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          ...keepTabMounted,
          tabBarIcon: ({ focused }) => <ChatTabBarItem focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          ...keepTabMounted,
          tabBarIcon: ({ focused }) => <TabBarItem icon="user" label="Profil" focused={focused} />,
        }}
      />
      {/* Search lives on the root stack (`/search`), not in the tab bar. */}
      <Tabs.Screen name="search" options={{ href: null, title: 'Rechercher' }} />
    </Tabs>
  );
}

const BAR_HEIGHT = 68;

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bar: {
    position: 'absolute',
    height: BAR_HEIGHT,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 8,
    borderRadius: 34,
    borderTopWidth: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    ...(Platform.OS === 'web'
      ? {
          left: 0,
          right: 0,
          marginLeft: 'auto',
          marginRight: 'auto',
          width: 'min(398px, calc(100% - 28px))',
          borderWidth: 1,
          borderColor: colors.border,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 10px 32px rgba(28, 22, 19, 0.16)',
        }
      : {
          left: 14,
          right: 14,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 20,
          elevation: 18,
        }),
  },
  tabSlot: {
    flex: 1,
    height: BAR_HEIGHT - 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  tabButtonPressed: { opacity: 0.82 },
  tabIcon: {
    width: '100%',
    height: '100%',
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
  },
  tabItemInnerActive: {
    backgroundColor: colors.cream,
  },
  iconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    color: colors.placeholder,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
    fontFamily: fontFamilies.bodySemi,
  },
  tabLabelActive: {
    color: colors.terracotta,
    fontWeight: '800',
    fontFamily: fontFamilies.bodyBold,
  },
  badgePill: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.terracotta,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
});
