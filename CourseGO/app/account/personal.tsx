import { AccountScreen, InfoRow } from '@/components/AccountScreen';
import { PillButton } from '@/components/ui';
import { toastApiError } from '@/components/ToastHost';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { patchStaffStores } from '@/lib/api/ops';
import { showToast } from '@/lib/toastBus';
import { AFFILIATE_STORES, staffJobLabel } from '@/lib/staffLabels';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function PersonalInfoScreen() {
  const { staff, applyStaff } = useStaffAuth();
  const p = staff?.profile;
  const initial = useMemo(
    () => (p?.storeIds?.length ? p.storeIds : staff?.storeId ? [staff.storeId] : []),
    [p?.storeIds, staff?.storeId],
  );
  const [storeIds, setStoreIds] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const home = [p?.residenceLine, p?.residenceCity].filter(Boolean).join(', ');
  const dirty =
    [...storeIds].sort().join(',') !== [...initial].sort().join(',');

  const toggle = (id: string) => {
    setStoreIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          showToast({ title: 'Magasins', body: 'Gardez au moins un Super U affilié.', tone: 'error' });
          return prev;
        }
        return prev.filter((s) => s !== id);
      }
      return [...prev, id];
    });
  };

  const save = async () => {
    if (!storeIds.length) {
      showToast({ title: 'Magasins', body: 'Choisissez au moins un Super U.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const res = await patchStaffStores(storeIds);
      applyStaff(res.staff);
      const next = res.staff.profile?.storeIds?.length
        ? res.staff.profile.storeIds
        : res.staff.storeId
          ? [res.staff.storeId]
          : storeIds;
      setStoreIds(next);
      showToast({ title: 'Magasins affiliés', body: 'Vos Super U ont été mis à jour.', tone: 'success' });
    } catch (e) {
      toastApiError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountScreen title="Infos personnelles">
      <InfoRow icon="user" label="Nom" value={`${staff?.firstName ?? ''} ${staff?.lastName ?? ''}`.trim() || '—'} />
      <InfoRow icon="briefcase" label="Métier" value={staffJobLabel(staff)} />
      <InfoRow icon="mail" label="E-mail" value={staff?.email || '—'} />
      <InfoRow icon="phone" label="Téléphone" value={staff?.phone || '—'} />
      <InfoRow icon="credit-card" label="Pièce d’identité" value={p?.idNumber?.trim() || '—'} />
      <InfoRow icon="home" label="Résidence" value={home || '—'} />

      <Text style={styles.section}>Magasins affiliés</Text>
      <Text style={styles.hint}>
        Cochez les Super U dont vous voyez les courses. Vous ne prenez des colis que dans un magasin à la fois.
      </Text>
      {AFFILIATE_STORES.map((s) => {
        const on = storeIds.includes(s.id);
        return (
          <Pressable key={s.id} style={[styles.card, on && styles.cardOn]} onPress={() => toggle(s.id)}>
            <Text style={[styles.cardTitle, on && styles.cardTitleOn]}>{s.name}</Text>
            <Text style={styles.cardState}>{on ? 'Affilié' : 'Ajouter'}</Text>
          </Pressable>
        );
      })}
      <PillButton
        label={busy ? '…' : 'ENREGISTRER LES MAGASINS'}
        onPress={() => void save()}
        disabled={busy || !dirty}
      />
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    ...displayFont('800'),
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 8,
  },
  hint: { ...bodyFont('400'), fontSize: 13, color: colors.muted, lineHeight: 20, marginTop: -4 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardOn: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  cardTitle: { ...displayFont('800'), fontSize: 16, color: colors.text, flex: 1 },
  cardTitleOn: { color: colors.teal },
  cardState: { ...bodyFont('700'), fontSize: 12, color: colors.muted },
});
