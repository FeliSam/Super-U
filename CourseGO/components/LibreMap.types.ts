import type { LngLat, MapMarker } from '@/constants/map';
import type { StyleProp, ViewStyle } from 'react-native';

export type LibreMapProps = {
  style?: StyleProp<ViewStyle>;
  mapStyle: string;
  center: LngLat;
  zoom?: number;
  markers?: MapMarker[];
  route?: LngLat[];
  fitToMarkers?: boolean;
  fitIncludeCourier?: boolean;
  fitPadding?: number | { top: number; bottom: number; left: number; right: number };
  interactive?: boolean;
  showNavigation?: boolean;
};
