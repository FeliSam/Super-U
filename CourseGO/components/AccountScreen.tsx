import { IconBtn, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export function AccountScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen>
      <View style={styles.nav}>
        <IconBtn name="chevron-left" bg={colors.white} onPress={() => router.back()} />
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
    </Screen>
  );
}

export function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Feather name={icon} size={18} color={colors.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  title: { ...displayFont('800'), fontSize: 18 },
  body: { padding: 24, gap: 12, paddingBottom: 48 },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...bodyFont('500'), fontSize: 12, color: colors.muted },
  value: { ...displayFont('700'), fontSize: 16, color: colors.text, marginTop: 2 },
});
