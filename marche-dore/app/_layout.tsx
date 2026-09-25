import '@/lib/navigationStability';
import { installLaunchGuards } from '@/lib/launchGuards';
installLaunchGuards();

import { BootFatalHost } from '@/components/BootFatalHost';
import { AccountPrefsSync } from '@/components/AccountPrefsSync';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { OrderNotificationBridge } from '@/components/OrderNotificationBridge';
import { OrderLiveActivityHost } from '@/components/OrderLiveActivityHost';
import { prepareApp, warmRemainingAssets } from '@/lib/bootstrap';
import { lockWebInputZoom } from '@/lib/noZoomInput';
import { hideSystemBars, watchHiddenSystemBars } from '@/lib/systemBars';
import { CallOverlay } from '@/components/CallOverlay';
import { ToastHost } from '@/components/ToastHost';
import { KeyboardDismissBar } from '@/components/KeyboardDismissBar';
import { AuthGate } from '@/components/AuthGate';
import { AddressesProvider } from '@/context/AddressesContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CallProvider } from '@/context/CallContext';
import { CartProvider } from '@/context/CartContext';
import { CatalogProvider } from '@/context/CatalogContext';
import { ChatProvider } from '@/context/ChatContext';
import { CheckoutPaymentProvider } from '@/context/CheckoutPaymentContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { PushNotificationsProvider } from '@/context/PushNotificationsContext';
import { OrdersProvider } from '@/context/OrdersContext';
import { PaymentsProvider } from '@/context/PaymentsContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { ReviewsProvider } from '@/context/ReviewsContext';
import { StoresProvider } from '@/context/StoresContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { UiStateProvider } from '@/context/UiStateContext';
import { AppTourProvider } from '@/context/AppTourContext';
import { AppTourHost } from '@/components/AppTourHost';
import { lightColors, MOBILE_FRAME_MAX } from '@/constants/theme';
import { LocalDbBoot } from '@/lib/db/boot';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { hydrateShopSessionPeek, peekShopHasSession } from '@/lib/sessionPeek';
import { DEV_OPEN_HOME } from '@/lib/devBoot';
import { loadApiBaseOverride } from '@/lib/api/http';

export { ErrorBoundary } from '@/components/AppErrorBoundary';

void loadApiBaseOverride();
void hydrateShopSessionPeek();

export const unstable_settings = {
  initialRouteName: DEV_OPEN_HOME || peekShopHasSession() ? '(tabs)' : '(auth)',
};

/** Une seule fois par lancement JS — évite de rejouer le splash sur login/signup / HMR. */
const splashBag = globalThis as typeof globalThis & { __marcheDoreSplashDone?: boolean };

