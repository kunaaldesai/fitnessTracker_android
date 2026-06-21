import { useFocusEffect } from 'expo-router';
import { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useAppTheme } from '@/context/AppThemeContext';

type PageTransitionProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  tabOrder?: number;
}>;

let lastFocusedTabOrder: number | null = null;

const SPRING = {
  damping: 23,
  mass: 0.72,
  stiffness: 230,
};

export function PageTransition({ children, style, tabOrder }: PageTransitionProps) {
  const { colors } = useAppTheme();
  const [opacity] = useState(() => new Animated.Value(1));
  const [translateX] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        opacity.setValue(1);
        translateX.setValue(0);
        translateY.setValue(0);
        return undefined;
      }

      let direction = 0;
      if (typeof tabOrder === 'number') {
        if (lastFocusedTabOrder !== null && lastFocusedTabOrder !== tabOrder) {
          direction = tabOrder > lastFocusedTabOrder ? 1 : -1;
        }
        lastFocusedTabOrder = tabOrder;
      }

      opacity.setValue(0.96);
      translateX.setValue(direction * 12);
      translateY.setValue(direction === 0 ? 6 : 0);

      const animation = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          ...SPRING,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          ...SPRING,
          useNativeDriver: true,
        }),
      ]);

      animation.start();

      return () => animation.stop();
    }, [opacity, reduceMotion, tabOrder, translateX, translateY]),
  );

  return (
    <View style={[styles.shell, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.page,
          style,
          {
            opacity,
            transform: [{ translateX }, { translateY }],
          },
        ]}>
        {children}
      </Animated.View>
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
