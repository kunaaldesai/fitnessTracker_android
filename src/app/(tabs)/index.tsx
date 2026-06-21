import { router } from 'expo-router';
import {
  type LucideIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dumbbell,
  GripVertical,
  Moon,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Sun,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageTransition } from '@/components/fittrack/PageTransition';
import { LoginLaunchAnimation } from '@/components/fittrack/LoginLaunchAnimation';
import { MuscleBodyPicker } from '@/components/fittrack/MuscleBodyPicker';
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
import { fitnessApi } from '@/services/fitnessApi';
import type { ExerciseOption, ExerciseSet, FitnessExercise, LastSessionsPayload, PreviousWorkoutPayload } from '@/types/fitness';
import { fullDateLabel, shiftIsoDate, todayIso } from '@/utils/date';
import {
  createEmptyEditableSet,
  defaultMovementTypeForCategory,
  ensureEditableSets,
  filterExerciseOptionsByCategoryAndQuery,
  stripSetClientKeys,
  withEditableSetKeys,
  withEditableSetKeysForExercises,
} from '@/utils/workoutExerciseDraft';
import {
  computeExerciseVolume,
  computeSetVolume,
  countCompletedSets,
  formatDecimal,
  formatNumber,
  normalizeExerciseSets,
  toIntOrNull,
  toNumberOrNull,
} from '@/utils/fitnessMath';

const DEFAULT_CATEGORIES = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Biceps', 'Triceps', 'Shoulders', 'Abs', 'Cardio'];
const DEFAULT_TYPES = ['Strength', 'Cardio'];

type ToastState = { message: string; tone?: 'default' | 'error' };

