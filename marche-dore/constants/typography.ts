import { Platform, type TextStyle } from 'react-native';

/**
 * Marché Doré type system
 * - Display (Syne): titles, brand, product names — geometric & distinctive
 * - Body (DM Sans): UI, paragraphs, meta — warm & highly readable
 */
export const fontFamilies = {
  display: Platform.select({
    web: 'Syne',
    default: 'Syne_700Bold',
  }) as string,
  displaySemi: Platform.select({
    web: 'Syne',
    default: 'Syne_600SemiBold',
  }) as string,
  displayExtra: Platform.select({
    web: 'Syne',
    default: 'Syne_800ExtraBold',
  }) as string,
  body: Platform.select({
    web: 'DM Sans',
    default: 'DMSans_400Regular',
  }) as string,
  bodyMedium: Platform.select({
    web: 'DM Sans',
    default: 'DMSans_500Medium',
  }) as string,
  bodySemi: Platform.select({
    web: 'DM Sans',
    default: 'DMSans_600SemiBold',
  }) as string,
  bodyBold: Platform.select({
    web: 'DM Sans',
    default: 'DMSans_700Bold',
  }) as string,
} as const;

/** Native needs a dedicated face per weight; web uses CSS weight on the family. */
export function bodyFont(weight: TextStyle['fontWeight'] = '400'): TextStyle {
  if (Platform.OS === 'web') {
    return { fontFamily: fontFamilies.body, fontWeight: weight };
  }
  const w = String(weight);
  if (w === '700' || w === 'bold' || w === '800' || w === '900') {
    return { fontFamily: fontFamilies.bodyBold, fontWeight: 'normal' };
  }
  if (w === '600' || w === 'semibold') {
    return { fontFamily: fontFamilies.bodySemi, fontWeight: 'normal' };
  }
  if (w === '500' || w === 'medium') {
    return { fontFamily: fontFamilies.bodyMedium, fontWeight: 'normal' };
  }
  return { fontFamily: fontFamilies.body, fontWeight: 'normal' };
}

export function displayFont(weight: TextStyle['fontWeight'] = '700'): TextStyle {
  if (Platform.OS === 'web') {
    return { fontFamily: fontFamilies.display, fontWeight: weight };
  }
  const w = String(weight);
  if (w === '800' || w === '900') {
    return { fontFamily: fontFamilies.displayExtra, fontWeight: 'normal' };
  }
  if (w === '600' || w === 'semibold') {
    return { fontFamily: fontFamilies.displaySemi, fontWeight: 'normal' };
  }
  return { fontFamily: fontFamilies.display, fontWeight: 'normal' };
}

export const type = {
  hero: {
    ...displayFont('800'),
    fontSize: 28,
    letterSpacing: -0.6,
    lineHeight: 34,
  } satisfies TextStyle,
  title: {
    ...displayFont('700'),
    fontSize: 22,
    letterSpacing: -0.4,
    lineHeight: 28,
  } satisfies TextStyle,
  productName: {
    ...displayFont('700'),
    fontSize: 16,
    letterSpacing: -0.2,
    lineHeight: 20,
  } satisfies TextStyle,
  section: {
    ...displayFont('700'),
    fontSize: 18,
    letterSpacing: -0.3,
    lineHeight: 24,
  } satisfies TextStyle,
  body: {
    ...bodyFont('400'),
    fontSize: 14,
    lineHeight: 21,
  } satisfies TextStyle,
  label: {
    ...bodyFont('600'),
    fontSize: 13,
    letterSpacing: 0.1,
  } satisfies TextStyle,
  meta: {
    ...bodyFont('500'),
    fontSize: 12,
    lineHeight: 16,
  } satisfies TextStyle,
} as const;
