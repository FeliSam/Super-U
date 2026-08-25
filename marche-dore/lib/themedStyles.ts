import { type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Build StyleSheet from the live theme palette.
 * Replaces module-level `StyleSheet.create({ ... colors.x })` which freezes light tokens.
 */
export function useThemedStyles<T extends NamedStyles<T>>(factory: (colors: AppColors) => T): T {
  const colors = useColors();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}

export function createThemedStyleFactory<T extends NamedStyles<T>>(factory: (colors: AppColors) => T) {
  return function useStyles() {
    return useThemedStyles(factory);
  };
}
