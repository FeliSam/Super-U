import { getApiBaseUrl } from '@/lib/api/http';
import avatarImg from '@/assets/images/avatar.png';
import { Platform, type ImageSourcePropType } from 'react-native';

export function staffPhotoSource(photoUrl?: string | null, bust?: number): ImageSourcePropType {
  const path = photoUrl?.trim();
  if (!path) return avatarImg;
  const abs = path.startsWith('http') ? path : `${getApiBaseUrl()}${path}`;
  return { uri: bust ? `${abs}${abs.includes('?') ? '&' : '?'}t=${bust}` : abs };
}

export async function pickStaffPhoto(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
