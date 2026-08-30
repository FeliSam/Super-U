import { colors, displayFont, radius } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import type { ComponentProps } from 'react';

export type SwipeAction = {
  key: string;
  label: string;
  tone: 'teal' | 'coral' | 'muted';
  icon: ComponentProps<typeof Feather>['name'];
  onPress: () => void;
};

export function SwipeRow({
  left,
  right,
  children,
}: {
  left?: SwipeAction[];
  right?: SwipeAction[];
  children: ReactNode;
}) {
  const ref = useRef<Swipeable>(null);
  const run = (fn: () => void) => {
    ref.current?.close();
    fn();
  };

  return (
    <Swipeable
      ref={ref}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
      containerStyle={styles.wrap}
      childrenContainerStyle={styles.child}
      renderLeftActions={
        left?.length
          ? () => (
              <View style={styles.row}>
                {left.map((a) => (
                  <ActionBtn key={a.key} action={a} onPress={() => run(a.onPress)} />
                ))}
              </View>
            )
          : undefined
      }
      renderRightActions={
        right?.length
          ? () => (
              <View style={styles.row}>
                {right.map((a) => (
                  <ActionBtn key={a.key} action={a} onPress={() => run(a.onPress)} />
                ))}
              </View>
            )
          : undefined
      }>
      {children}
    </Swipeable>
  );
}

function ActionBtn({ action, onPress }: { action: SwipeAction; onPress: () => void }) {
  const bg = action.tone === 'teal' ? colors.teal : action.tone === 'coral' ? colors.coral : colors.text;
  return (
    <Pressable onPress={onPress} style={[styles.btn, { backgroundColor: bg }]} accessibilityLabel={action.label}>
      <Feather name={action.icon} size={18} color={colors.onAccent} />
      <Text style={styles.btnTxt}>{action.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.card, overflow: 'hidden' },
  child: { backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  btn: {
    minWidth: 88,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  btnTxt: { ...displayFont('800'), fontSize: 11, color: colors.onAccent, textAlign: 'center' },
});
