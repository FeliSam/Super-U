import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WINDOW_H = Dimensions.get('window').height;

/** Opens just under the floating icon bar (Profil / rayons / produit). */
export const SHEET_TOP_GAP = 56;
export const SHEET_MIN_RATIO = 0.58;
export const SHEET_MIN = Math.round(WINDOW_H * SHEET_MIN_RATIO);
export const SHEET_MAX = Math.round(WINDOW_H - SHEET_TOP_GAP);
export const SHEET_COLLAPSED_TY = Math.max(0, SHEET_MAX - SHEET_MIN);

/** Drag snap — follows the finger, settles without bounce. */
export const SHEET_SPRING = {
  damping: 28,
  stiffness: 340,
  mass: 0.55,
  overshootClamping: true,
} as const;

/** Programmatic snap when there is no finger velocity. */
export const SHEET_OPEN = {
  duration: 240,
  easing: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

/** Dismiss off-screen. */
export const SHEET_DISMISS = {
  duration: 140,
  easing: Easing.bezier(0.4, 0, 1, 1),
} as const;

type SheetScroller = {
  scrollTo?: (opts: { y: number; animated?: boolean } | number, y?: number) => void;
  scrollToOffset?: (opts: { offset: number; animated?: boolean }) => void;
};

function scrollSheetToTop(node: SheetScroller | null | undefined) {
  if (!node) return;
  try {
    if (typeof node.scrollToOffset === 'function') {
      node.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ y: 0, animated: false });
    }
  } catch {
    /* FlatList / FlashList on web have no ScrollView.scrollTo */
  }
}

