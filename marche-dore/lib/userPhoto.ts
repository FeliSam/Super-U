import { avatar } from '@/data/catalog';
import { getApiBaseUrl } from '@/lib/api/http';
import type { ImageSourcePropType } from 'react-native';

export function userPhotoSource(userId?: string | null): ImageSourcePropType {
  const id = userId?.trim();
  if (!id) return avatar;
  const base = getApiBaseUrl().replace(/\/$/, '');
  return { uri: `${base}/users/${encodeURIComponent(id)}/photo` };
}
