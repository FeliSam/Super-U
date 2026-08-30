import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

/**
 * Layout wrapper only. The app root owns GestureHandlerRootView.
 * Nested roots make RNGH lose the pointer on web (“Cannot find single active touch”).
 */
export function GestureRoot({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}
