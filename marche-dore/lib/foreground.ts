import { AppState, Platform } from 'react-native';

function isForeground() {
  if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return false;
  }
  return AppState.currentState === 'active';
}

/** Subscribe to app / tab visibility. Starts with the current state. */
export function subscribeForeground(onChange: (active: boolean) => void): () => void {
  onChange(isForeground());
  const sub = AppState.addEventListener('change', () => onChange(isForeground()));
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return () => sub.remove();
  }
  const vis = () => onChange(isForeground());
  document.addEventListener('visibilitychange', vis);
  return () => {
    sub.remove();
    document.removeEventListener('visibilitychange', vis);
  };
}

/** Run `tick` on an interval only while the app is in the foreground. Pulls once on resume unless `immediate` is false. */
export function pollWhileForeground(tick: () => void, ms: number, immediate = true): () => void {
  let id: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    if (id == null) return;
    clearInterval(id);
    id = null;
  };
  const start = () => {
    if (id != null) return;
    id = setInterval(tick, ms);
  };
  const unsub = subscribeForeground((active) => {
    if (active) {
      if (immediate) tick();
      start();
    } else {
      stop();
    }
  });
  return () => {
    stop();
    unsub();
  };
}
