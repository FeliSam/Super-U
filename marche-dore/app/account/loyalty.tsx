import { LoyaltyQrCode } from '@/components/LoyaltyQrCode';
import { CtaButton, IconCircle, Page, Screen } from '@/components/ui';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import {
  buildLoyaltyQrPayload,
  loyaltyAccount,
  loyaltyEarnRules,
  loyaltyRewards,
  loyaltyTiers,
} from '@/data/account';
import { formatFcfa } from '@/lib/format';
import { navigateTab, tabPaths } from '@/lib/navigation';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function LoyaltyScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const progress = Math.min(1, loyaltyAccount.points / loyaltyAccount.nextRewardAt);
  const currentTier = loyaltyTiers.find((t) => t.id === loyaltyAccount.tierId) ?? loyaltyTiers[2];
  const nextTier = loyaltyTiers.find((t) => t.minPoints > loyaltyAccount.points);
  const pointsLeft = Math.max(0, loyaltyAccount.nextRewardAt - loyaltyAccount.points);

  const qrValue = useMemo(() => buildLoyaltyQrPayload(loyaltyAccount), []);

  const copyCode = (code: string) => {
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <Text style={styles.title}>Carte de fidélité</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#1c1613', '#3d2f28', '#5a4638']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}>
            <View style={styles.cardOrbA} />
            <View style={styles.cardOrbB} />

            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardBrand}>Marché Doré</Text>
                <Text style={styles.cardTier}>Cliente {currentTier.name}</Text>
                <Text style={styles.cardNumber}>{loyaltyAccount.cardNumber}</Text>
                <Text style={styles.cardClientId}>ID {loyaltyAccount.clientId}</Text>
              </View>
              <Pressable style={styles.qrThumb} onPress={() => setQrOpen(true)}>
                <View style={styles.qrThumbInner}>
                  <LoyaltyQrCode value={qrValue} size={78} />
                </View>
                <Text style={styles.qrThumbLabel}>Scanner</Text>
              </Pressable>
            </View>

            <View style={styles.cardBottom}>
              <View>
                <Text style={styles.cardMetaLabel}>Titulaire</Text>
                <Text style={styles.cardMetaValue}>{loyaltyAccount.memberName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardMetaLabel}>Membre depuis</Text>
                <Text style={styles.cardMetaValue}>{loyaltyAccount.memberSince}</Text>
              </View>
            </View>
          </LinearGradient>

          <Pressable style={styles.qrBanner} onPress={() => setQrOpen(true)}>
            <View style={styles.qrBannerIcon}>
              <Feather name="maximize" size={18} color={colors.gold} />
            </View>
            <View style={styles.qrBannerText}>
              <Text style={styles.qrBannerTitle}>Présenter mon QR code</Text>
              <Text style={styles.qrBannerSub}>Unique à chaque client · {loyaltyAccount.clientId}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.placeholder} />
          </Pressable>

          <View style={styles.pointsCard}>
            <View style={styles.pointsHead}>
              <View>
                <Text style={styles.pointsLabel}>Solde actuel</Text>
                <Text style={styles.pointsValue}>{loyaltyAccount.points} pts</Text>
              </View>
              <View style={styles.savedPill}>
                <Feather name="trending-down" size={12} color={colors.green} />
                <Text style={styles.savedText}>{formatFcfa(loyaltyAccount.lifetimeSaved)} économisés</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              {pointsLeft > 0
                ? `${pointsLeft} pts avant votre prochaine récompense (${loyaltyAccount.nextRewardAt} pts)`
                : 'Récompense débloquée — échangez vos points ci-dessous'}
            </Text>
            {nextTier ? (
              <Text style={styles.nextTier}>
                Niveau suivant : {nextTier.name} à {nextTier.minPoints} pts
              </Text>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Niveaux</Text>
          <View style={styles.tiersRow}>
            {loyaltyTiers.map((tier) => {
              const active = tier.id === currentTier.id;
              const unlocked = loyaltyAccount.points >= tier.minPoints;
              return (
                <View key={tier.id} style={[styles.tier, active && styles.tierActive, !unlocked && styles.tierLocked]}>
                  <Feather
                    name={unlocked ? 'check-circle' : 'circle'}
                    size={14}
                    color={active ? colors.white : unlocked ? colors.gold : colors.placeholder}
                  />
                  <Text style={[styles.tierName, active && styles.tierNameActive]}>{tier.name}</Text>
                  <Text style={[styles.tierPts, active && styles.tierPtsActive]}>{tier.minPoints}+</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Récompenses & réductions</Text>
          {loyaltyRewards.map((reward) => {
            const canRedeem = loyaltyAccount.points >= reward.cost;
            return (
              <View key={reward.id} style={styles.rewardCard}>
                <View style={styles.rewardIcon}>
                  <Feather name="gift" size={18} color={colors.gold} />
                </View>
                <View style={styles.rewardBody}>
                  <Text style={styles.rewardTitle}>{reward.title}</Text>
                  <Text style={styles.rewardSub}>{reward.subtitle}</Text>
                  <Text style={styles.rewardCost}>{reward.cost} pts</Text>
                  {reward.code && canRedeem ? (
                    <Pressable style={styles.codeRow} onPress={() => copyCode(reward.code!)}>
                      <Text style={styles.codeText}>{reward.code}</Text>
                      <Text style={styles.copyText}>
                        {copiedCode === reward.code ? 'Copié' : 'Copier'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  style={[styles.redeemBtn, !canRedeem && styles.redeemBtnOff]}
                  disabled={!canRedeem}
                  onPress={() => {
                    if (reward.code) copyCode(reward.code);
                    navigateTab(tabPaths.cart);
                  }}>
                  <Text style={[styles.redeemText, !canRedeem && styles.redeemTextOff]}>
                    {canRedeem ? 'Utiliser' : 'Bientôt'}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          <Text style={styles.sectionTitle}>Gagner des points</Text>
          <View style={styles.earnCard}>
            {loyaltyEarnRules.map((rule, index) => (
              <View key={rule.title}>
                <View style={styles.earnRow}>
                  <View style={styles.earnIcon}>
                    <Feather name={rule.icon} size={16} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.earnTitle}>{rule.title}</Text>
                    <Text style={styles.earnSub}>{rule.subtitle}</Text>
                  </View>
                </View>
                {index < loyaltyEarnRules.length - 1 ? <View style={styles.separator} /> : null}
              </View>
            ))}
          </View>

          <CtaButton label="Voir les promotions du moment" onPress={() => router.push('/promotions')} />
        </ScrollView>

        <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setQrOpen(false)} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>QR code fidélité</Text>
              <Text style={styles.modalSub}>{loyaltyAccount.memberName}</Text>
              <View style={styles.modalQr}>
                <LoyaltyQrCode value={qrValue} size={210} />
              </View>
              <Text style={styles.modalId}>{loyaltyAccount.clientId}</Text>
              <Text style={styles.modalHint}>
                Présentez ce code en caisse pour cumuler ou utiliser vos points.
              </Text>
              <Pressable style={styles.modalClose} onPress={() => setQrOpen(false)}>
                <Text style={styles.modalCloseText}>Fermer</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  card: {
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
    gap: 18,
  },
  cardOrbA: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(226,147,29,0.18)',
    top: -40,
    right: -20,
  },
  cardOrbB: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -20,
    left: 40,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  cardBrand: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  cardTier: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 2 },
  cardNumber: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 10,
  },
  cardClientId: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  qrThumb: { alignItems: 'center', gap: 6 },
  qrThumbInner: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  qrThumbLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  cardMetaLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '500' },
  cardMetaValue: { color: colors.white, fontSize: 14, fontWeight: '700', marginTop: 2 },
  qrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  qrBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBannerText: { flex: 1, gap: 2 },
  qrBannerTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  qrBannerSub: { color: colors.muted, fontSize: 12 },
  pointsCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  pointsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pointsLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  pointsValue: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 2 },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#edf7ef',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  savedText: { color: colors.green, fontSize: 11, fontWeight: '700' },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.gold },
  progressHint: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  nextTier: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
  tiersRow: { flexDirection: 'row', gap: 8 },
  tier: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 10,
  },
  tierActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tierLocked: { opacity: 0.7 },
  tierName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  tierNameActive: { color: colors.white },
  tierPts: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  tierPtsActive: { color: 'rgba(255,255,255,0.85)' },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  rewardIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardBody: { flex: 1, gap: 2 },
  rewardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rewardSub: { color: colors.muted, fontSize: 12 },
  rewardCost: { color: colors.gold, fontSize: 12, fontWeight: '700', marginTop: 2 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  codeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  copyText: { color: colors.gold, fontSize: 11, fontWeight: '700' },
  redeemBtn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  redeemBtnOff: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  redeemText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  redeemTextOff: { color: colors.placeholder },
  earnCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  earnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  earnIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  earnSub: { color: colors.muted, fontSize: 12, marginTop: 1 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 48 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,22,19,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  modalSub: { color: colors.muted, fontSize: 14, fontWeight: '500', marginTop: -4 },
  modalQr: {
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalId: { color: colors.gold, fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
  modalHint: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  modalClose: {
    marginTop: 6,
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  modalCloseText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
}
