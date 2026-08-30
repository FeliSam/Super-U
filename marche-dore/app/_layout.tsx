import '@/lib/navigationStability';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { AccountPrefsSync } from '@/components/AccountPrefsSync';
import { OrderNotificationBridge } from '@/components/OrderNotificationBridge';
import { prepareApp, warmRemainingAssets } from '@/lib/bootstrap';
import { lockWebInputZoom } from '@/lib/noZoomInput';
import { CallOverlay } from '@/components/CallOverlay';
import { ToastHost } from '@/components/ToastHost';
import { AuthGate } from '@/components/AuthGate';
import { AddressesProvider } from '@/context/AddressesContext';
import { AuthProvider } from '@/context/AuthContext';
import { CallProvider } from '@/context/CallContext';
import { CartProvider } from '@/context/CartContext';
import { ChatProvider } from '@/context/ChatContext';
import { CheckoutPaymentProvider } from '@/context/CheckoutPaymentContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { OrdersProvider } from '@/context/OrdersContext';
import { PaymentsProvider } from '@/context/PaymentsContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { ReviewsProvider } from '@/context/ReviewsContext';
import { StoresProvider } from '@/context/StoresContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { UiStateProvider } from '@/context/UiStateContext';
import { lightColors } from '@/constants/theme';
import { LocalDbBoot } from '@/lib/db/boot';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StatusBar as RNStatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)' };

function hideSystemBars() {
  StatusBar.setHidden(true, 'none');
  if (Platform.OS !== 'web') {
    RNStatusBar.setHidden(true, 'none');
  }
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
      animation: Platform.OS === 'web' ? ('none' as const) : Platform.OS === 'ios' ? ('default' as const) : ('fade' as const),
      freezeOnBlur: Platform.OS !== 'web',
      detachPreviousScreen: false,
      statusBarHidden: true }),
    [colors.bg],
  );

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <AuthProvider>
        <CartProvider>
          <ProfileProvider>
            <AddressesProvider>
              <StoresProvider>
                <OrdersProvider>
                  <PaymentsProvider>
                    <CheckoutPaymentProvider>
                      <FavoritesProvider>
                        <NotificationsProvider>
                          <ChatProvider>
                            <CallProvider>
                              <UiStateProvider>
                                <ReviewsProvider>
                                  <AccountPrefsSync />
                                  <OrderNotificationBridge />
                                  <StatusBar hidden style={scheme === 'dark' ? 'light' : 'dark'} />
                                  <AuthGate>
                                    <Stack detachInactiveScreens={false} screenOptions={stackScreenOptions}>
                                      {children}
                                    </Stack>
                                  </AuthGate>
                                  <CallOverlay />
                                  <ToastHost />
                                </ReviewsProvider>
                              </UiStateProvider>
                            </CallProvider>
                          </ChatProvider>
                        </NotificationsProvider>
                      </FavoritesProvider>
                    </CheckoutPaymentProvider>
                  </PaymentsProvider>
                </OrdersProvider>
              </StoresProvider>
            </AddressesProvider>
          </ProfileProvider>
        </CartProvider>
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
    hideSystemBars();
    let active = true;
    prepareApp().finally(() => {
      if (active) setFontsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashElapsed(true), 650);
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
          <View style={{ flex: 1, backgroundColor: lightColors.bg, position: 'relative' }}>
            <ThemedAppShell>
              <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
              <Stack.Screen
                name="search"
                options={{
                  animation: 'slide_from_bottom',
                  animationDuration: 420,
                  gestureDirection: 'vertical',
                  presentation: 'card' }}
              />
              <Stack.Screen name="promotions" />
              <Stack.Screen name="help" />
              <Stack.Screen name="contact" />
              <Stack.Screen name="legal" />
              <Stack.Screen name="about" />
              <Stack.Screen
                name="product/[id]"
                options={{ animation: 'none', animationDuration: 0 }}
              />
              <Stack.Screen name="product/reviews/[id]" />
              <Stack.Screen
                name="category/[id]"
                options={{ animation: 'none', animationDuration: 0 }}
              />
              <Stack.Screen name="checkout" />
              <Stack.Screen name="order-success" options={{ gestureEnabled: false }} />
              <Stack.Screen name="payment-setup/[id]" />
              <Stack.Screen name="tracking" />
              <Stack.Screen name="orders" />
              <Stack.Screen name="order/[id]" />
              <Stack.Screen name="notifications/index" />
              <Stack.Screen name="notifications/[id]" />
              <Stack.Screen name="account/personal-info" />
              <Stack.Screen name="account/addresses" />
              <Stack.Screen name="account/payment-methods" />
              <Stack.Screen name="account/loyalty" />
              <Stack.Screen name="account/settings" />
              <Stack.Screen name="account/favorites" />
            </ThemedAppShell>
            {!splashDone ? (
              <AnimatedSplash
                allowExit={fontsReady && minSplashElapsed}
                onFinish={onSplashFinish}
              />
            ) : null}
          </View>
        </LocalDbBoot>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
