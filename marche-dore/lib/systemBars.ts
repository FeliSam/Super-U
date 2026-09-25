import { setStatusBarStyle } from 'expo-status-bar';
import Constants from 'expo-constants';
import { AppState, Platform, StatusBar as RNStatusBar } from 'react-native';

/** Status bar inset helper — web preview has no notch gap. */
export function chromeSafeTop(insetTop: number) {
  if (Platform.OS === 'web') return 0;
  return insetTop;
}

function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

/**
 * Soft status-bar handling.
 * Never call setHidden on Expo Go — iOS RNSScreenWindowTraits can kill the app.
 */
export function hideSystemBars() {
  if (Platform.OS === 'web') return;

  // Expo Go : style only, never hide.
  if (isExpoGo()) {
    try {
      setStatusBarStyle('dark');
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    if (Platform.OS === 'android') {
      RNStatusBar.setHidden(true, 'none');
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent', true);
    }
    // iOS store builds: leave visible; Stack must not set statusBarHidden.
  } catch {
    /* ignore */
  }
}

export function watchHiddenSystemBars() {
  hideSystemBars();
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') hideSystemBars();
  });
  return () => sub.remove();
}
