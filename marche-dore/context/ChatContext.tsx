import { getThread, type ChatMessage } from '@/data/messages';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.chat-threads.v1';

type ThreadsMap = Record<string, ChatMessage[]>;

type ChatContextValue = {
  ready: boolean;
  getMessages: (conversationId: string) => ChatMessage[];
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  appendMessage: (conversationId: string, message: ChatMessage) => void;
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

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [threads, setThreads] = useState<ThreadsMap>({});
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const next: ThreadsMap = {};
            for (const [id, list] of Object.entries(parsed as Record<string, unknown>)) {
              if (!Array.isArray(list)) continue;
              const msgs = list.map(sanitizeMessage).filter((m): m is ChatMessage => Boolean(m));
              if (msgs.length) next[id] = msgs;
            }
            setThreads(next);
          }
        }
      } catch {
        // keep empty — seed on read
      } finally {
        if (active) {
          hydrated.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(threads)).catch(() => undefined);
  }, [threads]);

  const getMessages = useCallback(
    (conversationId: string) => {
      if (threads[conversationId]?.length) return threads[conversationId];
      return getThread(conversationId);
    },
    [threads],
  );

  const setMessagesFor = useCallback((conversationId: string, messages: ChatMessage[]) => {
    setThreads((prev) => ({ ...prev, [conversationId]: messages }));
  }, []);

  const appendMessage = useCallback((conversationId: string, message: ChatMessage) => {
    setThreads((prev) => {
      const base = prev[conversationId]?.length ? prev[conversationId] : getThread(conversationId);
      return { ...prev, [conversationId]: [...base, message] };
    });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      getMessages,
      setMessages: setMessagesFor,
      appendMessage,
    }),
    [ready, getMessages, setMessagesFor, appendMessage],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
