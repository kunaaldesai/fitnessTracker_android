import { describe, expect, it } from 'vitest';

import type { FitnessExercise, PersonalRecord } from '@/types/fitness';

import {
  collapsedExerciseSummary,
  formatMovementSet,
  historyMetricForMovement,
  initialExpandedExerciseIds,
  movementHistoryDetail,
  movementHistorySessionSummary,
  pluralize,
  recordDeltaLabel,
  recordMetrics,
  toggleExpandedExerciseId,
} from './fitnessPresentation';

const strengthExercise: FitnessExercise = {
  id: 'bench',
  workout_date: '2026-07-26',
  order_index: 0,
  name: 'Bench Press',
  category: 'Chest',
  movement_type: 'Strength',
  sets: [
    { weight: 135, reps: 8, rpe: 8 },
    { weight: 145, reps: 5, rpe: 9 },
  ],
};

describe('fitness presentation', () => {
  it('formats movement-specific set summaries', () => {
    expect(formatMovementSet(strengthExercise.sets[1], 'Strength')).toBe('145 × 5');
    expect(formatMovementSet({ weight: null, reps: null, rpe: 7, duration_seconds: 600, distance_miles: 1.2 }, 'Cardio'))
      .toBe('10 min 1.2 mi RPE 7');
    expect(formatMovementSet({ weight: null, reps: null, rpe: null, duration_seconds: 45, side: 'Left' }, 'Stretching'))
      .toBe('45 sec Left');
  });

  it('creates compact workout summaries and correct pluralization', () => {
    expect(collapsedExerciseSummary(strengthExercise)).toBe('2 Sets • 145 × 5');
    expect(pluralize(1, 'session')).toBe('1 session');
    expect(pluralize(2, 'session')).toBe('2 sessions');
  });

  it('starts with every exercise expanded and toggles each one independently', () => {
    const exercises = [{ id: 'one' }, { id: 'two' }];
    const initiallyExpanded = initialExpandedExerciseIds(exercises);
    const oneCollapsed = toggleExpandedExerciseId(initiallyExpanded, 'one');
    const oneReopened = toggleExpandedExerciseId(oneCollapsed, 'one');

    expect([...initiallyExpanded]).toEqual(['one', 'two']);
    expect([...oneCollapsed]).toEqual(['two']);
    expect([...oneReopened]).toEqual(['two', 'one']);
  });

  it('uses strength metrics only for strength records', () => {
    const strengthRecord: PersonalRecord = {
      exercise_name: 'Bench Press',
      category: 'Chest',
      movement_type: 'Strength',
      max_weight: 225,
      max_one_rm: 250,
      max_volume: 5000,
      one_rm_delta: 12,
      session_count: 4,
    };
    const cardioRecord: PersonalRecord = {
      exercise_name: 'Treadmill Run',
      category: 'Cardio',
      movement_type: 'Cardio',
      max_weight: 0,
      max_one_rm: 0,
      max_volume: 0,
      session_count: 1,
      latest_best_set: { weight: null, reps: null, rpe: 6, duration_seconds: 1200, distance_miles: 2 },
      last_workout_date_label: 'Jul 26',
    };

    expect(recordMetrics(strengthRecord).map((metric) => metric.label)).toEqual(['Max Weight', 'Est. 1RM', 'Best Volume']);
    expect(recordDeltaLabel(strengthRecord)).toBe('+12 1RM');
    expect(recordMetrics(cardioRecord)).toEqual([
      { label: 'Latest Best', value: '20 min 2 mi RPE 6', meta: 'Jul 26' },
      { label: 'History', value: '1 session', meta: 'Cardio' },
      { label: 'Last Activity', value: 'Jul 26', meta: 'Cardio' },
    ]);
    expect(recordDeltaLabel(cardioRecord)).toBe('History');
    expect(historyMetricForMovement('Cardio')).toEqual({ key: 'best_set_label', label: 'Best interval' });
    expect(movementHistoryDetail('-', 'Cardio')).toBe('No interval details recorded');
    expect(movementHistorySessionSummary(0, '-', 'Cardio')).toBe('No interval details recorded');
    expect(movementHistorySessionSummary(2, '5 min 1 mi', 'Cardio')).toBe('2 Intervals | 5 min 1 mi');
  });
});
