import { Platform, type TextStyle } from 'react-native';

export const fontFamilies = {
  display: Platform.select({ web: 'Archivo', default: 'Archivo_800ExtraBold' }) as string,
  displayBlack: Platform.select({ web: 'Archivo', default: 'Archivo_900Black' }) as string,
  displayBold: Platform.select({ web: 'Archivo', default: 'Archivo_700Bold' }) as string,
  body: Platform.select({ web: 'Manrope', default: 'Manrope_400Regular' }) as string,
  bodyMedium: Platform.select({ web: 'Manrope', default: 'Manrope_500Medium' }) as string,
  bodySemi: Platform.select({ web: 'Manrope', default: 'Manrope_600SemiBold' }) as string,
  bodyBold: Platform.select({ web: 'Manrope', default: 'Manrope_700Bold' }) as string,
  bodyExtra: Platform.select({ web: 'Manrope', default: 'Manrope_800ExtraBold' }) as string,
} as const;

export function bodyFont(weight: TextStyle['fontWeight'] = '400'): TextStyle {
  if (Platform.OS === 'web') return { fontFamily: fontFamilies.body, fontWeight: weight };
  const w = String(weight);
  if (w === '800' || w === '900') return { fontFamily: fontFamilies.bodyExtra, fontWeight: 'normal' };
  if (w === '700' || w === 'bold') return { fontFamily: fontFamilies.bodyBold, fontWeight: 'normal' };
  if (w === '600') return { fontFamily: fontFamilies.bodySemi, fontWeight: 'normal' };
  if (w === '500') return { fontFamily: fontFamilies.bodyMedium, fontWeight: 'normal' };
  return { fontFamily: fontFamilies.body, fontWeight: 'normal' };
}

export function displayFont(weight: TextStyle['fontWeight'] = '800'): TextStyle {
  if (Platform.OS === 'web') return { fontFamily: fontFamilies.display, fontWeight: weight };
  const w = String(weight);
  if (w === '900' || w === 'black') return { fontFamily: fontFamilies.displayBlack, fontWeight: 'normal' };
  if (w === '700' || w === 'bold') return { fontFamily: fontFamilies.displayBold, fontWeight: 'normal' };
  return { fontFamily: fontFamilies.display, fontWeight: 'normal' };
}

export const colors = {
  bg: '#fafaf9',
  white: '#ffffff',
  text: '#111827',
  muted: '#4b5563',
  placeholder: '#9ca3af',
  border: '#e5e7eb',
  teal: '#0d9488',
  tealSoft: 'rgba(13,148,136,0.1)',
  coral: '#ff6b6b',
  coralSoft: 'rgba(255,107,107,0.1)',
  green: '#00b86b',
  amber: '#f59e0b',
  amberSoft: '#fef3c7',
  danger: '#ef4444',
  dangerSoft: '#fee2e2',
  onAccent: '#fafaf9',
  callBg: '#111827',
  callCtrl: '#262d3d',
} as const;

export const radius = {
  card: 24,
  sheet: 32,
  tabBar: 28,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  tabBar: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
} as const;

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_MARGIN = 12;

/** Largeur max de l’UI web (téléphone). En dessous, l’app occupe 100 %. */
export const PHONE_MAX_WIDTH = 430;
