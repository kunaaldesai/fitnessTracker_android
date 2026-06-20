export type ApiEnvelope<T extends object = Record<string, never>> =
  | ({ status: 'ok'; error: null } & T)
  | ({ status: 'error'; error: string } & Partial<T>);

export type FitnessUser = {
  uid?: string;
  uuid?: string;
  display_name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
};

export type ExerciseSet = {
  set_number?: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  volume?: number;
  one_rm?: number;
};

export type FitnessExercise = {
  id: string;
  owner_uuid?: string;
  workout_date: string;
  order_index: number;
  name: string;
  category: string;
  movement_type: string;
  type?: string;
  notes?: string;
  sets: ExerciseSet[];
  total_volume?: number;
  completed_sets?: number;
  created_at_iso?: string;
  updated_at_iso?: string;
  source_date?: string;
  source_date_label?: string;
};

export type ExerciseOption = {
  name: string;
  category: string;
  movement_type: string;
  type?: string;
  source?: 'default' | 'custom' | string;
};

export type DayLabels = {
  date: string;
  label_short: string;
  label_full: string;
  is_today: boolean;
  previous_date: string;
  next_date: string;
};

export type DayPayload = {
  user: FitnessUser;
  day: DayLabels;
  summary: {
    total_volume: number;
    sets_completed: number;
    exercise_count: number;
  };
  exercises: FitnessExercise[];
};

export type ExerciseOptionsPayload = {
  user: FitnessUser;
  categories: string[];
  types: string[];
  exercises: ExerciseOption[];
  default_count: number;
};

export type RangePayload = {
  key: string;
  start_date: string | null;
  end_date: string | null;
};

export type PersonalRecord = {
  exercise_name: string;
  category: string;
  movement_type: string;
  max_weight: number;
  max_weight_date?: string | null;
  max_weight_date_label?: string;
  max_one_rm: number;
  max_one_rm_date?: string | null;
  max_one_rm_date_label?: string;
  max_volume: number;
  max_volume_date?: string | null;
  max_volume_date_label?: string;
  latest_one_rm?: number;
  previous_one_rm?: number;
  one_rm_delta?: number;
  improvement_since_first?: number;
  last_workout_date?: string;
  last_workout_date_label?: string;
  latest_volume?: number;
  latest_best_set?: ExerciseSet;
  session_count: number;
};

export type VolumePoint = {
  date: string;
  date_label: string;
  volume: number;
};

export type MuscleSplitRow = {
  group: string;
  value: number;
  percent: number;
  metric: string;
  unit: string;
};

export type RecentActivityRow = {
  exercise_id: string;
  exercise_name: string;
  category: string;
  movement_type: string;
  date: string;
  date_label: string;
  sets_completed: number;
  best_set_label: string;
  volume: number;
  max_one_rm: number;
};

export type AnalyticsPayload = {
  user: FitnessUser;
  range: RangePayload;
  summary: {
    total_volume: number;
    sets_completed: number;
    exercise_count: number;
    workout_days: number;
    record_count: number;
  };
  personal_records: PersonalRecord[];
  personal_records_total: number;
  volume_progression: VolumePoint[];
  volume_progression_by_category: Record<string, VolumePoint[]>;
  volume_category: string;
  volume_category_options: { key: string; label: string }[];
  muscle_split_metric: string;
  muscle_split_metrics: { key: string; label: string; unit: string }[];
  muscle_split: MuscleSplitRow[];
  muscle_split_by_metric: Record<string, MuscleSplitRow[]>;
  recent_activity: RecentActivityRow[];
};

export type RecordsPayload = {
  user: FitnessUser;
  range: RangePayload;
  query: string;
  sort: string;
  paging: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
  summary: {
    total_exercises: number;
    new_prs_30d: number;
    strongest_lift: { exercise_name: string; max_weight: number } | null;
    most_improved: { exercise_name: string; improvement_since_first: number } | null;
  };
  records: PersonalRecord[];
};

export type ExerciseHistoryPayload = {
  user: FitnessUser;
  exercise_name: string;
  category: string;
  movement_type: string;
  sessions: {
    date: string;
    date_label: string;
    sets_completed: number;
    best_set_label: string;
    volume: number;
    max_one_rm: number;
    max_weight: number;
  }[];
  session_count: number;
};

export type WorkoutCalendarPayload = {
  user: FitnessUser;
  range: RangePayload;
  weeks: { date: string | null; volume: number; has_workout: boolean; level: number }[][];
  current_streak: number;
  longest_streak: number;
  total_workout_days: number;
  max_volume: number;
};

export type LastSessionsPayload = {
  user: FitnessUser;
  last_sessions: Record<string, { date: string; date_label: string; sets_summary: string[] }>;
};

export type PreviousWorkoutPayload = {
  user: FitnessUser;
  previous_date: string | null;
  previous_date_label: string | null;
  exercises: FitnessExercise[];
};

export type ProfilePayload = {
  user: FitnessUser;
  profile: {
    date_of_birth: string | null;
    sex_for_bmr: string;
    height_feet: number | null;
    height_inches: number | null;
    weight_lbs: number | null;
    activity_level: string;
    bmr_formula: string;
    body_fat_percent: number | null;
    custom_goal_lbs_per_week: number | null;
  };
  metrics: {
    age_years: number | null;
    bmi: number | null;
    bmi_category: string | null;
    bmi_zone: string | null;
    bmi_position_pct: number | null;
    bmr: number | null;
    tdee: number | null;
    activity_multiplier: number | null;
    recommended_calories: Record<string, { label: string; rate_lbs_per_week: number; calories: number }>;
  };
  missing_fields: Record<string, string[]>;
  activity_level_options: { key: string; label: string; multiplier: number; description: string }[];
  bmr_formula_options: { key: string; label: string; description: string }[];
};
