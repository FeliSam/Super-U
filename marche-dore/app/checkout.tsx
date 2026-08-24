import { CtaButton, IconCircle, Screen, Page } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { formatFcfa } from '@/lib/format';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const dates = ["Aujourd'hui", 'Demain', 'Mer 25'];
const hours = ['10h-12h', '14h-16h', '16h-18h'];
const payments = ['Orange Money', 'Wave', 'Carte bancaire', 'Paiement à la livraison'];

export default function CheckoutScreen() {
  const { subtotal, delivery, discount, total } = useCart();
  const [date, setDate] = useState(dates[1]);
  const [hour, setHour] = useState(hours[1]);
  const [pay, setPay] = useState(payments[0]);

  return (
    <Screen>
      <Page style={{ flex: 1 }}>
        <View style={styles.header}>
          <IconCircle name="arrow-left" onPress={() => router.back()} />
          <Text style={styles.title}>Finaliser la commande</Text>
          <IconCircle name="more-horizontal" />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.h}>Adresse de livraison</Text>
          <View style={styles.card}>
            <View style={styles.pin}>
              <Feather name="map-pin" size={20} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Amina Diallo</Text>
              <Text style={styles.meta}>Rue 23, Dakar Plateau</Text>
              <Text style={styles.meta}>+221 77 123 45 67</Text>
            </View>
            <IconCircle name="edit" />
          </View>

          <Text style={styles.h}>Créneau de livraison</Text>
          <View style={styles.pills}>
            {dates.map((d) => (
              <Pressable key={d} style={[styles.pill, date === d && styles.pillOn]} onPress={() => setDate(d)}>
                <Text style={[styles.pillText, date === d && styles.pillTextOn]}>{d}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.pills}>
            {hours.map((h) => (
              <Pressable key={h} style={[styles.pill, hour === h && styles.pillOn]} onPress={() => setHour(h)}>
                <Text style={[styles.pillText, hour === h && styles.pillTextOn]}>{h}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.h}>Moyen de paiement</Text>
          {payments.map((p) => (
            <Pressable key={p} style={[styles.pay, pay === p && styles.payOn]} onPress={() => setPay(p)}>
              <Text style={styles.payText}>{p}</Text>
              <View style={[styles.radio, pay === p && styles.radioOn]} />
            </Pressable>
          ))}

          <View style={styles.summary}>
            <Sum label="Sous-total" value={formatFcfa(subtotal)} />
            <Sum label="Livraison" value={formatFcfa(delivery)} />
            {discount > 0 ? <Sum label="Réduction" value={`−${formatFcfa(discount)}`} green /> : null}
            <View style={styles.hr} />
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.total}>{formatFcfa(total)}</Text>
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <CtaButton
            label={`Confirmer et payer — ${formatFcfa(total)}`}
            onPress={() => router.push('/tracking')}
          />
        </View>
      </Page>
    </Screen>
  );
}

function Sum({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumVal, green && { color: colors.green }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 14, paddingBottom: 24 },
  h: { color: colors.text, fontSize: 15, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.text, fontWeight: '600', fontSize: 15 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    height: 37,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  pillText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  pillTextOn: { color: colors.white },
  pay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 14,
  },
  payOn: { borderColor: colors.gold },
  payText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioOn: { borderColor: colors.gold, backgroundColor: colors.gold },
  summary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  sumLabel: { color: colors.muted, fontSize: 14 },
  sumVal: { color: colors.text, fontWeight: '600' },
  hr: { height: 1, backgroundColor: colors.border },
  totalLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  total: { color: colors.terracotta, fontSize: 18, fontWeight: '800' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
});
