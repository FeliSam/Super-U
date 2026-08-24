import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

function Star({ fill, size }: { fill: number; size: number }) {
  const clamped = Math.min(1, Math.max(0, fill));

  return (
    <View style={[styles.starSlot, { width: size, height: size }]}>
      <Ionicons name="star-outline" size={size} color={colors.placeholder} style={styles.starOutline} />
      <View style={[styles.starFillMask, { width: `${clamped * 100}%` }]}>
        <Ionicons name="star" size={size} color={colors.gold} />
      </View>
    </View>
  );
}

export function StarRating({
  rating,
  size = 14,
  max = 5,
  gap = 2,
  interactive = false,
  onChange,
}: {
  rating: number;
  size?: number;
  max?: number;
  gap?: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
}) {
  const clampedRating = Math.min(max, Math.max(0, rating));

  if (interactive && onChange) {
    return (
      <View style={[styles.row, { gap }]}>
        {Array.from({ length: max }).map((_, index) => {
          const filled = index < Math.round(clampedRating);
          return (
            <Pressable key={index} onPress={() => onChange(index + 1)} hitSlop={6}>
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={size}
                color={filled ? colors.gold : colors.placeholder}
              />
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.row, { gap }]}>
      {Array.from({ length: max }).map((_, index) => (
        <Star key={index} fill={clampedRating - index} size={size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  starSlot: { position: 'relative', overflow: 'hidden' },
  starOutline: { position: 'absolute', left: 0, top: 0 },
  starFillMask: { height: '100%', overflow: 'hidden' },
});
