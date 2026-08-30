import { apiGetAccountState, loadAccountJson, saveAccountJson } from '@/lib/accountSync';
import {
  apiGetNotifications,
  apiMarkAllNotificationsRead,
  apiMarkNotificationRead,
} from '@/lib/api/notifications';
import { getAuthToken } from '@/lib/api/http';
import { showToast } from '@/lib/toastBus';
import { formatNotificationTime, type AppNotification } from '@/data/notifications';
import { useAuth } from '@/context/AuthContext';
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
  const n = raw as Partial<AppNotification> & { actionHref?: string; orderId?: string };
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

function mergeById(current: AppNotification[], incoming: AppNotification[]) {
  const map = new Map<string, AppNotification>();
  for (const n of current) map.set(n.id, n);
  for (const n of incoming) {
    const prev = map.get(n.id);
    map.set(n.id, prev ? { ...n, read: prev.read || n.read } : n);
  }
  return [...map.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { session, ready: authReady } = useAuth();
  const accountId = session?.accountId ?? null;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const skipSave = useRef(true);
  const seenToast = useRef<Set<string>>(new Set());

  const pullRemote = useCallback(async (opts?: { toastNew?: boolean }) => {
    if (!getAuthToken()) return;
    const remote = await apiGetNotifications();
    if (!remote) return;
    const next = remote.map(sanitizeNotification).filter((n): n is AppNotification => Boolean(n));
    setItems((prev) => {
      if (opts?.toastNew && hydrated.current) {
        const known = new Set(prev.map((n) => n.id));
        for (const n of next) {
          if (known.has(n.id) || seenToast.current.has(n.id) || n.read) continue;
          try {
            if (sessionStorage.getItem(`md.notif.seen.${n.id}`) === '1') continue;
          } catch {
            /* ignore */
          }
          seenToast.current.add(n.id);
          showToast({
            title: n.title,
            body: n.preview || n.body || undefined,
            tone: 'info',
            href: n.actionHref || '/notifications',
          });
        }
      }
      return mergeById(prev, next);
    });
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    skipSave.current = true;
    hydrated.current = false;
    seenToast.current = new Set();
    (async () => {
      if (!accountId) {
        setItems([]);
        hydrated.current = true;
        setReady(true);
        return;
      }
      const local = await loadAccountJson<unknown>(STORAGE_KEY, accountId);
      let list = Array.isArray(local)
        ? local.map(sanitizeNotification).filter((n): n is AppNotification => Boolean(n))
        : [];
      if (getAuthToken()) {
        const remote = await apiGetNotifications();
        if (remote) {
          list = remote.map(sanitizeNotification).filter((n): n is AppNotification => Boolean(n));
        } else {
          const state = await apiGetAccountState();
          if (Array.isArray(state?.notifications)) {
            list = mergeById(
              list,
              state.notifications.map(sanitizeNotification).filter((n): n is AppNotification => Boolean(n)),
            );
          }
        }
      }
      if (!active) return;
      for (const n of list) seenToast.current.add(n.id);
      setItems(list);
      hydrated.current = true;
      setReady(true);
      skipSave.current = false;
    })();
    return () => {
      active = false;
    };
  }, [authReady, accountId]);

  useEffect(() => {
    if (!hydrated.current || skipSave.current || !accountId) return;
    void saveAccountJson(STORAGE_KEY, accountId, items);
  }, [items, accountId]);

  useEffect(() => {
    if (!authReady || !accountId || !getAuthToken()) return;
    const t = setInterval(() => void pullRemote({ toastNew: true }), 3000);
    return () => clearInterval(t);
  }, [authReady, accountId, pullRemote]);

  const displayItems = useMemo(() => items.map(withRelativeTime), [items]);

  const unreadCount = useMemo(() => displayItems.filter((n) => !n.read).length, [displayItems]);

  const markAsRead = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (getAuthToken()) void apiMarkNotificationRead(id).catch(() => undefined);
  }, []);

  const markAllAsRead = useCallback(() => {
    setItems((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
    if (getAuthToken()) void apiMarkAllNotificationsRead().catch(() => undefined);
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
      if (!(input.read ?? false) && !seenToast.current.has(next.id)) {
        seenToast.current.add(next.id);
        queueMicrotask(() =>
          showToast({
            title: next.title,
            body: next.preview || next.body || undefined,
            tone: 'info',
            href: next.actionHref || '/notifications',
          }),
        );
      }
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
