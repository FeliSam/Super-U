import { apiFetch } from '@/lib/api/http';
import type { AppNotification } from '@/data/notifications';

export async function apiGetNotifications(): Promise<AppNotification[] | null> {
  try {
    const res = await apiFetch<{ ok: true; items: AppNotification[] }>('/me/notifications');
    return Array.isArray(res.items) ? res.items : [];
  } catch {
    return null;
  }
}

export async function apiMarkNotificationRead(id: string) {
  await apiFetch(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export async function apiMarkAllNotificationsRead() {
  await apiFetch('/me/notifications/read-all', { method: 'POST' });
}
