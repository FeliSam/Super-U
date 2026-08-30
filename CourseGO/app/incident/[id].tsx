import { ConfirmModal } from '@/components/ConfirmModal';
import { PillButton, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { INCIDENT_REASONS, type IncidentId } from '@/lib/incidents';
import { ApiError } from '@/lib/api/http';
import { setDeliveryStatus } from '@/lib/api/ops';
import { orderIdFromOpsId } from '@/lib/opsModel';
import { rememberLastDropoff } from '@/lib/tourRoute';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function IncidentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const delId = decodeURIComponent(id ?? '');
  const { refresh, deliveries } = useBoard();
  const { staff } = useStaffAuth();
  const [kind, setKind] = useState<IncidentId | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!kind) {
      setError('Choisissez un motif.');
      return;
    }
    setBusy(true);
    setError(null);
    const label = INCIDENT_REASONS.find((r) => r.id === kind)?.title ?? kind;
    const reason = note.trim() ? `${label} — ${note.trim()}` : label;
    try {
      await setDeliveryStatus(delId, 'failed', { reason, reasonCode: kind });
      const row = deliveries.find((x) => x.id === delId || x.order_id === orderIdFromOpsId(delId));
      if (staff?.id && row) rememberLastDropoff(staff.id, row);
      await refresh();
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Retour</Text>
        </Pressable>
        <Text style={styles.navTitle}>Signaler un incident</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sub}>Choisissez la situation. La course quittera vos missions.</Text>
        {INCIDENT_REASONS.map((r) => (
          <Pressable
            key={r.id}
            style={[styles.card, kind === r.id && styles.cardOn]}
            onPress={() => setKind(r.id)}>
            <Text style={styles.cardTitle}>{r.title}</Text>
            <Text style={styles.cardHint}>{r.hint}</Text>
          </Pressable>
        ))}
        <TextInput
          style={styles.input}
          placeholder="Précision (optionnel)"
          placeholderTextColor={colors.placeholder}
          value={note}
          onChangeText={setNote}
          multiline
        />
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <PillButton
          label={busy ? '…' : 'ENVOYER L’INCIDENT'}
          variant="danger"
          onPress={() => void submit()}
          disabled={busy}
        />
      </ScrollView>
      <ConfirmModal
        visible={done}
        title="Incident enregistré"
        body="La course a été clôturée en échec."
        cancelLabel="Fermer"
        onCancel={() => {
          setDone(false);
          router.replace('/(tabs)/missions');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    height: 56,
  },
  back: { ...bodyFont('600'), color: colors.teal },
  navTitle: { ...displayFont('800'), fontSize: 16 },
  body: { padding: 24, gap: 10, paddingBottom: 40 },
  sub: { ...bodyFont('400'), fontSize: 15, color: colors.muted, lineHeight: 22, marginBottom: 8 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardOn: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  cardTitle: { ...displayFont('800'), fontSize: 16, color: colors.text },
  cardHint: { ...bodyFont('400'), fontSize: 13, color: colors.muted, marginTop: 4 },
  input: {
    minHeight: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...bodyFont('500'),
    color: colors.text,
    textAlignVertical: 'top',
  },
  err: { ...bodyFont('600'), color: colors.danger },
});
