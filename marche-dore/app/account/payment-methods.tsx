import { MobileModalFrame } from '@/components/MobileModalFrame';
import { CtaButton, IconCircle, Screen, Page } from '@/components/ui';
import { goBack } from '@/lib/navigation';
import { displayFont, type AppColors, spacing } from '@/constants/theme';
import { useCheckoutPayment, type PaymentId } from '@/context/CheckoutPaymentContext';
import { usePayments, type WalletMethod } from '@/context/PaymentsContext';
import { useColors } from '@/context/ThemeContext';
import {
  formatBeninPhone,
  formatBeninPhoneInput,
  isValidBeninPhone,
  maskBeninPhone } from '@/lib/beninPhone';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View } from 'react-native';

function PaymentCard({
  method,
  selected,
  onSelect,
  onEdit }: {
  method: WalletMethod;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const needsNumber = (method.id === 'om' || method.id === 'wave') && !method.ready;

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
        <Text style={styles.detail}>
          {needsNumber ? 'Ajouter un numéro +229…' : method.detail}
        </Text>
      </View>
      {(method.id === 'om' || method.id === 'wave') && onEdit ? (
        <Pressable
          hitSlop={10}
          onPress={(e) => {
            e.stopPropagation?.();
            onEdit();
          }}
          style={styles.editBtn}>
          <Feather name={needsNumber ? 'plus' : 'edit-2'} size={16} color={colors.gold} />
        </Pressable>
      ) : null}
      <View style={[styles.radio, selected && styles.radioOn]} />
    </Pressable>
  );
}

export default function PaymentMethodsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { methods, setDefault, saveMobileNumber, defaultMethod } = usePayments();
  const { setSetup } = useCheckoutPayment();

  const [selectedId, setSelectedId] = useState(defaultMethod?.id ?? 'om');
  const [editId, setEditId] = useState<'om' | 'wave' | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('+229 ');

  const openEdit = (id: 'om' | 'wave') => {
    const existing = methods.find((m) => m.id === id);
    setPhoneDraft(
      existing?.phone ? formatBeninPhoneInput(existing.phone) : '+229 ',
    );
    setEditId(id);
  };

  const savePhone = () => {
    if (!editId) return;
    const res = saveMobileNumber(editId, phoneDraft);
    if (!res.ok) {
      Alert.alert('Numéro invalide', res.error);
      return;
    }
    const formatted = formatBeninPhone(phoneDraft);
    setSetup({
      methodId: editId,
      label: editId === 'om' ? 'Orange Money' : 'MTN MoMo',
      detail: maskBeninPhone(phoneDraft),
      phone: formatted,
      ready: true });
    setSelectedId(editId);
    setEditId(null);
  };

  const saveDefault = () => {
    setDefault(selectedId);
    const method = methods.find((m) => m.id === selectedId);
    if (method?.ready || method?.id === 'cod') {
      setSetup({
        methodId: selectedId as PaymentId,
        label: method.type,
        detail: method.detail,
        phone: method.phone,
        cardLast4: method.cardLast4,
        ready: true });
    }
    goBack();
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => goBack()} />
          <Text style={styles.title}>Moyens de paiement</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>
            Ajoutez vos numéros Mobile Money béninois (+229). Ils seront proposés au paiement de
            vos commandes.
          </Text>

          {methods.map((method) => (
            <PaymentCard
              key={method.id}
              method={method}
              selected={selectedId === method.id}
              onSelect={() => setSelectedId(method.id)}
              onEdit={
                method.id === 'om' || method.id === 'wave'
                  ? () => openEdit(method.id as 'om' | 'wave')
                  : undefined
              }
            />
          ))}

          <Pressable
            style={styles.addCard}
            onPress={() => {
              const missing = (['om', 'wave'] as const).find(
                (id) => !methods.find((m) => m.id === id)?.ready,
              );
              openEdit(missing ?? 'om');
            }}>
            <Feather name="plus" size={18} color={colors.gold} />
            <Text style={styles.addText}>Ajouter / modifier un numéro +229</Text>
          </Pressable>

          <View style={styles.secure}>
            <Feather name="lock" size={16} color={colors.green} />
            <Text style={styles.secureText}>Format Bénin · +229 01 00 00 00 00</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <CtaButton label="Enregistrer le moyen de paiement" onPress={saveDefault} />
        </View>
      </Page>

      <Modal visible={Boolean(editId)} transparent animationType="slide" onRequestClose={() => setEditId(null)}>
        <MobileModalFrame onDismiss={() => setEditId(null)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <Text style={styles.modalTitle}>
              {editId === 'wave' ? 'MTN MoMo' : 'Orange Money'}
            </Text>
            <Text style={styles.modalSub}>Numéro béninois au format +229 01 00 00 00 00</Text>
            <TextInput
              value={phoneDraft}
              onChangeText={(t) => setPhoneDraft(formatBeninPhoneInput(t))}
              keyboardType="phone-pad"
              placeholder="+229 01 00 00 00 00"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.phoneInput,
                {
                  backgroundColor: colors.white,
                  borderColor: isValidBeninPhone(phoneDraft) ? colors.green : colors.border,
                  color: colors.text },
              ]}
              autoFocus
            />
            <CtaButton label="Enregistrer le numéro" onPress={savePhone} />
            <Pressable onPress={() => setEditId(null)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
          </View>
        </MobileModalFrame>
      </Modal>
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
      paddingHorizontal: spacing.screen,
      paddingVertical: 12 },
    headerSpacer: { width: 40 },
    title: { color: colors.text, fontSize: 17, ...displayFont('700') },
    content: { padding: 20, gap: 10, paddingBottom: 24 },
    sub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 6 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 14 },
    cardSelected: { borderColor: colors.gold, backgroundColor: colors.selectSoft },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center' },
    body: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    type: { color: colors.text, fontSize: 15, fontWeight: '700' },
    defaultBadge: {
      backgroundColor: colors.cream,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3 },
    defaultText: { color: colors.gold, fontSize: 10, fontWeight: '700' },
    detail: { color: colors.muted, fontSize: 13 },
    editBtn: { padding: 6 },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10 },
    radioOn: { borderColor: colors.gold, backgroundColor: colors.gold },
    addCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderStyle: 'dashed',
      borderRadius: 16,
      paddingVertical: 16,
      backgroundColor: colors.white,
      marginTop: 4 },
    addText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
    secure: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8 },
    secureText: { color: colors.muted, fontSize: 12, fontWeight: '500' },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.white },
    modalSheet: {
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: 20,
      gap: 12,
      paddingBottom: 28 },
    modalTitle: { ...displayFont('700'), color: colors.text, fontSize: 18 },
    modalSub: { color: colors.muted, fontSize: 13, marginBottom: 4 },
    phoneInput: {
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 17,
      fontWeight: '600',
      letterSpacing: 0.3 },
    modalCancel: { alignItems: 'center', paddingVertical: 8 },
    modalCancelText: { color: colors.muted, fontWeight: '700' } });
}
