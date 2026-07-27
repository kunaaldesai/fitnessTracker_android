import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  type LucideIcon,
  Activity,
  BellRing,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Dumbbell,
  Ellipsis,
  GripVertical,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  Sparkles,
  StickyNote,
  Timer,
  Trash2,
  User,
  Vibrate,
  Volume2,
  X,
} from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  AppState,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import type { FlatList as GestureFlatList } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { PageTransition } from '@/components/fittrack/PageTransition';
import { LoginLaunchAnimation } from '@/components/fittrack/LoginLaunchAnimation';
import { CategoryPicker } from '@/components/fittrack/CategoryPicker';
import { MotionContent, MotionLayout } from '@/components/fittrack/Motion';
import { WorkoutDaySwipeSurface } from '@/components/fittrack/WorkoutDaySwipeSurface';
import {
  AppText,
  Card,
  DateField,
  EmptyState,
  Header,
  IconButton,
  InlineError,
  LoadingState,
  MetricCard,
  ModalSheet,
  OptionRow,
  PillButton,
  TextField,
  Toast,
} from '@/components/fittrack/ui';
import { radius, spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/context/AuthContext';
import { registerFitnessDataFlusher, trackFitnessDataWrite } from '@/services/fitnessDataFreshness';
import { fitnessApi } from '@/services/fitnessApi';
import {
  cancelWorkoutTimerNotification,
  configureWorkoutTimerNotifications,
  ensureWorkoutTimerNotificationPermission,
  scheduleWorkoutTimerNotification,
  triggerWorkoutTimerForegroundAlert,
  type WorkoutTimerAlertMode,
} from '@/services/workoutTimerNotifications';
import type { ExerciseOption, ExerciseSet, FitnessExercise, LastSessionsPayload, PreviousWorkoutPayload } from '@/types/fitness';
import { fullDateLabel, shiftIsoDate, todayIso } from '@/utils/date';
import {
  createEmptyEditableSet,
  DEFAULT_EXERCISE_CATEGORIES,
  defaultMovementTypeForCategory,
  ensureEditableSets,
  filterExerciseOptionsByCategoryAndQuery,
  mergeExerciseCategories,
  rankExerciseOptionsForSuggestions,
  stripSetClientKeys,
  withEditableSetKeys,
  withEditableSetKeysForExercises,
} from '@/utils/workoutExerciseDraft';
import {
  computeExerciseDistanceMiles,
  computeExerciseDurationSeconds,
  computeExerciseVolume,
  computeSetVolume,
  countCompletedSets,
  formatDecimal,
  formatDuration,
  formatNumber,
  isCardioMovement,
  isStretchingMovement,
  isStrengthMovement,
  normalizeDecimalInputText,
  toIntOrNull,
  toNumberOrNull,
} from '@/utils/fitnessMath';
import { calculateKeyboardAwareScrollDelta } from '@/utils/keyboardAwareScroll';
import {
  collapsedExerciseSummary,
  initialExpandedExerciseIds,
  toggleExpandedExerciseId,
} from '@/utils/fitnessPresentation';
import { MOTION_TIMING } from '@/utils/motion';

const DEFAULT_TYPES = ['Strength', 'Cardio', 'Stretching'];
const STRETCH_SIDE_OPTIONS = ['Both', 'Left', 'Right'];
const MAX_EXERCISE_SUGGESTIONS = 24;
const CARDIO_CATEGORY = 'Cardio';
const DEFAULT_CUSTOM_EXERCISE_TYPE = 'Strength';
const WORKOUT_SETTINGS_STORAGE_KEY = 'fittrack.workoutSettings.v1';
const DEFAULT_WORKOUT_SETTINGS = {
  showSummary: true,
  showLastSession: true,
  showSetVolume: true,
};
const WORKOUT_TIMER_STORAGE_KEY = 'fittrack.workoutTimer.v1';
const DEFAULT_TIMER_DURATION_SECONDS = 90;
const TIMER_PRESETS = [60, 90, 120, 180];
const MIN_TIMER_SECONDS = 5;
const MAX_TIMER_SECONDS = 99 * 60 + 59;
const WORKOUT_LIST_BASE_BOTTOM_PADDING = 120;
const WORKOUT_INPUT_KEYBOARD_MARGIN = 28;
const WORKOUT_INPUT_TOP_MARGIN = 18;
const SET_ROW_LAYOUT_ANIMATION = {
  duration: 240,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type ToastState = { message: string; title?: string; tone?: 'default' | 'success' | 'error' };
type WorkoutSettings = typeof DEFAULT_WORKOUT_SETTINGS;
type WorkoutListViewport = {
  top: number;
  bottom: number;
};
type WorkoutSetInputField = 'primary' | 'secondary' | 'rpe';
type WorkoutSetInputRefMap = Partial<Record<WorkoutSetInputField, TextInput | null>>;
type WorkoutDaySnapshot = {
  date: string;
  label: string;
  exercises: FitnessExercise[];
};
type AdjacentWorkoutDays = {
  previous: WorkoutDaySnapshot | null;
  next: WorkoutDaySnapshot | null;
};
type WorkoutTimerStatus = 'idle' | 'running' | 'paused' | 'completed';
type WorkoutTimerState = {
  status: WorkoutTimerStatus;
  durationSeconds: number;
  remainingSeconds: number;
  endsAt: number | null;
  alertMode: WorkoutTimerAlertMode;
  notificationId: string | null;
  notificationPermissionDenied: boolean;
};

const DEFAULT_WORKOUT_TIMER_STATE: WorkoutTimerState = {
  status: 'idle',
  durationSeconds: DEFAULT_TIMER_DURATION_SECONDS,
  remainingSeconds: DEFAULT_TIMER_DURATION_SECONDS,
  endsAt: null,
  alertMode: 'vibrate',
  notificationId: null,
  notificationPermissionDenied: false,
};

function animateSetListChange() {
  if (Platform.OS === 'web') return;
  LayoutAnimation.configureNext(SET_ROW_LAYOUT_ANIMATION);
}

function parseWorkoutSettings(value: string | null): WorkoutSettings {
  if (!value) return DEFAULT_WORKOUT_SETTINGS;
  try {
    const parsed = JSON.parse(value) as Partial<WorkoutSettings>;
    return {
      showSummary: typeof parsed.showSummary === 'boolean' ? parsed.showSummary : DEFAULT_WORKOUT_SETTINGS.showSummary,
      showLastSession: typeof parsed.showLastSession === 'boolean' ? parsed.showLastSession : DEFAULT_WORKOUT_SETTINGS.showLastSession,
      showSetVolume: typeof parsed.showSetVolume === 'boolean' ? parsed.showSetVolume : DEFAULT_WORKOUT_SETTINGS.showSetVolume,
    };
  } catch {
    return DEFAULT_WORKOUT_SETTINGS;
  }
}

function clampTimerSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return DEFAULT_TIMER_DURATION_SECONDS;
  return Math.min(MAX_TIMER_SECONDS, Math.max(MIN_TIMER_SECONDS, Math.round(seconds)));
}

function clampTimerRemaining(seconds: number, durationSeconds: number) {
  if (!Number.isFinite(seconds)) return durationSeconds;
  return Math.min(durationSeconds, Math.max(0, Math.round(seconds)));
}

function timerPartsFromSeconds(seconds: number) {
  const safeSeconds = clampTimerSeconds(seconds);
  return {
    minutes: String(Math.floor(safeSeconds / 60)),
    seconds: String(safeSeconds % 60).padStart(2, '0'),
  };
}

function secondsFromTimerParts(minutes: string, seconds: string) {
  const parsedMinutes = Math.max(0, Number.parseInt(minutes || '0', 10) || 0);
  const parsedSeconds = Math.max(0, Number.parseInt(seconds || '0', 10) || 0);
  return clampTimerSeconds(parsedMinutes * 60 + Math.min(59, parsedSeconds));
}

function formatTimerClock(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function parseWorkoutTimerState(value: string | null): WorkoutTimerState {
  if (!value) return DEFAULT_WORKOUT_TIMER_STATE;
  try {
    const parsed = JSON.parse(value) as Partial<WorkoutTimerState>;
    const durationSeconds = clampTimerSeconds(Number(parsed.durationSeconds || DEFAULT_TIMER_DURATION_SECONDS));
    const remainingSeconds = clampTimerRemaining(Number(parsed.remainingSeconds ?? durationSeconds), durationSeconds);
    const alertMode: WorkoutTimerAlertMode =
      parsed.alertMode === 'sound' || parsed.alertMode === 'both' || parsed.alertMode === 'vibrate'
        ? parsed.alertMode
        : 'vibrate';
    const status: WorkoutTimerStatus =
      parsed.status === 'running' || parsed.status === 'paused' || parsed.status === 'completed' || parsed.status === 'idle'
        ? parsed.status
        : 'idle';
    return {
      status,
      durationSeconds,
      remainingSeconds,
      endsAt: typeof parsed.endsAt === 'number' ? parsed.endsAt : null,
      alertMode,
      notificationId: typeof parsed.notificationId === 'string' ? parsed.notificationId : null,
      notificationPermissionDenied: parsed.notificationPermissionDenied === true,
    };
  } catch {
    return DEFAULT_WORKOUT_TIMER_STATE;
  }
}

function reconcileWorkoutTimerState(state: WorkoutTimerState, now = Date.now()): WorkoutTimerState {
  if (state.status !== 'running' || !state.endsAt) return state;
  const remainingSeconds = Math.max(0, Math.ceil((state.endsAt - now) / 1000));
  if (remainingSeconds <= 0) {
    return {
      ...state,
      status: 'completed',
      remainingSeconds: 0,
    };
  }
  return {
    ...state,
    remainingSeconds,
  };
}

function timerStatusLabel(status: WorkoutTimerStatus) {
  if (status === 'running') return 'Running';
  if (status === 'paused') return 'Paused';
  if (status === 'completed') return 'Complete';
  return 'Ready';
}

function summarizeWorkout(exercises: FitnessExercise[]) {
  return {
    volume: exercises.reduce((sum, exercise) => sum + computeExerciseVolume(exercise), 0),
    sets: countCompletedSets(exercises),
    exercises: exercises.length,
  };
}

export default function WorkoutScreen() {
  const { colors, mode } = useAppTheme();
  const { completeLoginEntrance, loginEntrancePending } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const [exercises, setExercises] = useState<FitnessExercise[]>([]);
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<Set<string>>(() => new Set());
  const [adjacentWorkoutDays, setAdjacentWorkoutDays] = useState<AdjacentWorkoutDays>({
    previous: null,
    next: null,
  });
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [categories, setCategories] = useState<string[]>(() => [...DEFAULT_EXERCISE_CATEGORIES]);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [dayLabel, setDayLabel] = useState(() => fullDateLabel(selectedDate));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FitnessExercise | null>(null);
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null);
  const [previousWorkout, setPreviousWorkout] = useState<PreviousWorkoutPayload | null>(null);
  const [copySelection, setCopySelection] = useState<Set<string>>(new Set());
  const [lastSessions, setLastSessions] = useState<LastSessionsPayload['last_sessions']>({});
  const [saving, setSaving] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState>({ message: '' });
  const [openNoteExerciseId, setOpenNoteExerciseId] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [draggingExercise, setDraggingExercise] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncingWorkout, setSyncingWorkout] = useState(false);
  const [workoutSettings, setWorkoutSettings] = useState<WorkoutSettings>(DEFAULT_WORKOUT_SETTINGS);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerState, setTimerState] = useState<WorkoutTimerState>(DEFAULT_WORKOUT_TIMER_STATE);
  const [timerDraftMinutes, setTimerDraftMinutes] = useState(() => timerPartsFromSeconds(DEFAULT_TIMER_DURATION_SECONDS).minutes);
  const [timerDraftSeconds, setTimerDraftSeconds] = useState(() => timerPartsFromSeconds(DEFAULT_TIMER_DURATION_SECONDS).seconds);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const saveSuccessTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingExerciseSaves = useRef<Map<string, { exercise: FitnessExercise; version: number }>>(new Map());
  const inFlightExerciseSaves = useRef<Map<string, Promise<void>>>(new Map());
  const saveVersions = useRef<Map<string, number>>(new Map());
  const selectedDateRef = useRef(selectedDate);
  const dayRequestId = useRef(0);
  const adjacentDayRequestId = useRef(0);
  const workoutDayCache = useRef<Map<string, WorkoutDaySnapshot>>(new Map());
  const expandedExerciseIdsByDate = useRef<Map<string, Set<string>>>(new Map());
  const workoutSettingsHydrated = useRef(false);
  const workoutTimerHydrated = useRef(false);
  const timerCompletionHandledAt = useRef<number | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const keyboardOpenRef = useRef(false);
  const keyboardHeightRef = useRef(0);
  const keyboardTopYRef = useRef<number | null>(null);
  const workoutListRef = useRef<GestureFlatList<FitnessExercise> | null>(null);
  const workoutListViewportRef = useRef<View | null>(null);
  const workoutListViewport = useRef<WorkoutListViewport | null>(null);
  const workoutScrollOffset = useRef(0);
  const focusedWorkoutInput = useRef<TextInput | null>(null);

  const [newName, setNewName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [customCreateOpen, setCustomCreateOpen] = useState(false);
  const [customExerciseType, setCustomExerciseType] = useState(DEFAULT_CUSTOM_EXERCISE_TYPE);
  const [customCategory, setCustomCategory] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const optionLookup = useMemo(() => {
    const lookup = new Map<string, ExerciseOption>();
    exerciseOptions.forEach((option) => lookup.set(option.name.trim().toLowerCase(), option));
    return lookup;
  }, [exerciseOptions]);

  const summary = useMemo(() => summarizeWorkout(exercises), [exercises]);

  const nameQuery = newName.trim();
  const matchedOption = nameQuery ? optionLookup.get(nameQuery.toLowerCase()) : undefined;
  const isCustomExercise = Boolean(nameQuery && !matchedOption);
  const customDetailsVisible = isCustomExercise && customCreateOpen;
  const selectedCategoryLabel = selectedCategories.length === 1 ? selectedCategories[0] : `${selectedCategories.length} categories`;
  const selectedTypeLabel = selectedTypes.length === 1 ? selectedTypes[0] : `${selectedTypes.length} types`;
  const activeSuggestionFilterLabel = [selectedCategories.length ? selectedCategoryLabel : '', selectedTypes.length ? selectedTypeLabel : ''].filter(Boolean).join(' | ');
  const canSubmitAddAction = Boolean(nameQuery && (matchedOption || isCustomExercise) && !creatingExercise);
  const addActionLabel = creatingExercise
    ? 'Adding...'
    : !nameQuery
      ? 'Select an exercise'
      : matchedOption
        ? 'Add exercise'
        : customDetailsVisible
          ? 'Create exercise'
          : 'Create custom';

  const filteredOptions = useMemo(() => {
    const matches = filterExerciseOptionsByCategoryAndQuery(exerciseOptions, selectedCategories, selectedTypes, nameQuery);
    return rankExerciseOptionsForSuggestions(matches).slice(0, MAX_EXERCISE_SUGGESTIONS);
  }, [exerciseOptions, selectedCategories, selectedTypes, nameQuery]);

  const applyWorkoutSnapshot = useCallback((snapshot: WorkoutDaySnapshot) => {
    const validExerciseIds = new Set(snapshot.exercises.map((exercise) => exercise.id));
    const rememberedExpandedIds = expandedExerciseIdsByDate.current.get(snapshot.date);
    const nextExpandedIds = rememberedExpandedIds
      ? new Set([...rememberedExpandedIds].filter((exerciseId) => validExerciseIds.has(exerciseId)))
      : initialExpandedExerciseIds(snapshot.exercises);

    setDayLabel(snapshot.label);
    setExercises(snapshot.exercises);
    setExpandedExerciseIds(nextExpandedIds);
    setLoading(false);
  }, []);

  const commitSelectedDate = useCallback((date: string) => {
    if (date === selectedDateRef.current) return;
    selectedDateRef.current = date;
    setOpenNoteExerciseId(null);
    const cachedDay = workoutDayCache.current.get(date);
    if (cachedDay) {
      setError('');
      setLastSessions({});
      applyWorkoutSnapshot(cachedDay);
    } else {
      setDayLabel(fullDateLabel(date));
    }
    setSelectedDate(date);
  }, [applyWorkoutSnapshot]);

  useEffect(() => {
    loadExerciseOptions();
  }, []);

  useEffect(() => {
    configureWorkoutTimerNotifications();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(WORKOUT_SETTINGS_STORAGE_KEY)
      .then((stored) => {
        setWorkoutSettings(parseWorkoutSettings(stored));
      })
      .finally(() => {
        workoutSettingsHydrated.current = true;
      });
  }, []);

  useEffect(() => {
    if (!workoutSettingsHydrated.current) return;
    AsyncStorage.setItem(WORKOUT_SETTINGS_STORAGE_KEY, JSON.stringify(workoutSettings)).catch(() => undefined);
  }, [workoutSettings]);

  useEffect(() => {
    AsyncStorage.getItem(WORKOUT_TIMER_STORAGE_KEY)
      .then((stored) => {
        const parsed = reconcileWorkoutTimerState(parseWorkoutTimerState(stored));
        const parts = timerPartsFromSeconds(parsed.durationSeconds);
        setTimerDraftMinutes(parts.minutes);
        setTimerDraftSeconds(parts.seconds);
        setTimerState(parsed);
        timerCompletionHandledAt.current = parsed.status === 'completed' ? parsed.endsAt : null;
      })
      .finally(() => {
        workoutTimerHydrated.current = true;
      });
  }, []);

  useEffect(() => {
    if (!workoutTimerHydrated.current) return;
    AsyncStorage.setItem(WORKOUT_TIMER_STORAGE_KEY, JSON.stringify(timerState)).catch(() => undefined);
  }, [timerState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState !== 'active') return;
      setTimerState((current) => reconcileWorkoutTimerState(current));
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (timerState.status !== 'running' || !timerState.endsAt) return undefined;
    const timer = setInterval(() => {
      setTimerState((current) => reconcileWorkoutTimerState(current));
    }, 500);
    return () => clearInterval(timer);
  }, [timerState.endsAt, timerState.status]);

  useEffect(() => {
    if (timerState.status !== 'completed' || !timerState.endsAt) return;
    if (timerCompletionHandledAt.current === timerState.endsAt) return;
    timerCompletionHandledAt.current = timerState.endsAt;
    const completedInForeground = appStateRef.current === 'active' && Math.abs(Date.now() - timerState.endsAt) <= 2500;
    if (completedInForeground) {
      cancelWorkoutTimerNotification(timerState.notificationId).catch(() => undefined);
      triggerWorkoutTimerForegroundAlert(timerState.alertMode).catch(() => undefined);
      showToast('Time for your next set.', 'success', 'Rest timer complete');
    }
    setTimerState((current) => (current.endsAt === timerState.endsAt ? { ...current, notificationId: null } : current));
  }, [timerState.alertMode, timerState.endsAt, timerState.notificationId, timerState.status]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
    loadDay(selectedDate);
    // Day reloads are tied to date navigation, not every helper closure refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    preloadAdjacentWorkoutDays(selectedDate);
    // Adjacent days are a disposable visual buffer around the active date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    if (loading) return;
    expandedExerciseIdsByDate.current.set(selectedDate, new Set(expandedExerciseIds));
  }, [expandedExerciseIds, loading, selectedDate]);

  useEffect(() => {
    if (loading || !workoutDayCache.current.has(selectedDate)) return;
    workoutDayCache.current.set(selectedDate, {
      date: selectedDate,
      label: dayLabel,
      exercises,
    });
  }, [dayLabel, exercises, loading, selectedDate]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      const nextHeight = event.endCoordinates?.height || 0;
      keyboardOpenRef.current = true;
      keyboardHeightRef.current = nextHeight;
      keyboardTopYRef.current = keyboardTopYFromEvent(event, nextHeight);
      setKeyboardOpen(true);
      setKeyboardHeight(nextHeight);
      scheduleEnsureFocusedWorkoutInputVisible(focusedWorkoutInput.current, Platform.OS === 'ios' ? [80, 320] : [40, 220]);
    });
    const hideSubscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardOpenRef.current = false;
      keyboardHeightRef.current = 0;
      keyboardTopYRef.current = null;
      focusedWorkoutInput.current = null;
      setKeyboardOpen(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
    // Keyboard listeners only read mutable refs, so one subscription stays current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The flusher only reads mutable refs, so one registration stays current for this mounted tab.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => registerFitnessDataFlusher(flushPendingExerciseSaves), []);

  useEffect(() => {
    if (!toast.message) return;
    const timer = setTimeout(() => setToast({ message: '' }), 1800);
    return () => clearTimeout(timer);
  }, [toast.message]);

  async function loadExerciseOptions() {
    const response = await fitnessApi.getExerciseOptions();
    if (response.status !== 'ok') return;
    const responseExercises = response.exercises || [];
    setExerciseOptions(responseExercises);
    setCategories(mergeExerciseCategories(response.categories, responseExercises.map((exercise) => exercise.category)));
    setTypes(response.types?.length ? response.types : DEFAULT_TYPES);
  }

  async function loadAdjacentWorkoutDay(date: string) {
    const cachedDay = workoutDayCache.current.get(date);
    if (cachedDay) return cachedDay;

    const response = await fitnessApi.getDay(date);
    if (response.status !== 'ok') return null;
    const responseDate = response.day.date;
    const snapshot: WorkoutDaySnapshot = {
      date: responseDate,
      label: response.day.label_short || fullDateLabel(responseDate),
      exercises: withEditableSetKeysForExercises(response.exercises || []),
    };
    workoutDayCache.current.set(responseDate, snapshot);
    return responseDate === date ? snapshot : null;
  }

  async function preloadAdjacentWorkoutDays(date: string) {
    const requestId = adjacentDayRequestId.current + 1;
    adjacentDayRequestId.current = requestId;
    const previousDate = shiftIsoDate(date, -1);
    const nextDate = shiftIsoDate(date, 1);

    setAdjacentWorkoutDays({
      previous: workoutDayCache.current.get(previousDate) || null,
      next: workoutDayCache.current.get(nextDate) || null,
    });

    const [previous, next] = await Promise.all([
      loadAdjacentWorkoutDay(previousDate),
      loadAdjacentWorkoutDay(nextDate),
    ]);
    if (requestId !== adjacentDayRequestId.current || date !== selectedDateRef.current) return;
    setAdjacentWorkoutDays({ previous, next });
  }

  async function loadDay(date: string) {
    const requestId = dayRequestId.current + 1;
    dayRequestId.current = requestId;
    setError('');
    setOpenNoteExerciseId(null);
    setLastSessions({});
    const cachedDay = workoutDayCache.current.get(date);
    if (cachedDay) {
      applyWorkoutSnapshot(cachedDay);
      if (cachedDay.exercises.length) {
        loadLastSessions(date, requestId);
      }
    } else {
      setLoading(true);
      setExercises([]);
      setExpandedExerciseIds(new Set());
    }
    const response = await fitnessApi.getDay(date);
    if (requestId !== dayRequestId.current) return;
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to load workout day.');
      setLoading(false);
      return;
    }
    const responseDate = response.day.date;
    if (responseDate !== date) {
      commitSelectedDate(responseDate);
    }
    const nextExercises = withEditableSetKeysForExercises(response.exercises || []);
    const snapshot: WorkoutDaySnapshot = {
      date: responseDate,
      label: response.day.label_short || fullDateLabel(responseDate),
      exercises: nextExercises,
    };
    workoutDayCache.current.set(responseDate, snapshot);
    applyWorkoutSnapshot(snapshot);
    if (nextExercises.length) {
      loadLastSessions(responseDate, requestId);
    }
    preloadAdjacentWorkoutDays(responseDate);
  }

  async function loadLastSessions(date: string, requestId = dayRequestId.current) {
    const response = await fitnessApi.getLastSessions(date);
    if (requestId !== dayRequestId.current) return;
    if (response.status === 'ok') {
      setLastSessions(response.last_sessions || {});
    }
  }

  function showToast(message: string, tone: ToastState['tone'] = 'default', title?: string) {
    setToast({ message, tone, title });
  }

  function updateWorkoutSetting(key: keyof WorkoutSettings, value: boolean) {
    setWorkoutSettings((current) => ({ ...current, [key]: value }));
  }

  async function syncWorkoutNow() {
    if (syncingWorkout) return;
    setSyncingWorkout(true);
    try {
      await flushPendingExerciseSaves();
      await loadLastSessions(selectedDateRef.current);
      showToast('Workout saved', 'success', 'Synced');
    } finally {
      setSyncingWorkout(false);
    }
  }

  function setTimerDraftFromSeconds(seconds: number) {
    const parts = timerPartsFromSeconds(seconds);
    setTimerDraftMinutes(parts.minutes);
    setTimerDraftSeconds(parts.seconds);
  }

  function updateTimerDuration(seconds: number) {
    const durationSeconds = clampTimerSeconds(seconds);
    setTimerDraftFromSeconds(durationSeconds);
    setTimerState((current) => {
      if (current.status === 'running') return current;
      return {
        ...current,
        status: current.status === 'completed' ? 'idle' : current.status,
        durationSeconds,
        remainingSeconds: durationSeconds,
        endsAt: null,
        notificationId: null,
      };
    });
  }

  function updateTimerDraft(part: 'minutes' | 'seconds', value: string) {
    const sanitized = value.replace(/\D/g, '').slice(0, 2);
    const nextMinutes = part === 'minutes' ? sanitized : timerDraftMinutes;
    const nextSeconds = part === 'seconds' ? sanitized : timerDraftSeconds;
    if (part === 'minutes') setTimerDraftMinutes(sanitized);
    else setTimerDraftSeconds(sanitized);
    const totalSeconds = secondsFromTimerParts(nextMinutes, nextSeconds);
    setTimerState((current) => {
      if (current.status === 'running') return current;
      return {
        ...current,
        status: current.status === 'completed' ? 'idle' : current.status,
        durationSeconds: totalSeconds,
        remainingSeconds: totalSeconds,
        endsAt: null,
        notificationId: null,
      };
    });
  }

  async function startWorkoutTimer(secondsOverride?: number) {
    const candidateSeconds = secondsOverride ?? (timerState.remainingSeconds || secondsFromTimerParts(timerDraftMinutes, timerDraftSeconds));
    const seconds = clampTimerSeconds(candidateSeconds);
    timerCompletionHandledAt.current = null;
    const previousNotificationId = timerState.notificationId;
    const permissionGranted = await ensureWorkoutTimerNotificationPermission().catch(() => false);
    const notificationId = permissionGranted
      ? await scheduleWorkoutTimerNotification({ seconds, alertMode: timerState.alertMode }).catch(() => null)
      : null;
    await cancelWorkoutTimerNotification(previousNotificationId);
    setTimerState((current) => ({
      ...current,
      status: 'running',
      durationSeconds: current.status === 'paused' ? current.durationSeconds : seconds,
      remainingSeconds: seconds,
      endsAt: Date.now() + seconds * 1000,
      notificationId,
      notificationPermissionDenied: !permissionGranted,
    }));
  }

  async function pauseWorkoutTimer() {
    const remainingSeconds = timerState.endsAt
      ? clampTimerRemaining(Math.ceil((timerState.endsAt - Date.now()) / 1000), timerState.durationSeconds)
      : timerState.remainingSeconds;
    await cancelWorkoutTimerNotification(timerState.notificationId);
    setTimerState((current) => ({
      ...current,
      status: 'paused',
      remainingSeconds,
      endsAt: null,
      notificationId: null,
    }));
  }

  async function resetWorkoutTimer() {
    await cancelWorkoutTimerNotification(timerState.notificationId);
    timerCompletionHandledAt.current = null;
    setTimerState((current) => ({
      ...current,
      status: 'idle',
      remainingSeconds: current.durationSeconds,
      endsAt: null,
      notificationId: null,
    }));
  }

  async function setTimerAlertMode(alertMode: WorkoutTimerAlertMode) {
    setTimerState((current) => ({ ...current, alertMode }));
    if (timerState.status !== 'running' || !timerState.endsAt) return;
    const remainingSeconds = clampTimerRemaining(Math.ceil((timerState.endsAt - Date.now()) / 1000), timerState.durationSeconds);
    const permissionGranted = await ensureWorkoutTimerNotificationPermission().catch(() => false);
    const notificationId = permissionGranted
      ? await scheduleWorkoutTimerNotification({ seconds: remainingSeconds, alertMode }).catch(() => null)
      : null;
    await cancelWorkoutTimerNotification(timerState.notificationId);
    setTimerState((current) => ({
      ...current,
      alertMode,
      notificationId,
      notificationPermissionDenied: !permissionGranted,
    }));
  }

  const navigateToDate = useCallback((date: string) => {
    commitSelectedDate(date);
  }, [commitSelectedDate]);

  const navigateByDays = useCallback((days: -1 | 1) => {
    commitSelectedDate(shiftIsoDate(selectedDateRef.current, days));
  }, [commitSelectedDate]);

  const toggleExerciseCategory = useCallback((category: string) => {
    setSelectedCategories((current) => {
      const key = category.trim().toLowerCase();
      return current.some((selected) => selected.trim().toLowerCase() === key)
        ? current.filter((selected) => selected.trim().toLowerCase() !== key)
        : [...current, category];
    });
  }, []);

  const toggleExerciseType = useCallback((type: string) => {
    setSelectedTypes((current) => {
      const key = type.trim().toLowerCase();
      return current.some((selected) => selected.trim().toLowerCase() === key)
        ? current.filter((selected) => selected.trim().toLowerCase() !== key)
        : [...current, type];
    });
  }, []);

  function updateExerciseName(value: string) {
    setNewName(value);
    const key = value.trim().toLowerCase();
    if (!key || optionLookup.has(key)) {
      setCustomCreateOpen(false);
    }
  }

  function startCustomExerciseCreation() {
    if (!isCustomExercise) return;
    setCustomCreateOpen(true);
  }

  const selectCustomExerciseType = useCallback((type: string) => {
    setCustomExerciseType(type);
    setCustomCategory((current) => (isCardioMovement(type) ? CARDIO_CATEGORY : current === CARDIO_CATEGORY ? '' : current));
  }, []);

  const selectCustomCategory = useCallback((category: string) => {
    setCustomCategory((current) => (current.trim().toLowerCase() === category.trim().toLowerCase() ? '' : category));
  }, []);

  function updateExercise(id: string, updater: (exercise: FitnessExercise) => FitnessExercise, save = true) {
    let nextExercise: FitnessExercise | null = null;
    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== id) return exercise;
        nextExercise = withEditableSetKeys(
          updater({ ...exercise, sets: ensureEditableSets(exercise.id, exercise.sets) }),
          exercise,
        );
        return nextExercise;
      }),
    );
    if (save && nextExercise) queueExerciseSave(nextExercise);
  }

  function queueExerciseSave(exercise: FitnessExercise) {
    const existing = saveTimers.current.get(exercise.id);
    if (existing) clearTimeout(existing);
    const successTimer = saveSuccessTimers.current.get(exercise.id);
    if (successTimer) clearTimeout(successTimer);
    saveSuccessTimers.current.delete(exercise.id);
    const version = (saveVersions.current.get(exercise.id) || 0) + 1;
    saveVersions.current.set(exercise.id, version);
    pendingExerciseSaves.current.set(exercise.id, { exercise, version });
    setSaving((current) => ({ ...current, [exercise.id]: 'Saving...' }));
    const timer = setTimeout(() => {
      saveTimers.current.delete(exercise.id);
      runQueuedExerciseSave(exercise.id);
    }, 650);
    saveTimers.current.set(exercise.id, timer);
  }

  function runQueuedExerciseSave(exerciseId: string) {
    const pendingSave = pendingExerciseSaves.current.get(exerciseId);
    if (!pendingSave) return Promise.resolve();

    pendingExerciseSaves.current.delete(exerciseId);
    const savePromise = persistExercise(pendingSave.exercise, pendingSave.version);
    const trackedPromise = savePromise.finally(() => {
      if (inFlightExerciseSaves.current.get(exerciseId) === trackedPromise) {
        inFlightExerciseSaves.current.delete(exerciseId);
      }
    });
    inFlightExerciseSaves.current.set(exerciseId, trackedPromise);
    return trackedPromise;
  }

  async function flushPendingExerciseSaves() {
    const pendingIds = Array.from(pendingExerciseSaves.current.keys());
    const inFlightBeforeFlush = Array.from(inFlightExerciseSaves.current.values());
    const startedSaves = pendingIds.map((exerciseId) => {
      const timer = saveTimers.current.get(exerciseId);
      if (timer) clearTimeout(timer);
      saveTimers.current.delete(exerciseId);
      return runQueuedExerciseSave(exerciseId);
    });

    await Promise.allSettled([...inFlightBeforeFlush, ...startedSaves]);
  }

  async function persistExercise(exercise: FitnessExercise, version: number) {
    const response = await trackFitnessDataWrite(
      fitnessApi.updateExercise(exercise.id, {
        name: exercise.name,
        category: exercise.category,
        movement_type: exercise.movement_type,
        notes: exercise.notes || '',
        sets: stripSetClientKeys(exercise.sets),
      }),
    );
    if (saveVersions.current.get(exercise.id) !== version) return;
    if (response.status !== 'ok') {
      setSaving((current) => ({ ...current, [exercise.id]: 'Error' }));
      showToast(response.error || 'Unable to save exercise.', 'error');
      return;
    }
    const savedExercise = response.exercise;
    if (savedExercise) {
      setExercises((current) => current.map((item) => (item.id === savedExercise.id ? withEditableSetKeys(savedExercise, item) : item)));
    }
    setSaving((current) => ({ ...current, [exercise.id]: 'Saved' }));
    const successTimer = setTimeout(() => {
      setSaving((current) => {
        if (current[exercise.id] !== 'Saved') return current;
        const { [exercise.id]: _removed, ...remaining } = current;
        return remaining;
      });
      saveSuccessTimers.current.delete(exercise.id);
    }, MOTION_TIMING.successVisibleMs);
    saveSuccessTimers.current.set(exercise.id, successTimer);
  }

  async function createExercise() {
    if (creatingExercise) return;
    const name = nameQuery;
    if (!name) {
      showToast('Exercise name is required.', 'error');
      return;
    }
    const matched = matchedOption;
    if (!matched && !customCreateOpen) {
      setCustomCreateOpen(true);
      return;
    }
    if (!matched && !customExerciseType) {
      showToast('Pick an exercise type.', 'error');
      return;
    }
    if (!matched && !isCardioMovement(customExerciseType) && !customCategory) {
      showToast('Pick a primary muscle group.', 'error');
      return;
    }
    const category = matched?.category || (isCardioMovement(customExerciseType) ? CARDIO_CATEGORY : customCategory);
    const movementType = matched?.movement_type || matched?.type || customExerciseType;
    setCreatingExercise(true);
    try {
      const response = await trackFitnessDataWrite(
        fitnessApi.createExercise({
          workout_date: selectedDate,
          name,
          category,
          movement_type: movementType,
          notes: newNotes.trim(),
          sets: [{ weight: null, reps: null, rpe: null, duration_seconds: null, distance_miles: null, side: '' }],
        }),
      );
      if (response.status !== 'ok') {
        showToast(response.error || 'Unable to add exercise.', 'error');
        return;
      }
      resetAddForm();
      setAddOpen(false);
      if (response.exercise) {
        const createdExercise = withEditableSetKeys(response.exercise);
        setExercises((current) => [...current, createdExercise].sort((a, b) => a.order_index - b.order_index));
        setExpandedExerciseIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.add(createdExercise.id);
          return nextIds;
        });
        upsertExerciseOptionUsage(createdExercise);
      } else {
        loadDay(selectedDate);
      }
      showToast(name, 'success', 'Exercise added');
    } finally {
      setCreatingExercise(false);
    }
  }

  function handleAddExerciseAction() {
    if (creatingExercise) return;
    if (isCustomExercise && !customCreateOpen) {
      startCustomExerciseCreation();
      return;
    }
    createExercise();
  }

  function resetAddForm() {
    setNewName('');
    setSelectedCategories([]);
    setSelectedTypes([]);
    setCustomCreateOpen(false);
    setCustomExerciseType(DEFAULT_CUSTOM_EXERCISE_TYPE);
    setCustomCategory('');
    setNewNotes('');
  }

  function closeAddExerciseComposer() {
    if (creatingExercise) return;
    setAddOpen(false);
    resetAddForm();
  }

  function clearAddExerciseSelection() {
    setNewName('');
    setCustomCreateOpen(false);
    setCustomExerciseType(DEFAULT_CUSTOM_EXERCISE_TYPE);
    setCustomCategory('');
  }

  function upsertExerciseOptionUsage(exercise: FitnessExercise) {
    const nameKey = exercise.name.trim().toLowerCase();
    const movementType = exerciseMovementType(exercise);
    const workoutDate = exercise.workout_date || selectedDate;
    setExerciseOptions((current) => {
      let updatedExisting = false;
      const nextOptions = current.map((option) => {
        if (option.name.trim().toLowerCase() !== nameKey) return option;
        updatedExisting = true;
        const lastWorkoutDate = option.last_workout_date && option.last_workout_date > workoutDate
          ? option.last_workout_date
          : workoutDate;
        return {
          ...option,
          name: exercise.name,
          category: exercise.category,
          movement_type: movementType,
          type: movementType,
          session_count: (option.session_count || 0) + 1,
          last_workout_date: lastWorkoutDate,
        };
      });
      if (updatedExisting) return nextOptions;
      return [
        ...nextOptions,
        {
          name: exercise.name,
          category: exercise.category,
          movement_type: movementType,
          type: movementType,
          source: 'custom',
          session_count: 1,
          last_workout_date: workoutDate,
        },
      ];
    });
  }

  async function deleteExercise(exercise: FitnessExercise) {
    const pendingSave = saveTimers.current.get(exercise.id);
    if (pendingSave) clearTimeout(pendingSave);
    saveTimers.current.delete(exercise.id);
    pendingExerciseSaves.current.delete(exercise.id);
    saveVersions.current.set(exercise.id, (saveVersions.current.get(exercise.id) || 0) + 1);
    setDeletingExerciseId(exercise.id);
    const response = await trackFitnessDataWrite(fitnessApi.deleteExercise(exercise.id));
    if (response.status !== 'ok') {
      setDeletingExerciseId(null);
      showToast(response.error || 'Unable to delete exercise.', 'error');
      return;
    }
    setExercises((current) => {
      const nextExercises = current.filter((item) => item.id !== exercise.id);
      setExpandedExerciseIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(exercise.id);
        return nextIds;
      });
      return nextExercises;
    });
    setDeleteTarget(null);
    setDeletingExerciseId(null);
    loadExerciseOptions();
    showToast(exercise.name, 'success', 'Exercise deleted');
  }

  async function reorder(nextExercises: FitnessExercise[]) {
    setExercises(nextExercises.map((exercise, index) => ({ ...exercise, order_index: index })));
    const response = await trackFitnessDataWrite(fitnessApi.reorderExercises(selectedDate, nextExercises.map((exercise) => exercise.id)));
    if (response.status !== 'ok') {
      showToast(response.error || 'Unable to reorder exercises.', 'error');
      loadDay(selectedDate);
    }
  }

  async function openCopyModal() {
    setCopyOpen(true);
    setCopySelection(new Set());
    setPreviousWorkout(null);
    const response = await fitnessApi.getPreviousWorkout(selectedDate);
    if (response.status !== 'ok') {
      showToast(response.error || 'Unable to load recent exercises.', 'error');
      setCopyOpen(false);
      return;
    }
    setPreviousWorkout(response);
  }

  async function copySelectedExercises() {
    const ids = Array.from(copySelection);
    if (!ids.length) {
      showToast('Select at least one exercise to copy.', 'error');
      return;
    }
    const response = await trackFitnessDataWrite(fitnessApi.copyExercisesToDate(selectedDate, ids));
    if (response.status !== 'ok') {
      showToast(response.error || 'Unable to copy exercises.', 'error');
      return;
    }
    setCopyOpen(false);
    showToast(`${response.count || ids.length} exercises copied`, 'success', 'Recent workout copied');
    loadExerciseOptions();
    loadDay(selectedDate);
  }

  function keyboardTopYFromEvent(event: { endCoordinates?: { screenY?: number } }, keyboardHeight: number) {
    const screenY = event.endCoordinates?.screenY;
    if (typeof screenY === 'number' && Number.isFinite(screenY) && screenY > 0) return screenY;
    if (!keyboardHeight) return null;
    const screenHeight = Dimensions.get('screen').height;
    return Number.isFinite(screenHeight) ? Math.max(0, screenHeight - keyboardHeight) : null;
  }

  function measureWorkoutListViewport(onMeasured?: () => void) {
    const viewportNode = workoutListViewportRef.current;
    if (!viewportNode) return;
    viewportNode.measureInWindow((_x, y, _width, height) => {
      if (Number.isFinite(y) && Number.isFinite(height) && height > 0) {
        workoutListViewport.current = { top: y, bottom: y + height };
      }
      onMeasured?.();
    });
  }

  function ensureFocusedWorkoutInputVisible(target = focusedWorkoutInput.current) {
    if (!target || !workoutListRef.current) return;

    measureWorkoutListViewport(() => {
      const viewport = workoutListViewport.current;
      if (!viewport || !workoutListRef.current) return;

      target.measureInWindow((_x, y, _width, height) => {
        if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0 || !workoutListRef.current) return;

        const scrollDelta = calculateKeyboardAwareScrollDelta({
          inputTop: y,
          inputBottom: y + height,
          viewportTop: viewport.top,
          viewportBottom: viewport.bottom,
          keyboardTop: keyboardTopYRef.current,
          topMargin: WORKOUT_INPUT_TOP_MARGIN,
          bottomMargin: WORKOUT_INPUT_KEYBOARD_MARGIN,
        });

        if (Math.abs(scrollDelta) < 1) return;

        const nextOffset = Math.max(0, workoutScrollOffset.current + scrollDelta);
        workoutListRef.current.scrollToOffset({ offset: nextOffset, animated: true });
      });
    });
  }

  function scheduleEnsureFocusedWorkoutInputVisible(target = focusedWorkoutInput.current, delays?: number[]) {
    const nextDelays = delays || (keyboardOpenRef.current ? [40, 140] : Platform.OS === 'ios' ? [120, 320] : [80, 220]);
    nextDelays.forEach((delay) => {
      setTimeout(() => ensureFocusedWorkoutInputVisible(target), delay);
    });
  }

  function focusWorkoutInput(input: TextInput | null) {
    if (!input) return;
    focusedWorkoutInput.current = input;
    scheduleEnsureFocusedWorkoutInputVisible(input);
  }

  function renderExercise({ item, drag, isActive }: RenderItemParams<FitnessExercise>) {
    return (
      <ExerciseCard
        exercise={item}
        saving={saving[item.id] || ''}
        lastSession={lastSessions[item.name]}
        dragging={isActive}
        expanded={expandedExerciseIds.has(item.id)}
        notesOpen={openNoteExerciseId === item.id}
        showLastSession={workoutSettings.showLastSession}
        showSetVolume={workoutSettings.showSetVolume}
        onDrag={drag}
        onToggle={() => {
          if (expandedExerciseIds.has(item.id)) {
            setOpenNoteExerciseId((currentId) => (currentId === item.id ? null : currentId));
          }
          setExpandedExerciseIds((currentIds) => toggleExpandedExerciseId(currentIds, item.id));
        }}
        onNotesOpenChange={(open) => {
          setOpenNoteExerciseId((currentId) => (open ? item.id : currentId === item.id ? null : currentId));
        }}
        onDelete={() => setDeleteTarget(item)}
        onChange={(updater) => updateExercise(item.id, updater)}
        onWorkoutInputFocus={focusWorkoutInput}
      />
    );
  }

  const swipeDisabled = loading || addOpen || copyOpen || settingsOpen || timerOpen || Boolean(deleteTarget) || keyboardOpen || draggingExercise;
  const workoutListContentStyle = useMemo(
    () => [
      styles.listContent,
      { paddingBottom: WORKOUT_LIST_BASE_BOTTOM_PADDING + (keyboardOpen ? keyboardHeight + spacing.xl : 0) },
    ],
    [keyboardHeight, keyboardOpen],
  );

  const contentHeader = (
    <View style={styles.contentHeader}>
      <View
        style={[
          styles.dateControlBar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: mode === 'dark' ? '#000' : colors.shadow,
          },
        ]}>
        <View style={styles.dateRow}>
          <ToolbarIconButton icon={ChevronLeft} onPress={() => navigateByDays(-1)} label="Previous day" />
          <DateField
            value={selectedDate}
            onChange={navigateToDate}
            placeholder={dayLabel}
            displayLabel={dayLabel}
            variant="inline"
            style={styles.workoutDateField}
          />
          <ToolbarIconButton icon={ChevronRight} onPress={() => navigateByDays(1)} label="Next day" />
          <PillButton onPress={() => navigateToDate(todayIso())} style={styles.todayButton}>Today</PillButton>
          <ToolbarIconButton icon={Copy} onPress={openCopyModal} label="Copy recent exercises" muted />
        </View>
      </View>

      {workoutSettings.showSummary ? (
        <View style={styles.summaryScroller}>
          <MetricCard label="Volume" value={formatNumber(summary.volume)} suffix="lbs" style={styles.summaryMetricCard} />
          <MetricCard label="Sets" value={summary.sets} style={styles.summaryMetricCard} />
          <MetricCard label="Exercises" value={summary.exercises} style={styles.summaryMetricCard} />
        </View>
      ) : null}

      <InlineError message={error} />
    </View>
  );

  const previousDayPage = adjacentWorkoutDays.previous ? (
    <WorkoutDayPreview
      day={adjacentWorkoutDays.previous}
      expandedIds={expandedExerciseIdsByDate.current.get(adjacentWorkoutDays.previous.date)}
      settings={workoutSettings}
    />
  ) : null;
  const nextDayPage = adjacentWorkoutDays.next ? (
    <WorkoutDayPreview
      day={adjacentWorkoutDays.next}
      expandedIds={expandedExerciseIdsByDate.current.get(adjacentWorkoutDays.next.date)}
      settings={workoutSettings}
    />
  ) : null;

  return (
    <PageTransition tabOrder={0}>
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
        <Header
          title="Workout"
          right={
            <>
              <HeaderTimerButton
                status={timerState.status}
                remainingSeconds={timerState.remainingSeconds}
                onPress={() => setTimerOpen(true)}
              />
              <IconButton icon={User} onPress={() => router.push('/profile')} label="Profile" />
              <IconButton icon={Settings} active={settingsOpen} onPress={() => setSettingsOpen(true)} label="Workout settings" />
            </>
          }
        />
        <WorkoutDaySwipeSurface
          canSwipeNext={Boolean(adjacentWorkoutDays.next)}
          canSwipePrevious={Boolean(adjacentWorkoutDays.previous)}
          disabled={swipeDisabled}
          nextPage={nextDayPage}
          onSwipeDay={navigateByDays}
          pageKey={selectedDate}
          previousPage={previousDayPage}>
          <View style={styles.workoutListContainer}>
          {loading ? (
            <View style={styles.loadingWrap}>
              {contentHeader}
              <LoadingState label="Loading workout..." />
            </View>
          ) : (
            <MotionContent
              style={styles.workoutListContainer}>
              <View ref={workoutListViewportRef} style={styles.workoutListContainer} onLayout={() => measureWorkoutListViewport()}>
              <DraggableFlatList
                ref={workoutListRef}
                data={exercises}
                keyExtractor={(item) => item.id}
                renderItem={renderExercise}
                containerStyle={styles.workoutListFill}
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                keyboardShouldPersistTaps="handled"
                onContainerLayout={() => measureWorkoutListViewport()}
                onScrollOffsetChange={(offset) => {
                  workoutScrollOffset.current = offset;
                }}
                onDragBegin={() => setDraggingExercise(true)}
                onDragEnd={({ data }) => {
                  setDraggingExercise(false);
                  reorder(data);
                }}
                activationDistance={12}
                contentContainerStyle={workoutListContentStyle}
                ListHeaderComponent={contentHeader}
                ListEmptyComponent={
                  <EmptyState
                    icon={CalendarDays}
                    title="No exercises logged yet"
                    body="Tap Add Exercise to start this workout."
                  />
                }
                ListFooterComponent={<View style={styles.workoutListFooterSpace} />}
              />
              </View>
            </MotionContent>
          )}
          </View>
        </WorkoutDaySwipeSurface>

        {!loading && !keyboardOpen && !openNoteExerciseId ? (
          <View pointerEvents="box-none" style={styles.stickyAddAction}>
            <AddExerciseButton onPress={() => setAddOpen(true)} />
          </View>
        ) : null}

        <Toast message={toast.message} title={toast.title} tone={toast.tone} />

          <WorkoutTimerDialog
            visible={timerOpen}
            timerState={timerState}
            draftMinutes={timerDraftMinutes}
            draftSeconds={timerDraftSeconds}
            onClose={() => setTimerOpen(false)}
            onStart={() => startWorkoutTimer(timerState.status === 'paused' ? timerState.remainingSeconds : undefined)}
            onPause={pauseWorkoutTimer}
            onReset={resetWorkoutTimer}
            onSelectPreset={updateTimerDuration}
            onChangeDraft={updateTimerDraft}
            onChangeAlertMode={setTimerAlertMode}
          />

          <WorkoutSettingsDialog
            visible={settingsOpen}
            settings={workoutSettings}
            summary={summary}
            dayLabel={dayLabel}
            syncing={syncingWorkout}
            onClose={() => setSettingsOpen(false)}
            onToggleSetting={updateWorkoutSetting}
            onSync={syncWorkoutNow}
          />

          <Modal visible={addOpen} transparent animationType="fade" onRequestClose={closeAddExerciseComposer}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.addComposerBackdrop}>
              <Pressable style={StyleSheet.absoluteFill} disabled={creatingExercise} onPress={closeAddExerciseComposer} />
              <View style={[styles.addComposerPanel, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                <View style={[styles.addComposerHeader, { borderBottomColor: colors.border }]}>
                  <View style={styles.addComposerTitleBlock}>
                    <AppText variant="subheading">Add Exercise</AppText>
                    <AppText variant="caption" muted numberOfLines={1}>
                      {matchedOption ? 'Library match' : customDetailsVisible ? 'Custom movement' : nameQuery ? 'Search results' : 'Workout library'}
                    </AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close add exercise"
                    disabled={creatingExercise}
                    onPress={closeAddExerciseComposer}
                    style={({ pressed }) => [
                      styles.addComposerClose,
                      { backgroundColor: colors.surfaceAlt, opacity: pressed && !creatingExercise ? 0.72 : creatingExercise ? 0.5 : 1 },
                    ]}>
                    <X size={18} color={colors.muted} strokeWidth={2.5} />
                  </Pressable>
                </View>

                <View style={[styles.addComposerFilters, { borderBottomColor: colors.border }]}>
                  <TextField
                    label="Search or Create"
                    value={newName}
                    onChangeText={updateExerciseName}
                    placeholder="Search exercises"
                    autoCapitalize="words"
                  />
                  <CategoryPicker
                    compact
                    title="Categories"
                    categories={categories}
                    selectedCategories={selectedCategories}
                    onToggleCategory={toggleExerciseCategory}
                    style={styles.addComposerFilterPicker}
                  />
                  <CategoryPicker
                    compact
                    title="Movement Types"
                    categories={types}
                    selectedCategories={selectedTypes}
                    onToggleCategory={toggleExerciseType}
                    style={styles.addComposerFilterPicker}
                  />
                </View>

                <ScrollView
                  style={styles.addComposerScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.addComposerBody}>
                  {customDetailsVisible ? (
                    <CustomExerciseDetails
                      categories={categories}
                      types={types}
                      movementType={customExerciseType}
                      category={customCategory}
                      onChangeMovementType={selectCustomExerciseType}
                      onChangeCategory={selectCustomCategory}
                    />
                  ) : null}

                  {filteredOptions.length ? (
                    <View style={styles.addSection}>
                      <View style={styles.addSectionHeader}>
                        <Sparkles size={15} color={colors.primary} />
                        <AppText variant="caption" muted>
                          {activeSuggestionFilterLabel ? `${activeSuggestionFilterLabel} ${nameQuery ? 'matches' : 'suggestions'}` : nameQuery ? 'Matches' : 'Suggestions'}
                        </AppText>
                      </View>
                      {filteredOptions.map((option) => {
                        const selected = nameQuery.toLowerCase() === option.name.toLowerCase();
                        return (
                          <OptionRow
                            key={option.name}
                            label={option.name}
                            meta={`${option.category || 'General'} | ${option.movement_type || option.type || 'Strength'}`}
                            selected={selected}
                            onPress={() => {
                              if (selected) {
                                clearAddExerciseSelection();
                                return;
                              }
                              setNewName(option.name);
                              setCustomCreateOpen(false);
                              setCustomExerciseType(DEFAULT_CUSTOM_EXERCISE_TYPE);
                              setCustomCategory('');
                              setSelectedCategories((current) => {
                                const optionCategoryKey = option.category.trim().toLowerCase();
                                if (current.some((category) => category.trim().toLowerCase() === optionCategoryKey)) return current;
                                return [...current, option.category];
                              });
                              const optionType = option.movement_type || option.type || defaultMovementTypeForCategory(option.category);
                              setSelectedTypes((current) => {
                                const optionTypeKey = optionType.trim().toLowerCase();
                                if (current.some((type) => type.trim().toLowerCase() === optionTypeKey)) return current;
                                return [...current, optionType];
                              });
                            }}
                          />
                        );
                      })}
                    </View>
                  ) : null}
                  {isCustomExercise && !customDetailsVisible ? (
                    <CreateCustomExercisePrompt name={nameQuery} onPress={startCustomExerciseCreation} />
                  ) : null}
                  <TextField label="Note" value={newNotes} onChangeText={setNewNotes} placeholder="Optional note..." multiline />
                </ScrollView>

                <View style={[styles.addComposerFooter, { borderTopColor: colors.border }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={addActionLabel}
                    disabled={!canSubmitAddAction || creatingExercise}
                    onPress={handleAddExerciseAction}
                    style={({ pressed }) => [
                      styles.addComposerPrimaryAction,
                      {
                        backgroundColor: colors.primary,
                        opacity: !canSubmitAddAction || creatingExercise ? 0.45 : pressed ? 0.78 : 1,
                      },
                    ]}>
                    {creatingExercise ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <AppText variant="caption" color="#ffffff" style={styles.addComposerPrimaryText}>{addActionLabel}</AppText>
                    )}
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <DeleteExerciseDialog
            exercise={deleteTarget}
            deleting={Boolean(deletingExerciseId)}
            onClose={() => {
              if (!deletingExerciseId) setDeleteTarget(null);
            }}
            onDelete={() => {
              if (deleteTarget) deleteExercise(deleteTarget);
            }}
          />

          <ModalSheet visible={copyOpen} onClose={() => setCopyOpen(false)} title="Copy Recent Exercises" actionLabel="Copy" onAction={copySelectedExercises}>
            {!previousWorkout ? <LoadingState label="Loading recent exercises..." /> : null}
            {previousWorkout && !previousWorkout.exercises.length ? (
              <EmptyState title="No recent exercises" body="There are no earlier exercise details to copy." />
            ) : null}
            {previousWorkout?.exercises.map((exercise) => {
              const selected = copySelection.has(exercise.id);
              const movementType = exerciseMovementType(exercise);
              const setsMeta = (exercise.sets || [])
                .map((set) => formatSetSummary(set, movementType))
                .filter(Boolean)
                .slice(0, 4)
                .join(', ');
              return (
                <OptionRow
                  key={exercise.id}
                  label={exercise.name}
                  meta={[exercise.source_date_label || exercise.workout_date, setsMeta].filter(Boolean).join(' | ')}
                  selected={selected}
                  onPress={() => {
                    setCopySelection((current) => {
                      const next = new Set(current);
                      if (next.has(exercise.id)) next.delete(exercise.id);
                      else next.add(exercise.id);
                      return next;
                    });
                  }}
                />
              );
            })}
          </ModalSheet>
      </SafeAreaView>
      <LoginLaunchAnimation visible={loginEntrancePending} onDone={completeLoginEntrance} />
    </PageTransition>
  );
}

function WorkoutDayPreview({
  day,
  expandedIds,
  settings,
}: {
  day: WorkoutDaySnapshot;
  expandedIds?: ReadonlySet<string>;
  settings: WorkoutSettings;
}) {
  const { colors, mode } = useAppTheme();
  const summary = useMemo(() => summarizeWorkout(day.exercises), [day.exercises]);

  return (
    <View style={[styles.workoutListContainer, { backgroundColor: colors.background }]}>
      <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        <View style={styles.contentHeader}>
          <View
            style={[
              styles.dateControlBar,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: mode === 'dark' ? '#000' : colors.shadow,
              },
            ]}>
            <View style={styles.dateRow}>
              <ToolbarIconButton icon={ChevronLeft} onPress={() => undefined} label="Previous day" />
              <DateField
                value={day.date}
                onChange={() => undefined}
                placeholder={day.label}
                displayLabel={day.label}
                variant="inline"
                style={styles.workoutDateField}
              />
              <ToolbarIconButton icon={ChevronRight} onPress={() => undefined} label="Next day" />
              <PillButton onPress={() => undefined} style={styles.todayButton}>Today</PillButton>
              <ToolbarIconButton icon={Copy} onPress={() => undefined} label="Copy recent exercises" muted />
            </View>
          </View>

          {settings.showSummary ? (
            <View style={styles.summaryScroller}>
              <MetricCard label="Volume" value={formatNumber(summary.volume)} suffix="lbs" style={styles.summaryMetricCard} />
              <MetricCard label="Sets" value={summary.sets} style={styles.summaryMetricCard} />
              <MetricCard label="Exercises" value={summary.exercises} style={styles.summaryMetricCard} />
            </View>
          ) : null}
        </View>

        {day.exercises.length ? (
          day.exercises.map((exercise) => (
            <ExerciseCard
              key={`${day.date}:${exercise.id}`}
              exercise={exercise}
              saving=""
              dragging={false}
              expanded={expandedIds?.has(exercise.id) ?? true}
              notesOpen={false}
              showLastSession={settings.showLastSession}
              showSetVolume={settings.showSetVolume}
              onDrag={() => undefined}
              onToggle={() => undefined}
              onNotesOpenChange={() => undefined}
              onDelete={() => undefined}
              onChange={() => undefined}
              onWorkoutInputFocus={() => undefined}
            />
          ))
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="No exercises logged yet"
            body="Tap Add Exercise to start this workout."
          />
        )}
        <View style={styles.workoutListFooterSpace} />
      </ScrollView>
    </View>
  );
}

