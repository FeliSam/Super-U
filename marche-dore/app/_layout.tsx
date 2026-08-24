import { CartProvider } from '@/context/CartContext';
import { ReviewsProvider } from '@/context/ReviewsContext';
import { UiStateProvider } from '@/context/UiStateContext';
import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { enableFreeze } from 'react-native-screens';

enableFreeze(true);

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
    <CartProvider>
      <UiStateProvider>
        <ReviewsProvider>
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="product/[id]" />
          <Stack.Screen name="product/reviews/[id]" />
          <Stack.Screen name="category/[id]" />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="tracking" />
          <Stack.Screen name="notifications/index" />
          <Stack.Screen name="notifications/[id]" />
          <Stack.Screen name="account/personal-info" />
          <Stack.Screen name="account/addresses" />
          <Stack.Screen name="account/payment-methods" />
          <Stack.Screen name="account/loyalty" />
        </Stack>
        </ReviewsProvider>
      </UiStateProvider>
    </CartProvider>
  );
}
