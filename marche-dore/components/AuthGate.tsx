import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useProfile } from '@/context/ProfileContext';
import { useColors } from '@/context/ThemeContext';
import { userProfile as seedProfile } from '@/data/account';
import { Href, router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Keeps navigation in sync with local auth session.
 * - logged out → (auth)
 * - logged in, onboarding pending → onboarding
 * - logged in, ready → main app
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { ready, isAuthenticated, needsOnboarding, session, toProfile } = useAuth();
  const { setProfile } = useProfile();
  const { clear: clearCart } = useCart();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const lastAccount = useRef<string | null>(null);

  const root = segments[0];
  const inAuthGroup = root === '(auth)';
  const onOnboarding = inAuthGroup && segments[1] === 'onboarding';

  const routeOk =
    ready &&
    Boolean(navState?.key) &&
    ((!isAuthenticated && inAuthGroup && !onOnboarding) ||
      (isAuthenticated && needsOnboarding && onOnboarding) ||
      (isAuthenticated && !needsOnboarding && !inAuthGroup));

  useEffect(() => {
    if (!ready) return;
    if (session) {
      const profile = toProfile();
      if (profile) setProfile(profile);
      lastAccount.current = session.accountId;
      return;
    }
    if (lastAccount.current) {
      lastAccount.current = null;
      setProfile(seedProfile);
      clearCart();
    }
  }, [ready, session, toProfile, setProfile, clearCart]);

  useEffect(() => {
    if (!ready || !navState?.key) return;

    if (!isAuthenticated) {
      if (!inAuthGroup || onOnboarding) {
        router.replace('/(auth)/index' as Href);
      }
      return;
    }

    if (needsOnboarding) {
      if (!onOnboarding) {
        router.replace('/(auth)/onboarding' as Href);
      }
      return;
    }

    if (inAuthGroup) {
      router.replace('/(tabs)' as Href);
    }
  }, [ready, navState?.key, isAuthenticated, needsOnboarding, inAuthGroup, onOnboarding]);

  if (!ready) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {children}
      {!routeOk ? (
        <View style={[styles.overlay, { backgroundColor: colors.bg }]} pointerEvents="auto">
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
});
