import { CtaButton, IconCircle, Screen, Page } from '@/components/ui';
import { MotionView } from '@/components/motion';
import { type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import {
  maskCard,
  maskPhone,
  useCheckoutPayment,
  type PaymentId,
} from '@/context/CheckoutPaymentContext';
import { userProfile } from '@/data/account';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const METHODS: Record<
  PaymentId,
  {
    label: string;
    accent: string;
    soft: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    title: string;
    subtitle: string;
  }
> = {
  om: {
    label: 'Orange Money',
    accent: '#ff7900',
    soft: '#fff3e8',
    icon: 'smartphone',
    title: 'Payer avec Orange Money',
    subtitle: 'Un code USSD / notification sera envoyé sur ce numéro pour valider le paiement.',
  },
  wave: {
    label: 'MTN MoMo',
    accent: '#1c64f2',
    soft: '#e8f0fe',
    icon: 'zap',
    title: 'Payer avec MTN MoMo',
    subtitle: 'Vous recevrez une demande de paiement MTN MoMo à confirmer dans l’application.',
  },
  card: {
    label: 'Carte bancaire',
    accent: '#e2931d',
    soft: '#fdf0d5',
    icon: 'credit-card',
    title: 'Carte Visa / Mastercard',
    subtitle: 'Paiement sécurisé. Vos données ne sont pas stockées sur cet appareil (démo).',
  },
  cod: {
    label: 'Paiement à la livraison',
    accent: '#498c53',
    soft: '#eaf4ec',
    icon: 'package',
    title: 'Payer à la livraison',
    subtitle: 'Réglez en espèces ou mobile money directement au livreur à la réception.',
  },
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  secureTextEntry,
  autoComplete,
  colors,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  maxLength?: number;
  secureTextEntry?: boolean;
  autoComplete?: 'tel' | 'cc-number' | 'cc-exp' | 'cc-csc' | 'name' | 'off';
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        autoComplete={autoComplete}
      />
    </View>
  );
}

