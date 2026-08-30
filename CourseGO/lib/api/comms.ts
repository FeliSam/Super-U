import { apiFetch } from '@/lib/api/http';

export type InboxThread = {
  id: string;
  kind: string;
  order_id: string | null;
  last_body: string | null;
  last_kind: string | null;
  last_at: string | null;
  unread: number;
  disabled_at?: string | null;
  disabled_by?: string | null;
};

export type CommsMessage = {
  id: string;
  thread_id: string;
  sender_kind: 'customer' | 'staff' | 'system';
  kind: string;
  body: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type CommsCall = {
  id: string;
  thread_id: string;
  status: string;
  media: string;
  answered_at: string | null;
  peer_name?: string | null;
  role?: 'caller' | 'callee';
};

export async function fetchInbox() {
  return apiFetch<{ ok: true; threads: InboxThread[] }>('/comms/inbox');
}

export async function fetchThread(id: string) {
  return apiFetch<{
    ok: true;
    thread: { id: string; order_id: string | null; title: string | null; disabled_at?: string | null };
    members: {
      actor_kind: string;
      user_first?: string | null;
      user_last?: string | null;
      staff_first?: string | null;
      staff_last?: string | null;
    }[];
  }>(`/comms/threads/${encodeURIComponent(id)}`);
}

export async function fetchMessages(id: string) {
  return apiFetch<{ ok: true; messages: CommsMessage[] }>(
    `/comms/threads/${encodeURIComponent(id)}/messages?limit=50`,
  );
}

export async function sendMessage(id: string, body: string) {
  return apiFetch<{ ok: true; message: CommsMessage }>(
    `/comms/threads/${encodeURIComponent(id)}/messages`,
    { method: 'POST', body: JSON.stringify({ kind: 'text', body }) },
  );
}

export async function markRead(id: string) {
  return apiFetch<{ ok: true }>(`/comms/threads/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export async function setThreadDisabled(id: string, disabled: boolean) {
  return apiFetch<{ ok: true; disabled: boolean }>(
    `/comms/threads/${encodeURIComponent(id)}/${disabled ? 'disable' : 'enable'}`,
    { method: 'POST' },
  );
}

export async function startCall(threadId: string, media: 'audio' | 'video' = 'audio') {
  return apiFetch<{ ok: true; call: CommsCall }>(
    `/comms/threads/${encodeURIComponent(threadId)}/calls`,
    { method: 'POST', body: JSON.stringify({ media }) },
  );
}

export async function fetchLiveCall() {
  return apiFetch<{ ok: true; call: CommsCall | null }>('/comms/live');
}

export async function fetchRingingCall() {
  return apiFetch<{ ok: true; call: CommsCall | null }>('/comms/ringing');
}

export async function getCall(id: string) {
  return apiFetch<{ ok: true; call: CommsCall }>(`/comms/calls/${encodeURIComponent(id)}`);
}

export async function acceptCall(id: string) {
  return apiFetch<{ ok: true; call: CommsCall }>(`/comms/calls/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
  });
}

export async function rejectCall(id: string) {
  return apiFetch<{ ok: true }>(`/comms/calls/${encodeURIComponent(id)}/reject`, { method: 'POST' });
}

export async function cancelCall(id: string) {
  return apiFetch<{ ok: true }>(`/comms/calls/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

export async function hangupCall(id: string) {
  return apiFetch<{ ok: true }>(`/comms/calls/${encodeURIComponent(id)}/hangup`, { method: 'POST' });
}
