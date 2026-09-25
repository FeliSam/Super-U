import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { DEV_OPEN_HOME, logDev, logDevError } from '@/lib/devBoot';
import { peekShopHasSession } from '@/lib/sessionPeek';
import { router, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

export function AuthGate({ children }: { children: React.ReactNode }) {
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

    try {
      if (DEV_OPEN_HOME) {
        if (inAuthGroup) {
          logDev('AuthGate → /(tabs) (DEV_OPEN_HOME)');
          router.replace('/(tabs)');
        }
        return;
      }

      if (!isAuthenticated) {
        // Session encore en cache / hydratation : ne pas forcer login.
        if (peekShopHasSession()) return;
        if (!inAuthGroup || onOnboarding) {
          router.replace('/(auth)');
        }
        return;
      }

      if (needsOnboarding && !onOnboarding) {
        router.replace('/(auth)/onboarding');
        return;
      }

      if (onOnboarding) return;

      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    } catch (e) {
      logDevError('AuthGate.redirect', e, { root, inAuthGroup, isAuthenticated });
    }
  }, [ready, isAuthenticated, needsOnboarding, inAuthGroup, onOnboarding, root]);

  return <>{children}</>;
}