function SplashHost() {
  const { ready } = useAuth();
  const [visible, setVisible] = useState(() => !splashBag.__marcheDoreSplashDone);

  const onFinish = useCallback(() => {
    if (splashBag.__marcheDoreSplashDone) return;
    splashBag.__marcheDoreSplashDone = true;
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <Modal
      visible
      animationType="none"
      transparent={false}
      statusBarTranslucent
      presentationStyle="fullScreen"
      hardwareAccelerated
      onRequestClose={() => undefined}>
      <AnimatedSplash onFinish={onFinish} allowExit={ready || DEV_OPEN_HOME} />
    </Modal>
  );
}

function ThemedAppShell({ children }: { children: React.ReactNode }) {
  const { colors, scheme } = useTheme();

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.gold,
        background: colors.bg,
        card: colors.bg,
        text: colors.text,
        border: colors.border,
        notification: colors.terracotta } };
  }, [colors, scheme]);

  const stackScreenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: colors.bg },
      animation: 'fade' as const,
      animationDuration: 120,
      freezeOnBlur: false,
      detachPreviousScreen: false,
      // Eviter statusBarHidden via react-native-screens (RNSScreenWindowTraits)
      // tant que le Info.plist natif n'a pas UIViewControllerBasedStatusBarAppearance=YES.
    }),
    [colors.bg],
  );

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <AuthProvider>
        <StoresProvider>
          <CatalogProvider>
            <CartProvider>
              <ProfileProvider>
                <AddressesProvider>
                <OrdersProvider>
                  <PaymentsProvider>
                    <CheckoutPaymentProvider>
                      <FavoritesProvider>
                        <NotificationsProvider>
                          <ChatProvider>
                            <CallProvider>
                              <UiStateProvider>
                                <PushNotificationsProvider>
                                <AppTourProvider>
                                <ReviewsProvider>
                                  <AccountPrefsSync />
                                  <OrderNotificationBridge />
                                  <OrderLiveActivityHost />
                                  <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
                                  <AuthGate>
                                    <Stack
                                      detachInactiveScreens={false}
                                      screenOptions={stackScreenOptions}>
                                      {children}
                                    </Stack>
                                  </AuthGate>
                                  <AppTourHost />
                                  <CallOverlay />
                                  <ToastHost />
                                  <KeyboardDismissBar />
                                  <BootFatalHost />
                                  <SplashHost />
                                </ReviewsProvider>
                                </AppTourProvider>
                                </PushNotificationsProvider>
                              </UiStateProvider>
                            </CallProvider>
                          </ChatProvider>
                        </NotificationsProvider>
                      </FavoritesProvider>
                    </CheckoutPaymentProvider>
                  </PaymentsProvider>
                </OrdersProvider>
                </AddressesProvider>
              </ProfileProvider>
            </CartProvider>
          </CatalogProvider>
        </StoresProvider>
      </AuthProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    return watchHiddenSystemBars();
  }, []);

  useEffect(() => {
    void prepareApp().finally(() => {
      warmRemainingAssets();
      hideSystemBars();
    });
  }, []);

  useEffect(() => {
    return lockWebInputZoom();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LocalDbBoot>
          <View style={{ flex: 1, alignItems: 'center', backgroundColor: lightColors.bg }}>
            <View
              style={{
                flex: 1,
                width: '100%',
                maxWidth: MOBILE_FRAME_MAX,
                overflow: 'hidden',
                minWidth: 0,
                position: 'relative',
              }}>
            <ThemedAppShell>
              <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade', animationDuration: 120 }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade', animationDuration: 120 }} />
              <Stack.Screen
                name="search"
                options={{
                  animation: 'fade',
                  animationDuration: 120,
                  presentation: 'card' }}
              />
              <Stack.Screen name="promotions" options={{ animation: 'fade', animationDuration: 120 }} />
              <Stack.Screen name="help" />
              <Stack.Screen name="contact" />
              <Stack.Screen name="legal" />
              <Stack.Screen name="about" />
              <Stack.Screen
                name="product/[id]"
                options={{ animation: 'fade', animationDuration: 120 }}
              />
              <Stack.Screen name="product/reviews/[id]" />
              <Stack.Screen
                name="category/[id]"
                options={{ animation: 'fade', animationDuration: 120 }}
              />
              <Stack.Screen name="checkout" />
              <Stack.Screen name="order-success" options={{ gestureEnabled: false }} />
              <Stack.Screen name="payment-setup/[id]" />
              <Stack.Screen name="tracking" options={{ animation: 'fade', animationDuration: 120 }} />
              <Stack.Screen name="orders" options={{ animation: 'fade', animationDuration: 120 }} />
              <Stack.Screen name="order/[id]" options={{ animation: 'fade', animationDuration: 120 }} />
              <Stack.Screen name="notifications/index" />
              <Stack.Screen name="notifications/[id]" />
              <Stack.Screen name="account/personal-info" />
              <Stack.Screen name="account/addresses" />
              <Stack.Screen name="account/payment-methods" />
              <Stack.Screen name="account/loyalty" />
              <Stack.Screen name="account/settings" />
              <Stack.Screen name="account/favorites" options={{ animation: 'fade', animationDuration: 120 }} />
            </ThemedAppShell>
            </View>
          </View>
        </LocalDbBoot>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
