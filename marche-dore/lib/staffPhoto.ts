import { avatar } from '@/data/catalog';
import { getApiBaseUrl } from '@/lib/api/http';
import type { ImageSourcePropType } from 'react-native';

export function staffPhotoSource(staffId?: string | null): ImageSourcePropType {
  const id = staffId?.trim();
  if (!id) return avatar;
  const base = getApiBaseUrl().replace(/\/$/, '');
  return { uri: `${base}/ops/staff/${encodeURIComponent(id)}/photo` };
}
