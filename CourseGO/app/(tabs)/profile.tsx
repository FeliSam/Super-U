import { PillButton, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useTabContentPadding } from '@/hooks/useTabContentPadding';
import { patchStaffPhoto } from '@/lib/api/ops';
import { pickStaffPhoto, staffPhotoSource } from '@/lib/staffPhoto';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const MENU: { icon: ComponentProps<typeof Feather>['name']; label: string; href: string }[] = [
  { icon: 'truck', label: 'Mon véhicule', href: '/account/vehicle' },
  { icon: 'file-text', label: 'Mes documents', href: '/account/documents' },
  { icon: 'bell', label: 'Notifications', href: '/notifications' },
  { icon: 'settings', label: 'Paramètres', href: '/settings' },
  { icon: 'lock', label: 'Sécurité', href: '/account/security' },
  { icon: 'help-circle', label: 'Support & Aide', href: '/account/support' },
  { icon: 'info', label: 'À propos', href: '/account/about' },
];

export default function ProfileScreen() {
  const { staff, signOut, applyStaff } = useStaffAuth();
  const pad = useTabContentPadding();
  const name = `${staff?.firstName ?? ''} ${staff?.lastName ?? ''}`.trim();
  const [photoBust, setPhotoBust] = useState(0);

  const changePhoto = async () => {
    const dataUrl = await pickStaffPhoto();
    if (!dataUrl) return;
    try {
      const res = await patchStaffPhoto(dataUrl);
      applyStaff(res.staff);
      setPhotoBust(Date.now());
    } catch {
      /* ignore */
    }
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: pad }]}>
        <View style={styles.header}>
          <Pressable onPress={() => void changePhoto()} accessibilityLabel="Changer la photo">
            <Image source={staffPhotoSource(staff?.photoUrl, photoBust)} style={styles.avatar} />
            <Text style={styles.photoHint}>Changer la photo</Text>
          </Pressable>
          <Text style={styles.name}>{name || 'Coursier'}</Text>
          <View style={styles.meta}>
            <View style={styles.star}>
              <Feather name="star" size={14} color={colors.teal} />
              <Text style={styles.starTxt}>4.8</Text>
            </View>
            <View style={styles.verif}>
              <Text style={styles.verifTxt}>VÉRIFIÉ</Text>
            </View>
          </View>
          <Text style={styles.sub}>
            {staff?.email} · {staff?.vehicle ?? 'moto'} · {staff?.storeId ?? 'magasin'}
          </Text>
        </View>
        <View style={styles.menu}>
          {MENU.map((item) => (
            <Pressable key={item.label} style={styles.item} onPress={() => router.push(item.href as never)}>
              <View style={styles.itemLeft}>
                <View style={styles.itemIcon}>
                  <Feather name={item.icon} size={18} color={colors.teal} />
                </View>
                <Text style={styles.itemLabel}>{item.label}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.placeholder} />
            </Pressable>
          ))}
        </View>
        <PillButton label="Se déconnecter" variant="danger" onPress={() => void signOut()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  header: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    backgroundColor: colors.white,
    ...shadow.card,
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  photoHint: { ...bodyFont('600'), fontSize: 12, color: colors.teal, textAlign: 'center', marginTop: 8 },
  name: { ...displayFont('800'), fontSize: 20 },
  meta: { flexDirection: 'row', gap: 12 },
  star: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  starTxt: { ...bodyFont('700'), fontSize: 12 },
  verif: { backgroundColor: colors.tealSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  verifTxt: { ...bodyFont('700'), fontSize: 12, color: colors.teal },
  sub: { ...bodyFont('400'), fontSize: 13, color: colors.muted, textAlign: 'center' },
  menu: {
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.white,
    ...shadow.card,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f6f9',
  },
  itemLeft: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { ...bodyFont('600'), fontSize: 15 },
});
