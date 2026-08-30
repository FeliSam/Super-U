import { AccountScreen, InfoRow } from '@/components/AccountScreen';
import { bodyFont, colors } from '@/constants/theme';
import { Text } from 'react-native';

export default function DocumentsScreen() {
  return (
    <AccountScreen title="Mes documents">
      <InfoRow icon="check-circle" label="Pièce d’identité" value="Vérifié" />
      <InfoRow icon="check-circle" label="Permis de conduire" value="Vérifié" />
      <InfoRow icon="file-text" label="Assurance" value="En attente d’API" />
      <Text style={{ ...bodyFont('400'), color: colors.muted, lineHeight: 20 }}>
        L’upload de documents n’est pas encore exposé par l’API ops. Le badge VÉRIFIÉ du profil reflète
        le compte staff actif.
      </Text>
    </AccountScreen>
  );
}
