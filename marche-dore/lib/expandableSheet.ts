import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
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

/** Opens just under the floating icon bar (Profil / rayons / produit). */
export const SHEET_TOP_GAP = 56;
export const SHEET_MIN_RATIO = 0.58;
export const SHEET_MIN = Math.round(WINDOW_H * SHEET_MIN_RATIO);
export const SHEET_MAX = Math.round(WINDOW_H - SHEET_TOP_GAP);
export const SHEET_COLLAPSED_TY = Math.max(0, SHEET_MAX - SHEET_MIN);

/** Soft spring — translateY stays on the compositor (no layout thrash). */
export const SHEET_SPRING = { damping: 24, stiffness: 190, mass: 0.88 } as const;

export type ExpandableSheetOptions = {
  minRatio?: number;
  /** Start fully open under the icon bar (e.g. Chat inbox). */
  initiallyExpanded?: boolean;
};

/**
 * Shared expandable bottom-sheet (Profil, category, product, chat).
 * Collapsed peek → full height under the top icon bar.
 * Scroll up expands; at top, scroll/pull down collapses.
 */
export function useExpandableSheet(
  minRatioOrOptions: number | ExpandableSheetOptions = SHEET_MIN_RATIO,
) {
  const options =
    typeof minRatioOrOptions === 'number'
      ? { minRatio: minRatioOrOptions }
      : minRatioOrOptions;
  const minRatio = options.minRatio ?? SHEET_MIN_RATIO;
  const initiallyExpanded = options.initiallyExpanded ?? false;

  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const sheetMin = Math.round(height * minRatio);
  const sheetTopGap = Math.max(insets.top + 8, SHEET_TOP_GAP);
  const sheetMax = Math.round(height - sheetTopGap);
  const collapsedOffset = Math.max(0, sheetMax - sheetMin);

  const sheetTY = useSharedValue(initiallyExpanded ? 0 : SHEET_COLLAPSED_TY);
  const dragStartTY = useSharedValue(initiallyExpanded ? 0 : SHEET_COLLAPSED_TY);
  const maxTY = useSharedValue(SHEET_COLLAPSED_TY);
  const expanded = useSharedValue(initiallyExpanded ? 1 : 0);
  const scrollY = useSharedValue(0);
  const scrollExpandedRef = useRef(initiallyExpanded);
  const animatingRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const sheetScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    maxTY.value = collapsedOffset;
    const target = expanded.value ? 0 : collapsedOffset;
    sheetTY.value = withSpring(target, SHEET_SPRING);
  }, [collapsedOffset, sheetTY, maxTY, expanded]);

  const markScrollExpanded = useCallback(() => {
    animatingRef.current = false;
    scrollExpandedRef.current = true;
  }, []);

  const clearScrollExpanded = useCallback(() => {
    animatingRef.current = false;
    scrollExpandedRef.current = false;
    lastScrollYRef.current = 0;
    scrollY.value = 0;
    sheetScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollY]);

  const expandFromScroll = useCallback(() => {
    if (scrollExpandedRef.current || animatingRef.current) return;
    animatingRef.current = true;
    expanded.value = 1;
    sheetTY.value = withSpring(0, SHEET_SPRING, (finished) => {
      if (finished) runOnJS(markScrollExpanded)();
      else runOnJS(() => {
        animatingRef.current = false;
      })();
    });
  }, [expanded, sheetTY, markScrollExpanded]);

  const collapseFromScroll = useCallback(() => {
    if (!scrollExpandedRef.current || animatingRef.current) return;
    animatingRef.current = true;
    scrollExpandedRef.current = false;
    lastScrollYRef.current = 0;
    scrollY.value = 0;
    expanded.value = 0;
    sheetScrollRef.current?.scrollTo({ y: 0, animated: false });
    sheetTY.value = withSpring(maxTY.value, SHEET_SPRING, (finished) => {
      runOnJS(clearScrollExpanded)();
      if (!finished) {
        // still clear flags via clearScrollExpanded
      }
    });
  }, [expanded, sheetTY, maxTY, scrollY, clearScrollExpanded]);

  const onSheetScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const prev = lastScrollYRef.current;
      lastScrollYRef.current = y;
      scrollY.value = y;

      if (animatingRef.current) return;

      // Collapsed → scroll up opens the sheet.
      if (!scrollExpandedRef.current) {
        if (y > 8) expandFromScroll();
        return;
      }

      // Fully open + already at top: overscroll / pull down collapses.
      if (prev <= 4 && (y < -6 || y < prev - 1.5)) {
        collapseFromScroll();
      }
    },
    [expandFromScroll, collapseFromScroll, scrollY],
  );

  const onSheetScrollBeginDrag = useCallback(() => {
    if (animatingRef.current) return;
    if (!scrollExpandedRef.current) expandFromScroll();
  }, [expandFromScroll]);

  const onSheetScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (animatingRef.current || !scrollExpandedRef.current) return;
      const y = e.nativeEvent.contentOffset.y;
      const vy = e.nativeEvent.velocity?.y ?? 0;
      if (y <= 4 && vy > 0.35) collapseFromScroll();
      if (y < -4) collapseFromScroll();
    },
    [collapseFromScroll],
  );

  /** Horizontal filter chips / thumbs — any nudge opens the sheet. */
  const onFiltersScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Math.abs(e.nativeEvent.contentOffset.x) > 0.5) expandFromScroll();
    },
    [expandFromScroll],
  );

  const finishHandle = useCallback(
    (toExpanded: boolean) => {
      if (toExpanded) markScrollExpanded();
      else clearScrollExpanded();
    },
    [markScrollExpanded, clearScrollExpanded],
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
          runOnJS(finishHandle)(toExpanded);
        }),
    [dragStartTY, sheetTY, maxTY, expanded, finishHandle],
  );

  /**
   * When fully open and content is at the top, a downward pan drags the sheet closed
   * (works on web where ScrollView has no negative overscroll).
   */
  const sheetPullDownGesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY(10)
        .failOffsetY([-12, -1])
        .failOffsetX([-28, 28])
        .onStart(() => {
          'worklet';
          dragStartTY.value = sheetTY.value;
        })
        .onUpdate((e) => {
          'worklet';
          if (expanded.value !== 1 || scrollY.value > 4) return;
          if (e.translationY <= 0) return;
          sheetTY.value = Math.min(maxTY.value, Math.max(0, e.translationY));
        })
        .onEnd((e) => {
          'worklet';
          if (expanded.value !== 1) return;
          if (scrollY.value > 4 && sheetTY.value < 1) return;
          const mid = maxTY.value * 0.45;
          const toExpanded =
            e.velocityY < 280 && sheetTY.value + e.velocityY * 0.12 < mid;
          expanded.value = toExpanded ? 1 : 0;
          sheetTY.value = withSpring(toExpanded ? 0 : maxTY.value, {
            ...SHEET_SPRING,
            velocity: e.velocityY,
          });
          runOnJS(finishHandle)(toExpanded);
        }),
    [dragStartTY, sheetTY, maxTY, expanded, scrollY, finishHandle],
  );

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTY.value }],
  }));

  return {
    sheetMin,
    sheetMax,
    sheetAnimStyle,
    sheetHandleGesture,
    sheetPullDownGesture,
    sheetScrollRef,
    expandFromScroll,
    collapseFromScroll,
    onSheetScroll,
    onSheetScrollBeginDrag,
    onSheetScrollEndDrag,
    onFiltersScroll,
  };
}
