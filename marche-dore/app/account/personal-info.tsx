import { BirthDateField } from '@/components/BirthDateField';
import { goBack } from '@/lib/navigation';
import { PressScale } from '@/components/motion';
import { CtaButton, IconCircle, Screen, Page } from '@/components/ui';
import { displayFont, type AppColors } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import { useColors } from '@/context/ThemeContext';
import { formatBeninPhoneInput } from '@/lib/beninPhone';
import { pickProfilePhoto, profilePhotoSource } from '@/lib/profilePhoto';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words';
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

export default function PersonalInfoScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile, setProfile, updateProfile } = useProfile();
  const [form, setForm] = useState(profile);

  useEffect(() => {
    setForm(profile);
  }, [profile]);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = () => {
    setProfile(form);
    goBack();
  };

  const changePhoto = async () => {
    const uri = await pickProfilePhoto();
    if (!uri) return;
    setForm((prev) => ({ ...prev, photoUri: uri }));
    updateProfile({ photoUri: uri });
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => goBack()} />
          <Text style={styles.title}>Informations personnelles</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarSection}>
            <Image source={profilePhotoSource(form.photoUri)} style={styles.avatar} />
            <PressScale
              onPress={() => void changePhoto()}
              scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel="Changer la photo de profil">
              <View style={styles.changePhoto}>
                <Feather name="camera" size={14} color={colors.gold} />
                <Text style={styles.changePhotoText}>Changer la photo</Text>
              </View>
            </PressScale>
          </View>

          <View style={styles.card}>
            <Field label="Prénom" value={form.firstName} onChangeText={update('firstName')} autoCapitalize="words" />
            <Field label="Nom" value={form.lastName} onChangeText={update('lastName')} autoCapitalize="words" />
            <Field
              label="E-mail"
              value={form.email}
              onChangeText={update('email')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Téléphone"
              value={form.phone}
              onChangeText={(t) => update('phone')(formatBeninPhoneInput(t))}
              keyboardType="phone-pad"
            />
            <BirthDateField label="Date de naissance" value={form.birthDate} onChange={update('birthDate')} />
          </View>

          <View style={styles.note}>
            <Feather name="shield" size={16} color={colors.muted} />
            <Text style={styles.noteText}>
              Vos informations sont utilisées pour la livraison et le suivi de vos commandes.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <CtaButton label="Enregistrer les modifications" onPress={save} />
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
    content: { padding: 20, gap: 16, paddingBottom: 24 },
    avatarSection: { alignItems: 'center', gap: 10 },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    changePhoto: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    changePhotoText: { color: colors.gold, fontSize: 14, fontWeight: '600' },
    card: {
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 16,
      gap: 14,
    },
    field: { gap: 6 },
    fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    input: {
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
    },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.cream,
      borderRadius: 14,
      padding: 14,
    },
    noteText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
    footer: {
      padding: 20,
      backgroundColor: colors.white,
    },
  });
}
