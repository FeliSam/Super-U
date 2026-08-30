import { AccountScreen, InfoRow } from '@/components/AccountScreen';
import { bodyFont, colors } from '@/constants/theme';
import { getApiBaseUrl } from '@/lib/api/http';
import { Text } from 'react-native';

export default function AboutScreen() {
  return (
    <AccountScreen title="À propos">
      <InfoRow icon="package" label="Application" value="CourseGo 1.0.0" />
      <InfoRow icon="server" label="API SuperU" value={getApiBaseUrl()} />
      <InfoRow icon="map" label="Cartes" value="MapLibre · OpenFreeMap Liberty" />
      <Text style={{ ...bodyFont('400'), color: colors.muted, lineHeight: 20 }}>
        App staff (préparation + livraison) branchée sur le même Postgres que Marché Doré. Auth ops.staff uniquement.
      </Text>
    </AccountScreen>
  );
}
