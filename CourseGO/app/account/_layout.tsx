import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function AccountLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="vehicle" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="security" />
      <Stack.Screen name="support" />
      <Stack.Screen name="about" />
    </Stack>
  );
}
