import { lightColors, darkColors, bindActiveColors, type AppColors, type ColorScheme } from '@/constants/theme';
import { appStorage as AsyncStorage } from '@/lib/db/kv';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, Platform, useColorScheme as useSystemColorScheme } from 'react-native';

const STORAGE_KEY = 'marche-dore.theme-preference.v1';

export type ThemePreference = 'light' | 'dark' | 'system';
export type { ColorScheme };

type ThemeContextValue = {
  preference: ThemePreference;
  scheme: ColorScheme;
  colors: AppColors;
  setPreference: (next: ThemePreference) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(preference: ThemePreference, system: ColorScheme | null | undefined): ColorScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

function paletteFor(scheme: ColorScheme): AppColors {
  return scheme === 'dark' ? { ...darkColors } : { ...lightColors };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (active && (raw === 'light' || raw === 'dark' || raw === 'system')) {
          setPreferenceState(raw);
        }
      } catch {
        // ignore
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    if (Platform.OS !== 'web' && typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(next === 'system' ? null : next);
    }
  }, []);

  const scheme = resolveScheme(preference, systemScheme === 'dark' ? 'dark' : 'light');
  const colors = useMemo(() => paletteFor(scheme), [scheme]);

  useLayoutEffect(() => {
    bindActiveColors(colors);
  }, [colors]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.theme = scheme;
    root.style.colorScheme = scheme;
    root.style.backgroundColor = colors.bg;
    if (document.body) {
      document.body.style.backgroundColor = colors.bg;
      document.body.style.colorScheme = scheme;
    }
  }, [scheme, colors.bg]);

  const value = useMemo(
    () => ({ preference, scheme, colors, setPreference, ready }),
    [preference, scheme, colors, setPreference, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useThemeOptional() {
  return useContext(ThemeContext);
}

/** Safe outside provider (returns light palette). */
export function useColors(): AppColors {
  const ctx = useContext(ThemeContext);
  return ctx?.colors ?? { ...lightColors };
}
