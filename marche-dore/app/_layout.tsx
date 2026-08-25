import '@/lib/navigationStability';
import { hideSplash, prepareApp, warmRemainingAssets } from '@/lib/bootstrap';
import { CartProvider } from '@/context/CartContext';
import { CheckoutPaymentProvider } from '@/context/CheckoutPaymentContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { OrdersProvider } from '@/context/OrdersContext';
import { ReviewsProvider } from '@/context/ReviewsContext';
import { UiStateProvider } from '@/context/UiStateContext';
import { colors } from '@/constants/theme';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StatusBar as RNStatusBar, View } from 'react-native';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.gold,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    notification: colors.terracotta,
  },
};

const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.bg },
  animation: Platform.OS === 'web' ? ('none' as const) : Platform.OS === 'ios' ? ('default' as const) : ('fade' as const),
  freezeOnBlur: Platform.OS !== 'web',
  detachPreviousScreen: false,
  statusBarHidden: true,
};

function hideSystemBars() {
  StatusBar.setHidden(true, 'none');
  if (Platform.OS !== 'web') {
    RNStatusBar.setHidden(true, 'none');
  }
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hideSystemBars();
    let active = true;
    prepareApp().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    hideSystemBars();
    hideSplash();
    // Defer non-critical images so first paint stays fast.
    const t = setTimeout(() => warmRemainingAssets(), 50);
    return () => clearTimeout(t);
  }, [ready]);

  if (!ready) {
    return (
      <>
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: colors.bg }} />
      </>
    );
  }

  return (
    <ThemeProvider value={appTheme}>
      <CartProvider>
        <OrdersProvider>
          <CheckoutPaymentProvider>
            <FavoritesProvider>
              <UiStateProvider>
                <ReviewsProvider>
                  <StatusBar hidden />
                  <Stack detachInactiveScreens={false} screenOptions={stackScreenOptions}>
                    <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
                    <Stack.Screen name="search" />
                    <Stack.Screen name="promotions" />
                    <Stack.Screen name="help" />
                    <Stack.Screen name="contact" />
                    <Stack.Screen name="legal" />
                    <Stack.Screen name="about" />
                    <Stack.Screen name="product/[id]" />
                    <Stack.Screen name="product/reviews/[id]" />
                    <Stack.Screen name="category/[id]" />
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
                  </Stack>
                </ReviewsProvider>
              </UiStateProvider>
            </FavoritesProvider>
          </CheckoutPaymentProvider>
        </OrdersProvider>
      </CartProvider>
    </ThemeProvider>
  );
}
