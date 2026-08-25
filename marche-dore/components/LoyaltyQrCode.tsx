import { useColors } from '@/context/ThemeContext';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  value: string;
  size?: number;
  backgroundColor?: string;
  color?: string;
};

/** Native QR via react-native-qrcode-svg. */
export function LoyaltyQrCode({
  value,
  size = 160,
  backgroundColor,
  color,
}: Props) {
  const colors = useColors();
  return (
    <QRCode
      value={value}
      size={size}
      backgroundColor={backgroundColor ?? colors.white}
      color={color ?? colors.text}
      ecl="M"
    />
  );
}
