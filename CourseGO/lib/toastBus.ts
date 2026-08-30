export type ToastTone = 'info' | 'error' | 'success';

export type ToastPayload = {
  title: string;
  body?: string;
  tone?: ToastTone;
  href?: string;
  durationMs?: number;
};

type Listener = (payload: ToastPayload) => void;

const listeners = new Set<Listener>();

export function subscribeToasts(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function showToast(payload: ToastPayload) {
  if (!payload.title.trim()) return;
  listeners.forEach((fn) => fn(payload));
}
