import type { ExerciseSet, FitnessExercise } from '@/types/fitness';

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toIntOrNull(value: unknown): number | null {
  const parsed = toNumberOrNull(value);
  return parsed === null ? null : Math.max(0, Math.trunc(parsed));
}

export function computeSetVolume(set: Pick<ExerciseSet, 'weight' | 'reps'>): number {
  const weight = toNumberOrNull(set.weight);
  const reps = toIntOrNull(set.reps);
  if (weight === null || reps === null) return 0;
  return Math.max(0, weight * reps);
}

export function computeExerciseVolume(exercise: Pick<FitnessExercise, 'sets' | 'total_volume'>): number {
  if (Array.isArray(exercise.sets)) {
    return exercise.sets.reduce((sum, set) => sum + computeSetVolume(set), 0);
  }
  return Number(exercise.total_volume || 0);
}

export function countCompletedSets(exercises: Pick<FitnessExercise, 'sets'>[]): number {
  return exercises.reduce(
    (total, exercise) => total + (exercise.sets || []).filter((set) => computeSetVolume(set) > 0).length,
    0,
  );
}

export function formatNumber(value: unknown, digits = 0): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(parsed);
}

export function formatDecimal(value: unknown, digits = 1): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return String(Number(parsed.toFixed(digits)));
}

export function normalizeExerciseSets(sets: ExerciseSet[] | undefined): ExerciseSet[] {
  if (!Array.isArray(sets) || sets.length === 0) {
    return [{ weight: null, reps: null, rpe: null }];
  }
  return sets.map((set) => ({
    weight: toNumberOrNull(set.weight),
    reps: toIntOrNull(set.reps),
    rpe: toNumberOrNull(set.rpe),
  }));
}
