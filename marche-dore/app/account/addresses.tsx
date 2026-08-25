import { CtaButton, IconCircle, Screen, Page } from '@/components/ui';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { deliveryAddresses, type DeliveryAddress } from '@/data/account';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function AddressCard({
  address,
  selected,
  onSelect,
}: {
  address: DeliveryAddress;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={[styles.card, selected && styles.cardSelected]} onPress={onSelect}>
      <View style={styles.cardTop}>
        <View style={styles.labelRow}>
          <View style={styles.pin}>
            <Feather name="map-pin" size={16} color={colors.gold} />
          </View>
          <Text style={styles.label}>{address.label}</Text>
          {address.default ? (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Par défaut</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.radio, selected && styles.radioOn]} />
      </View>
      <Text style={styles.line}>{address.line}</Text>
      <Text style={styles.meta}>{address.city}</Text>
      <Text style={styles.meta}>{address.phone}</Text>
      <Pressable style={styles.editBtn} onPress={onSelect}>
        <Feather name="edit-2" size={14} color={colors.gold} />
        <Text style={styles.editText}>Modifier</Text>
      </Pressable>
    </Pressable>
  );
}

export default function AddressesScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedId, setSelectedId] = useState(
    deliveryAddresses.find((a) => a.default)?.id ?? deliveryAddresses[0]?.id,
  );

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <Text style={styles.title}>Adresses de livraison</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>
            Sélectionnez l'adresse utilisée par défaut pour vos prochaines commandes.
          </Text>

          {deliveryAddresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              selected={selectedId === address.id}
              onSelect={() => setSelectedId(address.id)}
            />
          ))}

          <Pressable style={styles.addCard}>
            <Feather name="plus" size={18} color={colors.gold} />
            <Text style={styles.addText}>Ajouter une nouvelle adresse</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <CtaButton label="Enregistrer l'adresse par défaut" onPress={() => router.back()} />
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
  content: { padding: 20, gap: 12, paddingBottom: 24 },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  cardSelected: { borderColor: colors.gold, backgroundColor: '#fffdfb' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  defaultBadge: {
    backgroundColor: colors.cream,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  defaultText: { color: colors.gold, fontSize: 10, fontWeight: '700' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioOn: { borderColor: colors.gold, backgroundColor: colors.gold },
  line: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  meta: { color: colors.muted, fontSize: 13 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  editText: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 18,
    backgroundColor: colors.white,
  },
  addText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
});
}
