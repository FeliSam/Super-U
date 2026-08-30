import {
  buildOutboundMessage,
  formatChatClock,
  supportConversation,
  supportWelcomeThread,
} from '@/lib/api/chat';
import {
  fetchInbox,
  fetchMessages,
  markThreadRead,
  sendCommsMessage,
  setThreadDisabled,
  type CommsMessage,
  type InboxThread,
} from '@/lib/api/comms';
import { getAuthToken } from '@/lib/api/http';
import { staffPhotoSource } from '@/lib/staffPhoto';
import type { ChatMessage, Conversation } from '@/data/messages';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type ChatContextValue = {
  ready: boolean;
  conversations: Conversation[];
  unreadTotal: number;
  getMessages: (conversationId: string) => ChatMessage[];
  getConversationById: (conversationId: string) => Conversation | undefined;
  sendMessage: (conversationId: string, text: string) => void;
  setConversationDisabled: (conversationId: string, disabled: boolean) => Promise<void>;
  appendCallEvent: (conversationId: string, message: ChatMessage) => void;
  markRead: (conversationId: string) => void;
  clearActiveThread: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

function clockFromIso(iso: string | null) {
  if (!iso) return formatChatClock();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? formatChatClock() : formatChatClock(d);
}

function mapCommsMessage(row: CommsMessage): ChatMessage {
  const callerKind = String(row.payload?.caller_kind ?? '');
  const mine =
    row.sender_kind === 'customer' || (row.kind === 'call' && callerKind === 'customer');
  const from: ChatMessage['from'] = mine ? 'me' : 'them';
  if (row.kind === 'call') {
    const status = String(row.payload?.status ?? '');
    const callStatus =
      status === 'missed' || status === 'ended' || status === 'rejected' || status === 'canceled'
        ? status
        : 'ended';
    return {
      id: row.id,
      from,
      kind: 'call',
      text: row.body || 'Appel',
      time: clockFromIso(row.created_at),
      call: {
        direction: from === 'me' ? 'out' : 'in',
        status: callStatus,
      },
    };
  }
  return {
    id: row.id,
    from,
    kind: 'text',
    text: row.body,
    time: clockFromIso(row.created_at),
  };
}

function conversationFromInbox(row: InboxThread): Conversation {
  if (row.kind === 'support' || row.id.startsWith('support-')) {
    return {
      id: 'support',
      kind: 'support',
      name: 'Assistance Marché Doré',
      subtitle: 'Support client · 7j/7',
      preview: row.last_body?.trim() || 'Bonjour ! Comment pouvons-nous vous aider aujourd’hui ?',
      time: clockFromIso(row.last_at),
      unread: Number(row.unread) > 0 ? 1 : 0,
      online: true,
      icon: 'headphones',
    };
  }
  const name = [row.peer_first, row.peer_last].filter(Boolean).join(' ').trim();
  const label = row.order_id ? `#${String(row.order_id).replace(/^#/, '')}` : '';
  return {
    id: row.id,
    kind: row.kind === 'support' ? 'support' : 'courier',
    name: name || (label ? `Coursier · ${label}` : 'Coursier'),
    subtitle: label ? `Course · ${label}` : 'Coursier Marché Doré',
    preview: row.last_body?.trim() || 'Conversation avec votre coursier',
    time: clockFromIso(row.last_at),
    unread: Number(row.unread) > 0 ? 1 : 0,
    online: true,
    phone: row.peer_phone || undefined,
    orderId: row.order_id ?? undefined,
    icon: 'truck',
    disabled: Boolean(row.disabled_at || row.archived_at),
    archived: Boolean(row.archived_at),
    avatar: row.peer_staff_id ? staffPhotoSource(row.peer_staff_id) : undefined,
  };
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const { profile } = useProfile();
  const firstName = profile.firstName || session?.firstName || '';
  const [supportMsgs, setSupportMsgs] = useState<ChatMessage[]>([]);
  const [supportMeta, setSupportMeta] = useState({ unread: 0, preview: '', time: 'Maintenant' });
  const [courierConvs, setCourierConvs] = useState<Conversation[]>([]);
  const [courierThreads, setCourierThreads] = useState<Record<string, ChatMessage[]>>({});
  const [ready, setReady] = useState(false);
  const activeThreadRef = useRef<string | null>(null);
  const supportThreadIdRef = useRef<string | null>(null);

  const pullComms = useCallback(async () => {
    if (!getAuthToken()) {
      setCourierConvs([]);
      setCourierThreads({});
      return;
    }
    try {
      const inbox = await fetchInbox();
      const threads = inbox.threads ?? [];
      const supportRow = threads.find((t) => t.kind === 'support' || t.id.startsWith('support-'));
      if (supportRow) {
        supportThreadIdRef.current = supportRow.id;
        const mapped = conversationFromInbox(supportRow);
        setSupportMeta({
          unread: mapped.unread,
          preview: mapped.preview,
          time: mapped.time,
        });
        try {
          const res = await fetchMessages(supportRow.id);
          setSupportMsgs((res.messages ?? []).map(mapCommsMessage));
        } catch {
          /* keep last */
        }
      }
      const courierRows = threads.filter((t) => t.kind !== 'support' && !t.id.startsWith('support-'));
      const convs = courierRows.map(conversationFromInbox);
      setCourierConvs(convs);
      const next: Record<string, ChatMessage[]> = {};
      await Promise.all(
        convs.map(async (c) => {
          try {
            const res = await fetchMessages(c.id);
            next[c.id] = (res.messages ?? []).map(mapCommsMessage);
          } catch {
            next[c.id] = [];
          }
        }),
      );
      setCourierThreads(next);
    } catch {
      /* API down — inbox vide */
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    setSupportMsgs(supportWelcomeThread(firstName));
    const welcome = supportWelcomeThread(firstName)[0];
    setSupportMeta({
      unread: 0,
      preview: welcome?.text ?? '',
      time: welcome?.time ?? 'Maintenant',
    });
    setReady(true);
    void pullComms();
    const t = setInterval(() => void pullComms(), 2000);
    return () => {
      clearInterval(t);
    };
  }, [authReady, session?.accountId, pullComms, firstName]);

  const conversations = useMemo(() => {
    const support: Conversation = {
      ...supportConversation(),
      unread: supportMeta.unread,
      preview: supportMeta.preview || supportConversation().preview,
      time: supportMeta.time,
    };
    return [support, ...courierConvs];
  }, [courierConvs, supportMeta]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread > 0 ? c.unread : 0), 0),
    [conversations],
  );

  const getConversationById = useCallback(
    (conversationId: string) => conversations.find((c) => c.id === conversationId),
    [conversations],
  );

  const getMessages = useCallback(
    (conversationId: string) => {
      if (conversationId === 'support') return supportMsgs;
      return courierThreads[conversationId] ?? [];
    },
    [supportMsgs, courierThreads],
  );

  const markRead = useCallback((conversationId: string) => {
    activeThreadRef.current = conversationId;
    if (conversationId === 'support') {
      setSupportMeta((m) => (m.unread ? { ...m, unread: 0 } : m));
      const sid = supportThreadIdRef.current;
      if (sid) void markThreadRead(sid).catch(() => undefined);
      return;
    }
    setCourierConvs((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)));
    void markThreadRead(conversationId).catch(() => undefined);
  }, []);

  const clearActiveThread = useCallback(() => {
    activeThreadRef.current = null;
  }, []);

  const appendCallEvent = useCallback((conversationId: string, message: ChatMessage) => {
    if (conversationId === 'support') return;
    setCourierThreads((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] ?? []), message],
    }));
  }, []);

  const setConversationDisabled = useCallback(
    async (conversationId: string, disabled: boolean) => {
      if (conversationId === 'support') return;
      await setThreadDisabled(conversationId, disabled);
      await pullComms();
    },
    [pullComms],
  );

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (conversationId === 'support') {
        const mine = buildOutboundMessage(trimmed);
        setSupportMsgs((prev) => [...prev, mine]);
        setSupportMeta({ unread: 0, preview: mine.text, time: mine.time });
        const sid = supportThreadIdRef.current;
        if (sid) {
          void sendCommsMessage(sid, trimmed)
            .then(() => pullComms())
            .catch(() => undefined);
        }
        return;
      }

      const mine = buildOutboundMessage(trimmed);
      setCourierThreads((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] ?? []), mine],
      }));
      setCourierConvs((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, preview: mine.text, time: mine.time, unread: 0 } : c,
        ),
      );
      void sendCommsMessage(conversationId, trimmed)
        .then(() => pullComms())
        .catch(() => undefined);
    },
    [pullComms],
  );

  const value = useMemo(
    () => ({
      ready,
      conversations,
      unreadTotal,
      getMessages,
      getConversationById,
      sendMessage,
      setConversationDisabled,
      appendCallEvent,
      markRead,
      clearActiveThread,
    }),
    [
      ready,
      conversations,
      unreadTotal,
      getMessages,
      getConversationById,
      sendMessage,
      setConversationDisabled,
      appendCallEvent,
      markRead,
      clearActiveThread,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
