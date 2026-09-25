import { fetchInbox, type InboxThread } from '@/lib/api/comms';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { isThreadSignal, subscribeLive, useLiveConnected } from '@/lib/live';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ChatValue = {
  threads: InboxThread[];
  unreadTotal: number;
  refresh: () => Promise<void>;
};

const Ctx = createContext<ChatValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useStaffAuth();
  const [threads, setThreads] = useState<InboxThread[]>([]);

  const refresh = useCallback(async () => {
    if (!staff) {
      setThreads([]);
      return;
    }
    try {
      const res = await fetchInbox();
      setThreads(res.threads);
    } catch {
      /* ignore until comms is up */
    }
  }, [staff]);

  const liveOn = useLiveConnected();
  useEffect(() => {
    void refresh();
    if (!staff) return;
    // Flux temps réel ouvert : relecture sur signal + filet de sécurité toutes les 20 s.
    const t = setInterval(() => void refresh(), liveOn ? 20_000 : 2000);
    const unsub = subscribeLive((s) => {
      if (isThreadSignal(s)) void refresh();
    });
    return () => {
      clearInterval(t);
      unsub();
    };
  }, [staff, refresh, liveOn]);

  const unreadTotal = useMemo(
    () => threads.reduce((n, th) => n + (Number(th.unread) > 0 ? 1 : 0), 0),
    [threads],
  );

  return <Ctx.Provider value={{ threads, unreadTotal, refresh }}>{children}</Ctx.Provider>;
}

export function useChatInbox() {
  const v = useContext(Ctx);
  if (!v) throw new Error('ChatProvider missing');
  return v;
}
