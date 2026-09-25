import { LogBox, Platform, Alert } from 'react-native';

type BootFatal = { message: string; stack?: string; at: number };

let lastFatal: BootFatal | null = null;
const fatalListeners = new Set<(f: BootFatal | null) => void>();

export function getBootFatal() {
  return lastFatal;
}

export function subscribeBootFatal(fn: (f: BootFatal | null) => void) {
  fatalListeners.add(fn);
  if (lastFatal) fn(lastFatal);
  return () => {
    fatalListeners.delete(fn);
  };
}

function publishFatal(error: unknown, isFatal?: boolean) {
  const err = error instanceof Error ? error : new Error(String(error ?? 'Erreur inconnue'));
  const payload: BootFatal = {
    message: err.message || String(error),
    stack: typeof err.stack === 'string' ? err.stack.split('\n').slice(0, 12).join('\n') : undefined,
    at: Date.now(),
  };
  lastFatal = payload;
  fatalListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* ignore */
    }
  });
  console.error('[Marché Doré FATAL]', payload.message, '\n', payload.stack ?? '', isFatal ? '(fatal)' : '');
  if (/unknown module|metro/i.test(payload.message)) return;
  try {
    Alert.alert('Erreur Marché Doré', payload.message.slice(0, 400), [{ text: 'OK' }]);
  } catch {
    /* Alert indisponible au boot */
  }
}

function isNoiseReason(reason: unknown): boolean {
  if (reason == null) return true;
  if (typeof reason === 'string' && !reason.trim()) return true;
  if (typeof reason === 'object' && !(reason instanceof Error) && !Array.isArray(reason)) {
    try {
      const o = reason as Record<string, unknown>;
      const keys = Object.keys(o);
      if (keys.length === 0) return true;
      if (
        typeof o.code === 'number' &&
        typeof o.message === 'string' &&
        keys.every((k) => k === 'code' || k === 'message' || k === 'PERMISSION_DENIED' || k === 'POSITION_UNAVAILABLE' || k === 'TIMEOUT')
      ) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

let installed = false;

export function installLaunchGuards() {
  if (installed) return;
  installed = true;

  LogBox.ignoreLogs([
    'Listening to push token changes is not yet fully supported on web',
    'expo-notifications: Android Push notifications',
    'functionality is not fully supported in Expo Go',
    'Use a development build instead of Expo Go',
    'expo.fyi/dev-client',
    'props.pointerEvents is deprecated',
    'shadow*" style props are deprecated',
    'useNativeDriver',
    'Property [transform] may be overwritten by a layout animation',
    'Map cannot fit within canvas',
    'AJAXError',
    'tiles.openfreemap.org',
    'Writing to `value` during component render',
  ]);

  const warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
    if (/expo-notifications|development build|expo\.fyi\/dev-client|not fully supported in Expo Go/i.test(text)) {
      return;
    }
    warn(...(args as Parameters<typeof console.warn>));
  };

  try {
    const g = globalThis as typeof globalThis & {
      ErrorUtils?: {
        getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      };
    };
    const EU = g.ErrorUtils;
    if (EU?.getGlobalHandler && EU?.setGlobalHandler) {
      const prev = EU.getGlobalHandler();
      EU.setGlobalHandler((error, isFatal) => {
        const msg = error instanceof Error ? error.message : String(error ?? '');
        // Modules optionnels (ex. expo-location après install) : ne pas tuer l’app.
        if (/Requiring unknown module/i.test(msg)) {
          console.warn('[Marché Doré]', msg);
          return;
        }
        publishFatal(error, isFatal);
        try {
          prev?.(error, isFatal);
        } catch {
          /* ignore */
        }
      });
    }
  } catch {
    /* ignore */
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      if (isNoiseReason(event.reason)) {
        event.preventDefault();
        return;
      }
      publishFatal(event.reason, false);
    });
    window.addEventListener('error', (event) => {
      publishFatal(event.error ?? event.message, true);
    });
  }
}
