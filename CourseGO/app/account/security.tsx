import { AccountScreen, InfoRow } from '@/components/AccountScreen';
import { bodyFont, colors } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { Text } from 'react-native';

export default function SecurityScreen() {
  const { staff } = useStaffAuth();
  return (
    <AccountScreen title="Sécurité">
      <InfoRow icon="mail" label="E-mail" value={staff?.email || '—'} />
      <InfoRow icon="phone" label="Téléphone" value={staff?.phone || '—'} />
      <InfoRow icon="lock" label="Mot de passe" value="Géré par ops.staff" />
      <Text style={{ ...bodyFont('400'), color: colors.muted, lineHeight: 20 }}>
        Session staff (ops.staff_sessions). Déconnectez-vous depuis le profil pour révoquer le jeton local.
      </Text>
    </AccountScreen>
  );
}
