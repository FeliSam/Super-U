import 'react-native-gesture-handler';
import '@expo/metro-runtime';
import { Feather } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { loadBrandFonts } from './lib/fonts';

void Font.loadAsync(Feather.font).catch(() => undefined);
void loadBrandFonts();

import 'expo-router/entry';
