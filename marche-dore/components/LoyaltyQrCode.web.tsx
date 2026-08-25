import { useColors } from '@/context/ThemeContext';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

type Props = {
  value: string;
  size?: number;
  backgroundColor?: string;
  color?: string;
};

/** Web QR via PNG data URL — avoids react-native-svg Metro WebShape bug. */
export function LoyaltyQrCode({
  value,
  size = 160,
  backgroundColor,
  color,
}: Props) {
  const colors = useColors();
  const bg = backgroundColor ?? colors.white;
  const fg = color ?? colors.text;
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size,
      color: {
        dark: fg,
        light: bg,
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setUri(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, bg, fg]);

  return (
    <View style={[styles.box, { width: size, height: size, backgroundColor: bg }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <ActivityIndicator color={colors.gold} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
