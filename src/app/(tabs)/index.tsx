import { router } from 'expo-router';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  GripVertical,
  Moon,
  Plus,
  StickyNote,
  Sun,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppText,
  Card,
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
import { fitnessApi } from '@/services/fitnessApi';
import type { ExerciseOption, ExerciseSet, FitnessExercise, LastSessionsPayload, PreviousWorkoutPayload } from '@/types/fitness';
import { fullDateLabel, shiftIsoDate, todayIso } from '@/utils/date';
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
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [exercises, setExercises] = useState<FitnessExercise[]>([]);
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [dayLabel, setDayLabel] = useState(fullDateLabel(todayIso()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [previousWorkout, setPreviousWorkout] = useState<PreviousWorkoutPayload | null>(null);
  const [copySelection, setCopySelection] = useState<Set<string>>(new Set());
  const [lastSessions, setLastSessions] = useState<LastSessionsPayload['last_sessions']>({});
  const [saving, setSaving] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState>({ message: '' });
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

  useEffect(() => {
    loadExerciseOptions();
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate]);

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
    setLoading(true);
    setError('');
    const response = await fitnessApi.getDay(date);
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to load workout day.');
      setLoading(false);
      return;
    }
    setSelectedDate(response.day.date);
    setDayLabel(response.day.label_short || fullDateLabel(response.day.date));
    setExercises(response.exercises || []);
    setLoading(false);
    if (response.exercises?.length) {
      loadLastSessions(response.day.date);
    } else {
      setLastSessions({});
    }
  }

  async function loadLastSessions(date: string) {
    const response = await fitnessApi.getLastSessions(date);
    if (response.status === 'ok') {
      setLastSessions(response.last_sessions || {});
    }
  }

  function showToast(message: string, tone: ToastState['tone'] = 'default') {
    setToast({ message, tone });
  }

  function updateExercise(id: string, updater: (exercise: FitnessExercise) => FitnessExercise, save = true) {
    let nextExercise: FitnessExercise | null = null;
    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== id) return exercise;
        nextExercise = updater({ ...exercise, sets: normalizeExerciseSets(exercise.sets) });
        return nextExercise;
      }),
    );
    if (save && nextExercise) queueExerciseSave(nextExercise);
  }

  function queueExerciseSave(exercise: FitnessExercise) {
    const existing = saveTimers.current.get(exercise.id);
    if (existing) clearTimeout(existing);
    setSaving((current) => ({ ...current, [exercise.id]: 'Saving...' }));
    const timer = setTimeout(() => {
      saveTimers.current.delete(exercise.id);
      persistExercise(exercise);
    }, 650);
    saveTimers.current.set(exercise.id, timer);
  }

  async function persistExercise(exercise: FitnessExercise) {
    const response = await fitnessApi.updateExercise(exercise.id, {
      name: exercise.name,
      category: exercise.category,
      movement_type: exercise.movement_type,
      notes: exercise.notes || '',
      sets: normalizeExerciseSets(exercise.sets),
    });
    if (response.status !== 'ok') {
      setSaving((current) => ({ ...current, [exercise.id]: 'Error' }));
      showToast(response.error || 'Unable to save exercise.', 'error');
      return;
    }
    if (response.exercise) {
      setExercises((current) => current.map((item) => (item.id === response.exercise.id ? response.exercise : item)));
    }
    setSaving((current) => ({ ...current, [exercise.id]: 'Saved' }));
  }

  async function createExercise() {
    const name = newName.trim();
    if (!name) {
      showToast('Exercise name is required.', 'error');
      return;
    }
    const matched = optionLookup.get(name.toLowerCase());
    if (!matched && (!newCategory || !newType)) {
      showToast('Pick muscle group and type for a new exercise.', 'error');
      return;
    }
    const response = await fitnessApi.createExercise({
      workout_date: selectedDate,
      name,
      category: matched?.category || newCategory,
      movement_type: matched?.movement_type || newType,
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
      setExercises((current) => [...current, response.exercise].sort((a, b) => a.order_index - b.order_index));
      setExerciseOptions((current) => {
        if (current.some((option) => option.name.toLowerCase() === response.exercise.name.toLowerCase())) return current;
        return [...current, { name: response.exercise.name, category: response.exercise.category, movement_type: response.exercise.movement_type, source: 'custom' }];
      });
    } else {
      loadDay(selectedDate);
    }
    showToast('Exercise added.');
  }

  function resetAddForm() {
    setNewName('');
    setNewCategory('');
    setNewType('');
    setNewNotes('');
  }

  async function deleteExercise(id: string) {
    const response = await fitnessApi.deleteExercise(id);
    if (response.status !== 'ok') {
      showToast(response.error || 'Unable to delete exercise.', 'error');
      return;
    }
    setExercises((current) => current.filter((exercise) => exercise.id !== id));
    showToast('Exercise deleted.');
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
        onDelete={() => {
          Alert.alert('Delete exercise?', item.name, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteExercise(item.id) },
          ]);
        }}
        onChange={(updater) => updateExercise(item.id, updater)}
      />
    );
  }

  const filteredOptions = exerciseOptions
    .filter((option) => option.name.toLowerCase().includes(newName.trim().toLowerCase()))
    .slice(0, 14);

  const contentHeader = (
    <View style={styles.contentHeader}>
      <View style={styles.dateRow}>
        <IconButton icon={ChevronLeft} onPress={() => setSelectedDate((date) => shiftIsoDate(date, -1))} label="Previous day" />
        <View style={styles.dateLabel}>
          <AppText variant="subheading">{dayLabel}</AppText>
          <AppText variant="caption" muted>{selectedDate}</AppText>
        </View>
        <IconButton icon={ChevronRight} onPress={() => setSelectedDate((date) => shiftIsoDate(date, 1))} label="Next day" />
        <PillButton onPress={() => setSelectedDate(todayIso())}>Today</PillButton>
        <IconButton icon={ClipboardCopy} onPress={openCopyModal} label="Copy recent exercises" />
      </View>

      <View style={styles.summaryScroller}>
        <MetricCard label="Volume" value={formatNumber(summary.volume)} suffix="lbs" />
        <MetricCard label="Sets" value={summary.sets} />
        <MetricCard label="Exercises" value={summary.exercises} />
      </View>

      <InlineError message={error} />
    </View>
  );

  return (
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
          onDragEnd={({ data }) => reorder(data)}
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
            <PillButton onPress={() => setAddOpen(true)} style={styles.addButton}>
              <View style={styles.inlineIconLabel}>
                <Plus size={17} color="#fff" />
                <AppText variant="caption" color="#fff" style={{ fontWeight: '800' }}>Add Exercise</AppText>
              </View>
            </PillButton>
          }
        />
      )}

      <Toast message={toast.message} tone={toast.tone} />

      <ModalSheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add Exercise" actionLabel="Create" onAction={createExercise}>
        <TextField label="Exercise Name" value={newName} onChangeText={setNewName} placeholder="Barbell Squat" autoCapitalize="words" />
        {filteredOptions.map((option) => (
          <OptionRow
            key={option.name}
            label={option.name}
            meta={`${option.category || 'General'} | ${option.movement_type || option.type || 'Strength'}`}
            selected={newName.trim().toLowerCase() === option.name.toLowerCase()}
            onPress={() => {
              setNewName(option.name);
              setNewCategory(option.category);
              setNewType(option.movement_type || option.type || 'Strength');
            }}
          />
        ))}
        {!optionLookup.get(newName.trim().toLowerCase()) && newName.trim() ? (
          <View style={styles.pickerGroup}>
            <AppText variant="caption" muted>Muscle Group</AppText>
            <View style={styles.wrapRow}>
              {categories.map((category) => (
                <PillButton key={category} tone="plain" active={newCategory === category} onPress={() => setNewCategory(category)}>
                  {category}
                </PillButton>
              ))}
            </View>
            <AppText variant="caption" muted>Type</AppText>
            <View style={styles.wrapRow}>
              {types.map((type) => (
                <PillButton key={type} tone="plain" active={newType === type} onPress={() => setNewType(type)}>
                  {type}
                </PillButton>
              ))}
            </View>
          </View>
        ) : null}
        <TextField label="Note" value={newNotes} onChangeText={setNewNotes} placeholder="Optional note..." multiline />
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

  function updateSet(index: number, patch: Partial<ExerciseSet>) {
    onChange((current) => {
      const sets = normalizeExerciseSets(current.sets);
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
        <AppText variant="label">Set</AppText>
        <AppText variant="label">Weight</AppText>
        <AppText variant="label">Reps</AppText>
        <AppText variant="label">RPE</AppText>
      </View>

      {normalizeExerciseSets(exercise.sets).map((set, index) => (
        <View key={index} style={[styles.setRow, { borderTopColor: colors.border }]}>
          <View style={[styles.setNumber, { backgroundColor: colors.surfaceAlt }]}>
            <AppText variant="caption" muted style={{ fontWeight: '800' }}>{index + 1}</AppText>
          </View>
          <TextInput
            value={set.weight === null ? '' : formatDecimal(set.weight)}
            onChangeText={(value) => updateSet(index, { weight: toNumberOrNull(value) })}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={[styles.setInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
          />
          <TextInput
            value={set.reps === null ? '' : String(set.reps)}
            onChangeText={(value) => updateSet(index, { reps: toIntOrNull(value) })}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={[styles.setInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
          />
          <TextInput
            value={set.rpe === null ? '' : formatDecimal(set.rpe)}
            onChangeText={(value) => updateSet(index, { rpe: toNumberOrNull(value) })}
            keyboardType="decimal-pad"
            placeholder="-"
            placeholderTextColor={colors.muted}
            style={[styles.setInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
          />
          <Pressable
            onPress={() =>
              onChange((current) => {
                const sets = normalizeExerciseSets(current.sets).filter((_, setIndex) => setIndex !== index);
                return { ...current, sets: sets.length ? sets : [{ weight: null, reps: null, rpe: null }] };
              })
            }
            style={styles.removeSet}>
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
              sets: [...normalizeExerciseSets(current.sets), { weight: null, reps: null, rpe: null }],
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
    paddingTop: spacing.lg,
    paddingBottom: 120,
    gap: spacing.md,
  },
  loadingWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  contentHeader: { gap: spacing.lg },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateLabel: { flex: 1, alignItems: 'center' },
  summaryScroller: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addButton: {
    height: 48,
    marginTop: spacing.sm,
  },
  inlineIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    gridTemplateColumns: '44px 1fr 1fr 1fr',
    flexDirection: 'row',
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
  setNumber: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setInput: {
    flex: 1,
    minWidth: 54,
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
