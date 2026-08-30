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
  fitMaxZoom?: number;
  /** Recentre la caméra quand `center` change. Désactivé si l’utilisateur a déjà bougé la carte. */
  followCamera?: boolean;
  /**
   * Mode navigation type Google Maps : carte inclinée, cap devant,
   * le livreur en bas de l’écran. À activer au choix.
   */
  navigationMode?: boolean;
  /** Cap en degrés (0 = nord). Utilisé en mode navigation. */
  bearing?: number;
  /** Incrémenter pour reprendre le suivi après un geste. */
  followResumeTick?: number;
  onFollowBreak?: () => void;
  interactive?: boolean;
  showNavigation?: boolean;
  onMarkerPress?: (id: string) => void;
};
