import { PropsWithChildren, useEffect, useState } from 'react';
import {
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { MOTION_SPRING, MOTION_TIMING, resolveMotionPreset } from '@/utils/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const fluidLayoutTransition = LinearTransition.springify()
  .stiffness(MOTION_SPRING.stiffness)
  .damping(MOTION_SPRING.damping)
  .mass(MOTION_SPRING.mass)
  .overshootClamping(MOTION_SPRING.overshootClamping ? 1 : 0)
  .reduceMotion(ReduceMotion.System);

export function MotionContent({
  children,
  style,
  transitionKey,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  transitionKey?: string | number;
}>) {
  const reduceMotion = useReducedMotion();
  const preset = resolveMotionPreset(reduceMotion);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(preset.translateDistance);

  useEffect(() => {
    opacity.value = 0;
    translateY.value = preset.translateDistance;
    opacity.value = withTiming(1, {
      duration: preset.contentMs,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    translateY.value = withTiming(0, {
      duration: preset.contentMs,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [opacity, preset.contentMs, preset.translateDistance, transitionKey, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export function MotionLayout({
  children,
  style,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>) {
  return (
    <Animated.View layout={fluidLayoutTransition} style={style}>
      {children}
    </Animated.View>
  );
}

export function ChartReveal({
  children,
  transitionKey,
}: PropsWithChildren<{
  transitionKey?: string | number;
}>) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.set(0);
    opacity.set(withTiming(1, {
      duration: reduceMotion ? MOTION_TIMING.reducedContentMs : MOTION_TIMING.chartMs,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    }));
  }, [opacity, reduceMotion, transitionKey]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export function MotionPressable({
  style,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
}) {
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        setPressed(true);
        scale.set(withTiming(reduceMotion ? 1 : 0.985, {
          duration: reduceMotion ? 0 : MOTION_TIMING.pressInMs,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }));
        opacity.set(withTiming(0.88, {
          duration: reduceMotion ? 0 : MOTION_TIMING.pressInMs,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        scale.set(withTiming(1, {
          duration: reduceMotion ? 0 : MOTION_TIMING.pressOutMs,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }));
        opacity.set(withTiming(1, {
          duration: reduceMotion ? 0 : MOTION_TIMING.pressOutMs,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }));
        onPressOut?.(event);
      }}
      style={[
        typeof style === 'function' ? style({ pressed, hovered: false }) : style,
        animatedStyle,
      ]}
    />
  );
}
