import { PropsWithChildren, ReactNode, useCallback, useLayoutEffect, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { getWorkoutDaySwipeDelta } from '@/utils/workoutSwipe';

type WorkoutDaySwipeSurfaceProps = PropsWithChildren<{
  canSwipeNext?: boolean;
  canSwipePrevious?: boolean;
  disabled?: boolean;
  nextPage?: ReactNode;
  onSwipeDay: (deltaDays: -1 | 1) => void;
  pageKey: string;
  previousPage?: ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export function WorkoutDaySwipeSurface({
  children,
  canSwipeNext = false,
  canSwipePrevious = false,
  disabled = false,
  nextPage,
  onSwipeDay,
  pageKey,
  previousPage,
  style,
}: WorkoutDaySwipeSurfaceProps) {
  const reduceMotion = useReducedMotion();
  const pageWidth = useSharedValue(0);
  const dragX = useSharedValue(0);
  const finishSwipe = useCallback((delta: -1 | 1) => onSwipeDay(delta), [onSwipeDay]);

  useLayoutEffect(() => {
    cancelAnimation(dragX);
    dragX.set(0);
  }, [dragX, pageKey]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-18, 18])
        .failOffsetY([-24, 24])
        .onBegin(() => {
          cancelAnimation(dragX);
        })
        .onUpdate((event) => {
          if (reduceMotion) return;
          const minimum = canSwipeNext ? -pageWidth.get() : 0;
          const maximum = canSwipePrevious ? pageWidth.get() : 0;
          dragX.set(Math.min(maximum, Math.max(minimum, event.translationX)));
        })
        .onEnd((event) => {
          const requestedDelta = getWorkoutDaySwipeDelta(event);
          const delta =
            requestedDelta === -1 && canSwipePrevious
              ? -1
              : requestedDelta === 1 && canSwipeNext
                ? 1
                : 0;

          if (reduceMotion) {
            dragX.set(0);
            if (delta !== 0) runOnJS(finishSwipe)(delta);
            return;
          }

          const pageWidthValue = pageWidth.get();
          const target = delta === -1 ? pageWidthValue : delta === 1 ? -pageWidthValue : 0;
          dragX.set(withTiming(
            target,
            {
              duration: delta === 0 ? 180 : 250,
              easing: Easing.out(Easing.cubic),
            },
            (finished) => {
              if (!finished) return;
              if (delta === 0) {
                dragX.set(0);
                return;
              }
              runOnJS(finishSwipe)(delta);
            },
          ));
        }),
    [
      canSwipeNext,
      canSwipePrevious,
      disabled,
      dragX,
      finishSwipe,
      pageWidth,
      reduceMotion,
    ],
  );

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pageWidth.value + dragX.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        onLayout={(event) => {
          pageWidth.set(event.nativeEvent.layout.width);
        }}
        style={[styles.surface, style]}>
        <Animated.View style={[styles.track, trackStyle]}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={styles.page}>
            {previousPage}
          </View>
          <View style={styles.page}>{children}</View>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={styles.page}>
            {nextPage}
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    width: '300%',
  },
  page: {
    height: '100%',
    width: '33.333333%',
  },
});
