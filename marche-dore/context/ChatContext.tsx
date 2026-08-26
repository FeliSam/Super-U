import {
  buildAutoReply,
  buildOutboundMessage,
  seedChatBundle,
} from '@/lib/api/chat';
import type { ChatMessage, Conversation } from '@/data/messages';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const STORAGE_KEY = 'marche-dore.chat.v3';

type ConversationMeta = {
  unread: number;
  preview: string;
  time: string;
  updatedAt: number;
};

type PersistedChat = {
  threads: Record<string, ChatMessage[]>;
  meta: Record<string, ConversationMeta>;
};

type ChatContextValue = {
  ready: boolean;
  conversations: Conversation[];
  unreadTotal: number;
  getMessages: (conversationId: string) => ChatMessage[];
  getConversationById: (conversationId: string) => Conversation | undefined;
  sendMessage: (conversationId: string, text: string) => void;
  markRead: (conversationId: string) => void;
  clearActiveThread: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

function sanitizeMessage(raw: unknown): ChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<ChatMessage>;
  if (typeof m.id !== 'string' || typeof m.text !== 'string') return null;
  if (m.from !== 'me' && m.from !== 'them') return null;
  return {
    id: m.id,
    from: m.from,
    text: m.text.trim() || '…',
    time: (typeof m.time === 'string' && m.time.trim()) || '',
  };
}

function sanitizeMeta(raw: unknown): ConversationMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<ConversationMeta>;
  if (typeof m.preview !== 'string' || typeof m.time !== 'string') return null;
  return {
    unread: typeof m.unread === 'number' && m.unread >= 0 ? Math.floor(m.unread) : 0,
    preview: m.preview,
    time: m.time,
    updatedAt: typeof m.updatedAt === 'number' ? m.updatedAt : Date.now(),
  };
}

