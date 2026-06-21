import { describe, expect, it } from 'vitest';

import type { ExerciseOption } from '@/types/fitness';

import {
  defaultMovementTypeForCategory,
  ensureEditableSets,
  filterExerciseOptionsByCategoryAndQuery,
  stripSetClientKeys,
  withEditableSetKeys,
} from './workoutExerciseDraft';

const options: ExerciseOption[] = [
  { name: 'Barbell Bench Press', category: 'Chest', movement_type: 'Strength' },
  { name: 'Incline Dumbbell Curl', category: 'Biceps', movement_type: 'Strength' },
  { name: 'Lat Pulldown', category: 'Back', movement_type: 'Strength' },
  { name: 'Treadmill Run', category: 'Cardio', movement_type: 'Cardio' },
];

describe('workoutExerciseDraft', () => {
  it('filters exercise suggestions by selected category and query', () => {
    expect(filterExerciseOptionsByCategoryAndQuery(options, 'Chest', '')).toEqual([options[0]]);
    expect(filterExerciseOptionsByCategoryAndQuery(options, 'Biceps', 'curl')).toEqual([options[1]]);
    expect(filterExerciseOptionsByCategoryAndQuery(options, '', 'bar')).toEqual([options[0]]);
  });

  it('defaults custom movement type from the selected category', () => {
    expect(defaultMovementTypeForCategory('Cardio')).toBe('Cardio');
    expect(defaultMovementTypeForCategory('Quads')).toBe('Strength');
    expect(defaultMovementTypeForCategory(' shoulders ')).toBe('Strength');
  });

  it('adds stable local set keys for editable rows', () => {
    const sets = ensureEditableSets('exercise-1', [
      { weight: 100, reps: 5, rpe: 8 },
      { weight: null, reps: null, rpe: null },
    ]);

    expect(sets[0]._clientKey).toBe('exercise-1:server-set:0');
    expect(sets[1]._clientKey).toBe('exercise-1:server-set:1');
  });

  it('removes UI-only set keys from normalized save payloads', () => {
    expect(
      stripSetClientKeys([
        { _clientKey: 'local-1', weight: '135' as never, reps: '5' as never, rpe: '8.5' as never },
      ]),
    ).toEqual([{ weight: 135, reps: 5, rpe: 8.5 }]);
  });

  it('keeps surviving local set keys when rows are removed', () => {
    const next = withEditableSetKeys(
      {
        id: 'exercise-1',
        workout_date: '2026-06-21',
        order_index: 0,
        name: 'Bench Press',
        category: 'Chest',
        movement_type: 'Strength',
        sets: [{ _clientKey: 'second-row', weight: 105, reps: 5, rpe: 8 }],
      },
      {
        id: 'exercise-1',
        workout_date: '2026-06-21',
        order_index: 0,
        name: 'Bench Press',
        category: 'Chest',
        movement_type: 'Strength',
        sets: [
          { _clientKey: 'first-row', weight: 100, reps: 5, rpe: 8 },
          { _clientKey: 'second-row', weight: 105, reps: 5, rpe: 8 },
        ],
      },
    );

    expect(next.sets[0]._clientKey).toBe('second-row');
  });
});
