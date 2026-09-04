import '@/lib/navigationStability';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { AccountPrefsSync } from '@/components/AccountPrefsSync';
import { OrderNotificationBridge } from '@/components/OrderNotificationBridge';
import { OrderLiveActivityHost } from '@/components/OrderLiveActivityHost';
import { prepareApp, warmRemainingAssets } from '@/lib/bootstrap';
import { lockWebInputZoom } from '@/lib/noZoomInput';
import { hideSystemBars, watchHiddenSystemBars } from '@/lib/systemBars';
import { CallOverlay } from '@/components/CallOverlay';
import { ToastHost } from '@/components/ToastHost';
import { AuthGate } from '@/components/AuthGate';
import { AddressesProvider } from '@/context/AddressesContext';
import { AuthProvider } from '@/context/AuthContext';
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
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { peekShopHasSession } from '@/lib/sessionPeek';

export { ErrorBoundary } from '@/components/AppErrorBoundary';

export const unstable_settings = {
  initialRouteName: peekShopHasSession() ? '(tabs)' : '(auth)',
};

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
      statusBarHidden: true }),
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
                                  <StatusBar hidden style={scheme === 'dark' ? 'light' : 'dark'} />
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
  const [fontsReady, setFontsReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  const onSplashFinish = useCallback(() => {
    setSplashDone(true);
    warmRemainingAssets();
  }, []);

  useEffect(() => {
    return watchHiddenSystemBars();
  }, []);

  useEffect(() => {
    let active = true;
    prepareApp().finally(() => {
      if (active) setFontsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashElapsed(true), 280);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return lockWebInputZoom();
  }, []);

  useEffect(() => {
    hideSystemBars();
  }, [fontsReady]);

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
            {!splashDone ? (
              <AnimatedSplash
                allowExit={fontsReady && minSplashElapsed}
                onFinish={onSplashFinish}
              />
            ) : null}
            </View>
          </View>
        </LocalDbBoot>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
