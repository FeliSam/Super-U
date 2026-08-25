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
import { INPUT_FONT_SIZE, noZoomInputStyle } from '@/lib/noZoomInput';
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

/** Inject web base font stack — brand faces come from Font.loadAsync (bundled). */
function injectWebFontCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const id = 'marche-dore-fonts-base';
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
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
    // Bundled font modules failed to register — system stack remains.
  }

  if (applied) return;
  applied = true;

  const baseStyle =
    Platform.OS === 'web'
      ? { fontFamily: fontFamilies.body }
      : { fontFamily: fontFamilies.body };

  /** ≥16px prevents iOS / mobile Safari auto-zoom on focus. */
  const inputBaseStyle = {
    ...baseStyle,
    ...noZoomInputStyle,
    fontSize: INPUT_FONT_SIZE,
  };

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
    style: [inputBaseStyle, inputAny.defaultProps?.style],
  };
}
