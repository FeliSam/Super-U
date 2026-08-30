import { bodyFont } from '@/constants/theme';
import {
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
} from '@expo-google-fonts/archivo';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import * as Font from 'expo-font';
import { Platform, Text, TextInput } from 'react-native';
import { fontFamilies } from '@/constants/theme';

const brandFonts = {
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

let applied = false;

export async function loadBrandFonts() {
  if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('coursego-fonts')) {
    const style = document.createElement('style');
    style.id = 'coursego-fonts';
    style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap');
html,body,#root,input,textarea,button{
  font-family:${fontFamilies.body},system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}`;
    document.head.appendChild(style);
  }
  try {
    await Font.loadAsync(brandFonts);
  } catch {
    /* system stack */
  }
  if (applied) return;
  applied = true;
  const base = bodyFont('400');
  const textAny = Text as typeof Text & { defaultProps?: { style?: unknown } };
  const inputAny = TextInput as typeof TextInput & { defaultProps?: { style?: unknown } };
  textAny.defaultProps = { ...textAny.defaultProps, style: [base, textAny.defaultProps?.style] };
  inputAny.defaultProps = {
    ...inputAny.defaultProps,
    style: [{ ...base, fontSize: 16 }, inputAny.defaultProps?.style],
  };
}
