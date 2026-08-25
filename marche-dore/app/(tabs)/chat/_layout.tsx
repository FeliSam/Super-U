import { useColors } from '@/context/ThemeContext';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function ChatLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
        freezeOnBlur: Platform.OS !== 'web',
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
