import { colors } from '@/constants/theme';
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
  backgroundColor = colors.white,
  color = colors.text,
}: Props) {
  return (
    <QRCode
      value={value}
      size={size}
      backgroundColor={backgroundColor}
      color={color}
      ecl="M"
    />
  );
}
