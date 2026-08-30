import { IconBtn, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont, radius } from '@/constants/theme';
import { useCall } from '@/context/CallContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import {
  fetchMessages,
  fetchThread,
  markRead,
  sendMessage,
  setThreadDisabled,
  type CommsMessage,
} from '@/lib/api/comms';
import { formatChatClock } from '@/lib/format';
import { staffPhotoSource } from '@/lib/staffPhoto';
import { userPhotoSource } from '@/lib/userPhoto';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
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
  const { staff } = useStaffAuth();
  const insets = useSafeAreaInsets();
  const [peer, setPeer] = useState('Client');
  const [peerUserId, setPeerUserId] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [archived, setArchived] = useState(false);
  const [messages, setMessages] = useState<CommsMessage[]>([]);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const lastIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [th, msgs] = await Promise.all([fetchThread(threadId), fetchMessages(threadId)]);
      const customer = th.members.find((m) => m.actor_kind === 'customer');
      const name = [customer?.user_first, customer?.user_last].filter(Boolean).join(' ');
      if (name) setPeer(name);
      if (customer?.user_id) setPeerUserId(customer.user_id);
      setDisabled(Boolean(th.thread?.disabled_at || th.thread?.archived_at));
      setArchived(Boolean(th.thread?.archived_at));
      const list = [...(msgs.messages ?? [])].sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        if (ta !== tb) return ta - tb;
        return String(a.id).localeCompare(String(b.id));
      });
      setMessages((prev) => {
        const same =
          prev.length === list.length &&
          prev.at(0)?.id === list.at(0)?.id &&
          prev.at(-1)?.id === list.at(-1)?.id;
        return same ? prev : list;
      });
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
          <Image source={userPhotoSource(peerUserId)} style={styles.headerAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{peer}</Text>
            <Text style={styles.online}>{archived ? 'Archivée' : disabled ? 'Désactivée' : 'En ligne'}</Text>
          </View>
          {archived ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={disabled ? 'Réactiver la conversation' : 'Désactiver la conversation'}
            style={styles.call}
            onPress={() => void toggleDisabled()}>
            <Feather name={disabled ? 'message-circle' : 'slash'} size={16} color={colors.teal} />
          </Pressable>
          )}
          {disabled ? null : (
          <Pressable
            style={styles.call}
            onPress={() => void startOutgoing(threadId, peer)}>
            <Text style={{ color: colors.teal, fontSize: 16 }}>☎</Text>
          </Pressable>
          )}
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.stream}
          onContentSizeChange={() => {
            const last = messages.at(-1)?.id ?? null;
            if (last && last !== lastIdRef.current) {
              lastIdRef.current = last;
              scrollRef.current?.scrollToEnd({ animated: true });
            } else {
              scrollRef.current?.scrollToEnd({ animated: false });
            }
          }}>
          {messages.map((m) => {
            const callerKind = String(m.payload?.caller_kind ?? '');
            const mine =
              m.sender_kind === 'staff' || (m.kind === 'call' && callerKind === 'staff');
            const isCall = m.kind === 'call';
            return (
              <View key={m.id} style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                {mine ? null : <Image source={userPhotoSource(peerUserId)} style={styles.avatar} />}
                <View style={[styles.col, mine && styles.colMine]}>
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs, isCall && styles.callBubble]}>
                    <Text style={[styles.body, mine && { color: colors.onAccent }]}>
                      {isCall ? `☎ ${m.body}` : m.body}
                    </Text>
                  </View>
                  <Text style={[styles.time, mine && styles.timeMine]}>{formatChatClock(m.created_at)}</Text>
                </View>
                {mine ? <Image source={staffPhotoSource(staff?.photoUrl)} style={styles.avatar} /> : null}
              </View>
            );
          })}
        </ScrollView>
        <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom + 8) }]}>
          {disabled ? (
            <View style={styles.disabledBox}>
              <Text style={styles.disabledTxt}>
                {archived
                  ? 'Conversation archivée 30 minutes après la livraison. Plus de messages ni d’appels.'
                  : 'Conversation désactivée. Plus de messages ni d’appels.'}
              </Text>
              {archived ? null : (
              <Pressable style={styles.disabledBtn} onPress={() => void toggleDisabled()}>
                <Text style={styles.disabledBtnTxt}>Réactiver</Text>
              </Pressable>
              )}
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
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tealSoft },
  online: { ...bodyFont('400'), fontSize: 12, color: colors.teal },
  call: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stream: { padding: 24, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, width: '100%' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  col: { maxWidth: 260, gap: 4 },
  colMine: { alignItems: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.tealSoft },
  bubble: { maxWidth: 260, padding: 12, borderRadius: 16 },
  theirs: { backgroundColor: colors.white, borderBottomLeftRadius: 4 },
  mine: { backgroundColor: colors.teal, borderBottomRightRadius: 4 },
  callBubble: { backgroundColor: colors.tealSoft },
  body: { ...bodyFont('400'), fontSize: 14, color: colors.text },
  time: { ...bodyFont('400'), fontSize: 10, color: colors.placeholder },
  timeMine: { alignSelf: 'flex-end' },
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
