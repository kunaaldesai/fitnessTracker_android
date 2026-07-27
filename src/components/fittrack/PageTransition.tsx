import { useFocusEffect } from 'expo-router';
import { PropsWithChildren, useCallback } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/context/AppThemeContext';
import { resolveMotionPreset } from '@/utils/motion';

type PageTransitionProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  tabOrder?: number;
}>;

let lastFocusedTabOrder: number | null = null;

export function PageTransition({ children, style, tabOrder }: PageTransitionProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      const preset = resolveMotionPreset(reduceMotion);
      let direction = 0;

      if (typeof tabOrder === 'number') {
        if (lastFocusedTabOrder !== null && lastFocusedTabOrder !== tabOrder) {
          direction = tabOrder > lastFocusedTabOrder ? 1 : -1;
        }
        lastFocusedTabOrder = tabOrder;
      }

      opacity.set(reduceMotion ? 1 : 0.96);
      translateX.set(direction * preset.translateDistance * 2);
      translateY.set(direction === 0 ? preset.translateDistance : 0);

      const timing = {
        duration: preset.contentMs,
        easing: Easing.out(Easing.cubic),
      };
      opacity.set(withTiming(1, timing));
      translateX.set(withTiming(0, timing));
      translateY.set(withTiming(0, timing));

      return () => {
        cancelAnimation(opacity);
        cancelAnimation(translateX);
        cancelAnimation(translateY);
      };
    }, [opacity, reduceMotion, tabOrder, translateX, translateY]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return (
    <View style={[styles.shell, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.page, style, animatedStyle]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    overflow: 'hidden',
  },
  page: {
    flex: 1,
  },
});
