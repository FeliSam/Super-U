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
  /** Card / elevated surface (flips dark in dark mode). */
  white: '#ffffff',
  /** Always-light ink for text/icons on gold, terracotta, green, dark gradients. */
  onAccent: '#ffffff',
  /** Soft success / “in stock” wash. */
  successSoft: '#edf7ef',
  /** Soft selected / unread wash. */
  selectSoft: '#fffdfb',
  overlay: 'rgba(28,22,19,0.45)',
  /** Sheet drag handle — stays visible on bg in both modes. */
  grabber: '#c4b8ae',
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
  onAccent: '#ffffff',
  successSoft: 'rgba(106,173,116,0.18)',
  selectSoft: 'rgba(232,166,58,0.14)',
  overlay: 'rgba(0,0,0,0.55)',
  grabber: '#7d736b',
} as const;

export type AppColors = { -readonly [K in keyof typeof lightColors]: string };

export type ColorScheme = 'light' | 'dark';

/** Pick dark or light ink so an icon stays readable on `bg` (including translucent frosts). */
export function inkOnSurface(bg: string): string {
  const hex = bg.trim().match(/^#([0-9a-f]{6})$/i);
  const rgba = bg
    .trim()
    .match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  let r: number;
  let g: number;
  let b: number;
  let a = 1;
  if (hex) {
    const n = parseInt(hex[1], 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
  } else if (rgba) {
    r = Number(rgba[1]);
    g = Number(rgba[2]);
    b = Number(rgba[3]);
    a = rgba[4] != null ? Number(rgba[4]) : 1;
  } else {
    return lightColors.text;
  }
  // Composite translucent whites onto a dark photo/hero so 12% frost stays “dark”.
  const br = 28;
  const bgC = 22;
  const bb = 19;
  const cr = r * a + br * (1 - a);
  const cg = g * a + bgC * (1 - a);
  const cb = b * a + bb * (1 - a);
  const lum = (0.2126 * cr + 0.7152 * cg + 0.0722 * cb) / 255;
  return lum > 0.55 ? lightColors.text : darkColors.text;
}

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

/** Pastille « glace liquide » (adresse, cloche). */
export function liquidIce(scheme: ColorScheme) {
  if (scheme === 'dark') {
    return {
      backgroundColor: 'rgba(150, 210, 222, 0.18)',
      borderColor: 'rgba(210, 240, 248, 0.28)',
      webFilter: 'blur(22px) saturate(170%)',
      webShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 20px rgba(20, 60, 80, 0.28)',
    };
  }
  return {
    backgroundColor: 'rgba(210, 240, 250, 0.38)',
    borderColor: 'rgba(255, 255, 255, 0.82)',
    webFilter: 'blur(22px) saturate(170%)',
    webShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), 0 8px 22px rgba(80, 150, 175, 0.16)',
  };
}

/** Mutable live palette — updated by ThemeProvider. Prefer `useColors()` in components. */
export const colors: AppColors = { ...lightColors };

export function bindActiveColors(next: AppColors) {
  (Object.keys(next) as (keyof AppColors)[]).forEach((key) => {
    colors[key] = next[key];
  });
}

/** Floating tab bar height (must match `app/(tabs)/_layout.tsx`). */
export const TAB_BAR_HEIGHT = 68;

/** Distance from screen bottom to the floating tab bar. */
export function tabBarBottomOffset(insetsBottom: number) {
  return Math.max(12, insetsBottom + 4);
}

/** Bottom offset so a FAB sits clearly above the floating tab bar (iPhone home indicator aware). */
export function floatingAboveTabBar(insetsBottom: number, gap = 14) {
  return tabBarBottomOffset(insetsBottom) + TAB_BAR_HEIGHT + gap;
}

/** Space to keep tab content scrollable above the floating tab bar (+ FAB room). */
export const tabBarClearance = 148;

/** Largeur max du cadre boutique (mobile-first, prévisualisation web). */
export const MOBILE_FRAME_MAX = 430;

/** Keep 20% of historical outer page insets (80% reduction). */
export const SCREEN_EDGE_RATIO = 0.2;

export function screenEdge(px: number) {
  return Math.round(px * SCREEN_EDGE_RATIO);
}

export const spacing = {
  /** Outer page / list / sheet inset (was 20). */
  screen: screenEdge(20),
  /** Outer inset from former 16px screen/sheet edges. */
  screenMd: screenEdge(16),
  /** Outer inset from former 24px screen edges. */
  screenLg: screenEdge(24),
} as const;

export { bodyFont, displayFont, fontFamilies, type } from '@/constants/typography';
