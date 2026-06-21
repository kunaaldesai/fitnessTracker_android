import { describe, expect, it } from 'vitest';

import { getWorkoutDaySwipeDelta } from './workoutSwipe';

describe('workoutSwipe', () => {
  it('moves to the next day for a left swipe past the distance threshold', () => {
    expect(getWorkoutDaySwipeDelta({ translationX: -72, translationY: 10, velocityX: -160 })).toBe(1);
  });

  it('moves to the previous day for a right swipe past the distance threshold', () => {
    expect(getWorkoutDaySwipeDelta({ translationX: 68, translationY: 8, velocityX: 140 })).toBe(-1);
  });

  it('uses a fast horizontal fling when distance is shorter', () => {
    expect(getWorkoutDaySwipeDelta({ translationX: -30, translationY: 4, velocityX: -920 })).toBe(1);
  });

  it('ignores small or vertical gestures', () => {
    expect(getWorkoutDaySwipeDelta({ translationX: -18, translationY: 6, velocityX: -300 })).toBe(0);
    expect(getWorkoutDaySwipeDelta({ translationX: -62, translationY: 72, velocityX: -900, velocityY: 400 })).toBe(0);
  });
});
