import { IconCircle, Screen, Page } from '@/components/ui';
import { colors } from '@/constants/theme';
import { avatar } from '@/data/catalog';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const steps = [
  { label: 'Commande confirmée', time: '10:23', state: 'done' as const },
  { label: 'Préparation en cours', time: '11:45', state: 'active' as const },
  { label: 'En route', time: '', state: 'pending' as const },
  { label: 'Livrée', time: '', state: 'pending' as const },
];

export default function TrackingScreen() {
  return (
    <Screen>
      <Page style={{ flex: 1 }}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>Suivi de commande</Text>
            <Text style={styles.sub}>N° #MD-2024-0847</Text>
          </View>
          <IconCircle name="more-vertical" />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.map}>
            <View style={styles.road} />
            <View style={[styles.marker, { left: 80, top: 90, backgroundColor: colors.gold }]}>
              <Feather name="home" size={14} color={colors.white} />
            </View>
            <View style={[styles.marker, { left: 150, top: 45, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.terracotta }]}>
              <Feather name="navigation" size={16} color={colors.white} />
            </View>
            <View style={[styles.marker, { left: 240, top: 15, backgroundColor: colors.green }]}>
              <Feather name="map-pin" size={14} color={colors.white} />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View>
                <Text style={styles.meta}>Livraison estimée</Text>
                <Text style={styles.eta}>Aujourd'hui, 14h - 16h</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>En préparation</Text>
              </View>
            </View>
            <View style={styles.hr} />
            <View style={styles.current}>
              <View style={styles.pulse} />
              <Text style={styles.currentText}>Votre livreur va bientôt récupérer votre panier de fruits frais.</Text>
            </View>
          </View>

          <Text style={styles.h}>Étapes de livraison</Text>
          {steps.map((step, i) => (
            <View key={step.label} style={styles.step}>
              <View style={styles.col}>
                <View
                  style={[
                    styles.node,
                    step.state === 'done' && styles.nodeDone,
                    step.state === 'active' && styles.nodeActive,
                  ]}
                />
                {i < steps.length - 1 ? <View style={styles.vline} /> : null}
              </View>
              <Text style={[styles.stepLabel, step.state === 'pending' && { color: colors.placeholder }]}>
                {step.label}
              </Text>
              <Text style={styles.time}>{step.time}</Text>
            </View>
          ))}

          <View style={styles.courier}>
            <Image source={avatar} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Moussa Ndiaye</Text>
              <Text style={styles.meta}>Votre livreur Marché Doré</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconCircle name="message-circle" />
              <IconCircle name="phone" />
            </View>
          </View>

          <Pressable style={styles.details} onPress={() => navigateTab(tabPaths.cart)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="shopping-bag" size={18} color={colors.gold} />
              <Text style={styles.detailsLeft}>Détails de commande</Text>
            </View>
            <Text style={styles.detailsRight}>4 articles · 12 900 FCFA</Text>
          </Pressable>
          <View style={styles.help}>
            <Feather name="help-circle" size={14} color={colors.muted} />
            <Text style={styles.helpText}>Besoin d'aide ? Contacter le support</Text>
          </View>
        </ScrollView>
      </Page>
    </Screen>
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
  sub: { color: colors.muted, fontSize: 12 },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  map: {
    height: 160,
    borderRadius: 20,
    backgroundColor: '#e8efe4',
    overflow: 'hidden',
  },
  road: {
    position: 'absolute',
    left: 20,
    top: 40,
    width: 280,
    height: 16,
    backgroundColor: '#d4d0c8',
    transform: [{ rotate: '-18deg' }],
  },
  marker: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { color: colors.muted, fontSize: 13 },
  eta: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 4 },
  tag: { backgroundColor: colors.cream, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { color: colors.gold, fontWeight: '600', fontSize: 12 },
  hr: { height: 1, backgroundColor: colors.border },
  current: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  currentText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 18 },
  h: { color: colors.text, fontSize: 16, fontWeight: '700' },
  step: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 54 },
  col: { width: 24, alignItems: 'center' },
  node: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.border, marginTop: 4 },
  nodeDone: { backgroundColor: colors.gold },
  nodeActive: { backgroundColor: colors.terracotta, width: 14, height: 14 },
  vline: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  stepLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600', paddingTop: 3 },
  time: { color: colors.muted, fontSize: 12, paddingTop: 4 },
  courier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  name: { color: colors.text, fontWeight: '600', fontSize: 15 },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  detailsLeft: { color: colors.text, fontWeight: '600' },
  detailsRight: { color: colors.muted, fontSize: 13 },
  help: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  helpText: { color: colors.muted, fontSize: 13 },
});
