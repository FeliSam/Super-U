import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export const MAX_REVIEW_IMAGES = 4;

export async function pickReviewImages(remaining: number): Promise<string[]> {
  if (remaining <= 0) return [];

  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Accès refusé', 'Autorisez l’accès à la galerie pour ajouter des photos à votre avis.');
      return [];
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.length) return [];
  return result.assets.map((asset) => asset.uri).filter(Boolean);
}
