import { IconCircle, Screen, Page } from '@/components/ui';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors, useTheme, type ThemePreference } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

type FeatherIcon = ComponentProps<typeof Feather>['name'];

type ToggleRow = {
  icon: FeatherIcon;
  label: string;
  subtitle?: string;
  value: boolean;
  onToggle: (next: boolean) => void;
};

const THEME_OPTIONS: {
  id: ThemePreference;
  icon: FeatherIcon;
  label: string;
  subtitle: string;
}[] = [
  { id: 'light', icon: 'sun', label: 'Mode clair', subtitle: 'Toujours l’apparence jour' },
  { id: 'dark', icon: 'moon', label: 'Mode sombre', subtitle: 'Toujours l’apparence nuit' },
  { id: 'system', icon: 'smartphone', label: 'Système', subtitle: 'Suit les réglages de l’appareil' },
];

function SettingToggle({
  item,
  colors,
  styles,
}: {
  item: ToggleRow;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.icon}>
          <Feather name={item.icon} size={18} color={colors.gold} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          {item.subtitle ? <Text style={styles.rowSub}>{item.subtitle}</Text> : null}
        </View>
      </View>
      <Switch
        value={item.value}
        onValueChange={item.onToggle}
        trackColor={{ false: colors.border, true: colors.gold }}
        thumbColor={colors.white === '#ffffff' ? '#ffffff' : '#f6f1ea'}
      />
    </View>
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
    content: { padding: 20, gap: 22, paddingBottom: 40 },
    section: { gap: 8 },
    sectionTitle: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    sectionHint: { color: colors.placeholder, fontSize: 13, marginBottom: 2 },
    card: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 12,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 12,
    },
    optionActive: { backgroundColor: colors.cream },
    rowPressed: { backgroundColor: colors.bg },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    rowText: { flex: 1, gap: 2 },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconActive: { backgroundColor: colors.gold },
    rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
    rowSub: { color: colors.muted, fontSize: 12 },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 66 },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.cream,
      borderRadius: 14,
      padding: 14,
    },
    noteText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 18 },
  });
}

export default function SettingsScreen() {
  const colors = useColors();
  const { preference, setPreference, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [promoEnabled, setPromoEnabled] = useState(true);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');

  const notificationToggles: ToggleRow[] = [
    {
      icon: 'smartphone',
      label: 'Notifications push',
      subtitle: 'Alertes de livraison et commandes',
      value: pushEnabled,
      onToggle: setPushEnabled,
    },
    {
      icon: 'message-circle',
      label: 'Offres par SMS',
      subtitle: 'Promos et rappels sur votre mobile',
      value: smsEnabled,
      onToggle: setSmsEnabled,
    },
    {
      icon: 'mail',
      label: 'Newsletter',
      subtitle: 'Actualités et recettes par e-mail',
      value: emailEnabled,
      onToggle: setEmailEnabled,
    },
    {
      icon: 'tag',
      label: 'Offres personnalisées',
      subtitle: 'Suggestions selon vos achats',
      value: promoEnabled,
      onToggle: setPromoEnabled,
    },
  ];

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.back()} />
          <Text style={styles.title}>Réglages</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Apparence</Text>
            <Text style={styles.sectionHint}>
              Thème actuel : {scheme === 'dark' ? 'sombre' : 'clair'}
              {preference === 'system' ? ' (système)' : ''}.
            </Text>
            <View style={styles.card}>
              {THEME_OPTIONS.map((option, index) => {
                const active = preference === option.id;
                return (
                  <View key={option.id}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.option,
                        active && styles.optionActive,
                        pressed && styles.rowPressed,
                      ]}
                      onPress={() => setPreference(option.id)}>
                      <View style={styles.rowLeft}>
                        <View style={[styles.icon, active && styles.iconActive]}>
                          <Feather name={option.icon} size={18} color={active ? '#fff' : colors.gold} />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={styles.rowLabel}>{option.label}</Text>
                          <Text style={styles.rowSub}>{option.subtitle}</Text>
                        </View>
                      </View>
                      {active ? (
                        <Feather name="check-circle" size={20} color={colors.gold} />
                      ) : (
                        <View style={styles.radio} />
                      )}
                    </Pressable>
                    {index < THEME_OPTIONS.length - 1 ? <View style={styles.separator} /> : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <Text style={styles.sectionHint}>Choisissez comment Marché Doré vous contacte.</Text>
            <View style={styles.card}>
              {notificationToggles.map((item, index) => (
                <View key={item.label}>
                  <SettingToggle item={item} colors={colors} styles={styles} />
                  {index < notificationToggles.length - 1 ? <View style={styles.separator} /> : null}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Langue</Text>
            <View style={styles.card}>
              <Pressable
                style={({ pressed }) => [
                  styles.option,
                  language === 'fr' && styles.optionActive,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => setLanguage('fr')}>
                <View style={styles.rowLeft}>
                  <View style={[styles.icon, language === 'fr' && styles.iconActive]}>
                    <Feather name="globe" size={18} color={language === 'fr' ? '#fff' : colors.gold} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>Français</Text>
                    <Text style={styles.rowSub}>Langue par défaut</Text>
                  </View>
                </View>
                {language === 'fr' ? (
                  <Feather name="check-circle" size={20} color={colors.gold} />
                ) : (
                  <View style={styles.radio} />
                )}
              </Pressable>
              <View style={styles.separator} />
              <Pressable
                style={({ pressed }) => [
                  styles.option,
                  language === 'en' && styles.optionActive,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => setLanguage('en')}>
                <View style={styles.rowLeft}>
                  <View style={[styles.icon, language === 'en' && styles.iconActive]}>
                    <Feather name="globe" size={18} color={language === 'en' ? '#fff' : colors.gold} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>English</Text>
                    <Text style={styles.rowSub}>Coming soon</Text>
                  </View>
                </View>
                {language === 'en' ? (
                  <Feather name="check-circle" size={20} color={colors.gold} />
                ) : (
                  <View style={styles.radio} />
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compte & confidentialité</Text>
            <View style={styles.card}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push('/account/personal-info')}>
                <View style={styles.rowLeft}>
                  <View style={styles.icon}>
                    <Feather name="user" size={18} color={colors.gold} />
                  </View>
                  <Text style={styles.rowLabel}>Informations personnelles</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.placeholder} />
              </Pressable>
              <View style={styles.separator} />
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push('/legal')}>
                <View style={styles.rowLeft}>
                  <View style={styles.icon}>
                    <Feather name="shield" size={18} color={colors.gold} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>Confidentialité</Text>
                    <Text style={styles.rowSub}>Données et consentements</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.placeholder} />
              </Pressable>
            </View>
          </View>

          <View style={styles.note}>
            <Feather name="info" size={16} color={colors.muted} />
            <Text style={styles.noteText}>
              Le thème est enregistré sur cet appareil. Clair, sombre ou système — le fond de l’app et la
              navigation suivent votre choix immédiatement.
            </Text>
          </View>
        </ScrollView>
      </Page>
    </Screen>
  );
}
