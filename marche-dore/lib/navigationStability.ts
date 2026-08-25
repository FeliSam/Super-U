import { Platform } from 'react-native';
import { enableFreeze, enableScreens } from 'react-native-screens';

/**
 * On web, native-screens often unmount inactive routes (MPA feel + font/image flash).
 * Disable them so Stack/Tabs keep screens in the DOM like a real SPA.
 */
if (Platform.OS === 'web') {
  enableScreens(false);
} else {
  enableScreens(true);
  enableFreeze(true);
}
