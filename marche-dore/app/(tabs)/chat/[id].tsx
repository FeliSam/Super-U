import { AppImage } from '@/components/AppImage';
import { IconCircle, Page, Screen } from '@/components/ui';
import { displayFont, type AppColors } from '@/constants/theme';
import { useChat } from '@/context/ChatContext';
import { useColors } from '@/context/ThemeContext';
import { quickRepliesByKind } from '@/data/messages';
import { Feather } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function resolveConversationId(raw?: string) {
  if (!raw || raw === 'support') return 'support';
  if (raw === 'MD-2024-0847') return 'courier-moussa';
  return raw;
}

export default function ChatThreadScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const conversationId = resolveConversationId(id);

  const {
    ready,
    getMessages,
    getConversationById,
    sendMessage,
    markRead,
    clearActiveThread,
  } = useChat();

  const conversation = getConversationById(conversationId);
  const messages = getMessages(conversationId);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const quickReplies = useMemo(
    () => (conversation ? quickRepliesByKind[conversation.kind] : []),
    [conversation],
  );

  useEffect(() => {
    if (!ready || !conversationId) return;
    markRead(conversationId);
    return () => clearActiveThread();
  }, [ready, conversationId, markRead, clearActiveThread]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length, conversationId]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !conversation) return;
    sendMessage(conversation.id, trimmed);
    setDraft('');
  };

  if (ready && !conversation) {
    return (
      <Screen>
        <Page style={styles.flex}>
          <View style={styles.header}>
            <IconCircle name="chevron-left" onPress={() => router.navigate('/chat' as Href)} />
            <Text style={styles.missingTitle}>Conversation introuvable</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.missingBody}>
            <Feather name="message-circle" size={28} color={colors.gold} />
            <Text style={styles.missingText}>Cette discussion n’existe plus ou n’est pas encore disponible.</Text>
            <Pressable style={styles.missingBtn} onPress={() => router.navigate('/chat' as Href)}>
              <Text style={styles.missingBtnText}>Retour à la messagerie</Text>
            </Pressable>
          </View>
        </Page>
      </Screen>
    );
  }

  if (!conversation) {
    return (
      <Screen>
        <Page style={styles.flex}>
          <View style={styles.missingBody}>
            <Text style={styles.missingText}>Chargement…</Text>
          </View>
        </Page>
      </Screen>
    );
  }

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={styles.header}>
          <IconCircle name="chevron-left" onPress={() => router.navigate('/chat' as Href)} />
          <Pressable
            style={styles.headerCenter}
            onPress={() => {
              if (conversation.orderId) router.push(`/tracking?id=${conversation.orderId}`);
            }}>
            {conversation.avatar ? (
              <AppImage source={conversation.avatar} frameStyle={styles.headerAvatar} />
            ) : (
              <View
                style={[
                  styles.headerAvatarFallback,
                  conversation.kind === 'support' && styles.headerAvatarSupport,
                ]}>
                <Feather
                  name={conversation.icon ?? 'message-circle'}
                  size={18}
                  color={conversation.kind === 'support' ? colors.white : colors.gold}
                />
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={styles.headerName} numberOfLines={1}>
                {conversation.name}
              </Text>
              <View style={styles.onlineRow}>
                {conversation.online ? <View style={styles.onlineDot} /> : null}
                <Text style={styles.headerSub} numberOfLines={1}>
                  {conversation.subtitle}
                </Text>
              </View>
            </View>
          </Pressable>
          {conversation.phone ? (
            <IconCircle name="phone" onPress={() => Linking.openURL(`tel:${conversation.phone}`)} />
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.thread}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.banner}>
              <Feather
                name={
                  conversation.kind === 'support'
                    ? 'headphones'
                    : conversation.kind === 'courier'
                      ? 'truck'
                      : 'package'
                }
                size={14}
                color={colors.gold}
              />
              <Text style={styles.bannerText}>
                {conversation.kind === 'support'
                  ? 'Assistance Marché Doré'
                  : conversation.orderId
                    ? `Conversation · #${conversation.orderId}`
                    : conversation.subtitle}
              </Text>
            </View>

            {messages.map((msg) => {
              const mine = msg.from === 'me';
              return (
                <View
                  key={msg.id}
                  style={[styles.bubbleWrap, mine ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
                  {!mine ? (
                    conversation.avatar ? (
                      <AppImage source={conversation.avatar} frameStyle={styles.bubbleAvatar} />
                    ) : (
                      <View
                        style={[
                          styles.bubbleAvatarFallback,
                          conversation.kind === 'support' && styles.headerAvatarSupport,
                        ]}>
                        <Feather
                          name={conversation.icon ?? 'message-circle'}
                          size={12}
                          color={conversation.kind === 'support' ? colors.white : colors.gold}
                        />
                      </View>
                    )
                  ) : null}
                  <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMe]}>{msg.text}</Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMe]}>{msg.time}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom + 8) }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRow}
              keyboardShouldPersistTaps="handled">
              {quickReplies.map((reply) => (
                <Pressable key={reply} style={styles.quickChip} onPress={() => send(reply)}>
                  <Text style={styles.quickChipText}>{reply}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={
                  conversation.kind === 'support' ? 'Écrire à l’assistance…' : 'Écrire un message…'
                }
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                multiline
                maxLength={500}
                onSubmitEditing={() => send(draft)}
              />
              <Pressable
                style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
                onPress={() => send(draft)}
                disabled={!draft.trim()}>
                <Feather name="send" size={18} color={colors.white} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.white,
    },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: { width: 40, height: 40, borderRadius: 20 },
    headerAvatarFallback: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatarSupport: { backgroundColor: colors.terracotta },
    headerText: { flex: 1, gap: 2 },
    headerName: { color: colors.text, fontSize: 15, ...displayFont('700') },
    onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
    headerSub: { color: colors.muted, fontSize: 11, flexShrink: 1 },
    headerSpacer: { width: 40 },
    thread: { padding: 16, gap: 12, paddingBottom: 20 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'center',
      backgroundColor: colors.cream,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginBottom: 4,
    },
    bannerText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '92%' },
    bubbleWrapMe: { alignSelf: 'flex-end' },
    bubbleWrapThem: { alignSelf: 'flex-start' },
    bubbleAvatar: { width: 28, height: 28, borderRadius: 14 },
    bubbleAvatarFallback: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bubble: {
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 4,
      maxWidth: 280,
    },
    bubbleMe: {
      backgroundColor: colors.terracotta,
      borderBottomRightRadius: 6,
    },
    bubbleThem: {
      backgroundColor: colors.white,
      borderBottomLeftRadius: 6,
    },
    bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    bubbleTextMe: { color: colors.white },
    bubbleTime: { color: colors.placeholder, fontSize: 10, alignSelf: 'flex-end' },
    bubbleTimeMe: { color: 'rgba(255,255,255,0.75)' },
    composer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.white,
      paddingTop: 10,
      paddingHorizontal: 12,
      gap: 10,
    },
    quickRow: { gap: 8, paddingHorizontal: 4 },
    quickChip: {
      backgroundColor: colors.bg,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    quickChipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 110,
      backgroundColor: colors.bg,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}),
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.45 },
    missingTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
    missingBody: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 32,
    },
    missingText: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    missingBtn: {
      marginTop: 8,
      backgroundColor: colors.gold,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    missingBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  });
}
