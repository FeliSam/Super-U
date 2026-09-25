import 'react-native-gesture-handler';
// Initialise le runtime Expo AVANT tout module qui tire expo-font / ExpoAsset
// (sinon: "[runtime not ready]: Cannot find native module 'ExpoAsset'" + main not registered).
import 'expo';
import 'expo-router/entry';
