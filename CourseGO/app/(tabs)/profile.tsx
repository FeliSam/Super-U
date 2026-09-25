import { ConfirmModal } from '@/components/ConfirmModal';
import { PillButton, Screen } from '@/components/ui';
import { toastApiError } from '@/components/ToastHost';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useTabContentPadding } from '@/hooks/useTabContentPadding';
import { patchStaffPhoto } from '@/lib/api/ops';
import { staffJobLabel } from '@/lib/staffLabels';
import { pickStaffPhoto, staffPhotoSource } from '@/lib/staffPhoto';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type MenuItem = { icon: ComponentProps<typeof Feather>['name']; label: string; href: string };

const GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Compte',
    items: [
      { icon: 'user', label: 'Infos personnelles', href: '/account/personal' },
      { icon: 'map-pin', label: 'Magasins affiliés', href: '/account/stores' },
      { icon: 'truck', label: 'Mon véhicule', href: '/account/vehicle' },
      { icon: 'file-text', label: 'Mes documents', href: '/account/documents' },
    ],
  },
  {
    title: 'Préférences',
    items: [
      { icon: 'bell', label: 'Notifications', href: '/notifications' },
      { icon: 'settings', label: 'Paramètres', href: '/settings' },
      { icon: 'lock', label: 'Sécurité', href: '/account/security' },
    ],
  },
  {
    title: 'Aide',
    items: [
      { icon: 'help-circle', label: 'Support & Aide', href: '/account/support' },
      { icon: 'info', label: 'À propos', href: '/account/about' },
    ],
  },
];

export default function ProfileScreen() {
  const { staff, signOut, applyStaff } = useStaffAuth();
  const pad = useTabContentPadding();
  const name = `${staff?.firstName ?? ''} ${staff?.lastName ?? ''}`.trim();
  const [photoBust, setPhotoBust] = useState(0);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const ratingCount = staff?.ratingCount ?? 0;
  const rating = ratingCount > 0 ? (staff?.ratingAvg ?? 0).toFixed(1) : '—';

  const changePhoto = async () => {
    const dataUrl = await pickStaffPhoto();
    if (!dataUrl) return;
    try {
      const res = await patchStaffPhoto(dataUrl);
      applyStaff(res.staff);
      setPhotoBust(Date.now());
    } catch (e) {
      toastApiError(e);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: pad }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => void changePhoto()} accessibilityLabel="Changer la photo" style={styles.avatarWrap}>
            <Image source={staffPhotoSource(staff?.photoUrl, photoBust)} style={styles.avatar} />
            <View style={styles.camBadge}>
              <Feather name="camera" size={12} color={colors.white} />
            </View>
          </Pressable>
          <Text style={styles.name}>{name || 'Coursier'}</Text>
          <View style={styles.jobPill}>
            <Text style={styles.jobTxt}>{staffJobLabel(staff)}</Text>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Feather name="star" size={13} color={colors.amber} />
              <Text style={styles.statVal}>{rating}</Text>
            </View>
            <View style={styles.statDot} />
            <Text style={styles.statHint}>
              {ratingCount > 0 ? `${ratingCount} avis client${ratingCount > 1 ? 's' : ''}` : 'Pas encore d’avis'}
            </Text>
            <View style={styles.verif}>
              <Feather name="check" size={11} color={colors.teal} />
              <Text style={styles.verifTxt}>Vérifié</Text>
            </View>
          </View>
        </View>

        {GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.menu}>
              {group.items.map((item, i) => (
                <Pressable
                  key={item.label}
                  style={[styles.item, i === group.items.length - 1 && styles.itemLast]}
                  onPress={() => router.push(item.href as never)}>
                  <View style={styles.itemLeft}>
                    <View style={styles.itemIcon}>
                      <Feather name={item.icon} size={17} color={colors.teal} />
                    </View>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.placeholder} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.logoutWrap}>
          <PillButton label="Se déconnecter" variant="danger" onPress={() => setLogoutOpen(true)} />
        </View>
      </ScrollView>
      <ConfirmModal
        visible={logoutOpen}
        icon="log-out"
        danger
        title="Se déconnecter ?"
        body="Vous quittez CourseGo sur cet appareil. Les courses en cours restent au magasin."
        cancelLabel="Rester"
        confirmLabel="Se déconnecter"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          void signOut();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 18 },
  header: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
    gap: 10,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  avatarWrap: { position: 'relative', marginBottom: 2 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.tealSoft,
  },
  camBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  name: { ...displayFont('800'), fontSize: 22, color: colors.text, letterSpacing: -0.3 },
  jobPill: {
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  jobTxt: { ...displayFont('700'), fontSize: 12, color: colors.teal },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: { ...bodyFont('700'), fontSize: 12, color: colors.text },
  statDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.placeholder },
  statHint: { ...bodyFont('500'), fontSize: 12, color: colors.muted },
  verif: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  verifTxt: { ...bodyFont('700'), fontSize: 11, color: colors.teal },
  group: { gap: 8 },
  groupTitle: {
    ...displayFont('800'),
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    paddingLeft: 4,
  },
  menu: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLast: { borderBottomWidth: 0 },
  itemLeft: { flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { ...bodyFont('600'), fontSize: 15, color: colors.text },
  logoutWrap: { marginTop: 4 },
});
