import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WINDOW_H = Dimensions.get('window').height;

/** Opens just under the floating icon bar (Profil / rayons). */
export const SHEET_TOP_GAP = 56;
export const SHEET_MIN_RATIO = 0.58;
export const SHEET_MIN = Math.round(WINDOW_H * SHEET_MIN_RATIO);
export const SHEET_MAX = Math.round(WINDOW_H - SHEET_TOP_GAP);
export const SHEET_COLLAPSED_TY = Math.max(0, SHEET_MAX - SHEET_MIN);

/** Soft spring — translateY stays on the compositor (no layout thrash). */
export const SHEET_SPRING = { damping: 24, stiffness: 190, mass: 0.88 } as const;

/**
 * Shared expandable bottom-sheet (Profil + category pages).
 * Collapsed peek → full height under the top icon bar; scroll/handle expand.
 */
export function useExpandableSheet(minRatio = SHEET_MIN_RATIO) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const sheetMin = Math.round(height * minRatio);
  const sheetTopGap = Math.max(insets.top + 8, SHEET_TOP_GAP);
  const sheetMax = Math.round(height - sheetTopGap);
  const collapsedOffset = Math.max(0, sheetMax - sheetMin);

  const sheetTY = useSharedValue(SHEET_COLLAPSED_TY);
  const dragStartTY = useSharedValue(SHEET_COLLAPSED_TY);
  const maxTY = useSharedValue(SHEET_COLLAPSED_TY);
  const expanded = useSharedValue(0);
  const scrollExpandedRef = useRef(false);

  useEffect(() => {
    maxTY.value = collapsedOffset;
    const target = expanded.value ? 0 : collapsedOffset;
    sheetTY.value = withSpring(target, SHEET_SPRING);
  }, [collapsedOffset, sheetTY, maxTY, expanded]);

  const markScrollExpanded = useCallback(() => {
    scrollExpandedRef.current = true;
  }, []);

  const clearScrollExpanded = useCallback(() => {
    scrollExpandedRef.current = false;
  }, []);

  const expandFromScroll = useCallback(() => {
    if (scrollExpandedRef.current) return;
    scrollExpandedRef.current = true;
    expanded.value = 1;
    sheetTY.value = withSpring(0, SHEET_SPRING);
  }, [expanded, sheetTY]);

  const onSheetScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (e.nativeEvent.contentOffset.y > 8) expandFromScroll();
    },
    [expandFromScroll],
  );

  const onSheetScrollBeginDrag = useCallback(() => {
    expandFromScroll();
  }, [expandFromScroll]);

  /** Horizontal filter chips (category) — any nudge opens the sheet. */
  const onFiltersScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Math.abs(e.nativeEvent.contentOffset.x) > 0.5) expandFromScroll();
    },
    [expandFromScroll],
  );

  const sheetHandleGesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY([-6, 6])
        .failOffsetX([-48, 48])
        .onStart(() => {
          'worklet';
          dragStartTY.value = sheetTY.value;
        })
        .onUpdate((e) => {
          'worklet';
          const next = dragStartTY.value + e.translationY;
          sheetTY.value = Math.min(maxTY.value, Math.max(0, next));
        })
        .onEnd((e) => {
          'worklet';
          const isTap = Math.abs(e.translationY) < 10 && Math.abs(e.velocityY) < 280;
          const mid = maxTY.value * 0.5;
          let toExpanded: boolean;
          if (isTap) {
            toExpanded = sheetTY.value > mid * 0.35;
          } else {
            const projected = sheetTY.value + e.velocityY * 0.14;
            toExpanded = e.velocityY < -320 || (e.velocityY <= 320 && projected < mid);
          }
          expanded.value = toExpanded ? 1 : 0;
          sheetTY.value = withSpring(toExpanded ? 0 : maxTY.value, {
            ...SHEET_SPRING,
            velocity: e.velocityY,
          });
          if (toExpanded) runOnJS(markScrollExpanded)();
          else runOnJS(clearScrollExpanded)();
        }),
    [dragStartTY, sheetTY, maxTY, expanded, markScrollExpanded, clearScrollExpanded],
  );

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTY.value }],
  }));

  return {
    sheetMin,
    sheetMax,
    sheetAnimStyle,
    sheetHandleGesture,
    expandFromScroll,
    onSheetScroll,
    onSheetScrollBeginDrag,
    onFiltersScroll,
  };
}
