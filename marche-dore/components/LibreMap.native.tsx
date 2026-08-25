import type { LibreMapProps } from '@/components/LibreMap.types';
import { cotonouMap, routeLineGeoJSON } from '@/constants/map';
import { useColors } from '@/context/ThemeContext';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  ViewAnnotation,
} from '@maplibre/maplibre-react-native';
import { Feather } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

function Pin({
  color,
  kind,
  label,
}: {
  color: string;
  kind?: string;
  label?: string;
}) {
  if (kind === 'superu') {
    return (
      <View style={pinStyles.wrap}>
        {label ? (
          <View style={pinStyles.label}>
            <Text style={pinStyles.labelText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : null}
        <View style={[pinStyles.superU, { backgroundColor: color }]}>
          <Text style={pinStyles.superULetter}>U</Text>
        </View>
        <View style={[pinStyles.superUTip, { borderTopColor: color }]} />
      </View>
    );
  }

  const icon =
    kind === 'store' ? 'shopping-bag' : kind === 'home' ? 'home' : kind === 'courier' ? 'truck' : 'map-pin';
  return (
    <View style={pinStyles.wrap}>
      {label ? (
        <View style={pinStyles.label}>
          <Text style={pinStyles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
      <View style={[pinStyles.dot, { backgroundColor: color }]}>
        <Feather name={icon as 'map-pin'} size={14} color="#ffffff" />
      </View>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  label: {
    maxWidth: 120,
    backgroundColor: 'rgba(20,17,15,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  labelText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  superU: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    shadowColor: '#e30613',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  superULetter: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    letterSpacing: -1,
  },
  superUTip: {
    width: 0,
    height: 0,
    marginTop: -6,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

/**
 * Native MapLibre (requires a development build — not Expo Go).
 */
export function warmLibreMap(_styleUrl?: string, _center?: unknown, _zoom?: number) {
  return Promise.resolve();
}

export function LibreMap({
  style,
  mapStyle,
  center,
  zoom = cotonouMap.zoom,
  markers = [],
  route,
  interactive = true,
  onReady,
  onError,
  onPressMap,
  onPressMarker,
}: LibreMapProps) {
  const colors = useColors();
  const routeData = route && route.length >= 2 ? routeLineGeoJSON(route) : null;

  return (
    <View style={[styles.wrap, style]}>
      <Map
        style={styles.map}
        mapStyle={mapStyle}
        logo={false}
        attribution
        compass={false}
        dragPan={interactive}
        touchZoom={interactive}
        touchRotate={interactive}
        touchPitch={false}
        onDidFinishLoadingMap={onReady}
        onDidFailLoadingMap={() => onError?.('Impossible de charger la carte')}
        onPress={(e) => {
          const lngLat = e.nativeEvent?.lngLat;
          if (lngLat) onPressMap?.(lngLat);
        }}>
        <Camera
          initialViewState={{ center, zoom }}
          center={center}
          zoom={zoom}
          duration={500}
          easing="ease"
        />

        {routeData ? (
          <GeoJSONSource id="md-route" data={routeData}>
            <Layer
              id="md-route-line"
              type="line"
              paint={{
                'line-color': colors.gold,
                'line-width': 4,
                'line-opacity': 0.85,
                'line-dasharray': [1.2, 1.4],
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </GeoJSONSource>
        ) : null}

        {markers.map((m) => (
          <ViewAnnotation key={m.id} lngLat={m.coordinate} anchor="bottom">
            <Pressable
              onPress={() => onPressMarker?.(m.id, m.coordinate)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={m.label || m.id}>
              <Pin color={m.color ?? colors.gold} kind={m.kind} label={m.label} />
            </Pressable>
          </ViewAnnotation>
        ))}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#1a1714' },
  map: { flex: 1 },
});
