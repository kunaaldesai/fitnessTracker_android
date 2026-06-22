import { describe, expect, it } from 'vitest';

import type { ExerciseOption } from '@/types/fitness';

import {
  DEFAULT_EXERCISE_CATEGORIES,
  defaultMovementTypeForCategory,
  ensureEditableSets,
  filterExerciseOptionsByCategoryAndQuery,
  mergeExerciseCategories,
  stripSetClientKeys,
  withEditableSetKeys,
} from './workoutExerciseDraft';

const options: ExerciseOption[] = [
  { name: 'Barbell Bench Press', category: 'Chest', movement_type: 'Strength' },
  { name: 'Incline Dumbbell Curl', category: 'Biceps', movement_type: 'Strength' },
  { name: 'Lat Pulldown', category: 'Back', movement_type: 'Strength' },
  { name: 'Treadmill Run', category: 'Cardio', movement_type: 'Cardio' },
  { name: 'Hamstring Stretch', category: 'Hamstrings', movement_type: 'Stretching' },
];

describe('workoutExerciseDraft', () => {
  it('filters exercise suggestions by selected category, type, and query', () => {
    expect(filterExerciseOptionsByCategoryAndQuery(options, ['Chest'], [], '')).toEqual([options[0]]);
    expect(filterExerciseOptionsByCategoryAndQuery(options, ['Biceps'], [], 'curl')).toEqual([options[1]]);
    expect(filterExerciseOptionsByCategoryAndQuery(options, [], [], 'bar')).toEqual([options[0]]);
    expect(filterExerciseOptionsByCategoryAndQuery(options, ['Chest', 'Back'], [], '')).toEqual([options[0], options[2]]);
    expect(filterExerciseOptionsByCategoryAndQuery(options, [], ['Cardio'], '')).toEqual([options[3]]);
    expect(filterExerciseOptionsByCategoryAndQuery(options, ['Hamstrings'], ['Stretching'], '')).toEqual([options[4]]);
    expect(filterExerciseOptionsByCategoryAndQuery(options, ['Hamstrings'], ['Strength'], '')).toEqual([]);
  });

  it('defaults custom movement type from the selected category', () => {
    expect(defaultMovementTypeForCategory('Cardio')).toBe('Cardio');
    expect(defaultMovementTypeForCategory('Quads')).toBe('Strength');
    expect(defaultMovementTypeForCategory(' shoulders ')).toBe('Strength');
  });

  it('keeps the full category list even when the API only returns categories with exercises', () => {
    const categories = mergeExerciseCategories(['Chest', 'calves'], ['Neck']);

    expect(categories.slice(0, DEFAULT_EXERCISE_CATEGORIES.length)).toEqual(DEFAULT_EXERCISE_CATEGORIES);
    expect(categories).toContain('Forearms');
    expect(categories).toContain('Adductors');
    expect(categories).toContain('Calves');
    expect(categories).toContain('Neck');
    expect(categories.filter((category) => category === 'Calves')).toHaveLength(1);
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
    ).toEqual([{ weight: 135, reps: 5, rpe: 8.5, duration_seconds: null, distance_miles: null, side: '' }]);
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
