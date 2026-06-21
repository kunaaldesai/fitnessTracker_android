import type { ExerciseOption, ExerciseSet, FitnessExercise } from '@/types/fitness';

import { normalizeExerciseSets } from './fitnessMath';

export const BODY_PICKER_CATEGORIES = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Biceps', 'Triceps', 'Shoulders', 'Abs'];

let setKeyCounter = 0;

export function createSetClientKey(exerciseId: string) {
  setKeyCounter += 1;
  return `${exerciseId}:local-set:${setKeyCounter}`;
}

export function createEmptyEditableSet(exerciseId: string): ExerciseSet {
  return { weight: null, reps: null, rpe: null, _clientKey: createSetClientKey(exerciseId) };
}

export function ensureEditableSets(exerciseId: string, sets: ExerciseSet[] | undefined): ExerciseSet[] {
  const sourceSets = Array.isArray(sets) && sets.length ? sets : [{ weight: null, reps: null, rpe: null }];
  return sourceSets.map((set, index) => ({
    ...normalizeExerciseSets([set])[0],
    _clientKey: set._clientKey || `${exerciseId}:server-set:${set.set_number ?? index}`,
  }));
}

export function withEditableSetKeys(exercise: FitnessExercise, previous?: FitnessExercise): FitnessExercise {
  const previousSets = previous?.sets || [];
  const sourceSets = exercise.sets || [];
  return {
    ...exercise,
    sets: ensureEditableSets(exercise.id, exercise.sets).map((set, index) => ({
      ...set,
      _clientKey: sourceSets[index]?._clientKey || previousSets[index]?._clientKey || set._clientKey,
    })),
  };
}

export function withEditableSetKeysForExercises(exercises: FitnessExercise[]): FitnessExercise[] {
  return exercises.map((exercise) => withEditableSetKeys(exercise));
}

export function stripSetClientKeys(sets: ExerciseSet[] | undefined): ExerciseSet[] {
  return normalizeExerciseSets(sets);
}

export function defaultMovementTypeForCategory(category: string) {
  return category.trim().toLowerCase() === 'cardio' ? 'Cardio' : 'Strength';
}

export function filterExerciseOptionsByCategoryAndQuery(
  options: ExerciseOption[],
  selectedCategory: string,
  query: string,
) {
  const category = selectedCategory.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  return options.filter((option) => {
    const matchesCategory = !category || option.category.trim().toLowerCase() === category;
    const matchesQuery = !normalizedQuery || option.name.toLowerCase().includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });
}
