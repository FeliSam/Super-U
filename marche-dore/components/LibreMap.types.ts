import type { LngLat, MapMarker } from '@/constants/map';
import type { StyleProp, ViewStyle } from 'react-native';

export type LibreMapProps = {
  style?: StyleProp<ViewStyle>;
  /** Map style URL (OpenFreeMap / custom). */
  mapStyle: string;
  center: LngLat;
  zoom?: number;
  markers?: MapMarker[];
  /** Optional route line (store → home). */
  route?: LngLat[];
  interactive?: boolean;
  /** Show +/- zoom control. Default true. */
  showNavigation?: boolean;
  /** Offset for MapLibre navigation control (px from top-right). */
  navigationOffset?: { top?: number; right?: number };
  /** Called once the map canvas is ready. */
  onReady?: () => void;
  /** Style / tile / worker failure — show a friendly overlay. */
  onError?: (message?: string) => void;
  /** Tap / click on the map (lng, lat). */
  onPressMap?: (coordinate: LngLat) => void;
  /** Tap / click on a marker (by id). */
  onPressMarker?: (markerId: string, coordinate: LngLat) => void;
};
