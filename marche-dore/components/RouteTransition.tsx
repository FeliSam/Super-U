import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

/** Fondu + léger glissement à chaque focus d’écran (web inclus, sans native-screens). */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (!focused) {
      opacity.value = 1;
      translateX.value = 0;
      return;
    }
    opacity.value = 0.55;
    translateX.value = 10;
    opacity.value = withTiming(1, { duration: 140, easing: easeOut });
    translateX.value = withTiming(0, { duration: 160, easing: easeOut });
  }, [focused, opacity, translateX]);

  const style = useAnimatedStyle(() => ({
    flex: 1,
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', width: '100%' },
});
