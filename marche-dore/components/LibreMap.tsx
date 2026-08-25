/**
 * Platform entry — Metro resolves `.web` / `.native`.
 * This fallback keeps TypeScript happy when resolving the bare module path.
 */
export type { LibreMapProps } from '@/components/LibreMap.types';
export { LibreMap, warmLibreMap } from '@/components/LibreMap.web';
