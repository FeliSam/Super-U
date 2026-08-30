import { PhoneShell } from '@/components/PhoneShell';
import { CallOverlay } from '@/components/CallOverlay';
import { BoardProvider } from '@/context/BoardContext';
import { CallProvider } from '@/context/CallContext';
import { ChatProvider } from '@/context/ChatContext';
import { LocationProvider } from '@/context/LocationContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { StaffAuthProvider, useStaffAuth } from '@/context/StaffAuthContext';
import { colors } from '@/constants/theme';
import { loadBrandFonts } from '@/lib/fonts';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, LogBox, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

LogBox.ignoreLogs(['Map cannot fit within canvas']);

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(auth)' };

function Gate() {
  const { ready, staff } = useStaffAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!staff && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }
    if (staff && inAuth) {
      router.replace('/(tabs)');
    }
  }, [ready, staff, segments]);

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
      </Stack>
      <CallOverlay />
      {!ready ? (
        <View style={styles.boot}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      ) : null}
    </>
  );
}

export default function Root() {
  useEffect(() => {
    void loadBrandFonts();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <PhoneShell>
        <StaffAuthProvider>
          <NotificationsProvider>
          <BoardProvider>
            <LocationProvider>
              <ChatProvider>
                <CallProvider>
                  <StatusBar style="dark" />
                  <Gate />
                </CallProvider>
              </ChatProvider>
            </LocationProvider>
          </BoardProvider>
          </NotificationsProvider>
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
