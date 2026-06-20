import { describe, expect, it } from 'vitest';

import {
  computeExerciseVolume,
  computeSetVolume,
  countCompletedSets,
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
  });

  it('counts completed sets only when weight and reps create volume', () => {
    expect(
      countCompletedSets([
        {
          sets: [
            { weight: 100, reps: 5, rpe: null },
            { weight: null, reps: 8, rpe: null },
            { weight: 80, reps: 0, rpe: null },
          ],
        },
      ]),
    ).toBe(1);
  });

  it('normalizes empty and partially edited sets for save payloads', () => {
    expect(normalizeExerciseSets(undefined)).toEqual([{ weight: null, reps: null, rpe: null }]);
    expect(normalizeExerciseSets([{ weight: '135' as never, reps: '5' as never, rpe: '8.5' as never }])).toEqual([
      { weight: 135, reps: 5, rpe: 8.5 },
    ]);
  });
});
