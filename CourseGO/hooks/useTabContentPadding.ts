import { TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useTabContentPadding() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + TAB_BAR_MARGIN + Math.max(insets.bottom, 8) + 20;
}