function lastPreview(messages: ChatMessage[]): { preview: string; time: string } | null {
  const last = messages[messages.length - 1];
  if (!last) return null;
  return { preview: last.text, time: last.time || 'Maintenant' };
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [seed, setSeed] = useState<Conversation[]>([]);
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});
  const [meta, setMeta] = useState<Record<string, ConversationMeta>>({});
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const activeThreadRef = useRef<string | null>(null);
  const replyTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const bundle = await seedChatBundle();
        if (!active) return;

        let nextThreads = bundle.threads;
        const nextMeta: Record<string, ConversationMeta> = {};

        bundle.conversations.forEach((c, index) => {
          const tip = lastPreview(bundle.threads[c.id] ?? []);
          nextMeta[c.id] = {
            unread: c.unread,
            preview: tip?.preview ?? c.preview,
            time: tip?.time ?? c.time,
            updatedAt: Date.now() - index * 60_000,
          };
        });

        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedChat>;
          if (parsed.threads && typeof parsed.threads === 'object') {
            const merged: Record<string, ChatMessage[]> = { ...nextThreads };
            for (const [id, list] of Object.entries(parsed.threads)) {
              if (!Array.isArray(list)) continue;
              const msgs = list.map(sanitizeMessage).filter((m): m is ChatMessage => Boolean(m));
              if (msgs.length) merged[id] = msgs;
            }
            nextThreads = merged;
          }
          if (parsed.meta && typeof parsed.meta === 'object') {
            for (const [id, value] of Object.entries(parsed.meta)) {
              const clean = sanitizeMeta(value);
              if (clean) nextMeta[id] = clean;
            }
          }
          for (const [id, list] of Object.entries(nextThreads)) {
            const tip = lastPreview(list);
            if (!tip) continue;
            const prev = nextMeta[id];
            nextMeta[id] = {
              unread: prev?.unread ?? 0,
              preview: tip.preview,
              time: tip.time,
              updatedAt: prev?.updatedAt ?? Date.now(),
            };
          }
        }

        setSeed(bundle.conversations);
        setThreads(nextThreads);
        setMeta(nextMeta);
      } catch {
        // keep empty until next launch
      } finally {
        if (active) {
          hydrated.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
      for (const t of replyTimers.current.values()) clearTimeout(t);
      replyTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const payload: PersistedChat = { threads, meta };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => undefined);
  }, [threads, meta]);

  const conversations = useMemo(() => {
    const merged = seed.map((c) => {
      const m = meta[c.id];
      if (!m) return c;
      return {
        ...c,
        unread: m.unread,
        preview: m.preview,
        time: m.time,
      };
    });
    return [...merged].sort((a, b) => {
      if (a.unread > 0 && b.unread === 0) return -1;
      if (b.unread > 0 && a.unread === 0) return 1;
      const ua = meta[a.id]?.updatedAt ?? 0;
      const ub = meta[b.id]?.updatedAt ?? 0;
      return ub - ua;
    });
  }, [seed, meta]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread > 0 ? c.unread : 0), 0),
    [conversations],
  );

  const getConversationById = useCallback(
    (conversationId: string) => conversations.find((c) => c.id === conversationId),
    [conversations],
  );

  const getMessages = useCallback(
    (conversationId: string) => threads[conversationId] ?? [],
    [threads],
  );

  const patchMeta = useCallback((conversationId: string, patch: Partial<ConversationMeta>) => {
    setMeta((prev) => {
      const cur = prev[conversationId] ?? {
        unread: 0,
        preview: '',
        time: 'Maintenant',
        updatedAt: Date.now(),
      };
      const next: ConversationMeta = {
        ...cur,
        ...patch,
        updatedAt: patch.updatedAt ?? Date.now(),
      };
      if (
        next.unread === cur.unread &&
        next.preview === cur.preview &&
        next.time === cur.time &&
        (patch.updatedAt === undefined || next.updatedAt === cur.updatedAt)
      ) {
        return prev;
      }
      return { ...prev, [conversationId]: next };
    });
  }, []);

  const markRead = useCallback(
    (conversationId: string) => {
      activeThreadRef.current = conversationId;
      setMeta((prev) => {
        const cur = prev[conversationId];
        if (!cur || cur.unread === 0) return prev;
        return {
          ...prev,
          [conversationId]: { ...cur, unread: 0 },
        };
      });
    },
    [],
  );

  const clearActiveThread = useCallback(() => {
    activeThreadRef.current = null;
  }, []);

  const appendToThread = useCallback((conversationId: string, message: ChatMessage) => {
    setThreads((prev) => {
      const base = prev[conversationId] ?? [];
      return { ...prev, [conversationId]: [...base, message] };
    });
  }, []);

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const conv = seed.find((c) => c.id === conversationId);
      if (!conv) return;

      const mine = buildOutboundMessage(trimmed);
      appendToThread(conversationId, mine);
      patchMeta(conversationId, {
        preview: mine.text,
        time: mine.time,
        unread: 0,
        updatedAt: Date.now(),
      });

      const existing = replyTimers.current.get(conversationId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        replyTimers.current.delete(conversationId);
        const reply = buildAutoReply(conv.kind);
        appendToThread(conversationId, reply);
        const viewing = activeThreadRef.current === conversationId;
        setMeta((prev) => {
          const cur = prev[conversationId] ?? {
            unread: 0,
            preview: '',
            time: 'Maintenant',
            updatedAt: Date.now(),
          };
          return {
            ...prev,
            [conversationId]: {
              ...cur,
              preview: reply.text,
              time: reply.time,
              unread: viewing ? 0 : cur.unread + 1,
              updatedAt: Date.now(),
            },
          };
        });
      }, 900 + Math.floor(Math.random() * 700));

      replyTimers.current.set(conversationId, timer);
    },
    [seed, appendToThread, patchMeta],
  );

  const value = useMemo(
    () => ({
      ready,
      conversations,
      unreadTotal,
      getMessages,
      getConversationById,
      sendMessage,
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
