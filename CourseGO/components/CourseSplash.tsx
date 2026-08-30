import { CourseLogo } from '@/components/CourseLogo';
import { bodyFont, colors } from '@/constants/theme';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

export function CourseSplash({ onFinish }: { onFinish: () => void }) {
  const scale = useSharedValue(0.86);
  const opacity = useSharedValue(0);
  const tag = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: 14, stiffness: 170 });
    tag.value = withDelay(220, withTiming(1, { duration: 320 }));
    const t = setTimeout(onFinish, 1600);
    return () => clearTimeout(t);
  }, [onFinish, opacity, scale, tag]);

  const mark = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const word = useAnimatedStyle(() => ({ opacity: tag.value }));

  return (
    <View style={styles.root}>
      <Animated.View style={mark}>
        <CourseLogo width={260} />
      </Animated.View>
      <Animated.View style={word}>
        <Text style={styles.tag}>Ramasser · Livrer · Cotonou</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 80,
    gap: 16,
  },
  tag: { ...bodyFont('600'), fontSize: 14, color: colors.muted, textAlign: 'center' },
});
