import {
  formatNotificationTime,
  notifications as seedNotifications,
  type AppNotification,
} from '@/data/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'marche-dore.notifications.v2';

export type PushNotificationInput = Omit<AppNotification, 'read' | 'time' | 'createdAt'> & {
  createdAt?: number;
  read?: boolean;
};

type NotificationsContextValue = {
  ready: boolean;
  items: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  getById: (id: string) => AppNotification | undefined;
  push: (input: PushNotificationInput) => AppNotification;
  hasId: (id: string) => boolean;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function sanitizeNotification(raw: unknown): AppNotification | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Partial<AppNotification>;
  if (typeof n.id !== 'string' || typeof n.title !== 'string') return null;
  const createdAt = typeof n.createdAt === 'number' ? n.createdAt : undefined;
  return {
    id: n.id,
    title: n.title.trim() || 'Notification',
    preview: (typeof n.preview === 'string' && n.preview.trim()) || '',
    body: (typeof n.body === 'string' && n.body.trim()) || '',
    createdAt,
    time:
      (typeof n.time === 'string' && n.time.trim()) ||
      formatNotificationTime(createdAt, 'À l’instant'),
    read: Boolean(n.read),
    icon: (n.icon as AppNotification['icon']) || 'bell',
    actionLabel: typeof n.actionLabel === 'string' ? n.actionLabel : undefined,
    actionHref: typeof n.actionHref === 'string' ? n.actionHref : undefined,
    orderId: typeof n.orderId === 'string' ? n.orderId : undefined,
  };
}

function withRelativeTime(n: AppNotification): AppNotification {
  if (!n.createdAt) return n;
  return { ...n, time: formatNotificationTime(n.createdAt, n.time) };
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>(() => seedNotifications.map((n) => ({ ...n })));
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            const list = parsed.map(sanitizeNotification).filter((n): n is AppNotification => Boolean(n));
            if (list.length) setItems(list);
          }
        }
      } catch {
        // keep seed
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => undefined);
  }, [items]);

  const displayItems = useMemo(() => items.map(withRelativeTime), [items]);

  const unreadCount = useMemo(() => displayItems.filter((n) => !n.read).length, [displayItems]);

  const markAsRead = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setItems((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const getById = useCallback(
    (id: string) => displayItems.find((n) => n.id === id),
    [displayItems],
  );

  const hasId = useCallback((id: string) => items.some((n) => n.id === id), [items]);

  const push = useCallback((input: PushNotificationInput) => {
    const createdAt = input.createdAt ?? Date.now();
    const next: AppNotification = {
      id: input.id,
      title: input.title,
      preview: input.preview,
      body: input.body,
      icon: input.icon,
      actionLabel: input.actionLabel,
      actionHref: input.actionHref,
      orderId: input.orderId,
      createdAt,
      time: formatNotificationTime(createdAt),
      read: input.read ?? false,
    };
    setItems((prev) => {
      if (prev.some((n) => n.id === next.id)) return prev;
      return [next, ...prev];
    });
    return next;
  }, []);

  const value = useMemo(
    () => ({
      ready,
      items: displayItems,
      unreadCount,
      markAsRead,
      markAllAsRead,
      getById,
      push,
      hasId,
    }),
    [ready, displayItems, unreadCount, markAsRead, markAllAsRead, getById, push, hasId],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
