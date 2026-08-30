import { AccountScreen, InfoRow } from '@/components/AccountScreen';
import { bodyFont, colors } from '@/constants/theme';
import { Text } from 'react-native';

export default function SupportScreen() {
  return (
    <AccountScreen title="Support & Aide">
      <InfoRow icon="phone" label="Ops magasin" value="+229 01 40 00 00 00" />
      <InfoRow icon="mail" label="E-mail" value="ops@marchedore.bj" />
      <InfoRow icon="message-circle" label="Chat client" value="Depuis une course → Contacter" />
      <Text style={{ ...bodyFont('400'), color: colors.muted, lineHeight: 20 }}>
        Pour une commande en cours, ouvrez le fil courier depuis l’écran de livraison.
      </Text>
    </AccountScreen>
  );
}
