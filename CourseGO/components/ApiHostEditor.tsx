import { bodyFont, colors, displayFont, radius } from '@/constants/theme';
import {
  getApiBaseUrl,
  getSuggestedApiBaseUrl,
  isLoopbackApiUrl,
  persistApiBaseOverride,
  subscribeApiBase,
} from '@/lib/api/apiBase';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

/** Champ pour pointer l’API vers l’IP LAN du PC (téléphone / TestFlight). */
export function ApiHostEditor({ onSaved }: { onSaved?: (url: string) => void }) {
  const [url, setUrl] = useState(() => getApiBaseUrl());
  const [draft, setDraft] = useState(() => getApiBaseUrl());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    return subscribeApiBase(() => {
      const next = getApiBaseUrl();
      setUrl(next);
      setDraft(next);
    });
  }, []);

  if (Platform.OS === 'web') {
    return <Text style={styles.foot}>API {url}</Text>;
  }

  const loopback = isLoopbackApiUrl(url);
  const suggested = getSuggestedApiBaseUrl();

  const save = async (value: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const next = await persistApiBaseOverride(value.trim() || null);
      setUrl(next);
      setDraft(next);
      setMsg(`API → ${next}`);
      onSaved?.(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {loopback ? (
        <Text style={styles.warn}>
          127.0.0.1 sur le téléphone = cet appareil, pas votre PC. Entrez l’IP Wi‑Fi du PC (port 8787) ou l’URL https ngrok.
        </Text>
      ) : null}
      <Text style={styles.label}>Adresse API SuperU</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder={suggested}
        placeholderTextColor={colors.placeholder}
        style={styles.input}
      />
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={() => void save(suggested)}
          disabled={saving}>
          <Text style={styles.btnGhostTxt}>IP PC</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => void save(draft)} disabled={saving}>
          <Text style={styles.btnTxt}>{saving ? '…' : 'Enregistrer'}</Text>
        </Pressable>
      </View>
      {msg ? <Text style={styles.ok}>{msg}</Text> : <Text style={styles.foot}>Actuel : {url}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, width: '100%' },
  warn: {
    ...bodyFont('600'),
    fontSize: 12,
    lineHeight: 17,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: 10,
    borderRadius: 10,
  },
  label: {
    ...displayFont('800'),
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  input: {
    ...bodyFont('600'),
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnTxt: { ...displayFont('800'), fontSize: 12, color: '#fff' },
  btnGhost: {
    backgroundColor: colors.tealSoft,
  },
  btnGhostTxt: { ...displayFont('800'), fontSize: 12, color: colors.teal },
  foot: { ...bodyFont('400'), fontSize: 11, color: colors.placeholder, textAlign: 'center' },
  ok: { ...bodyFont('600'), fontSize: 11, color: colors.teal, textAlign: 'center' },
});