export default function PaymentSetupScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const methodId = (['om', 'wave', 'card', 'cod'].includes(id ?? '') ? id : 'om') as PaymentId;
  const meta = METHODS[methodId];
  const insets = useSafeAreaInsets();
  const { setup, setSetup } = useCheckoutPayment();

  const [phone, setPhone] = useState(
    setup?.methodId === methodId && setup.phone ? setup.phone : userProfile.phone.replace('+229 ', ''),
  );
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState(`${userProfile.firstName} ${userProfile.lastName}`);
  const [accepted, setAccepted] = useState(methodId === 'cod');

  const canSubmit = useMemo(() => {
    if (methodId === 'cod') return accepted;
    if (methodId === 'om' || methodId === 'wave') {
      return phone.replace(/\D/g, '').length >= 9;
    }
    const digits = cardNumber.replace(/\D/g, '');
    return digits.length >= 15 && expiry.length >= 4 && cvc.length >= 3 && cardName.trim().length > 2;
  }, [accepted, cardName, cardNumber, cvc, expiry, methodId, phone]);

  const formatCardInput = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 16);
    return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatExpiry = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  };

  const confirm = () => {
    if (!canSubmit) return;

    if (methodId === 'cod') {
      setSetup({
        methodId,
        label: meta.label,
        detail: 'Espèces au livreur',
        ready: true,
      });
      router.back();
      return;
    }

    if (methodId === 'om' || methodId === 'wave') {
      setSetup({
        methodId,
        label: meta.label,
        detail: maskPhone(phone),
        phone,
        ready: true,
      });
      router.back();
      return;
    }

    const digits = cardNumber.replace(/\D/g, '');
    setSetup({
      methodId: 'card',
      label: meta.label,
      detail: maskCard(digits),
      cardLast4: digits.slice(-4),
      cardBrand: digits.startsWith('4') ? 'Visa' : 'Mastercard',
      ready: true,
    });
    router.back();
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={[styles.header, { paddingTop: Math.max(8, insets.top ? 4 : 8) }]}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Configurer le paiement</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={12}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, insets.bottom + 20) }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <MotionView preset="down" delay={40}>
              <View style={[styles.hero, { backgroundColor: meta.soft, borderColor: meta.accent }]}>
                <View style={[styles.heroIcon, { backgroundColor: meta.accent }]}>
                  <Feather name={meta.icon} size={22} color={colors.white} />
                </View>
                <Text style={styles.heroTitle}>{meta.title}</Text>
                <Text style={styles.heroSub}>{meta.subtitle}</Text>
              </View>
            </MotionView>

            <MotionView preset="down" delay={90} style={styles.form}>
              {methodId === 'om' || methodId === 'wave' ? (
                <>
                  <Field
                    label="Numéro de téléphone"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="77 123 45 67"
                    keyboardType="phone-pad"
                    maxLength={16}
                    autoComplete="tel"
                    colors={colors}
                    styles={styles}
                  />
                  <View style={styles.infoBox}>
                    <Feather name="info" size={16} color={meta.accent} />
                    <Text style={styles.infoText}>
                      {methodId === 'om'
                        ? 'Après validation du swipe, ouvrez Orange Money et confirmez le montant.'
                        : 'Après validation du swipe, ouvrez MTN MoMo et acceptez la demande de paiement.'}
                    </Text>
                  </View>
                  <View style={styles.savedRow}>
                    <Feather name="check-circle" size={16} color={colors.green} />
                    <Text style={styles.savedText}>Compte lié au profil Amina Diallo</Text>
                  </View>
                </>
              ) : null}

              {methodId === 'card' ? (
                <>
                  <Field
                    label="Nom sur la carte"
                    value={cardName}
                    onChangeText={setCardName}
                    placeholder="Amina Diallo"
                    autoComplete="name"
                    colors={colors}
                    styles={styles}
                  />
                  <Field
                    label="Numéro de carte"
                    value={cardNumber}
                    onChangeText={(t) => setCardNumber(formatCardInput(t))}
                    placeholder="4242 4242 4242 4242"
                    keyboardType="number-pad"
                    maxLength={19}
                    autoComplete="cc-number"
                    colors={colors}
                    styles={styles}
                  />
                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Expiration"
                        value={expiry}
                        onChangeText={(t) => setExpiry(formatExpiry(t))}
                        placeholder="MM/AA"
                        keyboardType="number-pad"
                        maxLength={5}
                        autoComplete="cc-exp"
                        colors={colors}
                        styles={styles}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="CVC"
                        value={cvc}
                        onChangeText={(t) => setCvc(t.replace(/\D/g, '').slice(0, 4))}
                        placeholder="123"
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                        autoComplete="cc-csc"
                        colors={colors}
                        styles={styles}
                      />
                    </View>
                  </View>
                  <View style={styles.infoBox}>
                    <Feather name="lock" size={16} color={colors.green} />
                    <Text style={styles.infoText}>
                      Connexion chiffrée · 3-D Secure si requis par votre banque.
                    </Text>
                  </View>
                </>
              ) : null}

              {methodId === 'cod' ? (
                <>
                  <View style={styles.codCard}>
                    <View style={styles.codRow}>
                      <Feather name="map-pin" size={16} color={colors.gold} />
                      <Text style={styles.codText}>Livraison à Rue 12, Ganhi</Text>
                    </View>
                    <View style={styles.codRow}>
                      <Feather name="phone" size={16} color={colors.gold} />
                      <Text style={styles.codText}>{userProfile.phone}</Text>
                    </View>
                    <View style={styles.codRow}>
                      <Feather name="info" size={16} color={colors.gold} />
                      <Text style={styles.codText}>Préparez le montant exact si possible.</Text>
                    </View>
                  </View>
                  <Pressable style={styles.checkRow} onPress={() => setAccepted((v) => !v)}>
                    <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
                      {accepted ? <Feather name="check" size={14} color={colors.white} /> : null}
                    </View>
                    <Text style={styles.checkText}>
                      Je confirme payer le total au livreur à la réception de ma commande.
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </MotionView>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom + 10) }]}>
            <CtaButton
              label={
                methodId === 'cod'
                  ? 'Confirmer ce mode de paiement'
                  : methodId === 'card'
                    ? 'Enregistrer la carte'
                    : `Utiliser ${meta.label}`
              }
              onPress={confirm}
            />
            {!canSubmit ? (
              <Text style={styles.footerHint}>Complétez les informations pour continuer</Text>
            ) : (
              <Text style={styles.footerHintOk}>Prêt · retour au checkout</Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Page>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 10,
  },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '800' },
  headerSpacer: { width: 40 },
  content: { paddingHorizontal: 20, gap: 16 },
  hero: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    gap: 8,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  heroSub: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  form: { gap: 12 },
  field: { gap: 6 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  row2: { flexDirection: 'row', gap: 10 },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.bg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedText: { color: colors.green, fontSize: 12, fontWeight: '700' },
  codCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  codRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.green, borderColor: colors.green },
  checkText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    gap: 8,
  },
  footerHint: { textAlign: 'center', color: colors.placeholder, fontSize: 12, fontWeight: '600' },
  footerHintOk: { textAlign: 'center', color: colors.green, fontSize: 12, fontWeight: '700' },
});
}
