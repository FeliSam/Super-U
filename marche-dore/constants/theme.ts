export const lightColors = {
  bg: '#fdfbf7',
  text: '#1c1613',
  muted: '#615752',
  placeholder: '#9e938d',
  border: '#f1ebe3',
  gold: '#e2931d',
  terracotta: '#c84b31',
  cream: '#fdf0d5',
  blush: '#fceae6',
  green: '#498c53',
  white: '#ffffff',
  overlay: 'rgba(28,22,19,0.45)',
} as const;

export const darkColors = {
  bg: '#14110f',
  text: '#f6f1ea',
  muted: '#b7aaa1',
  placeholder: '#8a7d74',
  border: '#2a2420',
  gold: '#e8a63a',
  terracotta: '#e06a52',
  cream: '#3a2e1f',
  blush: '#3a221e',
  green: '#6aad74',
  white: '#1e1a17',
  overlay: 'rgba(0,0,0,0.55)',
} as const;

export type AppColors = { -readonly [K in keyof typeof lightColors]: string };

export type ColorScheme = 'light' | 'dark';

/** Frosted chrome + ink for gold/warm tab heroes (Accueil, Explorer, etc.). */
export function heroChrome(scheme: ColorScheme) {
  if (scheme === 'dark') {
    return {
      gradient: ['#3d2e1a', '#241c14', darkColors.bg] as [string, string, string],
      orb: 'rgba(255,255,255,0.06)',
      surface: 'rgba(255,255,255,0.1)',
      surfaceBorder: 'rgba(255,255,255,0.14)',
      ink: '#f6f1ea',
      muted: '#b7aaa1',
      divider: 'rgba(255,255,255,0.12)',
      iconBg: 'rgba(255,255,255,0.12)',
      iconBorder: 'rgba(255,255,255,0.16)',
      iconColor: '#f6f1ea',
    };
  }
  return {
    gradient: ['#f8e4c4', lightColors.cream, lightColors.bg] as [string, string, string],
    orb: 'rgba(255,255,255,0.35)',
    surface: 'rgba(255,255,255,0.72)',
    surfaceBorder: 'rgba(255,255,255,0.9)',
    ink: '#1c1613',
    muted: '#615752',
    divider: 'rgba(28,22,19,0.12)',
    iconBg: 'rgba(255,255,255,0.88)',
    iconBorder: 'rgba(255,255,255,0.95)',
    iconColor: '#1c1613',
  };
}

/** Mutable live palette — updated by ThemeProvider. Prefer `useColors()` in components. */
export const colors: AppColors = { ...lightColors };

export function bindActiveColors(next: AppColors) {
  (Object.keys(next) as (keyof AppColors)[]).forEach((key) => {
    colors[key] = next[key];
  });
}

/** Space to keep tab content scrollable above the floating tab bar */
export const tabBarClearance = 120;

export const spacing = {
  screen: 20,
} as const;

export { bodyFont, displayFont, fontFamilies, type } from '@/constants/typography';
