import type { ExerciseSet, FitnessExercise, PersonalRecord } from '@/types/fitness';

import {
  computeExerciseDistanceMiles,
  computeExerciseDurationSeconds,
  computeExerciseVolume,
  formatDecimal,
  formatDuration,
  formatNumber,
  isCardioMovement,
  isStretchingMovement,
  normalizeMovementType,
} from './fitnessMath';

export type MovementKind = 'strength' | 'cardio' | 'stretching' | 'other';

export type RecordMetricPresentation = {
  label: string;
  value: string;
  meta?: string;
};

export function movementKind(value: unknown): MovementKind {
  const normalized = normalizeMovementType(value);
  if (normalized === 'strength' || normalized === 'cardio' || normalized === 'stretching') return normalized;
  return 'other';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function movementEntryLabel(movementType: unknown, plural = false) {
  if (isCardioMovement(movementType)) return plural ? 'Intervals' : 'Interval';
  if (isStretchingMovement(movementType)) return plural ? 'Holds' : 'Hold';
  return plural ? 'Sets' : 'Set';
}

export function formatMovementSet(set: ExerciseSet | null | undefined, movementType: unknown) {
  if (!set) return '';

  if (isCardioMovement(movementType)) {
    const duration = computeExerciseDurationSeconds({ sets: [set] });
    const distance = computeExerciseDistanceMiles({ sets: [set] });
    const parts: string[] = [];
    if (duration > 0) parts.push(formatDuration(duration));
    if (distance > 0) parts.push(`${formatDecimal(distance, distance >= 10 ? 1 : 2)} mi`);
    if (set.rpe !== null && set.rpe !== undefined) parts.push(`RPE ${formatDecimal(set.rpe)}`);
    return parts.join(' ');
  }

  if (isStretchingMovement(movementType)) {
    const duration = computeExerciseDurationSeconds({ sets: [set] });
    const parts: string[] = [];
    if (duration > 0) parts.push(formatDuration(duration));
    if (set.side) parts.push(set.side);
    if (set.rpe !== null && set.rpe !== undefined) parts.push(`RPE ${formatDecimal(set.rpe)}`);
    return parts.join(' ');
  }

  if (set.weight !== null && set.weight !== undefined && set.reps !== null && set.reps !== undefined && set.reps > 0) {
    return `${formatDecimal(set.weight)} × ${set.reps}`;
  }
  if (set.reps !== null && set.reps !== undefined && set.reps > 0) return pluralize(set.reps, 'rep');
  return '';
}

export function formatExerciseEffort(exercise: FitnessExercise) {
  const type = exercise.movement_type || exercise.type || 'Strength';
  if (isCardioMovement(type)) {
    const duration = computeExerciseDurationSeconds(exercise);
    const distance = computeExerciseDistanceMiles(exercise);
    const parts: string[] = [];
    if (duration > 0) parts.push(formatDuration(duration));
    if (distance > 0) parts.push(`${formatDecimal(distance, distance >= 10 ? 1 : 2)} mi`);
    return parts.join(' • ') || 'Ready to log';
  }
  if (isStretchingMovement(type)) {
    const duration = computeExerciseDurationSeconds(exercise);
    return duration > 0 ? formatDuration(duration) : 'Ready to log';
  }
  const volume = computeExerciseVolume(exercise);
  return volume > 0 ? `${formatNumber(volume)} lbs` : 'Ready to log';
}

export function collapsedExerciseSummary(exercise: FitnessExercise) {
  const type = exercise.movement_type || exercise.type || 'Strength';
  const countLabel = pluralize(exercise.sets.length, movementEntryLabel(type), movementEntryLabel(type, true));
  const lastMeaningfulSet = exercise.sets
    .slice()
    .reverse()
    .find((set) => Boolean(formatMovementSet(set, type)));
  const setSummary = formatMovementSet(lastMeaningfulSet, type);
  return setSummary ? `${countLabel} • ${setSummary}` : `${countLabel} • ${formatExerciseEffort(exercise)}`;
}

export function initialExpandedExerciseIds(exercises: Pick<FitnessExercise, 'id'>[]) {
  return new Set(exercises.map((exercise) => exercise.id));
}

export function toggleExpandedExerciseId(currentIds: ReadonlySet<string>, exerciseId: string) {
  const nextIds = new Set(currentIds);
  if (nextIds.has(exerciseId)) {
    nextIds.delete(exerciseId);
  } else {
    nextIds.add(exerciseId);
  }
  return nextIds;
}

export function recordMetrics(record: PersonalRecord): RecordMetricPresentation[] {
  const kind = movementKind(record.movement_type);
  if (kind === 'strength' || kind === 'other') {
    return [
      {
        label: 'Max Weight',
        value: record.max_weight > 0 ? `${formatNumber(record.max_weight)} lbs` : '--',
        meta: record.max_weight_date_label,
      },
      {
        label: 'Est. 1RM',
        value: record.max_one_rm > 0 ? `${formatNumber(record.max_one_rm)} lbs` : '--',
        meta: record.max_one_rm_date_label,
      },
      {
        label: 'Best Volume',
        value: record.max_volume > 0 ? `${formatNumber(record.max_volume)} lbs` : '--',
        meta: record.max_volume_date_label,
      },
    ];
  }

  return [
    {
      label: kind === 'cardio' ? 'Latest Best' : 'Latest Hold',
      value: formatMovementSet(record.latest_best_set, record.movement_type) || 'Not recorded',
      meta: record.last_workout_date_label,
    },
    {
      label: 'History',
      value: pluralize(record.session_count, 'session'),
      meta: record.category,
    },
    {
      label: 'Last Activity',
      value: record.last_workout_date_label || '--',
      meta: kind === 'cardio' ? 'Cardio' : 'Mobility',
    },
  ];
}

export function movementHistoryDetail(value: string | null | undefined, movementType: unknown) {
  const detail = value?.trim();
  if (detail && detail !== '-' && detail !== '--') return detail;
  const entry = movementEntryLabel(movementType).toLowerCase();
  return `No ${entry} details recorded`;
}

export function movementHistorySessionSummary(
  completed: number,
  detail: string | null | undefined,
  movementType: unknown,
) {
  const cleanDetail = detail?.trim();
  if ((!cleanDetail || cleanDetail === '-' || cleanDetail === '--') && completed <= 0) {
    return movementHistoryDetail(detail, movementType);
  }
  const countLabel = pluralize(
    completed,
    movementEntryLabel(movementType),
    movementEntryLabel(movementType, true),
  );
  return cleanDetail && cleanDetail !== '-' && cleanDetail !== '--'
    ? `${countLabel} | ${cleanDetail}`
    : `${countLabel} | Details not recorded`;
}

export function recordDeltaLabel(record: PersonalRecord) {
  if (movementKind(record.movement_type) !== 'strength') return 'History';
  return record.one_rm_delta && record.one_rm_delta > 0 ? `+${formatNumber(record.one_rm_delta)} 1RM` : 'History';
}

export function historyMetricForMovement(movementType: unknown) {
  const kind = movementKind(movementType);
  if (kind === 'cardio') return { key: 'best_set_label' as const, label: 'Best interval' };
  if (kind === 'stretching') return { key: 'best_set_label' as const, label: 'Best hold' };
  return { key: 'max_one_rm' as const, label: 'Estimated 1RM' };
}
