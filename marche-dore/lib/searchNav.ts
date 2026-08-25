import { pinWebKeyboard } from '@/lib/keepKeyboard';
import { router } from 'expo-router';

export function openSearchScreen() {
  pinWebKeyboard();
  router.push('/search');
}