function HeaderTimerButton({
  status,
  remainingSeconds,
  onPress,
}: {
  status: WorkoutTimerStatus;
  remainingSeconds: number;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const active = status === 'running' || status === 'paused' || status === 'completed';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rest timer. ${active ? status === 'completed' ? 'Complete' : `${timerStatusLabel(status)}, ${formatTimerClock(remainingSeconds)}` : 'Ready'}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerTimerButton,
        active && { backgroundColor: `${colors.primary}14` },
        pressed && { backgroundColor: colors.surfacePressed },
      ]}>
      <Timer size={20} color={active ? colors.primary : colors.muted} strokeWidth={2.35} />
      {active ? (
        <View style={[styles.headerTimerBadge, { backgroundColor: status === 'completed' ? colors.success : colors.primary }]}>
          <AppText variant="caption" color="#ffffff" style={styles.headerTimerBadgeText}>
            {status === 'completed' ? 'Done' : formatTimerClock(remainingSeconds)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

function WorkoutTimerDialog({
  visible,
  timerState,
  draftMinutes,
  draftSeconds,
  onClose,
  onStart,
  onPause,
  onReset,
  onSelectPreset,
  onChangeDraft,
  onChangeAlertMode,
}: {
  visible: boolean;
  timerState: WorkoutTimerState;
  draftMinutes: string;
  draftSeconds: string;
  onClose: () => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSelectPreset: (seconds: number) => void;
  onChangeDraft: (part: 'minutes' | 'seconds', value: string) => void;
  onChangeAlertMode: (alertMode: WorkoutTimerAlertMode) => void;
}) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [openAnimation] = useState(() => new Animated.Value(0));
  const running = timerState.status === 'running';
  const paused = timerState.status === 'paused';
  const completed = timerState.status === 'completed';
  const progress = timerState.durationSeconds > 0
    ? 1 - Math.min(1, Math.max(0, timerState.remainingSeconds / timerState.durationSeconds))
    : 0;
  const primaryLabel = running ? 'Pause' : paused ? 'Resume' : completed ? 'Restart' : 'Start';
  const PrimaryIcon = running ? Pause : Play;

  useEffect(() => {
    if (!visible) {
      openAnimation.setValue(0);
      return;
    }
    openAnimation.setValue(0);
    Animated.timing(openAnimation, {
      toValue: 1,
      duration: reduceMotion ? MOTION_TIMING.reducedContentMs : MOTION_TIMING.sheetMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [openAnimation, reduceMotion, visible]);

  const panelAnimatedStyle = {
    opacity: openAnimation,
    transform: [
      {
        translateY: openAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: reduceMotion ? [0, 0] : [12, 0],
        }),
      },
      {
        scale: openAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: reduceMotion ? [1, 1] : [0.97, 1],
        }),
      },
    ],
  };

  function handlePrimaryAction() {
    if (running) onPause();
    else onStart();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.timerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.timerPanel, panelAnimatedStyle, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
          <View style={[styles.timerHeader, { borderBottomColor: colors.border }]}>
            <View style={[styles.timerHeaderIcon, { backgroundColor: `${colors.primary}16` }]}>
              <Timer size={19} color={colors.primary} strokeWidth={2.5} />
            </View>
            <View style={styles.timerTitleBlock}>
              <AppText variant="subheading">Rest Timer</AppText>
              <AppText variant="caption" muted>{timerStatusLabel(timerState.status)}</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close rest timer"
              onPress={onClose}
              style={({ pressed }) => [
                styles.timerCloseButton,
                { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.72 : 1 },
              ]}>
              <X size={18} color={colors.muted} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.timerBody}>
            <View style={[styles.timerHero, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <TimerProgressDial progress={completed ? 1 : progress} status={timerState.status} />
              <View style={styles.timerReadout}>
                <AppText style={styles.timerClock}>{formatTimerClock(timerState.remainingSeconds)}</AppText>
                <AppText variant="caption" muted>
                  {completed ? 'Rest complete' : running ? 'Keep breathing' : paused ? 'Paused' : 'Ready when you are'}
                </AppText>
              </View>
            </View>

            {timerState.notificationPermissionDenied ? (
              <View style={[styles.timerPermissionNote, { backgroundColor: `${colors.warning}16`, borderColor: `${colors.warning}55` }]}>
                <BellRing size={16} color={colors.warning} strokeWidth={2.5} />
                <AppText variant="caption" style={styles.timerPermissionText}>
                  Background alerts are off until notifications are allowed in system settings.
                </AppText>
              </View>
            ) : null}

            <View style={styles.timerSection}>
              <AppText variant="label" muted>Duration</AppText>
              <View style={styles.timerPresetRow}>
                {TIMER_PRESETS.map((seconds) => {
                  const selected = timerState.durationSeconds === seconds && !running;
                  return (
                    <Pressable
                      key={seconds}
                      accessibilityRole="button"
                      accessibilityLabel={`Set timer to ${formatTimerClock(seconds)}`}
                      disabled={running}
                      onPress={() => onSelectPreset(seconds)}
                      style={({ pressed }) => [
                        styles.timerPresetChip,
                        {
                          backgroundColor: selected ? colors.primary : colors.surfaceAlt,
                          borderColor: selected ? colors.primary : colors.border,
                          opacity: running ? 0.48 : pressed ? 0.74 : 1,
                        },
                      ]}>
                      <AppText variant="caption" color={selected ? '#ffffff' : colors.text} style={styles.timerPresetText}>
                        {formatTimerClock(seconds)}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.timerCustomRow}>
                <TimerPartField
                  label="Min"
                  value={draftMinutes}
                  editable={!running}
                  onChangeText={(value) => onChangeDraft('minutes', value)}
                />
                <TimerPartField
                  label="Sec"
                  value={draftSeconds}
                  editable={!running}
                  onChangeText={(value) => onChangeDraft('seconds', value)}
                />
              </View>
            </View>

            <View style={styles.timerSection}>
              <AppText variant="label" muted>Alert</AppText>
              <View style={[styles.timerAlertModeGroup, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <TimerAlertModeButton
                  icon={Vibrate}
                  label="Vibrate"
                  selected={timerState.alertMode === 'vibrate'}
                  onPress={() => onChangeAlertMode('vibrate')}
                />
                <TimerAlertModeButton
                  icon={Volume2}
                  label="Chime"
                  selected={timerState.alertMode === 'sound'}
                  onPress={() => onChangeAlertMode('sound')}
                />
                <TimerAlertModeButton
                  icon={BellRing}
                  label="Both"
                  selected={timerState.alertMode === 'both'}
                  onPress={() => onChangeAlertMode('both')}
                />
              </View>
            </View>
          </ScrollView>

          <View style={[styles.timerFooter, { borderTopColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset rest timer"
              onPress={onReset}
              style={({ pressed }) => [
                styles.timerSecondaryAction,
                { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.72 : 1 },
              ]}>
              <RotateCcw size={17} color={colors.primary} strokeWidth={2.6} />
              <AppText variant="caption" color={colors.primary} style={styles.timerActionText}>Reset</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              onPress={handlePrimaryAction}
              style={({ pressed }) => [
                styles.timerPrimaryAction,
                { backgroundColor: completed ? colors.success : colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}>
              <PrimaryIcon size={18} color="#ffffff" fill={running ? undefined : '#ffffff'} strokeWidth={2.6} />
              <AppText variant="caption" color="#ffffff" style={styles.timerPrimaryActionText}>{primaryLabel}</AppText>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function TimerProgressDial({
  progress,
  status,
}: {
  progress: number;
  status: WorkoutTimerStatus;
}) {
  const { colors } = useAppTheme();
  const radiusValue = 50;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radiusValue;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const strokeDashoffset = circumference * (1 - clampedProgress);
  const strokeColor = status === 'completed' ? colors.success : colors.primary;

  return (
    <View style={styles.timerDial}>
      <Svg width={126} height={126} viewBox="0 0 126 126">
        <Circle
          cx="63"
          cy="63"
          r={radiusValue}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx="63"
          cy="63"
          r={radiusValue}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin="63, 63"
        />
      </Svg>
      <View style={[styles.timerDialIcon, { backgroundColor: `${strokeColor}16` }]}>
        <Timer size={24} color={strokeColor} strokeWidth={2.6} />
      </View>
    </View>
  );
}

function TimerPartField({
  label,
  value,
  editable,
  onChangeText,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChangeText: (value: string) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.timerPartField}>
      <AppText variant="caption" muted style={styles.timerPartLabel}>{label}</AppText>
      <TextInput
        value={value}
        editable={editable}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="00"
        placeholderTextColor={colors.muted}
        style={[
          styles.timerPartInput,
          {
            backgroundColor: colors.surfaceAlt,
            color: colors.text,
            opacity: editable ? 1 : 0.5,
          },
        ]}
      />
    </View>
  );
}

function TimerAlertModeButton({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Timer alert ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.timerAlertModeButton,
        {
          backgroundColor: selected ? colors.primary : 'transparent',
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <Icon size={16} color={selected ? '#ffffff' : colors.primary} strokeWidth={2.5} />
      <AppText variant="caption" color={selected ? '#ffffff' : colors.text} style={styles.timerAlertModeText}>
        {label}
      </AppText>
    </Pressable>
  );
}

function WorkoutSettingsDialog({
  visible,
  settings,
  summary,
  dayLabel,
  syncing,
  onClose,
  onToggleSetting,
  onSync,
}: {
  visible: boolean;
  settings: WorkoutSettings;
  summary: { volume: number; sets: number; exercises: number };
  dayLabel: string;
  syncing: boolean;
  onClose: () => void;
  onToggleSetting: (key: keyof WorkoutSettings, value: boolean) => void;
  onSync: () => void;
}) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [openAnimation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      openAnimation.setValue(0);
      return;
    }
    openAnimation.setValue(0);
    Animated.timing(openAnimation, {
      toValue: 1,
      duration: reduceMotion ? MOTION_TIMING.reducedContentMs : MOTION_TIMING.sheetMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [openAnimation, reduceMotion, visible]);

  const panelAnimatedStyle = {
    opacity: openAnimation,
    transform: [
      {
        translateY: openAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: reduceMotion ? [0, 0] : [12, 0],
        }),
      },
      {
        scale: openAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: reduceMotion ? [1, 1] : [0.97, 1],
        }),
      },
    ],
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.settingsBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.settingsPanel,
            panelAnimatedStyle,
            {
              backgroundColor: colors.surface,
              shadowColor: colors.shadow,
            },
          ]}>
          <View style={[styles.settingsHeader, { borderBottomColor: colors.border }]}>
            <View style={[styles.settingsHeaderIcon, { backgroundColor: `${colors.primary}16` }]}>
              <Settings size={19} color={colors.primary} strokeWidth={2.5} />
            </View>
            <View style={styles.settingsTitleBlock}>
              <AppText variant="subheading">Workout Settings</AppText>
              <AppText variant="caption" muted numberOfLines={1}>{dayLabel}</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close workout settings"
              onPress={onClose}
              style={({ pressed }) => [
                styles.settingsCloseButton,
                { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.72 : 1 },
              ]}>
              <X size={18} color={colors.muted} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsBody}>
            <View style={[styles.settingsSummaryStrip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <SettingsSummaryItem label="Volume" value={`${formatNumber(summary.volume)} lbs`} />
              <SettingsSummaryItem label="Sets" value={String(summary.sets)} />
              <SettingsSummaryItem label="Exercises" value={String(summary.exercises)} />
            </View>

            <View style={styles.settingsSection}>
              <AppText variant="label" muted>Sync</AppText>
              <View style={[styles.settingsRows, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <SettingsActionRow
                  icon={RefreshCw}
                  label={syncing ? 'Syncing workout' : 'Sync workout'}
                  meta="Save pending changes and reload references"
                  onPress={onSync}
                  disabled={syncing}
                />
              </View>
            </View>

            <View style={styles.settingsSection}>
              <AppText variant="label" muted>Display</AppText>
              <View style={[styles.settingsRows, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <SettingsToggleRow
                  icon={Activity}
                  label="Summary cards"
                  meta="Volume, sets, exercises"
                  value={settings.showSummary}
                  onChange={(value) => onToggleSetting('showSummary', value)}
                />
                <SettingsToggleRow
                  icon={Sparkles}
                  label="Last session"
                  meta="Recent set references"
                  value={settings.showLastSession}
                  onChange={(value) => onToggleSetting('showLastSession', value)}
                />
                <SettingsToggleRow
                  icon={Dumbbell}
                  label="Set volume"
                  meta="Strength row totals"
                  value={settings.showSetVolume}
                  onChange={(value) => onToggleSetting('showSetVolume', value)}
                />
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SettingsSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingsSummaryItem}>
      <AppText variant="label" muted>{label}</AppText>
      <AppText style={styles.settingsSummaryValue} numberOfLines={1}>{value}</AppText>
    </View>
  );
}

function SettingsActionRow({
  icon: Icon,
  label,
  meta,
  onPress,
  danger = false,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  meta: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const rowColor = danger ? colors.accent : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${meta}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        { opacity: disabled ? 0.45 : pressed ? 0.72 : 1 },
      ]}>
      <View style={[styles.settingsRowIcon, { backgroundColor: `${rowColor}16` }]}>
        <Icon size={17} color={rowColor} strokeWidth={2.5} />
      </View>
      <View style={styles.settingsRowText}>
        <AppText color={danger ? colors.accent : undefined} style={styles.settingsRowTitle}>{label}</AppText>
        <AppText variant="caption" muted>{meta}</AppText>
      </View>
      <ChevronRight size={18} color={colors.muted} strokeWidth={2.4} />
    </Pressable>
  );
}

function SettingsToggleRow({
  icon: Icon,
  label,
  meta,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  meta: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.settingsRow,
        { opacity: pressed ? 0.72 : 1 },
      ]}>
      <View style={[styles.settingsRowIcon, { backgroundColor: value ? `${colors.primary}18` : colors.surface }]}>
        <Icon size={17} color={value ? colors.primary : colors.muted} strokeWidth={2.5} />
      </View>
      <View style={styles.settingsRowText}>
        <AppText style={styles.settingsRowTitle}>{label}</AppText>
        <AppText variant="caption" muted>{meta}</AppText>
      </View>
      <View style={[styles.settingsSwitchTrack, { backgroundColor: value ? colors.primary : colors.faint }]}>
        <View style={[styles.settingsSwitchThumb, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

function ToolbarIconButton({
  icon: Icon,
  onPress,
  label,
  muted,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  muted?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.toolbarIconButton, pressed && { backgroundColor: colors.surfacePressed }]}>
      <Icon size={22} color={muted ? colors.muted : colors.primary} strokeWidth={2.4} />
    </Pressable>
  );
}

function AddExerciseButton({ onPress }: { onPress: () => void }) {
  const { colors, mode } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add Exercise"
      accessibilityHint="Opens the exercise picker"
      onPress={onPress}
      style={({ pressed }) => [
        styles.addExerciseButton,
        {
          backgroundColor: colors.primary,
          shadowColor: mode === 'dark' ? '#000' : colors.shadow,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <Plus size={25} color="#fff" strokeWidth={2.8} />
    </Pressable>
  );
}

function DeleteExerciseDialog({
  exercise,
  deleting,
  onClose,
  onDelete,
}: {
  exercise: FitnessExercise | null;
  deleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  const movementType = exercise ? exerciseMovementType(exercise) : '';

  return (
    <Modal visible={Boolean(exercise)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.deleteDialogBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} disabled={deleting} onPress={onClose} />
        <View style={[styles.deleteDialogCard, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
          <View style={[styles.deleteDialogIcon, { backgroundColor: `${colors.accent}14` }]}>
            <Trash2 size={20} color={colors.accent} strokeWidth={2.4} />
          </View>
          <AppText variant="subheading" style={styles.deleteDialogTitle}>Delete exercise?</AppText>
          {exercise ? (
            <View style={styles.deleteDialogExercise}>
              <AppText style={styles.deleteDialogName} numberOfLines={2}>{exercise.name}</AppText>
              <AppText variant="caption" muted numberOfLines={1}>
                {[exercise.category || 'General', movementType].join(' | ')}
              </AppText>
            </View>
          ) : null}
          <View style={styles.deleteDialogActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel delete exercise"
              disabled={deleting}
              onPress={onClose}
              style={({ pressed }) => [
                styles.deleteDialogButton,
                { backgroundColor: colors.surfaceAlt },
                pressed && !deleting && { opacity: 0.72 },
                deleting && { opacity: 0.5 },
              ]}>
              <AppText variant="caption" style={styles.deleteDialogCancelText}>Cancel</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete exercise"
              disabled={deleting}
              onPress={onDelete}
              style={({ pressed }) => [
                styles.deleteDialogButton,
                { backgroundColor: colors.accent },
                pressed && !deleting && { opacity: 0.78 },
                deleting && { opacity: 0.68 },
              ]}>
              <AppText variant="caption" color="#ffffff" style={styles.deleteDialogDeleteText}>
                {deleting ? 'Deleting...' : 'Delete'}
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CreateCustomExercisePrompt({ name, onPress }: { name: string; onPress: () => void }) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Create custom exercise ${name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.createCustomPrompt,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          opacity: pressed ? 0.74 : 1,
        },
      ]}>
      <View style={[styles.createCustomPromptIcon, { backgroundColor: `${colors.primary}16` }]}>
        <Plus size={16} color={colors.primary} strokeWidth={2.7} />
      </View>
      <View style={styles.createCustomPromptText}>
        <AppText style={styles.createCustomPromptTitle} numberOfLines={1}>
          {`Create "${name}"`}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>Custom exercise</AppText>
      </View>
    </Pressable>
  );
}

function CustomExerciseDetails({
  categories,
  types,
  movementType,
  category,
  onChangeMovementType,
  onChangeCategory,
}: {
  categories: string[];
  types: string[];
  movementType: string;
  category: string;
  onChangeMovementType: (type: string) => void;
  onChangeCategory: (category: string) => void;
}) {
  const { colors } = useAppTheme();
  const isCardio = isCardioMovement(movementType);
  const muscleCategories = useMemo(() => {
    const options = categories.filter((option) => option.trim().toLowerCase() !== CARDIO_CATEGORY.toLowerCase());
    return options.length ? options : DEFAULT_EXERCISE_CATEGORIES.filter((option) => option !== CARDIO_CATEGORY);
  }, [categories]);
  const selectedCategoryLabel = isCardio ? CARDIO_CATEGORY : category || 'Primary muscle';

  return (
    <View style={[styles.customDetailsCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <View style={styles.customDetailsHeader}>
        <View style={styles.customDetailsTitleBlock}>
          <AppText style={styles.customDetailsTitle}>Custom exercise details</AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {[movementType, selectedCategoryLabel].filter(Boolean).join(' | ')}
          </AppText>
        </View>
      </View>

      <CategoryPicker
        title="Exercise Type"
        categories={types.length ? types : DEFAULT_TYPES}
        selectedCategories={[movementType]}
        onToggleCategory={onChangeMovementType}
        style={[styles.customDetailsPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
      />

      {isCardio ? (
        <View style={[styles.customCardioCategory, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="caption" muted>Category</AppText>
          <AppText style={styles.customCardioCategoryText}>{CARDIO_CATEGORY}</AppText>
        </View>
      ) : (
        <CategoryPicker
          title={isStretchingMovement(movementType) ? 'Focus Area' : 'Primary Muscle'}
          categories={muscleCategories}
          selectedCategories={category ? [category] : []}
          onToggleCategory={onChangeCategory}
          style={[styles.customDetailsPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
        />
      )}
    </View>
  );
}

function exerciseMovementType(exercise: Pick<FitnessExercise, 'movement_type' | 'type'>) {
  return exercise.movement_type || exercise.type || 'Strength';
}

function exerciseEntryLabel(movementType: string, plural = false) {
  if (isCardioMovement(movementType)) return plural ? 'Intervals' : 'Interval';
  if (isStretchingMovement(movementType)) return plural ? 'Holds' : 'Hold';
  return plural ? 'Sets' : 'Set';
}

function formatSetSummary(set: ExerciseSet, movementType: string) {
  if (isCardioMovement(movementType)) {
    const duration = computeExerciseDurationSeconds({ sets: [set] });
    const distance = computeExerciseDistanceMiles({ sets: [set] });
    const parts = [];
    if (duration > 0) parts.push(formatDuration(duration));
    if (distance > 0) parts.push(`${formatDecimal(distance, distance >= 10 ? 1 : 2)} mi`);
    if (set.rpe !== null && set.rpe !== undefined) parts.push(`RPE ${formatDecimal(set.rpe)}`);
    return parts.join(' ');
  }
  if (isStretchingMovement(movementType)) {
    const duration = computeExerciseDurationSeconds({ sets: [set] });
    const parts = [];
    if (duration > 0) parts.push(formatDuration(duration));
    if (set.side) parts.push(set.side);
    if (set.rpe !== null && set.rpe !== undefined) parts.push(`RPE ${formatDecimal(set.rpe)}`);
    return parts.join(' ');
  }
  if (set.weight !== null && set.weight !== undefined && set.reps !== null && set.reps !== undefined && set.reps > 0) {
    return `${formatDecimal(set.weight)}x${set.reps}`;
  }
  if (set.reps !== null && set.reps !== undefined && set.reps > 0) return `${set.reps} reps`;
  return '';
}

function nextStretchSide(side: string | undefined) {
  const currentIndex = STRETCH_SIDE_OPTIONS.findIndex((option) => option.toLowerCase() === String(side || '').toLowerCase());
  return STRETCH_SIDE_OPTIONS[(currentIndex + 1) % STRETCH_SIDE_OPTIONS.length];
}

function AnimatedSetRow({
  animateIn,
  children,
  highlightColor,
  onAnimationComplete,
  style,
}: {
  animateIn: boolean;
  children: ReactNode;
  highlightColor: string;
  onAnimationComplete: () => void;
  style: StyleProp<ViewStyle>;
}) {
  const [progress] = useState(() => new Animated.Value(animateIn ? 0 : 1));
  const completionRef = useRef(onAnimationComplete);

  useEffect(() => {
    completionRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    if (!animateIn) {
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      stiffness: 260,
      damping: 22,
      mass: 0.82,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) completionRef.current();
    });
  }, [animateIn, progress]);

  const animatedStyle = animateIn
    ? {
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.975, 1],
            }),
          },
        ],
      }
    : null;

  const highlightStyle = animateIn
    ? {
        backgroundColor: highlightColor,
        opacity: progress.interpolate({
          inputRange: [0, 0.58, 1],
          outputRange: [0.16, 0.09, 0],
        }),
      }
    : null;

  return (
    <Animated.View style={[style, styles.animatedSetRow, animatedStyle]}>
      {highlightStyle ? <Animated.View pointerEvents="none" style={[styles.setRowHighlight, highlightStyle]} /> : null}
      {children}
    </Animated.View>
  );
}

function ExerciseCard({
  exercise,
  saving,
  lastSession,
  dragging,
  expanded,
  notesOpen,
  showLastSession,
  showSetVolume,
  onDrag,
  onToggle,
  onNotesOpenChange,
  onDelete,
  onChange,
  onWorkoutInputFocus,
}: {
  exercise: FitnessExercise;
  saving: string;
  lastSession?: LastSessionsPayload['last_sessions'][string];
  dragging: boolean;
  expanded: boolean;
  notesOpen: boolean;
  showLastSession: boolean;
  showSetVolume: boolean;
  onDrag: () => void;
  onToggle: () => void;
  onNotesOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onChange: (updater: (exercise: FitnessExercise) => FitnessExercise) => void;
  onWorkoutInputFocus: (input: TextInput | null) => void;
}) {
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [enteringSetKeys, setEnteringSetKeys] = useState<Set<string>>(() => new Set());
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});
  const [noteOpenAnimation] = useState(() => new Animated.Value(0));
  const setInputRefs = useRef<Record<string, WorkoutSetInputRefMap>>({});
  const editableSets = useMemo(() => ensureEditableSets(exercise.id, exercise.sets), [exercise.id, exercise.sets]);
  const movementType = exerciseMovementType(exercise);
  const isStrength = isStrengthMovement(movementType);
  const isCardio = isCardioMovement(movementType);
  const isStretching = isStretchingMovement(movementType);
  const showStrengthVolume = isStrength && showSetVolume;
  const entryLabel = exerciseEntryLabel(movementType);
  const collapsedSummary = collapsedExerciseSummary(exercise);
  const strengthPrimaryLabel = fontScale >= 1.25 ? 'Wt.' : 'Weight';

  useEffect(() => {
    if (!notesOpen) {
      noteOpenAnimation.setValue(0);
      return;
    }
    noteOpenAnimation.setValue(0);
    Animated.timing(noteOpenAnimation, {
      toValue: 1,
      duration: reduceMotion ? MOTION_TIMING.reducedContentMs : MOTION_TIMING.contentMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [noteOpenAnimation, notesOpen, reduceMotion]);

  const notePanelAnimatedStyle = {
    opacity: noteOpenAnimation,
    transform: [
      {
        translateY: noteOpenAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: reduceMotion ? [0, 0] : [-6, 0],
        }),
      },
      {
        scale: noteOpenAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: reduceMotion ? [1, 1] : [0.98, 1],
        }),
      },
    ],
  };

  function updateSet(index: number, patch: Partial<ExerciseSet>) {
    onChange((current) => {
      const sets = ensureEditableSets(current.id, current.sets);
      sets[index] = { ...sets[index], ...patch };
      return { ...current, sets };
    });
  }

  function clearWeightDraft(setKey: string) {
    setWeightDrafts((current) => {
      if (!(setKey in current)) return current;
      const { [setKey]: _removed, ...rest } = current;
      return rest;
    });
  }

  function weightInputValue(setKey: string, set: ExerciseSet) {
    if (setKey in weightDrafts) return weightDrafts[setKey];
    return set.weight === null ? '' : formatDecimal(set.weight);
  }

  function updateWeightInput(index: number, setKey: string, value: string) {
    const normalized = normalizeDecimalInputText(value);
    if (normalized === null) return;
    setWeightDrafts((current) => ({ ...current, [setKey]: normalized }));
    updateSet(index, { weight: toNumberOrNull(normalized) });
  }

  function registerSetInput(setKey: string, field: WorkoutSetInputField, input: TextInput | null) {
    const currentRefs = setInputRefs.current[setKey] || {};
    if (input) {
      setInputRefs.current[setKey] = { ...currentRefs, [field]: input };
      return;
    }

    const { [field]: _removed, ...remainingRefs } = currentRefs;
    if (Object.keys(remainingRefs).length) setInputRefs.current[setKey] = remainingRefs;
    else delete setInputRefs.current[setKey];
  }

  function focusSetInput(setKey: string, field: WorkoutSetInputField) {
    onWorkoutInputFocus(setInputRefs.current[setKey]?.[field] || null);
  }

  const completeSetEntryAnimation = useCallback((setKey: string) => {
    setEnteringSetKeys((current) => {
      if (!current.has(setKey)) return current;
      const next = new Set(current);
      next.delete(setKey);
      return next;
    });
  }, []);

  function addSet() {
    const nextSet = createEmptyEditableSet(exercise.id);
    if (nextSet._clientKey) {
      setEnteringSetKeys((current) => new Set(current).add(nextSet._clientKey as string));
    }
    animateSetListChange();
    onChange((current) => ({
      ...current,
      sets: [...ensureEditableSets(current.id, current.sets), nextSet],
    }));
  }

  function removeSet(index: number) {
    const removedSetKey = editableSets[index]?._clientKey;
    if (removedSetKey) clearWeightDraft(removedSetKey);
    animateSetListChange();
    onChange((current) => {
      const sets = ensureEditableSets(current.id, current.sets).filter((_, setIndex) => setIndex !== index);
      return { ...current, sets: sets.length ? sets : [createEmptyEditableSet(current.id)] };
    });
  }

  return (
    <MotionLayout>
      <Card style={[styles.exerciseCard, dragging && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      <View style={styles.exerciseHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reorder ${exercise.name}`}
          accessibilityHint="Press and hold, then drag"
          delayLongPress={120}
          onLongPress={onDrag}
          style={({ pressed }) => [styles.dragHandle, pressed && { backgroundColor: colors.surfacePressed }]}>
          <GripVertical size={21} color={colors.faint} />
        </Pressable>
        {expanded ? (
          <View style={styles.exerciseTitleBlock}>
            <AppText style={styles.exerciseName} numberOfLines={2}>{exercise.name}</AppText>
            <View style={styles.metaRow}>
              <AppText variant="caption" muted>{exercise.category || 'General'}</AppText>
              <AppText variant="caption" muted>|</AppText>
              <AppText variant="caption" muted>{movementType}</AppText>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${exercise.name}. ${collapsedSummary}`}
            accessibilityHint="Opens exercise details"
            onPress={onToggle}
            style={({ pressed }) => [styles.exerciseTitleBlock, pressed && { opacity: 0.72 }]}>
            <AppText style={styles.exerciseName} numberOfLines={2}>{exercise.name}</AppText>
            <View style={styles.metaRow}>
              <AppText variant="caption" muted>{exercise.category || 'General'}</AppText>
              <AppText variant="caption" muted>|</AppText>
              <AppText variant="caption" muted>{movementType}</AppText>
            </View>
            <AppText variant="caption" muted numberOfLines={2}>{collapsedSummary}</AppText>
          </Pressable>
        )}
        <View style={styles.exerciseActions}>
          {saving ? (
            <AppText
              accessibilityRole="text"
              variant="caption"
              color={saving === 'Error' ? colors.accent : colors.primary}
              style={styles.exerciseSaveStatus}>
              {saving}
            </AppText>
          ) : null}
          <IconButton
            icon={Ellipsis}
            label={`More actions for ${exercise.name}`}
            onPress={() => {
              Alert.alert(exercise.name, undefined, [
                { text: 'Delete exercise', style: 'destructive', onPress: onDelete },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
          />
          <IconButton
            icon={expanded ? ChevronUp : ChevronDown}
            label={expanded ? `${exercise.name} details open` : `Open ${exercise.name}`}
            active={expanded}
            onPress={onToggle}
          />
        </View>
      </View>

      {expanded ? (
        <MotionContent transitionKey={`${exercise.id}:expanded`}>
      <View style={styles.setHeader}>
        <AppText variant="label" style={styles.setIndexHeader}>{entryLabel}</AppText>
        <AppText variant="label" style={styles.setInputHeader}>{isStrength ? strengthPrimaryLabel : isCardio ? 'Min' : 'Sec'}</AppText>
        <AppText variant="label" style={styles.setInputHeader}>{isStrength ? 'Reps' : isCardio ? 'Miles' : 'Side'}</AppText>
        <AppText variant="label" style={styles.setInputHeader}>RPE</AppText>
        <View style={styles.setActionColumn} />
        {showStrengthVolume ? <AppText variant="label" style={styles.setVolumeHeader}>Vol.</AppText> : null}
      </View>

      {editableSets.map((set, index) => {
        const durationValue = computeExerciseDurationSeconds({ sets: [set] });
        const setKey = set._clientKey || `${exercise.id}:set:${index}`;
        const animateIn = Boolean(set._clientKey && enteringSetKeys.has(set._clientKey));
        return (
          <AnimatedSetRow
            key={setKey}
            animateIn={animateIn}
            highlightColor={colors.primary}
            onAnimationComplete={() => {
              if (set._clientKey) completeSetEntryAnimation(set._clientKey);
            }}
            style={[styles.setRow, { borderTopColor: colors.border }]}>
            <View style={styles.setIndexColumn}>
              <View style={[styles.setNumber, { backgroundColor: colors.surfaceAlt }]}>
                <AppText variant="caption" muted style={{ fontWeight: '800' }}>{index + 1}</AppText>
              </View>
            </View>
            <View style={styles.setInputColumn}>
              <TextInput
                ref={(input) => registerSetInput(setKey, 'primary', input)}
                value={
                  isStrength
                    ? weightInputValue(setKey, set)
                    : durationValue > 0 ? formatDecimal(isCardio ? durationValue / 60 : durationValue, isCardio ? 1 : 0) : ''
                }
                onChangeText={(value) => {
                  if (isStrength) updateWeightInput(index, setKey, value);
                  else {
                    const parsed = toNumberOrNull(value);
                    updateSet(index, {
                      duration_seconds: parsed === null ? null : isCardio ? parsed * 60 : parsed,
                      ...(isStretching && !set.side ? { side: 'Both' } : {}),
                    });
                  }
                }}
                onBlur={() => {
                  if (isStrength) clearWeightDraft(setKey);
                }}
                onFocus={() => focusSetInput(setKey, 'primary')}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={[styles.setInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
              />
            </View>
            <View style={styles.setInputColumn}>
              {isStretching ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change stretch side"
                  onPress={() => updateSet(index, { side: nextStretchSide(set.side || 'Both') })}
                  style={({ pressed }) => [
                    styles.sideToggle,
                    {
                      backgroundColor: colors.surfaceAlt,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <AppText variant="caption" style={styles.sideToggleText}>{set.side || 'Both'}</AppText>
                </Pressable>
              ) : (
                <TextInput
                  ref={(input) => registerSetInput(setKey, 'secondary', input)}
                  value={isStrength ? set.reps === null ? '' : String(set.reps) : set.distance_miles === null || set.distance_miles === undefined ? '' : formatDecimal(set.distance_miles, 2)}
                  onChangeText={(value) => {
                    if (isStrength) updateSet(index, { reps: toIntOrNull(value) });
                    else updateSet(index, { distance_miles: toNumberOrNull(value) });
                  }}
                  onFocus={() => focusSetInput(setKey, 'secondary')}
                  keyboardType={isStrength ? 'number-pad' : 'decimal-pad'}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  style={[styles.setInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                />
              )}
            </View>
            <View style={styles.setInputColumn}>
              <TextInput
                ref={(input) => registerSetInput(setKey, 'rpe', input)}
                value={set.rpe === null ? '' : formatDecimal(set.rpe)}
                onChangeText={(value) => updateSet(index, { rpe: toNumberOrNull(value) })}
                onFocus={() => focusSetInput(setKey, 'rpe')}
                keyboardType="decimal-pad"
                placeholder="-"
                placeholderTextColor={colors.muted}
                style={[styles.setInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${entryLabel.toLowerCase()} ${index + 1}`}
              onPress={() => removeSet(index)}
              style={({ pressed }) => [
                styles.removeSet,
                styles.setActionColumn,
                { backgroundColor: pressed ? colors.surfacePressed : 'transparent' },
              ]}>
              <X size={16} color={colors.faint} />
            </Pressable>
            {showStrengthVolume ? <AppText variant="caption" muted style={styles.setVolume}>{formatNumber(computeSetVolume(set))} lbs</AppText> : null}
          </AnimatedSetRow>
        );
      })}

      {showLastSession && lastSession?.date_label ? (
        <View style={[styles.lastSession, { borderTopColor: colors.border }]}>
          <AppText variant="caption" muted>
            Last time ({lastSession.date_label}) {lastSession.sets_summary?.join(', ')}
          </AppText>
        </View>
      ) : null}

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            notesOpen ? 'Close note editor' : exercise.notes ? 'Edit exercise note' : 'Add exercise note'
          }
          onPress={() => onNotesOpenChange(!notesOpen)}
          style={({ pressed }) => [
            styles.noteToggle,
            { opacity: pressed ? 0.65 : 1 },
          ]}>
          <StickyNote size={15} color={colors.primary} />
          <AppText variant="caption" color={colors.primary} style={styles.noteToggleText}>
            {notesOpen ? 'Done' : exercise.notes ? 'Note' : 'Add note'}
          </AppText>
        </Pressable>
        <PillButton
          tone="plain"
          accessibilityLabel={`Add ${entryLabel.toLowerCase()}`}
          onPress={addSet}>
          Add {entryLabel}
        </PillButton>
      </View>
      {!notesOpen && exercise.notes ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit exercise note"
          onPress={() => onNotesOpenChange(true)}
          style={({ pressed }) => [
            styles.notePreview,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <StickyNote size={15} color={colors.muted} />
          <AppText variant="caption" numberOfLines={2} style={styles.notePreviewText}>
            {exercise.notes}
          </AppText>
        </Pressable>
      ) : null}
      {notesOpen ? (
        <Animated.View style={[styles.noteEditor, notePanelAnimatedStyle]}>
          <TextField
            value={exercise.notes || ''}
            onChangeText={(notes) => onChange((current) => ({ ...current, notes }))}
            multiline
            placeholder="Setup cues, pain, tempo, or context..."
            inputStyle={styles.noteInput}
          />
        </Animated.View>
      ) : null}
        </MotionContent>
      ) : null}
      </Card>
    </MotionLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  workoutListContainer: { flex: 1 },
  workoutListFill: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: WORKOUT_LIST_BASE_BOTTOM_PADDING,
    gap: spacing.md,
  },
  workoutListFooterSpace: {
    height: spacing.xl,
  },
  stickyAddAction: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
  },
  loadingWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  contentHeader: { gap: spacing.md },
  dateControlBar: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    shadowOpacity: 0.7,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  toolbarIconButton: {
    width: 32,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutDateField: {
    flex: 1,
    minWidth: 0,
  },
  todayButton: {
    minHeight: 34,
    minWidth: 62,
    paddingHorizontal: spacing.md,
  },
  summaryScroller: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryMetricCard: {
    flexBasis: 0,
    minWidth: 96,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  headerTimerButton: {
    minWidth: 44,
    height: 44,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  headerTimerBadge: {
    minWidth: 35,
    height: 20,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTimerBadgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
  },
  timerBackdrop: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: 'rgba(12, 15, 20, 0.44)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPanel: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '88%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  timerHeader: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timerHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  timerCloseButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBody: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  timerHero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  timerDial: {
    width: 126,
    height: 126,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerDialIcon: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerReadout: {
    alignItems: 'center',
    gap: 2,
  },
  timerClock: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
  },
  timerPermissionNote: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timerPermissionText: {
    flex: 1,
    minWidth: 0,
    fontWeight: '700',
  },
  timerSection: {
    gap: spacing.sm,
  },
  timerPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timerPresetChip: {
    minHeight: 44,
    minWidth: 68,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPresetText: {
    fontWeight: '900',
  },
  timerCustomRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timerPartField: {
    flex: 1,
    minWidth: 0,
  },
  timerPartLabel: {
    marginBottom: 6,
    fontWeight: '800',
  },
  timerPartInput: {
    height: 48,
    borderRadius: radius.md,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '900',
  },
  timerAlertModeGroup: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: 3,
    flexDirection: 'row',
    gap: 3,
  },
  timerAlertModeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  timerAlertModeText: {
    fontWeight: '900',
  },
  timerFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timerSecondaryAction: {
    minHeight: 46,
    minWidth: 106,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  timerPrimaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  timerActionText: {
    fontWeight: '900',
  },
  timerPrimaryActionText: {
    fontWeight: '900',
  },
  settingsBackdrop: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: 'rgba(12, 15, 20, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsPanel: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '88%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  settingsHeader: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingsHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  settingsCloseButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBody: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  settingsSummaryStrip: {
    minHeight: 70,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsSummaryItem: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  settingsSummaryValue: {
    fontWeight: '900',
  },
  settingsSection: {
    gap: spacing.sm,
  },
  settingsActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  settingsActionTile: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 70,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsActionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsActionText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  settingsActionTitle: {
    fontWeight: '900',
  },
  settingsActionMetaPrimary: {
    opacity: 0.78,
  },
  settingsRows: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  settingsRow: {
    minHeight: 62,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsRowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  settingsRowTitle: {
    fontWeight: '800',
  },
  settingsSwitchTrack: {
    width: 46,
    height: 28,
    borderRadius: radius.pill,
    padding: 3,
    justifyContent: 'center',
  },
  settingsSwitchThumb: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: '#ffffff',
  },
  addComposerBackdrop: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    backgroundColor: 'rgba(12, 15, 20, 0.46)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addComposerPanel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  addComposerHeader: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  addComposerTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  addComposerClose: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addComposerFilters: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  addComposerFilterPicker: {
    borderRadius: radius.md,
  },
  addComposerScroll: {
    flexShrink: 1,
  },
  addComposerBody: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  addComposerFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addComposerSecondaryAction: {
    minHeight: 46,
    minWidth: 96,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  addComposerPrimaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  addComposerSecondaryText: {
    fontWeight: '800',
  },
  addComposerPrimaryText: {
    fontWeight: '900',
  },
  addHero: {
    minHeight: 78,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  addHeroIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addHeroText: {
    flex: 1,
    minWidth: 0,
  },
  addHeroClearButton: {
    minHeight: 34,
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  addHeroClearLabel: {
    fontWeight: '800',
  },
  createCustomPrompt: {
    minHeight: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  createCustomPromptIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCustomPromptText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  createCustomPromptTitle: {
    fontWeight: '800',
  },
  customDetailsCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  customDetailsHeader: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customDetailsTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  customDetailsTitle: {
    fontWeight: '800',
  },
  customDetailsPicker: {
    borderRadius: radius.md,
  },
  customCardioCategory: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 2,
  },
  customCardioCategoryText: {
    fontWeight: '800',
  },
  filterDropdown: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  filterDropdownButton: {
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterDropdownIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDropdownText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  filterDropdownTitle: {
    fontWeight: '800',
  },
  filterDropdownBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDropdownBadgeText: {
    fontWeight: '900',
  },
  filterDropdownChevron: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDropdownBody: {
    overflow: 'hidden',
  },
  filterDropdownBodyInner: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterDropdownPicker: {
    borderRadius: radius.md,
  },
  addSection: {
    gap: spacing.sm,
  },
  addSectionHeader: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteDialogBackdrop: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: 'rgba(12, 15, 20, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  deleteDialogIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDialogTitle: {
    textAlign: 'center',
  },
  deleteDialogExercise: {
    width: '100%',
    alignItems: 'center',
    gap: 3,
  },
  deleteDialogName: {
    maxWidth: '100%',
    textAlign: 'center',
    fontWeight: '800',
  },
  deleteDialogActions: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deleteDialogButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  deleteDialogCancelText: {
    fontWeight: '800',
  },
  deleteDialogDeleteText: {
    fontWeight: '900',
  },
  addExerciseButton: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  exerciseCard: {
    padding: 0,
    overflow: 'hidden',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
  },
  dragHandle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseTitleBlock: { flex: 1, minWidth: 0 },
  exerciseName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    padding: 0,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  exerciseSaveStatus: {
    maxWidth: 62,
    fontWeight: '800',
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  animatedSetRow: {
    overflow: 'hidden',
  },
  setRowHighlight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  setIndexColumn: {
    width: 38,
    alignItems: 'center',
  },
  setIndexHeader: {
    width: 38,
    textAlign: 'center',
  },
  setInputColumn: {
    flex: 1,
    minWidth: 0,
  },
  setInputHeader: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  setActionColumn: {
    width: 44,
    alignItems: 'center',
  },
  setVolumeHeader: {
    width: 58,
    textAlign: 'right',
  },
  setNumber: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setInput: {
    width: '100%',
    height: 44,
    borderRadius: radius.md,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  sideToggle: {
    width: '100%',
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideToggleText: {
    fontWeight: '800',
  },
  removeSet: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setVolume: {
    width: 58,
    textAlign: 'right',
  },
  lastSession: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  noteToggle: {
    minHeight: 32,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteToggleText: {
    fontWeight: '800',
  },
  notePreview: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  notePreviewText: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
  },
  noteEditor: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  noteInput: {
    minHeight: 56,
    maxHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  pickerGroup: {
    gap: spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
