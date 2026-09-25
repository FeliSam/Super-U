/**
 * Fallback si Metro ne résout pas `.web` / `.native`.
 * Ne pas importer `.native` ici — sinon le bundle web tire react-native-maps.
 */
export type { LibreMapProps } from '@/components/LibreMap.types';

export function warmLibreMap(_styleUrl?: string, _center?: unknown, _zoom?: number) {
  return Promise.resolve();
}

export function LibreMap(_props: import('@/components/LibreMap.types').LibreMapProps) {
  // Si ce stub s’affiche sur iPhone, Metro n’a pas pris LibreMap.native.tsx.
  return null;
}
