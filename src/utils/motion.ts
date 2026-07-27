export const MOTION_TIMING = {
  pressInMs: 110,
  pressOutMs: 150,
  contentMs: 180,
  reducedContentMs: 90,
  sheetMs: 260,
  chartMs: 320,
  successVisibleMs: 800,
} as const;

export const MOTION_SPRING = {
  stiffness: 220,
  damping: 24,
  mass: 0.9,
  overshootClamping: true,
} as const;

export type MotionPreset = {
  contentMs: number;
  sheetMs: number;
  chartMs: number;
  translateDistance: number;
  layoutEnabled: boolean;
};

export function resolveMotionPreset(reduceMotion: boolean): MotionPreset {
  if (reduceMotion) {
    return {
      contentMs: MOTION_TIMING.reducedContentMs,
      sheetMs: MOTION_TIMING.reducedContentMs,
      chartMs: MOTION_TIMING.reducedContentMs,
      translateDistance: 0,
      layoutEnabled: false,
    };
  }

  return {
    contentMs: MOTION_TIMING.contentMs,
    sheetMs: MOTION_TIMING.sheetMs,
    chartMs: MOTION_TIMING.chartMs,
    translateDistance: 6,
    layoutEnabled: true,
  };
}
