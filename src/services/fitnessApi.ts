import { getCurrentIdToken } from '@/services/authService';
import type {
  AnalyticsPayload,
  ApiEnvelope,
  DayPayload,
  ExerciseHistoryPayload,
  ExerciseOptionsPayload,
  ExerciseSet,
  FitnessExercise,
  LastSessionsPayload,
  PreviousWorkoutPayload,
  ProfilePayload,
  RecordsPayload,
  WeightHistoryPayload,
  WorkoutCalendarPayload,
} from '@/types/fitness';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ClientOptions = {
  baseUrl?: string;
  getToken?: () => Promise<string>;
  fetchImpl?: FetchLike;
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  params?: Record<string, string | number | null | undefined>;
  body?: Record<string, unknown>;
};

const DEFAULT_BASE_URL = 'https://fitness-tracker-39bca.web.app';

export function buildApiUrl(
  baseUrl: string,
  path: string,
  params: Record<string, string | number | null | undefined> = {},
) {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export function createFitnessApiClient(options: ClientOptions = {}) {
  const baseUrl = options.baseUrl || process.env.EXPO_PUBLIC_FITNESS_API_BASE_URL || DEFAULT_BASE_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const getToken = options.getToken || getCurrentIdToken;

  async function request<T extends object>(path: string, requestOptions: RequestOptions = {}): Promise<ApiEnvelope<T>> {
    const token = await getToken();
    const method = requestOptions.method || 'GET';
    const response = await fetchImpl(buildApiUrl(baseUrl, path, requestOptions.params), {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method !== 'GET' ? JSON.stringify(requestOptions.body || {}) : undefined,
    });
    const data = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!data || typeof data !== 'object') {
      return { status: 'error', error: `Request failed (${response.status}).` } as ApiEnvelope<T>;
    }
    if (!response.ok && !data.error) {
      return { ...data, status: 'error', error: `Request failed (${response.status}).` } as ApiEnvelope<T>;
    }
    return data;
  }

  return {
    getDay(date: string) {
      return request<DayPayload>('/api/fitness/day/', { params: { date } });
    },
    getExerciseOptions() {
      return request<ExerciseOptionsPayload>('/api/fitness/exercise-options/');
    },
    getAnalytics(params: {
      range?: string;
      start_date?: string;
      end_date?: string;
      split_metric?: string;
      volume_category?: string;
    }) {
      return request<AnalyticsPayload>('/api/fitness/analytics/', { params });
    },
    getRecords(params: {
      q?: string;
      sort?: string;
      page?: number;
      page_size?: number;
      range?: string;
      start_date?: string;
      end_date?: string;
    }) {
      return request<RecordsPayload>('/api/fitness/records/', { params });
    },
    getProfile() {
      return request<ProfilePayload>('/api/fitness/profile/');
    },
    saveProfile(payload: Record<string, unknown>) {
      return request<ProfilePayload>('/api/fitness/profile/', { method: 'POST', body: payload });
    },
    getWeightHistory(params: {
      range?: string;
      start_date?: string;
      end_date?: string;
    } = {}) {
      return request<WeightHistoryPayload>('/api/fitness/profile/weight-history/', { params });
    },
    createWeightEntry(payload: {
      date?: string;
      weight_lbs?: number;
      weight_kg?: number;
      note?: string;
    }) {
      return request<{ entry: WeightHistoryPayload['entries'][number]; weight_history: WeightHistoryPayload }>(
        '/api/fitness/profile/weight-history/create/',
        { method: 'POST', body: payload },
      );
    },
    updateWeightEntry(entryId: string, payload: {
      date?: string;
      weight_lbs?: number;
      weight_kg?: number;
      note?: string;
    }) {
      return request<{ entry: WeightHistoryPayload['entries'][number]; weight_history: WeightHistoryPayload }>(
        `/api/fitness/profile/weight-history/${encodeURIComponent(entryId)}/update/`,
        { method: 'POST', body: payload },
      );
    },
    deleteWeightEntry(entryId: string) {
      return request<{ deleted: boolean; entry_id: string; weight_history: WeightHistoryPayload }>(
        `/api/fitness/profile/weight-history/${encodeURIComponent(entryId)}/delete/`,
        { method: 'POST', body: {} },
      );
    },
    createExercise(payload: {
      workout_date: string;
      name: string;
      category?: string;
      movement_type?: string;
      notes?: string;
      sets?: ExerciseSet[];
    }) {
      return request<{ exercise: FitnessExercise }>('/api/fitness/exercises/create/', {
        method: 'POST',
        body: payload,
      });
    },
    updateExercise(exerciseId: string, payload: Partial<FitnessExercise> & { sets?: ExerciseSet[] }) {
      return request<{ exercise: FitnessExercise }>(`/api/fitness/exercises/${encodeURIComponent(exerciseId)}/update/`, {
        method: 'POST',
        body: payload as Record<string, unknown>,
      });
    },
    deleteExercise(exerciseId: string) {
      return request<{ deleted: boolean; exercise_id: string }>(
        `/api/fitness/exercises/${encodeURIComponent(exerciseId)}/delete/`,
        { method: 'POST', body: {} },
      );
    },
    reorderExercises(workoutDate: string, order: string[]) {
      return request<{ reordered: { updated: number }; workout_date: string }>('/api/fitness/exercises/reorder/', {
        method: 'POST',
        body: { workout_date: workoutDate, order },
      });
    },
    getLastSessions(date: string) {
      return request<LastSessionsPayload>('/api/fitness/exercises/last-sessions/', { params: { date } });
    },
    getPreviousWorkout(before: string) {
      return request<PreviousWorkoutPayload>('/api/fitness/exercises/previous-workout/', { params: { before } });
    },
    copyExercisesToDate(targetDate: string, exerciseIds: string[]) {
      return request<{ created: FitnessExercise[]; count: number }>('/api/fitness/exercises/copy-from-date/', {
        method: 'POST',
        body: { target_date: targetDate, exercise_ids: exerciseIds },
      });
    },
    getExerciseHistory(name: string) {
      return request<ExerciseHistoryPayload>('/api/fitness/exercise-history/', { params: { name } });
    },
    getWorkoutCalendar(params: { range?: string; start_date?: string; end_date?: string }) {
      return request<WorkoutCalendarPayload>('/api/fitness/workout-calendar/', { params });
    },
  };
}

export const fitnessApi = createFitnessApiClient();
