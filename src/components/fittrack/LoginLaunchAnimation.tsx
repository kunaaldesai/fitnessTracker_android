import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { AppText } from './ui';

const appIcon = require('@/assets/images/logmaxxing-icon.png');

type LoginLaunchAnimationProps = {
  visible: boolean;
  onDone: () => void;
};

export function LoginLaunchAnimation({ visible, onDone }: LoginLaunchAnimationProps) {
  const { colors, mode } = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const completionCalled = useRef(false);
  const [overlayOpacity] = useState(() => new Animated.Value(0));
  const [iconScale] = useState(() => new Animated.Value(0.72));
  const [iconOpacity] = useState(() => new Animated.Value(0));
  const [ringScale] = useState(() => new Animated.Value(0.75));
  const [ringOpacity] = useState(() => new Animated.Value(0));
  const [titleOpacity] = useState(() => new Animated.Value(0));
  const [titleY] = useState(() => new Animated.Value(18));
  const [chipOne] = useState(() => new Animated.Value(0));
  const [chipTwo] = useState(() => new Animated.Value(0));
  const [chipThree] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [exitScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!visible) return undefined;

    completionCalled.current = false;
    overlayOpacity.setValue(1);
    iconScale.setValue(0.72);
    iconOpacity.setValue(0);
    ringScale.setValue(0.75);
    ringOpacity.setValue(0);
    titleOpacity.setValue(0);
    titleY.setValue(18);
    chipOne.setValue(0);
    chipTwo.setValue(0);
    chipThree.setValue(0);
    progress.setValue(0);
    exitScale.setValue(1);

    if (reduceMotion) {
      const timer = setTimeout(() => {
        completionCalled.current = true;
        onDone();
      }, 80);
      return () => clearTimeout(timer);
    }

    const entrance = Animated.sequence([
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          damping: 13,
          mass: 0.7,
          stiffness: 170,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(80),
          Animated.parallel([
            Animated.timing(ringOpacity, {
              toValue: 0.56,
              duration: 190,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(ringScale, {
              toValue: 1.34,
              duration: 520,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(titleY, {
          toValue: 0,
          damping: 17,
          mass: 0.72,
          stiffness: 210,
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(80, [
        chipIn(chipOne),
        chipIn(chipTwo),
        chipIn(chipThree),
      ]),
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: 560,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(170),
          Animated.spring(iconScale, {
            toValue: 1.08,
            damping: 9,
            mass: 0.55,
            stiffness: 145,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(160),
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(exitScale, {
          toValue: 1.08,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    entrance.start(({ finished }) => {
      if (!finished || completionCalled.current) return;
      completionCalled.current = true;
      onDone();
    });

    return () => entrance.stop();
  }, [
    chipOne,
    chipThree,
    chipTwo,
    exitScale,
    iconOpacity,
    iconScale,
    onDone,
    overlayOpacity,
    progress,
    reduceMotion,
    ringOpacity,
    ringScale,
    titleOpacity,
    titleY,
    visible,
  ]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        {
          backgroundColor: colors.background,
          opacity: overlayOpacity,
          transform: [{ scale: exitScale }],
        },
      ]}>
      <View style={styles.centerStage}>
        <View style={styles.iconStage}>
          <Animated.View
            style={[
              styles.ring,
              {
                borderColor: colors.primary,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
          <Animated.Image
            source={appIcon}
            style={[
              styles.icon,
              {
                opacity: iconOpacity,
                shadowColor: mode === 'dark' ? '#000000' : colors.shadow,
                transform: [{ scale: iconScale }],
              },
            ]}
          />
        </View>

        <Animated.View style={[styles.titleBlock, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          <AppText style={styles.wordmark} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
            Logmaxxing
          </AppText>
          <AppText muted style={styles.subtitle}>Your training, organized.</AppText>
        </Animated.View>

        <View style={styles.chipRow}>
          <LaunchChip value={chipOne} label="Workout" accent={colors.primary} />
          <LaunchChip value={chipTwo} label="Analytics" accent={colors.success} />
          <LaunchChip value={chipThree} label="Records" accent={colors.warning} />
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                transform: [{ scaleX: progress }],
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function chipIn(value: Animated.Value) {
  return Animated.spring(value, {
    toValue: 1,
    damping: 16,
    mass: 0.64,
    stiffness: 210,
    useNativeDriver: true,
  });
}

function LaunchChip({ value, label, accent }: { value: Animated.Value; label: string; accent: string }) {
  const { colors } = useAppTheme();
  return (
    <Animated.View
      style={[
        styles.chip,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: value,
          transform: [
            {
              translateY: value.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
            {
              scale: value.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              }),
            },
          ],
        },
      ]}>
      <View style={[styles.chipDot, { backgroundColor: accent }]} />
      <AppText variant="caption" style={styles.chipLabel}>{label}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconStage: {
    width: 240,
    height: 224,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 40,
    borderWidth: 2,
  },
  icon: {
    width: 124,
    height: 124,
    borderRadius: 28,
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 7,
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
    maxWidth: 300,
  },
  wordmark: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  chip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  chipLabel: {
    fontWeight: '800',
  },
  progressTrack: {
    width: 180,
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: spacing.xl,
  },
  progressFill: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
});
