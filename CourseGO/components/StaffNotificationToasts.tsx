import { useCall } from '@/context/CallContext';
import { useStaffNotifications } from '@/context/NotificationsContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useStaffPrefs } from '@/context/StaffPrefsContext';
import { showToast } from '@/lib/toastBus';
import { useEffect, useRef } from 'react';

function allowed(kind: string, prefs: { notifJobs: boolean; notifChat: boolean; notifCalls: boolean }) {
  if (kind === 'job') return prefs.notifJobs;
  if (kind === 'chat') return prefs.notifChat;
  if (kind === 'call') return prefs.notifCalls;
  return true;
}

function sessionKey(staffId: string) {
  return `coursego.notif.seen.${staffId}`;
}

function loadSeen(staffId: string) {
  try {
    const raw = sessionStorage.getItem(sessionKey(staffId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function saveSeen(staffId: string, ids: Set<string>) {
  try {
    sessionStorage.setItem(sessionKey(staffId), JSON.stringify([...ids].slice(-200)));
  } catch {
    /* ignore */
  }
}

/** Toasts only true new events this session. Calls already on overlay are skipped. */
export function StaffNotificationToasts() {
  const { items, ready, markRead } = useStaffNotifications();
  const { prefs } = useStaffPrefs();
  const { staff } = useStaffAuth();
  const { phase, call } = useCall();
  const seen = useRef<Set<string> | null>(null);
  const staffKey = staff?.id ?? null;

  useEffect(() => {
    seen.current = staffKey ? loadSeen(staffKey) : new Set();
  }, [staffKey]);

  useEffect(() => {
    if (!ready || !staffKey) return;
    if (seen.current === null) seen.current = loadSeen(staffKey);
    const onCall = phase === 'incoming' || phase === 'outgoing' || phase === 'active';
    for (const n of items) {
      if (n.read_at) {
        seen.current.add(n.id);
        continue;
      }
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (n.kind === 'call' && onCall) {
        if (phase === 'outgoing' || phase === 'active') void markRead(n.id);
        continue;
      }
      if (n.kind === 'call' && call?.id && n.id.includes(call.id)) continue;
      if (!allowed(n.kind, prefs)) continue;
      showToast({
        title: n.kind === 'call' && phase === 'outgoing' ? 'Appel émis' : n.title,
        body: n.body || undefined,
        tone: n.kind === 'call' ? 'error' : n.kind === 'job' ? 'success' : 'info',
        href: n.href || '/notifications',
      });
    }
    saveSeen(staffKey, seen.current);
  }, [items, prefs, ready, staffKey, phase, call?.id, markRead]);

  return null;
}
