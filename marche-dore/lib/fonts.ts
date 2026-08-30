import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { INPUT_FONT_SIZE, noZoomInputStyle } from '@/lib/noZoomInput';
import * as Font from 'expo-font';
import { Platform, Text, TextInput } from 'react-native';
import { fontFamilies } from '@/constants/typography';

const brandFonts = {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
};

let applied = false;

/** Inject web base font stack — brand faces come from Font.loadAsync (bundled). */
function injectWebFontCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const id = 'marche-dore-fonts-base';
  document.getElementById(id)?.remove();

  const style = document.createElement('style');
  style.id = id;
    style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
    html, body, #root, input, textarea, button, select {
      font-family: 'DM Sans', ${fontFamilies.body}, system-ui, -apple-system, sans-serif;
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
