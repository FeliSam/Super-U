import { CtaButton, IconCircle, Screen, Page } from '@/components/ui';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { paymentMethods, type PaymentMethod } from '@/data/account';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function PaymentCard({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethod;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={[styles.card, selected && styles.cardSelected]} onPress={onSelect}>
      <View style={styles.iconWrap}>
        <Feather name={method.icon} size={18} color={colors.gold} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.type}>{method.type}</Text>
          {method.default ? (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Par défaut</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.detail}>{method.detail}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]} />
    </Pressable>
  );
}

export default function PaymentMethodsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedId, setSelectedId] = useState(
    paymentMethods.find((m) => m.default)?.id ?? paymentMethods[0]?.id,
  );

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <Text style={styles.title}>Moyens de paiement</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>
            Choisissez votre moyen de paiement préféré pour vos commandes Marché Doré.
          </Text>

          {paymentMethods.map((method) => (
            <PaymentCard
              key={method.id}
              method={method}
              selected={selectedId === method.id}
              onSelect={() => setSelectedId(method.id)}
            />
          ))}

          <Pressable style={styles.addCard}>
            <Feather name="plus" size={18} color={colors.gold} />
            <Text style={styles.addText}>Ajouter un moyen de paiement</Text>
          </Pressable>

          <View style={styles.secure}>
            <Feather name="lock" size={16} color={colors.green} />
            <Text style={styles.secureText}>Paiements sécurisés · Données chiffrées</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <CtaButton label="Enregistrer le moyen de paiement" onPress={() => router.back()} />
        </View>
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
    paddingVertical: 12,
  },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 17, ...displayFont('700') },
  content: { padding: 20, gap: 10, paddingBottom: 24 },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  cardSelected: { borderColor: colors.gold, backgroundColor: '#fffdfb' },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  type: { color: colors.text, fontSize: 15, fontWeight: '700' },
  defaultBadge: {
    backgroundColor: colors.cream,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  defaultText: { color: colors.gold, fontSize: 10, fontWeight: '700' },
  detail: { color: colors.muted, fontSize: 13 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioOn: { borderColor: colors.gold, backgroundColor: colors.gold },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 16,
    backgroundColor: colors.white,
    marginTop: 4,
  },
  addText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  secure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  secureText: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
});
}
