import { colors } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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

const keepTabMounted = {
  lazy: false,
  freezeOnBlur: true,
} as const;

export default function TabLayout() {
  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        lazy: false,
        freezeOnBlur: true,
        animation: 'none',
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.tabSlot,
        tabBarIconStyle: styles.tabIcon,
        tabBarButton: (props) => (
          <Pressable
            {...props}
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
        name="search"
        options={{
          title: 'Rechercher',
          ...keepTabMounted,
          tabBarIcon: ({ focused }) => <TabBarItem icon="search" label="Rechercher" focused={focused} />,
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
        name="profile"
        options={{
          title: 'Profil',
          ...keepTabMounted,
          tabBarIcon: ({ focused }) => <TabBarItem icon="user" label="Profil" focused={focused} />,
        }}
      />
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
    bottom: 12,
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
  },
  tabLabelActive: {
    color: colors.terracotta,
    fontWeight: '800',
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
