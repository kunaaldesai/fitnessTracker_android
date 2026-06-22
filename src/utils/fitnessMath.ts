import type { ExerciseSet, FitnessExercise } from '@/types/fitness';

export function normalizeMovementType(value: unknown): string {
  return String(value || 'Strength').trim().toLowerCase();
}

export function isStrengthMovement(value: unknown) {
  return normalizeMovementType(value) === 'strength';
}

export function isCardioMovement(value: unknown) {
  return normalizeMovementType(value) === 'cardio';
}

export function isStretchingMovement(value: unknown) {
  return normalizeMovementType(value) === 'stretching';
}

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

export function computeExerciseVolume(exercise: Pick<FitnessExercise, 'sets' | 'total_volume'> & { movement_type?: string; type?: string }): number {
  if (!isStrengthMovement(exercise.movement_type || exercise.type || 'Strength')) return 0;
  if (Array.isArray(exercise.sets)) {
    return exercise.sets.reduce((sum, set) => sum + computeSetVolume(set), 0);
  }
  return Number(exercise.total_volume || 0);
}

export function computeSetDurationSeconds(set: Pick<ExerciseSet, 'duration_seconds'>): number {
  const duration = toNumberOrNull(set.duration_seconds);
  return duration === null ? 0 : Math.max(0, duration);
}

export function computeExerciseDurationSeconds(exercise: Pick<FitnessExercise, 'sets' | 'total_duration_seconds'>): number {
  if (Array.isArray(exercise.sets)) {
    return exercise.sets.reduce((sum, set) => sum + computeSetDurationSeconds(set), 0);
  }
  return Number(exercise.total_duration_seconds || 0);
}

export function computeSetDistanceMiles(set: Pick<ExerciseSet, 'distance_miles'>): number {
  const distance = toNumberOrNull(set.distance_miles);
  return distance === null ? 0 : Math.max(0, distance);
}

export function computeExerciseDistanceMiles(exercise: Pick<FitnessExercise, 'sets' | 'total_distance_miles'>): number {
  if (Array.isArray(exercise.sets)) {
    return exercise.sets.reduce((sum, set) => sum + computeSetDistanceMiles(set), 0);
  }
  return Number(exercise.total_distance_miles || 0);
}

export function isCompletedExerciseSet(set: ExerciseSet, movementType = 'Strength'): boolean {
  if (isStrengthMovement(movementType)) return computeSetVolume(set) > 0;
  if (isCardioMovement(movementType)) return computeSetDurationSeconds(set) > 0 || computeSetDistanceMiles(set) > 0;
  if (isStretchingMovement(movementType)) return computeSetDurationSeconds(set) > 0;
  return computeSetVolume(set) > 0 || computeSetDurationSeconds(set) > 0 || computeSetDistanceMiles(set) > 0;
}

export function countCompletedSets(exercises: (Pick<FitnessExercise, 'sets'> & { movement_type?: string; type?: string })[]): number {
  return exercises.reduce(
    (total, exercise) => total + (exercise.sets || []).filter((set) => isCompletedExerciseSet(set, exercise.movement_type || exercise.type)).length,
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

export function formatDuration(seconds: unknown): string {
  const parsed = toNumberOrNull(seconds);
  if (parsed === null || parsed <= 0) return '0 min';
  if (parsed < 60) return `${formatNumber(parsed)} sec`;
  const minutes = parsed / 60;
  return `${formatDecimal(minutes, minutes >= 10 ? 0 : 1)} min`;
}

export function normalizeExerciseSets(sets: ExerciseSet[] | undefined): ExerciseSet[] {
  if (!Array.isArray(sets) || sets.length === 0) {
    return [{ weight: null, reps: null, rpe: null, duration_seconds: null, distance_miles: null, side: '' }];
  }
  return sets.map((set) => ({
    weight: toNumberOrNull(set.weight),
    reps: toIntOrNull(set.reps),
    rpe: toNumberOrNull(set.rpe),
    duration_seconds: toNumberOrNull(set.duration_seconds),
    distance_miles: toNumberOrNull(set.distance_miles),
    side: typeof set.side === 'string' ? set.side : '',
  }));
}
