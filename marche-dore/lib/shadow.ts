import { Platform, type TextStyle, type ViewStyle } from 'react-native';

type SoftShadow = {
  color?: string;
  y?: number;
  blur?: number;
  opacity?: number;
  elevation?: number;
};

/** Cross-platform soft shadow — boxShadow on web, legacy shadow* on native. */
export function softShadow({
  color = '#1c1613',
  y = 8,
  blur = 16,
  opacity = 0.12,
  elevation = 8,
}: SoftShadow = {}): ViewStyle {
  if (Platform.OS === 'web') {
    const rgba = hexToRgba(color, opacity);
    return {
      boxShadow: `0 ${y}px ${blur}px ${rgba}`,
    } as ViewStyle;
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur / 2,
    elevation,
  };
}

export function textSoftShadow(
  color = 'rgba(0,0,0,0.45)',
  y = 1,
  blur = 4,
): TextStyle {
  if (Platform.OS === 'web') {
    return { textShadow: `0 ${y}px ${blur}px ${color}` } as TextStyle;
  }
  return {
    textShadowColor: color,
    textShadowOffset: { width: 0, height: y },
    textShadowRadius: blur,
  };
}

function hexToRgba(hex: string, alpha: number) {
  if (hex.startsWith('rgb')) return hex;
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(28, 22, 19, ${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
