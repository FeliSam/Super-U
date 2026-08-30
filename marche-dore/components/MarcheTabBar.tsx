import { fontFamilies, TAB_BAR_HEIGHT, tabBarBottomOffset, type AppColors } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { useChat } from '@/context/ChatContext';
import { useColors, useTheme } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

const TAB_META: Record<string, { icon: FeatherIcon; label: string }> = {
  index: { icon: 'home', label: 'Accueil' },
  explore: { icon: 'grid', label: 'Explorer' },
  cart: { icon: 'shopping-bag', label: 'Panier' },
  chat: { icon: 'message-circle', label: 'Chat' },
  profile: { icon: 'user', label: 'Profil' },
};

function TabBarItem({
  icon,
  label,
  focused,
  badge,
  theme,
}: {
  icon: FeatherIcon;
  label: string;
  focused: boolean;
  badge?: number;
  theme: AppColors;
}) {
  const showBadge = typeof badge === 'number' && badge > 0;
  return (
    <View style={[styles.tabItemInner, focused && { backgroundColor: theme.cream }]}>
      <View style={styles.iconWrap}>
        <Feather
          name={icon}
          size={focused ? 21 : 20}
          color={focused ? theme.terracotta : theme.placeholder}
        />
        {showBadge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.terracotta, borderColor: theme.white }]}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.tabLabel, { color: theme.placeholder }, focused && { color: theme.terracotta, fontWeight: '800' }]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function MarcheTabBar({ state, descriptors, navigation, hidden }: BottomTabBarProps & { hidden?: boolean }) {
  const insets = useSafeAreaInsets();
  const theme = useColors();
  const { scheme } = useTheme();
  const { count: cartCount } = useCart();
  const { unreadTotal } = useChat();
  const bottomOffset = tabBarBottomOffset(insets.bottom);
  const barBg = scheme === 'dark' ? 'rgba(30, 26, 23, 0.94)' : 'rgba(255, 255, 255, 0.94)';

  if (hidden) return null;

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: barBg, borderColor: theme.border }]}>
        {state.routes.map((route) => {
          const options = descriptors[route.key]?.options;
          if (options?.href === null) return null;

          const meta = TAB_META[route.name];
          if (!meta) return null;

          const focused = state.routes[state.index]?.key === route.key;
          const badge =
            route.name === 'cart' ? cartCount : route.name === 'chat' ? unreadTotal : undefined;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={meta.label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}>
              <TabBarItem icon={meta.icon} label={meta.label} focused={focused} badge={badge} theme={theme} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 8,
    borderRadius: 34,
    borderTopWidth: 0,
    ...(Platform.OS === 'web'
      ? {
          marginLeft: 'auto',
          marginRight: 'auto',
          width: 'min(398px, calc(100% - 28px))',
          borderWidth: 1,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 10px 32px rgba(28, 22, 19, 0.16)',
        }
      : {
          marginHorizontal: 14,
          borderWidth: 1,
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 20,
          elevation: 18,
        }),
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  tabButtonPressed: { opacity: 0.82 },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
  },
  iconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
    fontFamily: fontFamilies.bodySemi,
  },
  badgePill: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
});
