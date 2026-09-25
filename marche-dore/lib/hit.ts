import type { ViewStyle } from 'react-native';

/** RN web: pointerEvents belongs on `style`, not a View prop. */
export const hitNone = { pointerEvents: 'none' } as ViewStyle;
export const hitBoxNone = { pointerEvents: 'box-none' } as ViewStyle;
export const hitAuto = { pointerEvents: 'auto' } as ViewStyle;
