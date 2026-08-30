import { AccountScreen, InfoRow } from '@/components/AccountScreen';
import { useStaffAuth } from '@/context/StaffAuthContext';

export default function DocumentsScreen() {
  const { staff } = useStaffAuth();
  const p = staff?.profile;
  const city = [p?.residenceLine, p?.residenceCity].filter(Boolean).join(', ');
  return (
    <AccountScreen title="Mes documents">
      <InfoRow icon="credit-card" label="Pièce d’identité" value={p?.idNumber?.trim() || 'Non renseigné'} />
      <InfoRow
        icon="file-text"
        label="Permis de conduire"
        value={p?.hasLicense ? p.licenseNumber?.trim() || 'Déclaré' : 'Pas de permis'}
      />
      <InfoRow
        icon="shield"
        label="Assurance"
        value={p?.hasInsurance ? p.insuranceRef?.trim() || 'Déclarée' : 'Non déclarée'}
      />
      <InfoRow icon="home" label="Adresse de résidence" value={city || '—'} />
      <InfoRow icon="mail" label="E-mail" value={staff?.email || '—'} />
      <InfoRow icon="phone" label="Téléphone" value={staff?.phone || '—'} />
    </AccountScreen>
  );
}
