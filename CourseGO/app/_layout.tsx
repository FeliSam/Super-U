import { PhoneShell } from '@/components/PhoneShell';
import { CallOverlay } from '@/components/CallOverlay';
import { CourseSplash } from '@/components/CourseSplash';
import { StaffNotificationToasts } from '@/components/StaffNotificationToasts';
import { ToastHost } from '@/components/ToastHost';
import { BoardProvider } from '@/context/BoardContext';
import { CallProvider } from '@/context/CallContext';
import { ChatProvider } from '@/context/ChatContext';
import { LocationProvider } from '@/context/LocationContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import { StaffPrefsProvider } from '@/context/StaffPrefsContext';
import { StaffAuthProvider, useStaffAuth } from '@/context/StaffAuthContext';
import { colors } from '@/constants/theme';
import { loadBrandFonts } from '@/lib/fonts';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, LogBox, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

LogBox.ignoreLogs(['Map cannot fit within canvas']);

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(auth)' };

function Gate() {
  const { ready, staff } = useStaffAuth();
  const onboarding = useOnboarding();
  const segments = useSegments();

  useEffect(() => {
    if (!ready || !onboarding.ready) return;
    const inAuth = segments[0] === '(auth)';
    const authPage = String(segments[1] ?? '');
    if (!staff && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }
    if (!staff) return;
    if (!onboarding.welcomeDone) {
      if (authPage !== 'welcome') router.replace('/(auth)/welcome');
      return;
    }
    if (!onboarding.permsDone) {
      if (authPage !== 'permissions') router.replace('/(auth)/permissions');
      return;
    }
    if (inAuth) router.replace('/(tabs)');
  }, [ready, staff, segments, onboarding.ready, onboarding.welcomeDone, onboarding.permsDone]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: Platform.OS === 'web' ? 'none' : 'default',
          freezeOnBlur: false,
          detachInactiveScreens: false,
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
        <Stack.Screen name="incident/[id]" />
      </Stack>
      <CallOverlay />
      <StaffNotificationToasts />
      <ToastHost />
      {!ready || !onboarding.ready ? (
        <View style={styles.boot}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      ) : null}
    </>
  );
}

export default function Root() {
  const [splash, setSplash] = useState(true);
  useEffect(() => {
    void loadBrandFonts();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <PhoneShell>
        <StaffAuthProvider>
          <OnboardingProvider>
            <NotificationsProvider>
              <StaffPrefsProvider>
                <BoardProvider>
                  <LocationProvider>
                    <ChatProvider>
                      <CallProvider>
                        <StatusBar style="dark" />
                        <Gate />
                        {splash ? <CourseSplash onFinish={() => setSplash(false)} /> : null}
                      </CallProvider>
                    </ChatProvider>
                  </LocationProvider>
                </BoardProvider>
              </StaffPrefsProvider>
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
