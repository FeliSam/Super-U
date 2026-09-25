import { AccountScreen } from '@/components/AccountScreen';
import { PillButton } from '@/components/ui';
import { toastApiError } from '@/components/ToastHost';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { patchStaffStores } from '@/lib/api/ops';
import { showToast } from '@/lib/toastBus';
import { AFFILIATE_STORES } from '@/lib/staffLabels';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function AffiliatedStoresScreen() {
  const { staff, applyStaff } = useStaffAuth();
  const p = staff?.profile;
  const initial = useMemo(
    () => (p?.storeIds?.length ? p.storeIds : staff?.storeId ? [staff.storeId] : []),
    [p?.storeIds, staff?.storeId],
  );
  const [storeIds, setStoreIds] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = [...storeIds].sort().join(',') !== [...initial].sort().join(',');

  useEffect(() => {
    setStoreIds(initial);
  }, [initial]);

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
    <AccountScreen title="Magasins affiliés">
      <Text style={styles.hint}>
        Cochez les Super U dont vous voyez les courses. Vous ne prenez des colis que dans un magasin à
        la fois.
      </Text>
      {AFFILIATE_STORES.map((s) => {
        const on = storeIds.includes(s.id);
        return (
          <Pressable key={s.id} style={[styles.card, on && styles.cardOn]} onPress={() => toggle(s.id)}>
            <View style={[styles.check, on && styles.checkOn]}>
              {on ? <Feather name="check" size={16} color={colors.white} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, on && styles.cardTitleOn]}>{s.name}</Text>
              <Text style={styles.meta}>{s.address}</Text>
              <Text style={styles.metaMuted}>
                {s.city} · {s.hours}
              </Text>
            </View>
            <Text style={[styles.cardState, on && styles.cardStateOn]}>{on ? 'Affilié' : 'Ajouter'}</Text>
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
  hint: { ...bodyFont('400'), fontSize: 14, color: colors.muted, lineHeight: 21, marginBottom: 4 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardOn: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  check: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  cardTitle: { ...displayFont('800'), fontSize: 16, color: colors.text },
  cardTitleOn: { color: colors.teal },
  meta: { ...bodyFont('500'), fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 18 },
  metaMuted: { ...bodyFont('400'), fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  cardState: { ...bodyFont('700'), fontSize: 12, color: colors.muted, marginTop: 4 },
  cardStateOn: { color: colors.teal },
});
