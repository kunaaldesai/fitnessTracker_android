import type { ExerciseOption, ExerciseSet, FitnessExercise } from '@/types/fitness';

import { normalizeExerciseSets } from './fitnessMath';

const RECENT_SUGGESTION_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function exerciseOptionUsageCount(option: ExerciseOption) {
  const count = Number(option.session_count || 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function exerciseOptionLastWorkoutTime(option: ExerciseOption) {
  const date = option.last_workout_date?.trim();
  if (!date) return 0;
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function rankExerciseOptionsForSuggestions(options: ExerciseOption[]) {
  const latestWorkoutTime = options.reduce((latest, option) => Math.max(latest, exerciseOptionLastWorkoutTime(option)), 0);
  const hasUsage = options.some((option) => exerciseOptionUsageCount(option) > 0 || exerciseOptionLastWorkoutTime(option) > 0);
  if (!hasUsage) return options;

  return [...options]
    .map((option, index) => {
      const sessionCount = exerciseOptionUsageCount(option);
      const lastWorkoutTime = exerciseOptionLastWorkoutTime(option);
      const daysSinceLatest = lastWorkoutTime && latestWorkoutTime
        ? Math.max(0, Math.round((latestWorkoutTime - lastWorkoutTime) / DAY_MS))
        : RECENT_SUGGESTION_WINDOW_DAYS + 1;
      const recencyScore = Math.max(0, RECENT_SUGGESTION_WINDOW_DAYS - daysSinceLatest) * 2;
      const frequencyScore = Math.min(sessionCount, 30) * 6;
      return {
        option,
        index,
        sessionCount,
        lastWorkoutTime,
        score: recencyScore + frequencyScore,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.lastWorkoutTime !== a.lastWorkoutTime) return b.lastWorkoutTime - a.lastWorkoutTime;
      if (b.sessionCount !== a.sessionCount) return b.sessionCount - a.sessionCount;
      return a.index - b.index;
    })
    .map(({ option }) => option);
}
