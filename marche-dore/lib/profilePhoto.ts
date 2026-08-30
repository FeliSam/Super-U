import { avatar } from '@/data/catalog';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform, type ImageSourcePropType } from 'react-native';

export function profilePhotoSource(photoUri?: string | null): ImageSourcePropType {
  const uri = photoUri?.trim();
  if (uri) return { uri };
  return avatar;
}

export async function pickProfilePhoto(): Promise<string | null> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Accès refusé', 'Autorisez l’accès à la galerie pour changer votre photo.');
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.55,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.base64) {
    const mime = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg';
    return `data:${mime};base64,${asset.base64}`;
  }
  if (!asset.uri) return null;
  return persistablePhotoUri(asset.uri);
}

async function persistablePhotoUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : uri;
        resolve(result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return uri;
  }
}
