import { PhoneShell } from '@/components/PhoneShell';
import { CallOverlay } from '@/components/CallOverlay';
import { CourseSplash } from '@/components/CourseSplash';
import { KeyboardDismissBar } from '@/components/KeyboardDismissBar';
import { StaffLiveActivityHost } from '@/components/StaffLiveActivityHost';
import { StaffNotificationToasts } from '@/components/StaffNotificationToasts';
import { ToastHost } from '@/components/ToastHost';
import { BoardProvider } from '@/context/BoardContext';
import { CallProvider } from '@/context/CallContext';
import { ChatProvider } from '@/context/ChatContext';
import { LocationProvider } from '@/context/LocationContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { PushNotificationsProvider } from '@/context/PushNotificationsContext';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import { StaffPrefsProvider } from '@/context/StaffPrefsContext';
import { StaffAuthProvider, useStaffAuth } from '@/context/StaffAuthContext';
import { colors } from '@/constants/theme';
import { loadBrandFonts } from '@/lib/fonts';
import { loadApiBaseOverride } from '@/lib/api/http';
import { hydrateStaffSessionPeek, peekStaffHasSession } from '@/lib/sessionPeek';
import { clearPendingToasts } from '@/lib/toastBus';
import { Feather } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export { ErrorBoundary } from '@/components/AppErrorBoundary';

void loadApiBaseOverride();
void hydrateStaffSessionPeek();

export const unstable_settings = { initialRouteName: peekStaffHasSession() ? '(tabs)' : '(auth)' };

function Gate({ splash }: { splash: boolean }) {
  const { ready, staff } = useStaffAuth();
  const onboarding = useOnboarding();
  const segments = useSegments();
  const inAuth = segments[0] === '(auth)';
  const authPage = String(segments[1] ?? '');
  const peekSession = peekStaffHasSession();

  useEffect(() => {
    // Pendant le splash : préparer l’accueil si session connue (évite flash login).
    if (splash) {
      if (ready && staff && onboarding.ready && onboarding.welcomeDone && onboarding.permsDone && !staff.mustResetPassword) {
        if (inAuth) router.replace('/(tabs)');
      }
      return;
    }

    if (!ready) {
      // Session en cache / hydratation : ne pas renvoyer vers login.
      if (peekSession && inAuth) return;
      return;
    }

    if (!staff) {
      if (peekSession) return;
      clearPendingToasts();
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    if (staff.mustResetPassword) {
      if (authPage !== 'reset-password') router.replace('/(auth)/reset-password');
      return;
    }
    if (!onboarding.ready) return;
    if (!onboarding.welcomeDone) {
      if (authPage !== 'welcome') router.replace('/(auth)/welcome');
      return;
    }
    if (!onboarding.permsDone) {
      if (authPage !== 'permissions') router.replace('/(auth)/permissions');
      return;
    }
    if (inAuth) router.replace('/(tabs)');
  }, [
    ready,
    staff,
    segments,
    splash,
    inAuth,
    authPage,
    peekSession,
    onboarding.ready,
    onboarding.welcomeDone,
    onboarding.permsDone,
  ]);

  useEffect(() => {
    if (inAuth) clearPendingToasts();
  }, [inAuth]);

  const showChrome = !splash && !inAuth;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'none',
          freezeOnBlur: false,
        }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="run/[id]" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="account" />
        <Stack.Screen name="missing" />
        <Stack.Screen name="wait/[id]" />
        <Stack.Screen name="confirm/[id]" />
        <Stack.Screen name="rate/[id]" />
        <Stack.Screen name="reviews" />
        <Stack.Screen name="incident/[id]" />
      </Stack>
      {showChrome ? (
        <>
          <CallOverlay />
          <StaffLiveActivityHost />
          <StaffNotificationToasts />
          <ToastHost />
        </>
      ) : null}
      {!splash && (!ready || (staff && !onboarding.ready)) && (peekSession || staff) ? (
        <View style={styles.boot}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      ) : null}
    </>
  );
}

function CourseSplashHost({ onDone }: { onDone: () => void }) {
  const { ready, staff } = useStaffAuth();
  const onboarding = useOnboarding();
  const allowExit = ready && (!staff || onboarding.ready);
  return <CourseSplash onFinish={onDone} allowExit={allowExit} />;
}

export default function Root() {
  const [splash, setSplash] = useState(true);
  const onSplashDone = useCallback(() => setSplash(false), []);

  useEffect(() => {
    void (async () => {
      try {
        await Font.loadAsync(Feather.font);
      } catch {
        /* Expo Go / system icons */
      }
      await loadBrandFonts();
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <PhoneShell>
        <StaffAuthProvider>
          <OnboardingProvider>
            <NotificationsProvider>
              <PushNotificationsProvider>
                <StaffPrefsProvider>
                  <BoardProvider>
                    <LocationProvider>
                      <ChatProvider>
                        <CallProvider>
                          <StatusBar style="dark" />
                          <Gate splash={splash} />
                          {splash ? <CourseSplashHost onDone={onSplashDone} /> : null}
                          <KeyboardDismissBar />
                        </CallProvider>
                      </ChatProvider>
                    </LocationProvider>
                  </BoardProvider>
                </StaffPrefsProvider>
              </PushNotificationsProvider>
            </NotificationsProvider>
          </OnboardingProvider>
        </StaffAuthProvider>
      </PhoneShell>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  boot: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
});
