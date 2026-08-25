import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Syne_600SemiBold,
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import * as Font from 'expo-font';
import { Platform, Text, TextInput } from 'react-native';
import { fontFamilies } from '@/constants/typography';

const brandFonts = {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  Syne_600SemiBold,
  Syne_700Bold,
  Syne_800ExtraBold,
};

let applied = false;

/** Inject web CSS so weight axes resolve cleanly with family names. */
function injectWebFontCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const id = 'marche-dore-fonts';
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Syne:wght@600;700;800&display=swap';
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.id = `${id}-base`;
  style.textContent = `
    html, body, #root, input, textarea, button, select {
      font-family: ${fontFamilies.body}, system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Load Marché Doré brand fonts and set sensible Text defaults.
 * Safe to call multiple times.
 */
export async function loadBrandFonts(): Promise<void> {
  injectWebFontCss();

  try {
    await Font.loadAsync(brandFonts);
  } catch {
    // Keep system fallback if download fails.
  }

  if (applied) return;
  applied = true;

  const baseStyle =
    Platform.OS === 'web'
      ? { fontFamily: fontFamilies.body }
      : { fontFamily: fontFamilies.body };

  const textAny = Text as typeof Text & {
    defaultProps?: { style?: unknown };
  };
  const inputAny = TextInput as typeof TextInput & {
    defaultProps?: { style?: unknown };
  };

  textAny.defaultProps = {
    ...textAny.defaultProps,
    style: [baseStyle, textAny.defaultProps?.style],
  };
  inputAny.defaultProps = {
    ...inputAny.defaultProps,
    style: [baseStyle, inputAny.defaultProps?.style],
  };
}
