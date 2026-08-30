import { AccountScreen, InfoRow } from '@/components/AccountScreen';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { vehicleLabel } from '@/lib/staffLabels';

export default function VehicleScreen() {
  const { staff } = useStaffAuth();
  const p = staff?.profile;
  return (
    <AccountScreen title="Mon véhicule">
      <InfoRow icon="truck" label="Type" value={vehicleLabel(staff?.vehicle)} />
      <InfoRow icon="hash" label="Immatriculation" value={p?.vehiclePlate?.trim() || '—'} />
      <InfoRow
        icon="package"
        label="Propriété"
        value={p?.ownsVehicle ? 'Véhicule personnel' : p?.needsKit ? 'Matériel Super U (casque, etc.)' : '—'}
      />
    </AccountScreen>
  );
}
