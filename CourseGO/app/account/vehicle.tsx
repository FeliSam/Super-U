import { AccountScreen, InfoRow } from '@/components/AccountScreen';
import { bodyFont, colors } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { Text } from 'react-native';

export default function VehicleScreen() {
  const { staff } = useStaffAuth();
  return (
    <AccountScreen title="Mon véhicule">
      <InfoRow icon="truck" label="Type" value={staff?.vehicle?.trim() || 'Moto'} />
      <InfoRow icon="map-pin" label="Magasin rattaché" value={staff?.storeId || '—'} />
      <InfoRow icon="user" label="Rôle" value={staff?.role || '—'} />
      <Text style={{ ...bodyFont('400'), color: colors.muted, lineHeight: 20 }}>
        Les infos véhicule viennent du compte ops.staff. La modification se fait côté SuperU, pas dans
        CourseGo.
      </Text>
    </AccountScreen>
  );
}
