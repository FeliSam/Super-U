import { fontFamilies, TAB_BAR_HEIGHT, tabBarBottomOffset, type AppColors } from '@/constants/theme';
import { hitBoxNone, hitNone } from '@/lib/hit';
import { useCart } from '@/context/CartContext';
import { useChat } from '@/context/ChatContext';
import { useColors } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

const TAB_META: Record<string, { icon: FeatherIcon; label: string }> = {
  index: { icon: 'home', label: 'Accueil' },
  explore: { icon: 'grid', label: 'Explorer' },
  cart: { icon: 'shopping-bag', label: 'Panier' },
  chat: { icon: 'message-circle', label: 'Chat' },
  profile: { icon: 'user', label: 'Profil' },
};

const SPRING = { damping: 18, stiffness: 200, mass: 0.55 };

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
    <View style={styles.tabItemInner}>
      <View style={styles.iconWrap}>
        <Feather
          name={icon}
          size={22}
          color={focused ? theme.terracotta : theme.text}
        />
        {showBadge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.terracotta, borderColor: theme.white }]}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[
          styles.tabLabel,
          { color: theme.text, fontWeight: '800' },
          focused && { color: theme.terracotta },
        ]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Barre d’onglets flottante — pastille qui coulisse, sans import react-navigation/native. */
export function MarcheTabBar({ state, descriptors, navigation, hidden }: BottomTabBarProps & { hidden?: boolean }) {
  const insets = useSafeAreaInsets();
  const theme = useColors();
  const { count: cartCount } = useCart();
  const { unreadTotal } = useChat();
  const bottomOffset = tabBarBottomOffset(insets.bottom);

  const visible = useMemo(
    () =>
      state.routes.filter((route) => {
        const options = descriptors[route.key]?.options;
        return options?.href !== null && TAB_META[route.name];
      }),
    [descriptors, state.routes],
  );

  const focusedVisibleIndex = Math.max(
    0,
    visible.findIndex((route) => route.key === state.routes[state.index]?.key),
  );

  const layouts = useRef<{ x: number; width: number }[]>([]);
  const ready = useRef(false);
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);

  const movePill = (index: number, animate: boolean) => {
    const box = layouts.current[index];
    if (!box || box.width <= 0) return;
    if (!animate) {
      pillX.value = box.x;
      pillW.value = box.width;
      return;
    }
    pillX.value = withSpring(box.x, SPRING);
    pillW.value = withSpring(box.width, SPRING);
  };

  useEffect(() => {
    movePill(focusedVisibleIndex, ready.current);
  }, [focusedVisibleIndex]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
  }));

  if (hidden) return null;

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }, hitBoxNone]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.white,
            borderColor: theme.border,
          },
        ]}>
        <Animated.View
          style={[styles.pill, { backgroundColor: theme.cream }, pillStyle, hitNone]}
        />
        {visible.map((route, visibleIndex) => {
          const meta = TAB_META[route.name];
          const focused = visibleIndex === focusedVisibleIndex;
          const badge =
            route.name === 'cart' ? cartCount : route.name === 'chat' ? unreadTotal : undefined;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={meta.label}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                layouts.current[visibleIndex] = { x, width };
                if (visibleIndex === focusedVisibleIndex) {
                  movePill(visibleIndex, ready.current);
                  ready.current = true;
                }
              }}
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
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          marginLeft: 'auto',
          marginRight: 'auto',
          width: 'min(398px, calc(100% - 28px))',
          borderWidth: 1,
          boxShadow: '0 10px 28px rgba(28, 22, 19, 0.12)',
        }
      : {
          marginHorizontal: 14,
          borderWidth: 1,
          shadowColor: '#1c1613',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
          elevation: 14,
        }),
  },
  pill: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    borderRadius: 999,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 1,
  },
  tabButtonPressed: { opacity: 0.82 },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  iconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.15,
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
