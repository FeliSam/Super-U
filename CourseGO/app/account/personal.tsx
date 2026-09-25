import { AccountScreen, InfoRow } from '@/components/AccountScreen';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { staffJobLabel } from '@/lib/staffLabels';

export default function PersonalInfoScreen() {
  const { staff } = useStaffAuth();
  const p = staff?.profile;
  const home = [p?.residenceLine, p?.residenceCity].filter(Boolean).join(', ');

  return (
    <AccountScreen title="Infos personnelles">
      <InfoRow icon="user" label="Nom" value={`${staff?.firstName ?? ''} ${staff?.lastName ?? ''}`.trim() || '—'} />
      <InfoRow icon="briefcase" label="Métier" value={staffJobLabel(staff)} />
      <InfoRow icon="mail" label="E-mail" value={staff?.email || '—'} />
      <InfoRow icon="phone" label="Téléphone" value={staff?.phone || '—'} />
      <InfoRow icon="credit-card" label="Pièce d’identité" value={p?.idNumber?.trim() || '—'} />
      <InfoRow icon="home" label="Résidence" value={home || '—'} />
    </AccountScreen>
  );
}
