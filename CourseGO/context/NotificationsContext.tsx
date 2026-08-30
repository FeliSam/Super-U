import { useStaffAuth } from '@/context/StaffAuthContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type StaffNotification,
} from '@/lib/api/ops';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

type Value = {
  items: StaffNotification[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const Ctx = createContext<Value | null>(null);

function isHidden() {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return document.visibilityState === 'hidden';
  }
  return AppState.currentState !== 'active';
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useStaffAuth();
  const [items, setItems] = useState<StaffNotification[]>([]);

  const refresh = useCallback(async () => {
    if (!staff) {
      setItems([]);
      return;
    }
    try {
      const res = await fetchNotifications();
      setItems(res.items ?? []);
    } catch {
      /* ignore */
    }
  }, [staff]);

  useEffect(() => {
    void refresh();
    if (!staff) return;
    const tick = () => {
      if (isHidden()) return;
      void refresh();
    };
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, [staff, refresh]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
    );
    await markNotificationRead(id).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    await markAllNotificationsRead().catch(() => undefined);
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  const value = useMemo(
    () => ({ items, unreadCount, refresh, markRead, markAllRead }),
    [items, unreadCount, refresh, markRead, markAllRead],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaffNotifications() {
  const v = useContext(Ctx);
  if (!v) throw new Error('NotificationsProvider missing');
  return v;
}
