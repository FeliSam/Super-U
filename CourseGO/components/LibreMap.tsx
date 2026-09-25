export type { LibreMapProps } from '@/components/LibreMap.types';

// Platform files: LibreMap.web.tsx / LibreMap.native.tsx are picked by Metro.
// This fallback keeps TypeScript happy for non-platform imports.
export { LibreMap } from '@/components/LibreMap.web';
