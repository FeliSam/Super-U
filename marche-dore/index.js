import 'react-native-gesture-handler';
import '@expo/metro-runtime';

/**
 * Kick off icon + brand fonts as early as possible (before router mounts).
 */
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { loadBrandFonts } from './lib/fonts';

void Font.loadAsync({
  ...Feather.font,
  ...Ionicons.font,
}).catch(() => undefined);

void loadBrandFonts();

import 'expo-router/entry';
