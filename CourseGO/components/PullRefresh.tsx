import { colors, displayFont } from '@/constants/theme';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';

export function pullRefreshControl(refreshing: boolean, onRefresh: () => void) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.teal}
      colors={[colors.teal]}
      progressBackgroundColor={colors.white}
      progressViewOffset={Platform.OS === 'web' ? 12 : 0}
    />
  );
}

/** Bandeau discret en haut de liste pendant le pull-to-refresh (sans icône). */
export function PullBanner({ visible }: { visible: boolean }) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      slide.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, slide]);

  if (!visible) return null;

  const x = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-48, 160],
  });

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.track}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX: x }] }]} />
      </View>
      <Text style={styles.txt}>Mise à jour…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  track: {
    width: 120,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.tealSoft,
    overflow: 'hidden',
  },
  thumb: {
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.teal,
  },
  txt: { ...displayFont('700'), fontSize: 11, letterSpacing: 0.4, color: colors.muted },
});
