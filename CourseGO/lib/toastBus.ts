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
/** Toasts émis avant que ToastHost soit monté (boot / splash). */
const pending: ToastPayload[] = [];

export function subscribeToasts(fn: Listener) {
  listeners.add(fn);
  if (pending.length) {
    const queued = pending.splice(0, pending.length);
    queued.forEach((payload) => fn(payload));
  }
  return () => {
    listeners.delete(fn);
  };
}

export function showToast(payload: ToastPayload) {
  if (!payload.title.trim()) return;
  if (listeners.size === 0) {
    pending.push(payload);
    if (pending.length > 8) pending.shift();
    return;
  }
  listeners.forEach((fn) => fn(payload));
}

/** Vide la file (splash / auth) pour ne pas afficher des toasts sur welcome/login. */
export function clearPendingToasts() {
  pending.length = 0;
}