export default function WorkoutScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const { completeLoginEntrance, loginEntrancePending } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const [exercises, setExercises] = useState<FitnessExercise[]>([]);
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [draggingExercise, setDraggingExercise] = useState(false);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const saveVersions = useRef<Map<string, number>>(new Map());
  const selectedDateRef = useRef(selectedDate);
  const dayRequestId = useRef(0);

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newType, setNewType] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const optionLookup = useMemo(() => {
    const lookup = new Map<string, ExerciseOption>();
    exerciseOptions.forEach((option) => lookup.set(option.name.trim().toLowerCase(), option));
    return lookup;
  }, [exerciseOptions]);

  const summary = useMemo(() => {
    const volume = exercises.reduce((sum, exercise) => sum + computeExerciseVolume(exercise), 0);
    return {
      volume,
      sets: countCompletedSets(exercises),
      exercises: exercises.length,
    };
  }, [exercises]);

  const nameQuery = newName.trim();
  const matchedOption = nameQuery ? optionLookup.get(nameQuery.toLowerCase()) : undefined;
  const isCustomExercise = Boolean(nameQuery && !matchedOption);
  const canCreateExercise = Boolean(nameQuery && (matchedOption || newCategory) && !creatingExercise);
  const addActionLabel = creatingExercise ? 'Adding...' : matchedOption ? 'Add' : 'Create';
  const pickerCategory = matchedOption?.category || newCategory;

  const filteredOptions = useMemo(() => {
    return filterExerciseOptionsByCategoryAndQuery(exerciseOptions, newCategory, nameQuery).slice(0, 8);
  }, [exerciseOptions, newCategory, nameQuery]);

  const commitSelectedDate = useCallback((date: string) => {
    if (date === selectedDateRef.current) return;
    selectedDateRef.current = date;
    setDayLabel(fullDateLabel(date));
    setSelectedDate(date);
  }, []);

  useEffect(() => {
    loadExerciseOptions();
  }, []);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
    loadDay(selectedDate);
    // Day reloads are tied to date navigation, not every helper closure refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!toast.message) return;
    const timer = setTimeout(() => setToast({ message: '' }), 1800);
    return () => clearTimeout(timer);
  }, [toast.message]);

  async function loadExerciseOptions() {
    const response = await fitnessApi.getExerciseOptions();
    if (response.status !== 'ok') return;
    setExerciseOptions(response.exercises || []);
    setCategories(response.categories?.length ? response.categories : DEFAULT_CATEGORIES);
    setTypes(response.types?.length ? response.types : DEFAULT_TYPES);
  }

  async function loadDay(date: string) {
    const requestId = dayRequestId.current + 1;
    dayRequestId.current = requestId;
    setLoading(true);
    setError('');
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
    setDayLabel(response.day.label_short || fullDateLabel(responseDate));
    setExercises(withEditableSetKeysForExercises(response.exercises || []));
    setLoading(false);
    if (response.exercises?.length) {
      loadLastSessions(responseDate, requestId);
    } else {
      setLastSessions({});
    }
  }

  async function loadLastSessions(date: string, requestId = dayRequestId.current) {
    const response = await fitnessApi.getLastSessions(date);
    if (requestId !== dayRequestId.current) return;
    if (response.status === 'ok') {
      setLastSessions(response.last_sessions || {});
    }
  }

  function showToast(message: string, tone: ToastState['tone'] = 'default') {
    setToast({ message, tone });
  }

  const navigateToDate = useCallback((date: string) => {
    commitSelectedDate(date);
  }, [commitSelectedDate]);

  const navigateByDays = useCallback((days: -1 | 1) => {
    commitSelectedDate(shiftIsoDate(selectedDateRef.current, days));
  }, [commitSelectedDate]);

  const selectExerciseCategory = useCallback((category: string) => {
    setNewCategory(category);
    setNewType(defaultMovementTypeForCategory(category));
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
    const version = (saveVersions.current.get(exercise.id) || 0) + 1;
    saveVersions.current.set(exercise.id, version);
    setSaving((current) => ({ ...current, [exercise.id]: 'Saving...' }));
    const timer = setTimeout(() => {
      saveTimers.current.delete(exercise.id);
      persistExercise(exercise, version);
    }, 650);
    saveTimers.current.set(exercise.id, timer);
  }

  async function persistExercise(exercise: FitnessExercise, version: number) {
    const response = await fitnessApi.updateExercise(exercise.id, {
      name: exercise.name,
      category: exercise.category,
      movement_type: exercise.movement_type,
      notes: exercise.notes || '',
      sets: stripSetClientKeys(exercise.sets),
    });
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
  }

  async function createExercise() {
    if (creatingExercise) return;
    const name = nameQuery;
    if (!name) {
      showToast('Exercise name is required.', 'error');
      return;
    }
    const matched = matchedOption;
    if (!matched && !newCategory) {
      showToast('Pick a muscle group for a new exercise.', 'error');
      return;
    }
    const category = matched?.category || newCategory;
    const movementType = matched?.movement_type || matched?.type || newType || defaultMovementTypeForCategory(category);
    setCreatingExercise(true);
    try {
      const response = await fitnessApi.createExercise({
        workout_date: selectedDate,
        name,
        category,
        movement_type: movementType,
        notes: newNotes.trim(),
        sets: [{ weight: null, reps: null, rpe: null }],
      });
      if (response.status !== 'ok') {
        showToast(response.error || 'Unable to add exercise.', 'error');
        return;
      }
      resetAddForm();
      setAddOpen(false);
      if (response.exercise) {
        const createdExercise = withEditableSetKeys(response.exercise);
        setExercises((current) => [...current, createdExercise].sort((a, b) => a.order_index - b.order_index));
        setExerciseOptions((current) => {
          if (current.some((option) => option.name.toLowerCase() === createdExercise.name.toLowerCase())) return current;
          return [...current, { name: createdExercise.name, category: createdExercise.category, movement_type: createdExercise.movement_type, source: 'custom' }];
        });
      } else {
        loadDay(selectedDate);
      }
      showToast(`${name} added.`);
    } finally {
      setCreatingExercise(false);
    }
  }

  function resetAddForm() {
    setNewName('');
    setNewCategory('');
    setNewType('');
    setNewNotes('');
  }

  async function deleteExercise(exercise: FitnessExercise) {
    const pendingSave = saveTimers.current.get(exercise.id);
    if (pendingSave) clearTimeout(pendingSave);
    saveTimers.current.delete(exercise.id);
    saveVersions.current.set(exercise.id, (saveVersions.current.get(exercise.id) || 0) + 1);
    setDeletingExerciseId(exercise.id);
    const response = await fitnessApi.deleteExercise(exercise.id);
    if (response.status !== 'ok') {
      setDeletingExerciseId(null);
      showToast(response.error || 'Unable to delete exercise.', 'error');
      return;
    }
    setExercises((current) => current.filter((item) => item.id !== exercise.id));
    setDeleteTarget(null);
    setDeletingExerciseId(null);
    showToast(`${exercise.name} deleted.`);
  }

  async function reorder(nextExercises: FitnessExercise[]) {
    setExercises(nextExercises.map((exercise, index) => ({ ...exercise, order_index: index })));
    const response = await fitnessApi.reorderExercises(selectedDate, nextExercises.map((exercise) => exercise.id));
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
    const response = await fitnessApi.copyExercisesToDate(selectedDate, ids);
    if (response.status !== 'ok') {
      showToast(response.error || 'Unable to copy exercises.', 'error');
      return;
    }
    setCopyOpen(false);
    showToast(`${response.count || ids.length} copied.`);
    loadDay(selectedDate);
  }

  function renderExercise({ item, drag, isActive }: RenderItemParams<FitnessExercise>) {
    return (
      <ExerciseCard
        exercise={item}
        saving={saving[item.id] || 'Saved'}
        lastSession={lastSessions[item.name]}
        dragging={isActive}
        onDrag={drag}
        onDelete={() => setDeleteTarget(item)}
        onChange={(updater) => updateExercise(item.id, updater)}
      />
    );
  }

  const swipeDisabled = loading || addOpen || copyOpen || Boolean(deleteTarget) || keyboardOpen || draggingExercise;

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

      <View style={styles.summaryScroller}>
        <MetricCard label="Volume" value={formatNumber(summary.volume)} suffix="lbs" style={styles.summaryMetricCard} />
        <MetricCard label="Sets" value={summary.sets} style={styles.summaryMetricCard} />
        <MetricCard label="Exercises" value={summary.exercises} style={styles.summaryMetricCard} />
      </View>

      <InlineError message={error} />
    </View>
  );

  return (
    <PageTransition tabOrder={0}>
      <WorkoutDaySwipeSurface disabled={swipeDisabled} onSwipeDay={navigateByDays}>
        <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
          <Header
            title="Workout"
            right={
              <>
                <IconButton icon={User} onPress={() => router.push('/profile')} label="Profile" />
                <IconButton icon={mode === 'dark' ? Sun : Moon} onPress={toggleMode} label="Toggle theme" />
              </>
            }
          />
          {loading ? (
            <View style={styles.loadingWrap}>
              {contentHeader}
              <LoadingState label="Loading workout..." />
            </View>
          ) : (
            <DraggableFlatList
              data={exercises}
              keyExtractor={(item) => item.id}
              renderItem={renderExercise}
              onDragBegin={() => setDraggingExercise(true)}
              onDragEnd={({ data }) => {
                setDraggingExercise(false);
                reorder(data);
              }}
              activationDistance={12}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={contentHeader}
              ListEmptyComponent={
                <EmptyState
                  icon={CalendarDays}
                  title="No exercises logged yet"
                  body="Tap Add Exercise to start this workout."
                />
              }
              ListFooterComponent={
                <AddExerciseButton onPress={() => setAddOpen(true)} />
              }
            />
          )}

          <Toast message={toast.message} tone={toast.tone} />

          <ModalSheet
            visible={addOpen}
            onClose={() => {
              setAddOpen(false);
              resetAddForm();
            }}
            title="Add Exercise"
            actionLabel={addActionLabel}
            actionBusy={creatingExercise}
            actionDisabled={!canCreateExercise}
            onAction={createExercise}>
            <View style={[styles.addHero, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={[styles.addHeroIcon, { backgroundColor: `${colors.primary}18` }]}>
                {matchedOption ? <Dumbbell size={22} color={colors.primary} /> : <Search size={22} color={colors.primary} />}
              </View>
              <View style={styles.addHeroText}>
                <AppText style={{ fontWeight: '800' }}>
                  {nameQuery ? nameQuery : 'Find an exercise'}
                </AppText>
                <AppText variant="caption" muted>
                  {matchedOption
                    ? `${matchedOption.category || 'General'} | ${matchedOption.movement_type || matchedOption.type || 'Strength'}`
                    : isCustomExercise
                      ? 'New exercise'
                      : 'Search your library or create a custom movement.'}
                </AppText>
              </View>
            </View>

            <TextField
              label="Search or Create"
              value={newName}
              onChangeText={setNewName}
              placeholder="Barbell Squat"
              autoCapitalize="words"
            />

            <MuscleBodyPicker
              categories={categories}
              selectedCategory={pickerCategory}
              onSelectCategory={selectExerciseCategory}
            />

            {filteredOptions.length ? (
              <View style={styles.addSection}>
                <View style={styles.addSectionHeader}>
                  <Sparkles size={15} color={colors.primary} />
                  <AppText variant="caption" muted>
                    {newCategory ? `${newCategory} ${nameQuery ? 'matches' : 'suggestions'}` : nameQuery ? 'Matches' : 'Suggestions'}
                  </AppText>
                </View>
                {filteredOptions.map((option) => (
                  <OptionRow
                    key={option.name}
                    label={option.name}
                    meta={`${option.category || 'General'} | ${option.movement_type || option.type || 'Strength'}`}
                    selected={nameQuery.toLowerCase() === option.name.toLowerCase()}
                    onPress={() => {
                      setNewName(option.name);
                      setNewCategory(option.category);
                      setNewType(option.movement_type || option.type || defaultMovementTypeForCategory(option.category));
                    }}
                  />
                ))}
              </View>
            ) : nameQuery ? (
              <View style={[styles.noMatchesPanel, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <AppText style={{ fontWeight: '800' }}>Create {nameQuery}</AppText>
                <AppText variant="caption" muted>Choose metadata below so analytics can classify it correctly.</AppText>
              </View>
            ) : null}

            {isCustomExercise ? (
              <View style={styles.pickerGroup}>
                <View style={styles.addSectionHeader}>
                  <AppText variant="caption" muted>Type</AppText>
                </View>
                <View style={styles.wrapRow}>
                  {types.map((type) => (
                    <PillButton key={type} tone="plain" active={newType === type} onPress={() => setNewType(type)}>
                      {type}
                    </PillButton>
                  ))}
                </View>
                {!newCategory || !newType ? (
                  <InlineError message="Pick a muscle group to finish this custom exercise." />
                ) : null}
              </View>
            ) : null}
            <TextField label="Note" value={newNotes} onChangeText={setNewNotes} placeholder="Optional note..." multiline />
          </ModalSheet>

          <ModalSheet
            visible={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            title="Delete Exercise"
            actionLabel={deletingExerciseId ? 'Deleting...' : 'Delete'}
            actionTone="danger"
            actionBusy={Boolean(deletingExerciseId)}
            onAction={() => {
              if (deleteTarget) deleteExercise(deleteTarget);
            }}>
            {deleteTarget ? (
              <View style={[styles.deletePanel, { backgroundColor: `${colors.accent}12`, borderColor: `${colors.accent}55` }]}>
                <View style={[styles.deleteIcon, { backgroundColor: `${colors.accent}20` }]}>
                  <Trash2 size={23} color={colors.accent} />
                </View>
                <View style={styles.deleteText}>
                  <AppText style={{ fontWeight: '800' }}>{deleteTarget.name}</AppText>
                  <AppText variant="caption" muted>
                    {[deleteTarget.category || 'General', deleteTarget.movement_type || deleteTarget.type || 'Strength'].join(' | ')}
                  </AppText>
                </View>
                <View style={styles.deleteStats}>
                  <View style={styles.deleteStat}>
                    <AppText variant="caption" muted>Sets</AppText>
                    <AppText style={{ fontWeight: '800' }}>{normalizeExerciseSets(deleteTarget.sets).length}</AppText>
                  </View>
                  <View style={styles.deleteStat}>
                    <AppText variant="caption" muted>Volume</AppText>
                    <AppText style={{ fontWeight: '800' }}>{formatNumber(computeExerciseVolume(deleteTarget))} lbs</AppText>
                  </View>
                </View>
              </View>
            ) : null}
            <InlineError message="This removes the exercise and its sets from this workout day." />
          </ModalSheet>

          <ModalSheet visible={copyOpen} onClose={() => setCopyOpen(false)} title="Copy Recent" actionLabel="Copy" onAction={copySelectedExercises}>
            {!previousWorkout ? <LoadingState label="Loading recent exercises..." /> : null}
            {previousWorkout && !previousWorkout.exercises.length ? (
              <EmptyState title="No recent workout" body="There are no previous exercises to copy." />
            ) : null}
            {previousWorkout?.exercises.map((exercise) => {
              const selected = copySelection.has(exercise.id);
              const setsMeta = (exercise.sets || [])
                .filter((set) => set.weight || set.reps)
                .slice(0, 4)
                .map((set) => `${set.weight ?? ''}x${set.reps ?? ''}`)
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
      </WorkoutDaySwipeSurface>
      <LoginLaunchAnimation visible={loginEntrancePending} onDone={completeLoginEntrance} />
    </PageTransition>
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
      <View style={styles.addExerciseButtonContent}>
        <Plus size={18} color="#fff" strokeWidth={2.7} />
        <AppText color="#fff" style={styles.addExerciseButtonTitle}>Add Exercise</AppText>
      </View>
    </Pressable>
  );
}

function ExerciseCard({
  exercise,
  saving,
  lastSession,
  dragging,
  onDrag,
  onDelete,
  onChange,
}: {
  exercise: FitnessExercise;
  saving: string;
  lastSession?: LastSessionsPayload['last_sessions'][string];
  dragging: boolean;
  onDrag: () => void;
  onDelete: () => void;
  onChange: (updater: (exercise: FitnessExercise) => FitnessExercise) => void;
}) {
  const { colors } = useAppTheme();
  const [notesOpen, setNotesOpen] = useState(Boolean(exercise.notes));
  const editableSets = useMemo(() => ensureEditableSets(exercise.id, exercise.sets), [exercise.id, exercise.sets]);

  function updateSet(index: number, patch: Partial<ExerciseSet>) {
    onChange((current) => {
      const sets = ensureEditableSets(current.id, current.sets);
      sets[index] = { ...sets[index], ...patch };
      return { ...current, sets };
    });
  }

  return (
    <Card style={[styles.exerciseCard, dragging && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      <View style={styles.exerciseHeader}>
        <Pressable onLongPress={onDrag} onPressIn={onDrag} style={styles.dragHandle}>
          <GripVertical size={21} color={colors.faint} />
        </Pressable>
        <View style={styles.exerciseTitleBlock}>
          <TextInput
            value={exercise.name}
            onChangeText={(name) => onChange((current) => ({ ...current, name }))}
            style={[styles.exerciseName, { color: colors.text }]}
            placeholderTextColor={colors.muted}
          />
          <View style={styles.metaRow}>
            <AppText variant="caption" muted>{exercise.category || 'General'}</AppText>
            <AppText variant="caption" muted>|</AppText>
            <AppText variant="caption" muted>{exercise.movement_type || exercise.type || 'Strength'}</AppText>
            <AppText variant="caption" muted>{saving}</AppText>
          </View>
        </View>
        <View style={styles.exerciseActions}>
          <AppText variant="caption" color={colors.primary} style={{ fontWeight: '800' }}>
            {formatNumber(computeExerciseVolume(exercise))} lbs
          </AppText>
          <IconButton icon={Trash2} onPress={onDelete} danger label="Delete exercise" />
        </View>
      </View>

      <View style={styles.setHeader}>
        <AppText variant="label" style={styles.setIndexHeader}>Set</AppText>
        <AppText variant="label" style={styles.setInputHeader}>Weight</AppText>
        <AppText variant="label" style={styles.setInputHeader}>Reps</AppText>
        <AppText variant="label" style={styles.setInputHeader}>RPE</AppText>
        <View style={styles.setActionColumn} />
        <AppText variant="label" style={styles.setVolumeHeader}>Vol.</AppText>
      </View>

      {editableSets.map((set, index) => (
        <View key={set._clientKey || `${exercise.id}:set:${index}`} style={[styles.setRow, { borderTopColor: colors.border }]}>
          <View style={styles.setIndexColumn}>
            <View style={[styles.setNumber, { backgroundColor: colors.surfaceAlt }]}>
              <AppText variant="caption" muted style={{ fontWeight: '800' }}>{index + 1}</AppText>
            </View>
          </View>
          <View style={styles.setInputColumn}>
            <TextInput
              value={set.weight === null ? '' : formatDecimal(set.weight)}
              onChangeText={(value) => updateSet(index, { weight: toNumberOrNull(value) })}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={[styles.setInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
            />
          </View>
          <View style={styles.setInputColumn}>
            <TextInput
              value={set.reps === null ? '' : String(set.reps)}
              onChangeText={(value) => updateSet(index, { reps: toIntOrNull(value) })}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={[styles.setInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
            />
          </View>
          <View style={styles.setInputColumn}>
            <TextInput
              value={set.rpe === null ? '' : formatDecimal(set.rpe)}
              onChangeText={(value) => updateSet(index, { rpe: toNumberOrNull(value) })}
              keyboardType="decimal-pad"
              placeholder="-"
              placeholderTextColor={colors.muted}
              style={[styles.setInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
            />
          </View>
          <Pressable
            onPress={() =>
              onChange((current) => {
                const sets = ensureEditableSets(current.id, current.sets).filter((_, setIndex) => setIndex !== index);
                return { ...current, sets: sets.length ? sets : [createEmptyEditableSet(current.id)] };
              })
            }
            style={[styles.removeSet, styles.setActionColumn]}>
            <X size={16} color={colors.faint} />
          </Pressable>
          <AppText variant="caption" muted style={styles.setVolume}>{formatNumber(computeSetVolume(set))} lbs</AppText>
        </View>
      ))}

      {lastSession?.date_label ? (
        <View style={[styles.lastSession, { borderTopColor: colors.border }]}>
          <AppText variant="caption" muted>
            Last time ({lastSession.date_label}) {lastSession.sets_summary?.join(', ')}
          </AppText>
        </View>
      ) : null}

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Pressable onPress={() => setNotesOpen((value) => !value)} style={styles.noteToggle}>
          <StickyNote size={15} color={colors.primary} />
          <AppText variant="caption" color={colors.primary}>{exercise.notes ? 'Edit note' : 'Add note'}</AppText>
        </Pressable>
        <PillButton
          tone="plain"
          onPress={() =>
            onChange((current) => ({
              ...current,
              sets: [...ensureEditableSets(current.id, current.sets), createEmptyEditableSet(current.id)],
            }))
          }>
          Add Set
        </PillButton>
      </View>
      {notesOpen ? (
        <TextField
          value={exercise.notes || ''}
          onChangeText={(notes) => onChange((current) => ({ ...current, notes }))}
          multiline
          placeholder="Optional note..."
          style={{ marginTop: spacing.sm }}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
    gap: spacing.md,
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
  addSection: {
    gap: spacing.sm,
  },
  addSectionHeader: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noMatchesPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 3,
  },
  deletePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  deleteIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    gap: 2,
  },
  deleteStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deleteStat: {
    flex: 1,
    minHeight: 54,
    justifyContent: 'center',
    gap: 2,
  },
  addExerciseButton: {
    minHeight: 50,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  addExerciseButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addExerciseButtonTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
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
    width: 30,
    height: 34,
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
    alignItems: 'flex-end',
    gap: 2,
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
    width: 28,
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
    height: 38,
    borderRadius: radius.md,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  removeSet: {
    width: 28,
    height: 28,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
