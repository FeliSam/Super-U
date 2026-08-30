import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useColors } from '@/context/ThemeContext';
import { router, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { ready, isAuthenticated, needsOnboarding, session } = useAuth();
  const { clear: clearCart } = useCart();
  const segments = useSegments();
  const lastAccount = useRef<string | null>(null);

  const root = segments[0];
  const inAuthGroup = root === '(auth)';
  const onOnboarding = inAuthGroup && segments[1] === 'onboarding';

  useEffect(() => {
    if (!ready) return;
    if (session) {
      lastAccount.current = session.accountId;
      return;
    }
    if (lastAccount.current) {
      lastAccount.current = null;
      clearCart();
    }
  }, [ready, session, clearCart]);

  useEffect(() => {
    if (!ready) return;

    if (!isAuthenticated) {
      if (!inAuthGroup || onOnboarding) {
        router.replace('/(auth)');
      }
      return;
    }

    if (needsOnboarding && !onOnboarding) {
      router.replace('/(auth)/onboarding');
      return;
    }

    // L’onboarding envoie vers adresse puis Super U. Ne pas renvoyer aux tabs avant.
    if (onOnboarding) return;

    if (inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [ready, isAuthenticated, needsOnboarding, inAuthGroup, onOnboarding]);

  return (
    <>
      {children}
      {!ready ? (
        <View style={[styles.fill, { backgroundColor: colors.bg }]}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
});
