import { bodyFont, colors, radius, shadow, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { countCoursesTabBadge, countNowTabBadge, tabBadgeLabel } from '@/lib/tabBadges';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ICONS: Record<string, ComponentProps<typeof Feather>['name']> = {
  index: 'home',
  missions: 'package',
  earnings: 'trending-up',
  history: 'clock',
  profile: 'user',
};

const LABELS: Record<string, string> = {
  index: 'Accueil',
  missions: 'Courses',
  earnings: 'Perf',
  history: 'Historique',
  profile: 'Profil',
};

export function CourseTabBar({
  state,
  descriptors,
  navigation,
}: {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  // Expo tab bar injects a wider navigation helper than we use here.
  navigation: { emit: (event: Record<string, unknown>) => { defaultPrevented: boolean }; navigate: (name: string, params?: object) => void };
}) {
  const insets = useSafeAreaInsets();
  const { staff } = useStaffAuth();
  const { jobs, deliveries } = useBoard();
  const nowBadge = useMemo(() => tabBadgeLabel(countNowTabBadge(jobs, deliveries, staff ?? {})), [jobs, deliveries, staff]);
  const coursesBadge = useMemo(
    () => tabBadgeLabel(countCoursesTabBadge(jobs, deliveries, staff ?? {})),
    [jobs, deliveries, staff],
  );

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = LABELS[route.name] ?? options.title ?? route.name;
          const icon = ICONS[route.name] ?? 'circle';
          const badge =
            route.name === 'index' ? nowBadge : route.name === 'missions' ? coursesBadge : null;
          const badgeTone = route.name === 'index' ? 'teal' : 'coral';
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={badge ? `${label}, ${badge} en cours` : label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              style={styles.item}>
              <View style={[styles.iconWrap, focused && styles.iconWrapOn]}>
                <Feather name={icon} size={20} color={focused ? colors.teal : colors.placeholder} />
                {badge ? (
                  <View style={[styles.badge, badgeTone === 'teal' && styles.badgeTeal]}>
                    <Text style={styles.badgeTxt}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, { color: focused ? colors.teal : colors.placeholder }]}>{label}</Text>
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
    left: TAB_BAR_MARGIN,
    right: TAB_BAR_MARGIN,
    zIndex: 30,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: colors.white,
    borderRadius: radius.tabBar,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    ...shadow.tabBar,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: { backgroundColor: colors.tealSoft },
  label: { ...bodyFont('600'), fontSize: 10 },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTeal: { backgroundColor: colors.teal },
  badgeTxt: { ...bodyFont('700'), fontSize: 9, color: '#fff' },
});

export { CourseTabBar as TabItem };
