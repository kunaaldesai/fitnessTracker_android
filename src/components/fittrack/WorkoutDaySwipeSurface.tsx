import { PropsWithChildren, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { getWorkoutDaySwipeDelta } from '@/utils/workoutSwipe';

type WorkoutDaySwipeSurfaceProps = PropsWithChildren<{
  disabled?: boolean;
  onSwipeDay: (deltaDays: -1 | 1) => void;
  style?: StyleProp<ViewStyle>;
}>;

export function WorkoutDaySwipeSurface({
  children,
  disabled = false,
  onSwipeDay,
  style,
}: WorkoutDaySwipeSurfaceProps) {
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .runOnJS(true)
        .activeOffsetX([-18, 18])
        .failOffsetY([-24, 24])
        .onEnd((event) => {
          const delta = getWorkoutDaySwipeDelta(event);
          if (delta !== 0) onSwipeDay(delta);
        }),
    [disabled, onSwipeDay],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} style={[styles.surface, style]}>
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
  },
});
