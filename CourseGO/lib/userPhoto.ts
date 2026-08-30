import { getApiBaseUrl } from '@/lib/api/http';
import avatarImg from '@/assets/images/avatar.png';
import type { ImageSourcePropType } from 'react-native';

export function userPhotoSource(userId?: string | null): ImageSourcePropType {
  const id = userId?.trim();
  if (!id) return avatarImg;
  const base = getApiBaseUrl().replace(/\/$/, '');
  return { uri: `${base}/users/${encodeURIComponent(id)}/photo` };
}
