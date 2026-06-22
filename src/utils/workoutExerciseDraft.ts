import type { ExerciseOption, ExerciseSet, FitnessExercise } from '@/types/fitness';

import { normalizeExerciseSets } from './fitnessMath';

export const DEFAULT_EXERCISE_CATEGORIES = [
  'Chest',
  'Back',
  'Shoulders',
  'Traps',
  'Biceps',
  'Triceps',
  'Forearms',
  'Abs',
  'Adductors',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Cardio',
];

export function mergeExerciseCategories(...sources: ((string | null | undefined)[] | null | undefined)[]) {
  const categories: string[] = [];
  const seen = new Set<string>();

  function addCategory(category: string | null | undefined) {
    const trimmed = category?.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    const defaultLabel = DEFAULT_EXERCISE_CATEGORIES.find((option) => option.toLowerCase() === key);
    categories.push(defaultLabel || trimmed);
    seen.add(key);
  }

  DEFAULT_EXERCISE_CATEGORIES.forEach(addCategory);
  sources.forEach((source) => source?.forEach(addCategory));
  return categories;
}

let setKeyCounter = 0;

export function createSetClientKey(exerciseId: string) {
  setKeyCounter += 1;
  return `${exerciseId}:local-set:${setKeyCounter}`;
}

export function createEmptyEditableSet(exerciseId: string): ExerciseSet {
  return {
    weight: null,
    reps: null,
    rpe: null,
    duration_seconds: null,
    distance_miles: null,
    side: '',
    _clientKey: createSetClientKey(exerciseId),
  };
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
  selectedCategories: string[],
  selectedTypes: string[],
  query: string,
) {
  const categoryKeys = new Set(selectedCategories.map((category) => category.trim().toLowerCase()).filter(Boolean));
  const typeKeys = new Set(selectedTypes.map((type) => type.trim().toLowerCase()).filter(Boolean));
  const normalizedQuery = query.trim().toLowerCase();
  return options.filter((option) => {
    const matchesCategory = !categoryKeys.size || categoryKeys.has(option.category.trim().toLowerCase());
    const optionType = (option.movement_type || option.type || '').trim().toLowerCase();
    const matchesType = !typeKeys.size || typeKeys.has(optionType);
    const matchesQuery = !normalizedQuery || option.name.toLowerCase().includes(normalizedQuery);
    return matchesCategory && matchesType && matchesQuery;
  });
}
