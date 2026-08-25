import '@/lib/navigationStability';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { prepareApp, warmRemainingAssets } from '@/lib/bootstrap';
import { CartProvider } from '@/context/CartContext';
import { CheckoutPaymentProvider } from '@/context/CheckoutPaymentContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { OrdersProvider } from '@/context/OrdersContext';
import { ReviewsProvider } from '@/context/ReviewsContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { UiStateProvider } from '@/context/UiStateContext';
import { lightColors } from '@/constants/theme';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StatusBar as RNStatusBar, View } from 'react-native';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

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
        notification: colors.terracotta,
      },
    };
  }, [colors, scheme]);

  const stackScreenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: colors.bg },
      animation: Platform.OS === 'web' ? ('none' as const) : Platform.OS === 'ios' ? ('default' as const) : ('fade' as const),
      freezeOnBlur: Platform.OS !== 'web',
      detachPreviousScreen: false,
      statusBarHidden: true,
    }),
    [colors.bg],
  );

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <CartProvider>
        <OrdersProvider>
          <CheckoutPaymentProvider>
            <FavoritesProvider>
              <UiStateProvider>
                <ReviewsProvider>
                  <StatusBar hidden style={scheme === 'dark' ? 'light' : 'dark'} />
                  <Stack detachInactiveScreens={false} screenOptions={stackScreenOptions}>
                    {children}
                  </Stack>
                </ReviewsProvider>
              </UiStateProvider>
            </FavoritesProvider>
          </CheckoutPaymentProvider>
        </OrdersProvider>
      </CartProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  const onSplashFinish = useCallback(() => {
    setSplashDone(true);
    warmRemainingAssets();
  }, []);

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
  }, [ready]);

  if (!ready) {
    return (
      <>
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: '#fdfbf7' }} />
      </>
    );
  }

  return (
    <ThemeProvider>
      <View style={{ flex: 1, backgroundColor: lightColors.bg }}>
        <ThemedAppShell>
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen
            name="search"
            options={{
              animation: 'fade_from_bottom',
              animationDuration: 380,
              gestureDirection: 'vertical',
            }}
          />
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
        </ThemedAppShell>
        {!splashDone ? <AnimatedSplash onFinish={onSplashFinish} /> : null}
      </View>
    </ThemeProvider>
  );
}