export type ExpandableSheetOptions = {
  minRatio?: number;
  /** Start fully open under the icon bar (e.g. Chat inbox). */
  initiallyExpanded?: boolean;
  /** Keep the sheet fully open — no collapse / drag-down. */
  lockExpanded?: boolean;
  /** Slide up from below the screen on mount. */
  animateEnter?: boolean;
  /** Collapse only from the grabber — content scroll never steals the sheet. */
  lockCollapseToHandle?: boolean;
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
  const lockExpanded = options.lockExpanded ?? false;
  const animateEnter = options.animateEnter ?? false;
  const lockCollapseToHandle = options.lockCollapseToHandle ?? false;
  const initiallyExpanded = lockExpanded || (options.initiallyExpanded ?? false);

  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const sheetMin = Math.round(height * minRatio);
  const sheetTopGap = Math.max(insets.top + 8, SHEET_TOP_GAP);
  const sheetMax = Math.round(height - sheetTopGap);
  const collapsedOffset = Math.max(0, sheetMax - sheetMin);

  const sheetTY = useSharedValue(
    animateEnter ? height : initiallyExpanded ? 0 : collapsedOffset,
  );
  const dragStartTY = useSharedValue(initiallyExpanded ? 0 : collapsedOffset);
  const maxTY = useSharedValue(collapsedOffset);
  const expanded = useSharedValue(initiallyExpanded ? 1 : 0);
  const scrollY = useSharedValue(0);
  const scrollExpandedRef = useRef(initiallyExpanded);
  const animatingRef = useRef(false);
  const enteringRef = useRef(animateEnter);
  const lastScrollYRef = useRef(0);
  const sheetScrollRef = useRef<SheetScroller>(null);
  /** Always on — disabling scroll on web made the sheet impossible to open. */
  const listScrollEnabled = true;

  useEffect(() => {
    maxTY.value = collapsedOffset;
    if (lockExpanded) {
      sheetTY.value = 0;
      expanded.value = 1;
      return;
    }
    if (enteringRef.current || animatingRef.current) return;
    sheetTY.value = expanded.value ? 0 : collapsedOffset;
  }, [collapsedOffset, sheetTY, maxTY, expanded, lockExpanded]);

  const enterStartedRef = useRef(false);
  useEffect(() => {
    if (!animateEnter || enterStartedRef.current) return;
    enterStartedRef.current = true;
    const target = initiallyExpanded ? 0 : collapsedOffset;
    sheetTY.value = withTiming(target, SHEET_OPEN);
    enteringRef.current = false;
    animatingRef.current = false;
  }, [animateEnter, collapsedOffset, initiallyExpanded, sheetTY]);

  const markScrollExpanded = useCallback(() => {
    animatingRef.current = false;
    scrollExpandedRef.current = true;
  }, []);

  const clearScrollExpanded = useCallback(() => {
    animatingRef.current = false;
    scrollExpandedRef.current = false;
    lastScrollYRef.current = 0;
    scrollY.value = 0;
    scrollSheetToTop(sheetScrollRef.current);
  }, [scrollY]);

  const expandFromScroll = useCallback(() => {
    if (scrollExpandedRef.current) return;
    scrollExpandedRef.current = true;
    animatingRef.current = false;
    expanded.value = 1;
    sheetTY.value = withSpring(0, SHEET_SPRING);
  }, [expanded, sheetTY]);

  const collapseFromScroll = useCallback(() => {
    if (lockExpanded || lockCollapseToHandle) return;
    if (!scrollExpandedRef.current) return;
    scrollExpandedRef.current = false;
    lastScrollYRef.current = 0;
    scrollY.value = 0;
    expanded.value = 0;
    scrollSheetToTop(sheetScrollRef.current);
    sheetTY.value = withSpring(maxTY.value, SHEET_SPRING);
  }, [expanded, sheetTY, maxTY, scrollY, lockExpanded, lockCollapseToHandle]);

  const onSheetScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const prev = lastScrollYRef.current;
      lastScrollYRef.current = y;
      scrollY.value = y;

      if (animatingRef.current) return;

      // Collapsed → any upward content movement opens immediately.
      if (!scrollExpandedRef.current) {
        if (y > 0) {
          expandFromScroll();
          scrollSheetToTop(sheetScrollRef.current);
        }
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

  const onSheetWheel = useCallback(
    (e: { nativeEvent?: { deltaY?: number }; deltaY?: number }) => {
      if (scrollExpandedRef.current) return;
      const dy = e.nativeEvent?.deltaY ?? e.deltaY ?? 0;
      if (dy > 0) expandFromScroll();
    },
    [expandFromScroll],
  );

  const finishHandle = useCallback(
    (toExpanded: boolean) => {
      if (lockExpanded) {
        markScrollExpanded();
        return;
      }
      if (toExpanded) markScrollExpanded();
      else clearScrollExpanded();
    },
    [markScrollExpanded, clearScrollExpanded, lockExpanded],
  );

  const sheetHandleGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!lockExpanded)
        .maxPointers(1)
        .activeOffsetY([-4, 4])
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
            const projected = sheetTY.value + e.velocityY * 0.12;
            toExpanded = e.velocityY < -80 || (e.velocityY <= 180 && projected < mid);
          }
          expanded.value = toExpanded ? 1 : 0;
          sheetTY.value = withSpring(toExpanded ? 0 : maxTY.value, {
            ...SHEET_SPRING,
            velocity: e.velocityY,
          });
          runOnJS(finishHandle)(toExpanded);
        }),
    [dragStartTY, sheetTY, maxTY, expanded, finishHandle, lockExpanded],
  );

  /**
   * Collapsed sheet: finger/trackpad up moves the sheet 1:1 (does not wait for ScrollView).
   */
  const sheetExpandGesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetY(-2)
        .failOffsetX([-56, 56])
        .onStart(() => {
          'worklet';
          dragStartTY.value = sheetTY.value;
        })
        .onUpdate((e) => {
          'worklet';
          if (expanded.value === 1) return;
          if (e.translationY > 0) return;
          const next = dragStartTY.value + e.translationY;
          sheetTY.value = Math.min(maxTY.value, Math.max(0, next));
        })
        .onEnd((e) => {
          'worklet';
          if (expanded.value === 1) return;
          const toExpanded = e.velocityY < -40 || e.translationY < -6;
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
        .enabled(!lockExpanded && !lockCollapseToHandle)
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
          const pulledFar = sheetTY.value > maxTY.value * 0.2 || e.translationY > 40;
          const flickedDown = e.velocityY > 380;
          const toExpanded = !pulledFar && !flickedDown;
          expanded.value = toExpanded ? 1 : 0;
          sheetTY.value = withSpring(toExpanded ? 0 : maxTY.value, {
            ...SHEET_SPRING,
            velocity: e.velocityY,
          });
          runOnJS(finishHandle)(toExpanded);
        }),
    [dragStartTY, sheetTY, maxTY, expanded, scrollY, finishHandle, lockExpanded, lockCollapseToHandle],
  );

  const sheetScrollGesture = useMemo(
    () =>
      lockCollapseToHandle
        ? Gesture.Simultaneous(sheetExpandGesture, Gesture.Native())
        : Gesture.Simultaneous(sheetExpandGesture, sheetPullDownGesture, Gesture.Native()),
    [sheetExpandGesture, sheetPullDownGesture, lockCollapseToHandle],
  );

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTY.value }],
  }));

  const dismissSheet = useCallback(
    (onDone?: () => void) => {
      animatingRef.current = true;
      sheetTY.value = withTiming(height, SHEET_DISMISS, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      });
    },
    [height, sheetTY],
  );

  return {
    sheetMin,
    sheetMax,
    sheetAnimStyle,
    sheetHandleGesture,
    sheetPullDownGesture,
    sheetScrollGesture,
    sheetScrollRef,
    listScrollEnabled,
    expandFromScroll,
    collapseFromScroll,
    dismissSheet,
    onSheetScroll,
    onSheetScrollBeginDrag,
    onSheetScrollEndDrag,
    onFiltersScroll,
    onSheetWheel,
    expandedSV: expanded,
  };
}
