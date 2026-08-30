import { IconBtn, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont, radius } from '@/constants/theme';
import { useCall } from '@/context/CallContext';
import {
  fetchMessages,
  fetchThread,
  markRead,
  sendMessage,
  setThreadDisabled,
  type CommsMessage,
} from '@/lib/api/comms';
import { formatChatClock } from '@/lib/format';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK = ['Je suis devant l’entrée', 'J’arrive dans quelques minutes', 'Pouvez-vous m’indiquer votre bâtiment ?'];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = decodeURIComponent(id ?? '');
  const { startOutgoing } = useCall();
  const insets = useSafeAreaInsets();
  const [peer, setPeer] = useState('Client');
  const [disabled, setDisabled] = useState(false);
  const [messages, setMessages] = useState<CommsMessage[]>([]);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    try {
      const [th, msgs] = await Promise.all([fetchThread(threadId), fetchMessages(threadId)]);
      const customer = th.members.find((m) => m.actor_kind === 'customer');
      const name = [customer?.user_first, customer?.user_last].filter(Boolean).join(' ');
      if (name) setPeer(name);
      setDisabled(Boolean(th.thread?.disabled_at));
      setMessages(msgs.messages);
      await markRead(threadId);
    } catch {
      /* thread may not exist until delivery claimed */
    }
  }, [threadId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [load]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body || disabled) return;
    setDraft('');
    await sendMessage(threadId, body);
    await load();
  };

  const toggleDisabled = async () => {
    await setThreadDisabled(threadId, !disabled);
    await load();
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <IconBtn name="chevron-left" size={36} onPress={() => router.back()} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{peer}</Text>
            <Text style={styles.online}>{disabled ? 'Désactivée' : 'En ligne'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={disabled ? 'Réactiver la conversation' : 'Désactiver la conversation'}
            style={styles.call}
            onPress={() => void toggleDisabled()}>
            <Feather name={disabled ? 'message-circle' : 'slash'} size={16} color={colors.teal} />
          </Pressable>
          {disabled ? null : (
          <Pressable
            style={styles.call}
            onPress={() => void startOutgoing(threadId, peer)}>
            <Text style={{ color: colors.teal, fontSize: 16 }}>☎</Text>
          </Pressable>
          )}
        </View>
        <ScrollView contentContainerStyle={styles.stream}>
          {messages.map((m) => {
            const callerKind = m.payload?.caller_kind;
            const mine =
              m.kind === 'call'
                ? callerKind === 'staff' || m.sender_kind === 'staff'
                : m.sender_kind === 'staff';
            const isCall = m.kind === 'call';
            return (
              <View key={m.id} style={[styles.row, mine && { justifyContent: 'flex-end' }]}>
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs, isCall && styles.callBubble]}>
                  <Text style={[styles.body, mine && { color: colors.onAccent }]}>
                    {isCall ? `☎ ${m.body}` : m.body}
                  </Text>
                </View>
                <Text style={styles.time}>{formatChatClock(m.created_at)}</Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom + 8) }]}>
          {disabled ? (
            <View style={styles.disabledBox}>
              <Text style={styles.disabledTxt}>Conversation désactivée. Plus de messages ni d’appels.</Text>
              <Pressable style={styles.disabledBtn} onPress={() => void toggleDisabled()}>
                <Text style={styles.disabledBtnTxt}>Réactiver</Text>
              </Pressable>
            </View>
          ) : (
            <>
          <Text style={styles.suggestLabel}>Réponses rapides</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}>
            {QUICK.map((q) => (
              <Pressable
                key={q}
                accessibilityRole="button"
                accessibilityLabel={q}
                onPress={() => void send(q)}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
                <Text style={styles.chipTxt} numberOfLines={1}>
                  {q}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Votre message…"
              placeholderTextColor={colors.placeholder}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={500}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
              style={[styles.send, !draft.trim() && styles.sendOff]}
              onPress={() => void send(draft)}
              disabled={!draft.trim()}>
              <Feather name="send" size={18} color={colors.onAccent} />
            </Pressable>
          </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  name: { ...displayFont('800'), fontSize: 16 },
  online: { ...bodyFont('400'), fontSize: 12, color: colors.teal },
  call: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stream: { padding: 24, gap: 16 },
  row: { gap: 4 },
  bubble: { maxWidth: 260, padding: 12, borderRadius: 16 },
  theirs: { backgroundColor: colors.white, borderBottomLeftRadius: 4, alignSelf: 'flex-start' },
  mine: { backgroundColor: colors.teal, borderBottomRightRadius: 4, alignSelf: 'flex-end' },
  callBubble: { backgroundColor: colors.tealSoft },
  body: { ...bodyFont('400'), fontSize: 14, color: colors.text },
  time: { ...bodyFont('400'), fontSize: 10, color: colors.placeholder },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  suggestLabel: {
    ...displayFont('800'),
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.placeholder,
  },
  chipsScroll: { flexGrow: 0 },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    flexShrink: 0,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.28)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipPressed: { backgroundColor: 'rgba(13,148,136,0.2)', opacity: 0.92 },
  chipTxt: {
    ...bodyFont('600'),
    fontSize: 13,
    color: colors.teal,
  },
  disabledBox: { gap: 10, paddingVertical: 4 },
  disabledTxt: { ...bodyFont('400'), fontSize: 13, color: colors.muted, lineHeight: 18 },
  disabledBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  disabledBtnTxt: { ...displayFont('800'), fontSize: 13, color: colors.teal },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.bg,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null),
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
});
