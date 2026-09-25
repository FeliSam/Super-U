import * as SplashScreen from 'expo-splash-screen';

let preventDone = false;

export async function prepareNativeSplash(): Promise<void> {
  if (preventDone) return;
  preventDone = true;
  try {
    await SplashScreen.preventAutoHideAsync();
  } catch {
    /* Expo Go / web */
  }
}

export async function hideSplash(): Promise<void> {
  try {
    await SplashScreen.hideAsync();
  } catch {
    /* already hidden */
  }
}

void prepareNativeSplash();
