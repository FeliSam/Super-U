import { useThemeOptional } from '@/context/ThemeContext';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export const useColorScheme = (): 'light' | 'dark' => {
  const theme = useThemeOptional();
  const system = useSystemColorScheme();
  if (theme) return theme.scheme;
  return system === 'dark' ? 'dark' : 'light';
};
