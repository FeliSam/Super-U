import { PillButton, Screen } from '@/components/ui';
import { ProductThumb } from '@/components/ProductThumb';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { ApiError } from '@/lib/api/http';
import { patchPickLines } from '@/lib/api/ops';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function MissingProductScreen() {
  const { pickId, productId, name } = useLocalSearchParams<{
    pickId?: string;
    productId?: string;
    name?: string;
  }>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (kind: 'replace' | 'report' | 'skip') => {
    if (!pickId || !productId) return;
    setBusy(true);
    setError(null);
    const label =
      kind === 'replace'
        ? `Remplacer : ${note.trim() || 'équivalent magasin'}`
        : kind === 'report'
          ? `Signaler : ${note.trim() || 'introuvable en rayon'}`
          : note.trim() || 'Non ramassé';
    try {
      await patchPickLines(decodeURIComponent(pickId), [
        {
          productId: decodeURIComponent(productId),
          pickedQty: 0,
          unavailable: true,
          note: label,
        },
      ]);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible d’enregistrer.');
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
        <Text style={styles.navTitle}>Produit introuvable</Text>
        <View style={{ width: 56 }} />
      </View>
      <View style={styles.body}>
        <ProductThumb productId={productId ? decodeURIComponent(productId) : ''} name={name} size={88} />
        <Text style={styles.title}>{name ? decodeURIComponent(name) : 'Article'}</Text>
        <Text style={styles.sub}>Remplacez-le, signalez une rupture, ou continuez sans cet article.</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <TextInput
          style={styles.input}
          placeholder="Note (équivalent, rayon, motif…)"
          placeholderTextColor={colors.placeholder}
          value={note}
          onChangeText={setNote}
          multiline
        />
        <PillButton label={busy ? '…' : 'REMPLACER'} onPress={() => void save('replace')} disabled={busy} />
        <PillButton
          label="SIGNALER UNE RUPTURE"
          variant="ghost"
          onPress={() => void save('report')}
          disabled={busy}
        />
        <PillButton
          label="CONTINUER SANS CET ARTICLE"
          variant="danger"
          onPress={() => void save('skip')}
          disabled={busy}
        />
      </View>
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
  body: { padding: 24, gap: 14, alignItems: 'center' },
  title: { ...displayFont('900'), fontSize: 22, textAlign: 'center' },
  sub: { ...bodyFont('400'), fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  err: { ...bodyFont('600'), color: colors.danger },
  input: {
    width: '100%',
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...bodyFont('500'),
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
});
