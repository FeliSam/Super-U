import { LogBox, Platform } from 'react-native';

function isNoiseReason(reason: unknown): boolean {
  if (reason == null) return true;
  if (typeof reason === 'string' && !reason.trim()) return true;
  if (typeof reason === 'object' && !(reason instanceof Error) && !Array.isArray(reason)) {
    try {
      const o = reason as Record<string, unknown>;
      const keys = Object.keys(o);
      if (keys.length === 0) return true;
      // GeolocationPositionError often serializes oddly in LogBox
      if (typeof o.code === 'number' && typeof o.message === 'string' && keys.every((k) => k === 'code' || k === 'message' || k === 'PERMISSION_DENIED' || k === 'POSITION_UNAVAILABLE' || k === 'TIMEOUT')) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

let installed = false;

/**
 * Soften launch-time noise (empty rejections, web-only push warnings) so LogBox
 * does not look like a fatal crash. Real Error instances still surface.
 */
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
  ]);

  const warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
    if (/expo-notifications|development build|expo\.fyi\/dev-client|not fully supported in Expo Go/i.test(text)) {
      return;
    }
    warn(...(args as Parameters<typeof console.warn>));
  };

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      if (isNoiseReason(event.reason)) {
        event.preventDefault();
      }
    });

    const original = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      if (args.every((a) => isNoiseReason(a))) return;
      if (args.length === 1 && isNoiseReason(args[0])) return;
      original(...(args as Parameters<typeof console.error>));
    };
  }
}

// Run at module load so Metro/LogBox cannot race import hoisting in index.js
installLaunchGuards();
