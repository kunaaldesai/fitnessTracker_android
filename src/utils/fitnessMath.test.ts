import { describe, expect, it } from 'vitest';

import {
  computeExerciseDurationSeconds,
  computeExerciseDistanceMiles,
  computeExerciseVolume,
  computeSetVolume,
  countCompletedSets,
  formatDuration,
  normalizeExerciseSets,
  toIntOrNull,
  toNumberOrNull,
} from './fitnessMath';

describe('fitnessMath', () => {
  it('normalizes numeric fields without allowing invalid values through', () => {
    expect(toNumberOrNull('225.5')).toBe(225.5);
    expect(toNumberOrNull('bad')).toBeNull();
    expect(toIntOrNull('8.9')).toBe(8);
    expect(toIntOrNull('-2')).toBe(0);
  });

  it('computes set and exercise volume from editable set fields', () => {
    expect(computeSetVolume({ weight: '225' as never, reps: '5' as never })).toBe(1125);
    expect(computeSetVolume({ weight: -20, reps: 5 })).toBe(0);
    expect(
      computeExerciseVolume({
        total_volume: 999,
          sets: [
            { weight: 100, reps: 3, rpe: null },
            { weight: 120, reps: 2, rpe: null },
          ],
      }),
    ).toBe(540);
    expect(computeExerciseVolume({ movement_type: 'Cardio', total_volume: 999, sets: [{ weight: 100, reps: 3, rpe: null }] })).toBe(0);
  });

  it('computes duration and distance for non-strength work', () => {
    expect(
      computeExerciseDurationSeconds({
        sets: [
          { weight: null, reps: null, rpe: null, duration_seconds: 600 },
          { weight: null, reps: null, rpe: null, duration_seconds: 90 },
        ],
      }),
    ).toBe(690);
    expect(computeExerciseDistanceMiles({ sets: [{ weight: null, reps: null, rpe: null, distance_miles: 1.25 }] })).toBe(1.25);
    expect(formatDuration(45)).toBe('45 sec');
    expect(formatDuration(600)).toBe('10 min');
  });

  it('counts completed sets using movement-specific effort fields', () => {
    expect(
      countCompletedSets([
        {
          movement_type: 'Strength',
          sets: [
            { weight: 100, reps: 5, rpe: null },
            { weight: null, reps: 8, rpe: null },
            { weight: 80, reps: 0, rpe: null },
          ],
        },
        {
          movement_type: 'Cardio',
          sets: [
            { weight: null, reps: null, rpe: null, duration_seconds: 600 },
            { weight: null, reps: null, rpe: null, distance_miles: 0 },
          ],
        },
        {
          movement_type: 'Stretching',
          sets: [
            { weight: null, reps: null, rpe: null, duration_seconds: 30 },
            { weight: null, reps: null, rpe: 4, duration_seconds: null },
          ],
        },
      ]),
    ).toBe(3);
  });

  it('normalizes empty and partially edited sets for save payloads', () => {
    expect(normalizeExerciseSets(undefined)).toEqual([{ weight: null, reps: null, rpe: null, duration_seconds: null, distance_miles: null, side: '' }]);
    expect(
      normalizeExerciseSets([
        { weight: '135' as never, reps: '5' as never, rpe: '8.5' as never, duration_seconds: '600' as never, distance_miles: '1.5' as never, side: 'Left' },
      ]),
    ).toEqual([
      { weight: 135, reps: 5, rpe: 8.5, duration_seconds: 600, distance_miles: 1.5, side: 'Left' },
    ]);
  });
});
