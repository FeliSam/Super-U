import { bodyFont, displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import {
  ensureReachableApiBase,
  getApiBaseUrl,
  getSuggestedApiBaseUrl,
  isLoopbackApiUrl,
  persistApiBaseOverride,
  subscribeApiBase,
} from '@/lib/api/apiBase';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

function cleanDraft(raw: string) {
  const chunks = raw
    .trim()
    .split(/(?=https?:\/\/)/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return (chunks.length > 1 ? chunks[chunks.length - 1]! : raw).trim().replace(/\/$/, '');
}

export function ApiHostEditor({
  onSaved,
}: {
  onSaved?: (url: string) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [url, setUrl] = useState(() => cleanDraft(getApiBaseUrl()));
  const [draft, setDraft] = useState(() => cleanDraft(getApiBaseUrl()));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(
    () =>
      subscribeApiBase(() => {
        const next = cleanDraft(getApiBaseUrl());
        setUrl(next);
        setDraft(next);
      }),
    [],
  );

  // Répare une ancienne valeur doublée déjà en mémoire
  useEffect(() => {
    setDraft((d) => cleanDraft(d));
    setUrl((u) => cleanDraft(u));
  }, []);

  const loopback = isLoopbackApiUrl(url);
  const suggested = getSuggestedApiBaseUrl();

  const save = async (value: string) => {
    setSaving(true);
    setMsg(null);
    setOk(null);
    try {
      const next = await persistApiBaseOverride(cleanDraft(value) || null);
      setUrl(next);
      setDraft(next);
      const reachable = await ensureReachableApiBase(3500);
      if (reachable) {
        setOk(true);
        setMsg(`OK ${reachable} — déconnectez-vous puis reconnectez-vous si vous étiez en mode local.`);
      } else {
        setOk(false);
        setMsg(`Injoignable : ${next}. PC : npm run dev:api + npm run tunnel:ngrok.`);
      }
      onSaved?.(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {loopback && Platform.OS !== 'web' ? (
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
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => void save(suggested)} disabled={saving}>
          <Text style={styles.btnGhostTxt}>{/https:\/\//i.test(suggested) ? 'Tunnel' : 'IP PC'}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => void save(draft)} disabled={saving}>
          <Text style={styles.btnTxt}>{saving ? '…' : 'Enregistrer'}</Text>
        </Pressable>
      </View>
      {msg ? (
        <Text style={ok === false ? styles.bad : styles.ok}>{msg}</Text>
      ) : (
        <Text style={styles.foot}>Actuel : {url}</Text>
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: { gap: 8, width: '100%' },
    warn: {
      ...bodyFont('600'),
      fontSize: 12,
      lineHeight: 17,
      color: colors.terracotta,
      backgroundColor: colors.blush,
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
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    row: { flexDirection: 'row', gap: 8 },
    btn: {
      flex: 1,
      backgroundColor: colors.gold,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    btnTxt: { ...displayFont('800'), fontSize: 12, color: '#fff' },
    btnGhost: { backgroundColor: colors.border },
    btnGhostTxt: { ...displayFont('800'), fontSize: 12, color: colors.gold },
    foot: { ...bodyFont('400'), fontSize: 11, color: colors.muted, textAlign: 'center' },
    ok: { ...bodyFont('600'), fontSize: 11, color: colors.gold, textAlign: 'center' },
    bad: { ...bodyFont('600'), fontSize: 11, color: colors.terracotta, textAlign: 'center' },
  });
}
