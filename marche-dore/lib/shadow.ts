import { Platform, type ViewStyle } from 'react-native';

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
      // @ts-expect-error RN web accepts boxShadow
      boxShadow: `0 ${y}px ${blur}px ${rgba}`,
    };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur / 2,
    elevation,
  };
}

function hexToRgba(hex: string, alpha: number) {
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
