import { router } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Edit3,
  ListFilter,
  LogOut,
  Plus,
  Scale,
  Sun,
  Moon,
  Target,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeightLineChart } from '@/components/fittrack/Charts';
import { PageTransition } from '@/components/fittrack/PageTransition';
import {
  AppText,
  Card,
  DateField,
  Header,
  IconButton,
  InlineError,
  LoadingState,
  ModalSheet,
  PillButton,
  SegmentedControl,
  TextField,
} from '@/components/fittrack/ui';
import { radius, spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/context/AuthContext';
import { fitnessApi } from '@/services/fitnessApi';
import type { ProfilePayload, WeightEntry, WeightHistoryPayload } from '@/types/fitness';
import { todayIso } from '@/utils/date';
import { formatNumber } from '@/utils/fitnessMath';
import {
  convertInputValue,
  convertRateInputValue,
  formatRateInput,
  formatWeight,
  formatWeightInput,
  rateUnitToLbs,
  signedWeightDelta,
  summaryDelta,
  unitToLbs,
  type WeightUnit,
} from '@/utils/weightTracking';

type ProfileForm = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex_for_bmr: string;
  height_feet: string;
  height_inches: string;
  weight_lbs: string;
  target_weight_lbs: string;
  activity_level: string;
  bmr_formula: string;
  body_fat_percent: string;
  custom_goal_lbs_per_week: string;
};

const emptyForm: ProfileForm = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  sex_for_bmr: '',
  height_feet: '',
  height_inches: '',
  weight_lbs: '',
  target_weight_lbs: '',
  activity_level: 'sedentary',
  bmr_formula: 'katch_mcardle',
  body_fat_percent: '',
  custom_goal_lbs_per_week: '',
};

type WeightRange = '1m' | '3m' | '6m' | 'ytd' | 'all';
type WeightHistoryRange = WeightRange | 'custom';

type WeightEntryForm = {
  date: string;
  weight: string;
  note: string;
};

const emptyWeightForm = (): WeightEntryForm => ({
  date: todayIso(),
  weight: '',
  note: '',
});

export default function ProfileScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightHistoryPayload | null>(null);
  const [allWeightHistory, setAllWeightHistory] = useState<WeightHistoryPayload | null>(null);
  const [historyWeightHistory, setHistoryWeightHistory] = useState<WeightHistoryPayload | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [weightForm, setWeightForm] = useState<WeightEntryForm>(() => emptyWeightForm());
  const [editWeightForm, setEditWeightForm] = useState<WeightEntryForm>(() => emptyWeightForm());
  const [goalForm, setGoalForm] = useState({ target_weight: '', weekly_rate: '' });
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [logWeightOpen, setLogWeightOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lb');
  const [weightRange, setWeightRange] = useState<WeightRange>('3m');
  const [historyRange, setHistoryRange] = useState<WeightHistoryRange>('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [weightLoading, setWeightLoading] = useState(true);
  const [allWeightLoading, setAllWeightLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [deletingWeightId, setDeletingWeightId] = useState<string | null>(null);
  const [deletingFiltered, setDeletingFiltered] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');

  const applyProfile = useCallback((response: ProfilePayload) => {
    setProfile(response);
    setForm(fromProfile(response));
    setGoalForm(goalFromProfile(response, weightUnit));
  }, [weightUnit]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await fitnessApi.getProfile();
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to load profile.');
      setLoading(false);
      return;
    }
    applyProfile(response);
    setLoading(false);
  }, [applyProfile]);

  const loadWeightHistory = useCallback(async () => {
    setWeightLoading(true);
    const response = await fitnessApi.getWeightHistory({ range: weightRange });
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to load weight history.');
      setWeightLoading(false);
      return;
    }
    setWeightHistory(response);
    setWeightLoading(false);
  }, [weightRange]);

  const loadAllWeightHistory = useCallback(async () => {
    setAllWeightLoading(true);
    const response = await fitnessApi.getWeightHistory({ range: 'all' });
    if (response.status === 'ok') {
      setAllWeightHistory(response);
    }
    setAllWeightLoading(false);
  }, []);

  const loadHistoryBrowser = useCallback(async () => {
    if (historyRange === 'custom' && !historyStartDate && !historyEndDate) {
      setHistoryError('Choose a start or end date for the custom range.');
      setHistoryWeightHistory(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryError('');
    const params = historyRange === 'custom'
      ? { start_date: historyStartDate || undefined, end_date: historyEndDate || undefined }
      : { range: historyRange };
    const response = await fitnessApi.getWeightHistory(params);
    if (response.status !== 'ok') {
      setHistoryError(response.error || 'Unable to load weight logs.');
      setHistoryLoading(false);
      return;
    }
    setHistoryWeightHistory(response);
    setHistoryLoading(false);
  }, [historyEndDate, historyRange, historyStartDate]);

  useEffect(() => {
    const timer = setTimeout(loadProfile, 0);
    return () => clearTimeout(timer);
  }, [loadProfile]);

  useEffect(() => {
    const timer = setTimeout(loadWeightHistory, 0);
    return () => clearTimeout(timer);
  }, [loadWeightHistory]);

  useEffect(() => {
    const timer = setTimeout(loadAllWeightHistory, 0);
    return () => clearTimeout(timer);
  }, [loadAllWeightHistory]);

  useEffect(() => {
    if (!historyOpen) return;
    const timer = setTimeout(loadHistoryBrowser, 0);
    return () => clearTimeout(timer);
  }, [historyOpen, loadHistoryBrowser]);

  async function refreshWeightViews() {
    await Promise.all([
      loadWeightHistory(),
      loadAllWeightHistory(),
      historyOpen ? loadHistoryBrowser() : Promise.resolve(),
    ]);
  }

  async function saveProfile() {
    setSaving(true);
    setError('');
    setMessage('');
    const response = await fitnessApi.saveProfile(form);
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to save profile.');
      setSaving(false);
      return;
    }
    applyProfile(response);
    setEditorOpen(false);
    setMessage('Profile updated.');
    setSaving(false);
    refreshWeightViews();
  }

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openProfileEditor() {
    setDetailsOpen(true);
    setEditorOpen(true);
  }

  function openWeightLogger() {
    setWeightForm(emptyWeightForm());
    setLogWeightOpen(true);
  }

  function openGoalEditor() {
    if (profile) setGoalForm(goalFromProfile(profile, weightUnit));
    setGoalOpen(true);
  }

  function openHistoryManager() {
    setHistoryRange('all');
    setHistoryStartDate('');
    setHistoryEndDate('');
    setHistoryOpen(true);
  }

  function changeHistoryRange(nextRange: WeightHistoryRange) {
    setHistoryRange(nextRange);
    if (nextRange === 'custom' && !historyStartDate && !historyEndDate) {
      setHistoryEndDate(todayIso());
    }
  }

  function changeWeightUnit(nextUnit: WeightUnit) {
    if (nextUnit === weightUnit) return;
    setWeightForm((current) => ({ ...current, weight: convertInputValue(current.weight, weightUnit, nextUnit) }));
    setEditWeightForm((current) => ({ ...current, weight: convertInputValue(current.weight, weightUnit, nextUnit) }));
    setGoalForm((current) => ({
      target_weight: convertInputValue(current.target_weight, weightUnit, nextUnit),
      weekly_rate: convertRateInputValue(current.weekly_rate, weightUnit, nextUnit),
    }));
    setWeightUnit(nextUnit);
  }

  async function saveWeightEntry() {
    const weightLbs = unitToLbs(weightForm.weight, weightUnit);
    if (weightLbs === null) {
      setError('Enter a valid weight.');
      return;
    }
    setWeightSaving(true);
    setError('');
    setMessage('');
    const payload = weightUnit === 'kg'
      ? { date: weightForm.date, weight_kg: Number(weightForm.weight), note: weightForm.note.trim() }
      : { date: weightForm.date, weight_lbs: weightLbs, note: weightForm.note.trim() };
    const response = await fitnessApi.createWeightEntry(payload);
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to save weight.');
      setWeightSaving(false);
      return;
    }
    setWeightForm(emptyWeightForm());
    setLogWeightOpen(false);
    setMessage('Weight logged.');
    setWeightSaving(false);
    loadProfile();
    refreshWeightViews();
  }

  function beginEditWeight(entry: WeightEntry) {
    setEditingWeightId(entry.id);
    setEditWeightForm({
      date: entry.date,
      weight: formatWeightInput(entry.weight_lbs, weightUnit),
      note: entry.note || '',
    });
  }

  async function saveEditedWeight() {
    if (!editingWeightId) return;
    const weightLbs = unitToLbs(editWeightForm.weight, weightUnit);
    if (weightLbs === null) {
      setError('Enter a valid weight.');
      return;
    }
    setWeightSaving(true);
    setError('');
    setMessage('');
    const payload = weightUnit === 'kg'
      ? { date: editWeightForm.date, weight_kg: Number(editWeightForm.weight), note: editWeightForm.note.trim() }
      : { date: editWeightForm.date, weight_lbs: weightLbs, note: editWeightForm.note.trim() };
    const response = await fitnessApi.updateWeightEntry(editingWeightId, payload);
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to update weight.');
      setWeightSaving(false);
      return;
    }
    setEditingWeightId(null);
    setMessage('Weight updated.');
    setWeightSaving(false);
    loadProfile();
    refreshWeightViews();
  }

  function confirmDeleteWeightEntry(entry: WeightEntry) {
    Alert.alert(
      'Delete weight log?',
      `${entry.date_label} at ${formatWeight(entry.weight_lbs, weightUnit)} will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteWeightEntry(entry.id) },
      ],
    );
  }

  async function deleteWeightEntry(entryId: string) {
    setDeletingWeightId(entryId);
    setError('');
    setHistoryError('');
    setMessage('');
    const response = await fitnessApi.deleteWeightEntry(entryId);
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to delete weight.');
      setDeletingWeightId(null);
      return;
    }
    if (editingWeightId === entryId) setEditingWeightId(null);
    setMessage('Weight deleted.');
    setDeletingWeightId(null);
    loadProfile();
    refreshWeightViews();
  }

  function confirmDeleteFilteredWeightEntries() {
    const entries = historyWeightHistory?.entries || [];
    if (!entries.length) return;
    Alert.alert(
      'Delete filtered logs?',
      `This will delete ${entries.length} weight ${entries.length === 1 ? 'log' : 'logs'} in the current filter.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteFilteredWeightEntries },
      ],
    );
  }

  async function deleteFilteredWeightEntries() {
    const entries = historyWeightHistory?.entries || [];
    if (!entries.length) return;
    setDeletingFiltered(true);
    setError('');
    setHistoryError('');
    setMessage('');
    for (const entry of entries) {
      const response = await fitnessApi.deleteWeightEntry(entry.id);
      if (response.status !== 'ok') {
        setHistoryError(response.error || `Unable to delete ${entry.date_label}.`);
        setDeletingFiltered(false);
        return;
      }
    }
    setDeletingFiltered(false);
    setMessage(`${entries.length} weight ${entries.length === 1 ? 'log' : 'logs'} deleted.`);
    loadProfile();
    refreshWeightViews();
  }

  async function saveWeightGoal() {
    const targetWeightLbs = goalForm.target_weight ? unitToLbs(goalForm.target_weight, weightUnit) : null;
    const weeklyRateLbs = goalForm.weekly_rate ? rateUnitToLbs(goalForm.weekly_rate, weightUnit) : null;
    if (goalForm.target_weight && targetWeightLbs === null) {
      setError('Enter a valid target weight.');
      return;
    }
    if (goalForm.weekly_rate && weeklyRateLbs === null) {
      setError('Enter a valid weekly rate.');
      return;
    }
    setGoalSaving(true);
    setError('');
    setMessage('');
    const nextForm = {
      ...form,
      target_weight_lbs: targetWeightLbs === null ? '' : String(targetWeightLbs),
      custom_goal_lbs_per_week: weeklyRateLbs === null ? '' : String(weeklyRateLbs),
    };
    const response = await fitnessApi.saveProfile(nextForm);
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to save weight goal.');
      setGoalSaving(false);
      return;
    }
    applyProfile(response);
    setGoalOpen(false);
    setMessage('Weight goal updated.');
    setGoalSaving(false);
    refreshWeightViews();
  }

  const missing = useMemo(() => {
    if (!profile) return [];
    const all = new Set<string>();
    Object.values(profile.missing_fields || {}).forEach((fields) => fields.forEach((field) => all.add(field)));
    return Array.from(all);
  }, [profile]);

  const weightSummary = weightHistory?.summary || null;
  const totalWeightLogs = allWeightHistory?.entries.length ?? weightHistory?.entries.length ?? 0;
  const recentWeightEntries = (allWeightHistory?.entries || weightHistory?.entries || []).slice(0, 3);
  const historyEntries = historyWeightHistory?.entries || [];
  const goalDelta = signedWeightDelta(weightSummary?.target_delta_lbs, weightUnit);
  const targetWeightLabel = formatWeight(weightHistory?.goal?.target_weight_lbs ?? profile?.profile.target_weight_lbs, weightUnit);
  const weeklyRateLabel = signedWeightDelta(weightHistory?.goal?.weekly_rate_lbs ?? profile?.profile.custom_goal_lbs_per_week, weightUnit);
  const profileReady = missing.length === 0;
  const missingLabel = humanizeFields(missing);

  return (
    <PageTransition>
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Profile"
        right={
          <>
            <IconButton icon={ArrowLeft} onPress={() => router.back()} label="Back" />
            <IconButton icon={mode === 'dark' ? Sun : Moon} onPress={toggleMode} label="Toggle theme" />
            <IconButton icon={LogOut} onPress={logout} danger label="Sign out" />
          </>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <LoadingState label="Loading profile..." /> : null}
        <InlineError message={error} />
        {message ? <Card><AppText color={colors.success} style={{ fontWeight: '800' }}>{message}</AppText></Card> : null}

        {profile ? (
          <>
            {!profileReady ? (
              <View style={[styles.profileNudge, { backgroundColor: `${colors.accent}12`, borderColor: `${colors.accent}35` }]}>
                <View style={styles.nudgeContent}>
                  <AlertCircle size={19} color={colors.accent} />
                  <View style={styles.nudgeText}>
                    <AppText style={{ fontWeight: '800' }}>Complete your profile</AppText>
                    <AppText variant="caption" muted numberOfLines={2}>
                      Add {missingLabel} to unlock full BMI, BMR, TDEE, and calorie targets.
                    </AppText>
                  </View>
                </View>
                <PillButton onPress={openProfileEditor} style={styles.smallActionButton}>Complete</PillButton>
              </View>
            ) : null}

            <Card style={styles.weightCard}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardTitleBlock}>
                  <View style={styles.iconTitleRow}>
                    <Scale size={19} color={colors.primary} />
                    <AppText variant="subheading">Weight</AppText>
                  </View>
                  <AppText variant="caption" muted>
                    {weightSummary?.latest_date_label ? `Latest ${weightSummary.latest_date_label}` : 'No weigh-ins yet'}
                  </AppText>
                </View>
                <SegmentedControl<WeightUnit>
                  value={weightUnit}
                  options={[
                    { key: 'lb', label: 'lb' },
                    { key: 'kg', label: 'kg' },
                  ]}
                  onChange={changeWeightUnit}
                />
              </View>

              <View style={styles.weightHeroRow}>
                <CompactMetricTile
                  label="Current"
                  value={formatWeight(weightSummary?.latest_weight_lbs ?? profile.profile.weight_lbs, weightUnit)}
                  meta={weightSummary?.latest_bmi ? `BMI ${weightSummary.latest_bmi}` : 'Add height for BMI'}
                  style={styles.weightHeroMetric}
                  tone={bmiTone(weightSummary?.latest_bmi_zone)}
                />
                <CompactMetricTile
                  label="Goal Delta"
                  value={goalDelta}
                  meta={weightHistory?.goal?.estimated_goal_date_label ? `ETA ${weightHistory.goal.estimated_goal_date_label}` : 'Tap Goal to set'}
                  style={styles.weightHeroMetric}
                  tone="info"
                />
              </View>

              <View style={styles.weightControlRow}>
                <SegmentedControl<WeightRange>
                  value={weightRange}
                  options={[
                    { key: '1m', label: '1M' },
                    { key: '3m', label: '3M' },
                    { key: '6m', label: '6M' },
                    { key: 'ytd', label: 'YTD' },
                    { key: 'all', label: 'All' },
                  ]}
                  onChange={setWeightRange}
                />
              </View>

              {weightLoading ? (
                <LoadingState label="Loading weight..." />
              ) : (
                <WeightLineChart
                  points={weightHistory?.chart_points || []}
                  targetWeightLbs={weightHistory?.goal?.target_weight_lbs}
                  unit={weightUnit}
                  height={180}
                />
              )}

              <View style={styles.weightStatsGrid}>
                <CompactMetricTile label="Range" value={summaryDelta(weightSummary, 'range', weightUnit)} style={styles.weightStatCard} />
                <CompactMetricTile label="30 Day" value={summaryDelta(weightSummary, '30d', weightUnit)} style={styles.weightStatCard} />
                <CompactMetricTile label="Weekly Avg" value={summaryDelta(weightSummary, 'weekly', weightUnit)} style={styles.weightStatCard} />
              </View>

              <View style={styles.weightActionGrid}>
                <WeightActionTile
                  icon={Plus}
                  title="Log Weight"
                  subtitle="Add today or another weigh-in"
                  meta={weightSummary?.latest_date_label ? `Last ${weightSummary.latest_date_label}` : 'No logs yet'}
                  onPress={openWeightLogger}
                />
                <WeightActionTile
                  icon={Target}
                  title="Goal"
                  subtitle={targetWeightLabel === '--' ? 'Set target and pace' : `${targetWeightLabel} target`}
                  meta={weeklyRateLabel === '--' ? 'No weekly rate' : `${weeklyRateLabel}/wk`}
                  onPress={openGoalEditor}
                />
              </View>

              <View style={styles.weightHistoryList}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.cardTitleBlock}>
                    <AppText style={{ fontWeight: '800' }}>Recent Logs</AppText>
                    <AppText variant="caption" muted>
                      {allWeightLoading ? 'Loading logs...' : `Latest ${Math.min(3, recentWeightEntries.length)} of ${totalWeightLogs}`}
                    </AppText>
                  </View>
                  <PillButton tone="plain" onPress={openHistoryManager} style={styles.smallActionButton}>
                    View All
                  </PillButton>
                </View>
                {!recentWeightEntries.length && !allWeightLoading ? (
                  <InlineError message="Log your first weight to start the trend." />
                ) : null}
                {recentWeightEntries.map((entry) => (
                  <WeightEntryRow
                    key={entry.id}
                    entry={entry}
                    unit={weightUnit}
                    deleting={deletingWeightId === entry.id}
                    onEdit={() => beginEditWeight(entry)}
                    onDelete={() => confirmDeleteWeightEntry(entry)}
                  />
                ))}
              </View>
            </Card>

            <Card style={styles.healthCard}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardTitleBlock}>
                  <AppText variant="subheading">Health Metrics</AppText>
                  <AppText variant="caption" muted>
                    BMI, metabolism, and calorie targets from your profile details.
                  </AppText>
                </View>
                {!profileReady ? <PillButton tone="plain" onPress={openProfileEditor}>Complete</PillButton> : null}
              </View>

              <View style={styles.healthMetricGrid}>
                <CompactMetricTile label="BMI" value={profile.metrics.bmi ?? '--'} meta={profile.metrics.bmi_category || 'Add height and weight.'} tone={bmiTone(profile.metrics.bmi_zone)} style={styles.healthMetricTile} />
                <CompactMetricTile label="BMR" value={profile.metrics.bmr ? formatNumber(profile.metrics.bmr) : '--'} meta={profile.metrics.bmr ? 'calories/day at rest' : 'Needs formula inputs.'} style={styles.healthMetricTile} />
                <CompactMetricTile label="TDEE" value={profile.metrics.tdee ? formatNumber(profile.metrics.tdee) : '--'} meta={profile.metrics.activity_multiplier ? `Activity x ${profile.metrics.activity_multiplier}` : 'Set activity level.'} style={styles.healthMetricTile} />
              </View>

              <View style={styles.bmiBlock}>
                <View style={styles.cardTitleRow}>
                  <AppText style={{ fontWeight: '800' }}>BMI Range</AppText>
                  <AppText variant="caption" color={colors.primary} style={{ fontWeight: '800' }}>{profile.metrics.bmi_category || 'No BMI yet'}</AppText>
                </View>
                <View style={styles.bmiTrack}>
                  <View style={[styles.bmiSegment, { flex: 3.5, backgroundColor: `${colors.info}aa` }]} />
                  <View style={[styles.bmiSegment, { flex: 6.5, backgroundColor: `${colors.success}bb` }]} />
                  <View style={[styles.bmiSegment, { flex: 5, backgroundColor: `${colors.warning}cc` }]} />
                  <View style={[styles.bmiSegment, { flex: 10, backgroundColor: `${colors.accent}cc` }]} />
                  {profile.metrics.bmi_position_pct !== null ? (
                    <View style={[styles.bmiMarker, { left: `${profile.metrics.bmi_position_pct}%`, backgroundColor: colors.text, borderColor: colors.surface }]} />
                  ) : null}
                </View>
                <View style={styles.bmiAxis}>
                  {['15', '18.5', '25', '30', '40'].map((value) => (
                    <AppText key={value} variant="caption" muted>{value}</AppText>
                  ))}
                </View>
              </View>

              <View style={styles.calorieBlock}>
                <View>
                  <AppText style={{ fontWeight: '800' }}>Recommended Calories</AppText>
                  <AppText variant="caption" muted>Based on selected formula and activity level.</AppText>
                </View>
                <View style={styles.calorieGrid}>
                  {Object.entries(profile.metrics.recommended_calories || {}).map(([key, target]) => (
                    <CompactMetricTile
                      key={key}
                      label={target.label}
                      value={`${formatNumber(target.calories)} cal`}
                      meta={`${target.rate_lbs_per_week > 0 ? '+' : ''}${target.rate_lbs_per_week} lbs/week`}
                      style={styles.calorieTarget}
                    />
                  ))}
                  {!Object.keys(profile.metrics.recommended_calories || {}).length ? (
                    <InlineError message="Complete your profile to calculate calorie targets." />
                  ) : null}
                </View>
              </View>
            </Card>

            <Card style={styles.detailsCard}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardTitleBlock}>
                  <View style={styles.iconTitleRow}>
                    <UserRound size={18} color={colors.primary} />
                    <AppText variant="subheading">Account & Details</AppText>
                  </View>
                  <AppText variant="caption" muted numberOfLines={1}>
                    {profile.user.email || 'Manage profile inputs'}
                  </AppText>
                </View>
                <PillButton tone="plain" onPress={() => setDetailsOpen((open) => !open)}>
                  {detailsOpen ? 'Hide' : 'Details'}
                </PillButton>
              </View>

              <View style={[styles.profileStatusRow, { backgroundColor: profileReady ? `${colors.success}14` : `${colors.accent}12` }]}>
                {profileReady ? <CheckCircle2 size={18} color={colors.success} /> : <AlertCircle size={18} color={colors.accent} />}
                <View style={styles.profileStatusText}>
                  <AppText style={{ fontWeight: '800' }}>{profileReady ? 'Profile Ready' : 'Profile Needs Details'}</AppText>
                  <AppText variant="caption" muted numberOfLines={2}>
                    {profileReady ? 'Your health calculations have the inputs they need.' : `Missing ${missingLabel}.`}
                  </AppText>
                </View>
                <PillButton onPress={openProfileEditor} style={styles.smallActionButton}>
                  {profileReady ? 'Update' : 'Complete'}
                </PillButton>
              </View>

              {detailsOpen ? (
                <View style={styles.accountDetails}>
                  <View style={styles.accountRow}>
                    <AppText variant="caption" muted>Display Name</AppText>
                    <AppText style={styles.accountValue} numberOfLines={1}>{profile.user.display_name || '-'}</AppText>
                  </View>
                  <View style={styles.accountRow}>
                    <AppText variant="caption" muted>Email</AppText>
                    <AppText style={styles.accountValue} numberOfLines={1}>{profile.user.email || '-'}</AppText>
                  </View>
                </View>
              ) : null}
            </Card>

            <ModalSheet
              visible={logWeightOpen}
              onClose={() => setLogWeightOpen(false)}
              title="Log Weight"
              actionLabel={weightSaving && !editingWeightId ? 'Saving' : 'Save'}
              actionBusy={weightSaving && !editingWeightId}
              onAction={saveWeightEntry}>
              <View style={styles.modalStack}>
                <View style={[styles.modalIntroPanel, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={styles.iconTitleRow}>
                    <Scale size={18} color={colors.primary} />
                    <AppText style={{ fontWeight: '800' }}>New weigh-in</AppText>
                  </View>
                  <AppText variant="caption" muted>
                    The latest dated log becomes your current profile weight.
                  </AppText>
                </View>
                <View style={styles.twoCol}>
                  <DateField label="Date" value={weightForm.date} onChange={(value) => setWeightForm((current) => ({ ...current, date: value }))} maximumDate={new Date()} style={styles.formField} />
                  <TextField
                    label={`Weight (${weightUnit})`}
                    value={weightForm.weight}
                    onChangeText={(value) => setWeightForm((current) => ({ ...current, weight: value }))}
                    keyboardType="decimal-pad"
                    placeholder={weightUnit === 'kg' ? '82.0' : '180.0'}
                    style={styles.formField}
                  />
                </View>
                <TextField
                  label="Note"
                  value={weightForm.note}
                  onChangeText={(value) => setWeightForm((current) => ({ ...current, note: value }))}
                  placeholder="Optional context, like morning weigh-in"
                />
              </View>
            </ModalSheet>

            <ModalSheet
              visible={goalOpen}
              onClose={() => setGoalOpen(false)}
              title="Weight Goal"
              actionLabel={goalSaving ? 'Saving' : 'Save'}
              actionBusy={goalSaving}
              onAction={saveWeightGoal}>
              <View style={styles.modalStack}>
                <View style={[styles.modalIntroPanel, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={styles.iconTitleRow}>
                    <Target size={18} color={colors.primary} />
                    <AppText style={{ fontWeight: '800' }}>Target and pace</AppText>
                  </View>
                  <AppText variant="caption" muted>
                    Use a negative weekly rate for loss and positive for gain.
                  </AppText>
                </View>
                <View style={styles.twoCol}>
                  <TextField
                    label={`Target (${weightUnit})`}
                    value={goalForm.target_weight}
                    onChangeText={(value) => setGoalForm((current) => ({ ...current, target_weight: value }))}
                    keyboardType="decimal-pad"
                    placeholder={weightUnit === 'kg' ? '75.0' : '165.0'}
                    style={styles.formField}
                  />
                  <TextField
                    label={`Weekly Rate (${weightUnit}/wk)`}
                    value={goalForm.weekly_rate}
                    onChangeText={(value) => setGoalForm((current) => ({ ...current, weekly_rate: value }))}
                    keyboardType="decimal-pad"
                    placeholder={weightUnit === 'kg' ? '-0.45' : '-1.0'}
                    style={styles.formField}
                  />
                </View>
              </View>
            </ModalSheet>

            <ModalSheet
              visible={historyOpen}
              onClose={() => setHistoryOpen(false)}
              title="Weight History">
              <View style={styles.modalStack}>
                <View style={[styles.historySummaryPanel, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={styles.cardTitleRow}>
                    <View style={styles.cardTitleBlock}>
                      <View style={styles.iconTitleRow}>
                        <CalendarRange size={18} color={colors.primary} />
                        <AppText style={{ fontWeight: '800' }}>All Logs</AppText>
                      </View>
                      <AppText variant="caption" muted>
                        {historyWeightHistory?.range.key === 'custom'
                          ? `${historyWeightHistory.range.start_date || 'Start'} to ${historyWeightHistory.range.end_date || 'Today'}`
                          : 'Filter by preset or custom dates'}
                      </AppText>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <AppText variant="caption" style={{ fontWeight: '800' }}>{historyEntries.length}</AppText>
                    </View>
                  </View>
                </View>

                <SelectorGroup
                  label="Date Range"
                  value={historyRange}
                  options={[
                    { key: 'all', label: 'All' },
                    { key: '1m', label: '1M' },
                    { key: '3m', label: '3M' },
                    { key: '6m', label: '6M' },
                    { key: 'ytd', label: 'YTD' },
                    { key: 'custom', label: 'Custom' },
                  ]}
                  onChange={(value) => changeHistoryRange(value as WeightHistoryRange)}
                />

                {historyRange === 'custom' ? (
                  <View style={styles.twoCol}>
                    <DateField label="Start" value={historyStartDate} onChange={setHistoryStartDate} maximumDate={new Date()} style={styles.formField} />
                    <DateField label="End" value={historyEndDate} onChange={setHistoryEndDate} maximumDate={new Date()} style={styles.formField} />
                  </View>
                ) : null}

                <InlineError message={historyError} />

                <View style={styles.historyToolbar}>
                  <View style={styles.iconTitleRow}>
                    <ListFilter size={16} color={colors.muted} />
                    <AppText variant="caption" muted>
                      {historyLoading ? 'Loading filtered logs...' : `${historyEntries.length} shown`}
                    </AppText>
                  </View>
                  <PillButton
                    tone="danger"
                    onPress={confirmDeleteFilteredWeightEntries}
                    disabled={!historyEntries.length || deletingFiltered}
                    style={styles.smallActionButton}>
                    {deletingFiltered ? 'Deleting...' : 'Delete Filtered'}
                  </PillButton>
                </View>

                {historyLoading ? <LoadingState label="Loading logs..." /> : null}
                {!historyLoading && !historyEntries.length ? (
                  <InlineError message="No weight logs in this range." />
                ) : null}
                {!historyLoading ? (
                  <View style={styles.weightHistoryList}>
                    {historyEntries.map((entry) => (
                      <WeightEntryRow
                        key={entry.id}
                        entry={entry}
                        unit={weightUnit}
                        deleting={deletingWeightId === entry.id}
                        onEdit={() => beginEditWeight(entry)}
                        onDelete={() => confirmDeleteWeightEntry(entry)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </ModalSheet>

            <ModalSheet
              visible={Boolean(editingWeightId)}
              onClose={() => setEditingWeightId(null)}
              title="Edit Weight"
              actionLabel={weightSaving ? 'Saving' : 'Save'}
              actionBusy={weightSaving}
              onAction={saveEditedWeight}>
              <View style={styles.modalStack}>
                <View style={styles.twoCol}>
                  <DateField label="Date" value={editWeightForm.date} onChange={(value) => setEditWeightForm((current) => ({ ...current, date: value }))} maximumDate={new Date()} style={styles.formField} />
                  <TextField
                    label={`Weight (${weightUnit})`}
                    value={editWeightForm.weight}
                    onChangeText={(value) => setEditWeightForm((current) => ({ ...current, weight: value }))}
                    keyboardType="decimal-pad"
                    style={styles.formField}
                  />
                </View>
                <TextField label="Note" value={editWeightForm.note} onChangeText={(value) => setEditWeightForm((current) => ({ ...current, note: value }))} placeholder="Optional" />
              </View>
            </ModalSheet>

            <ModalSheet
              visible={editorOpen}
              onClose={() => setEditorOpen(false)}
              title="Profile Details"
              actionLabel="Save"
              actionBusy={saving}
              onAction={saveProfile}>
              <View style={styles.editor}>
                <View>
                  <AppText variant="subheading">Health Inputs</AppText>
                  <AppText variant="caption" muted>These fields power BMI, BMR, TDEE, and calorie recommendations.</AppText>
                </View>
                <View style={styles.twoCol}>
                  <TextField label="First Name" value={form.first_name} onChangeText={(value) => setField('first_name', value)} style={styles.formField} />
                  <TextField label="Last Name" value={form.last_name} onChangeText={(value) => setField('last_name', value)} style={styles.formField} />
                </View>
                <View style={styles.twoCol}>
                  <DateField label="Date of Birth" value={form.date_of_birth} onChange={(value) => setField('date_of_birth', value)} placeholder="Birth date" style={styles.formField} maximumDate={new Date()} />
                  <View style={styles.formField}>
                    <SelectorGroup
                      label="Sex for BMR"
                      value={form.sex_for_bmr}
                      options={[
                        { key: 'male', label: 'Male' },
                        { key: 'female', label: 'Female' },
                      ]}
                      onChange={(value) => setField('sex_for_bmr', value)}
                    />
                  </View>
                </View>
                <View style={styles.twoCol}>
                  <TextField label="Height Feet" value={form.height_feet} onChangeText={(value) => setField('height_feet', value)} keyboardType="number-pad" placeholder="5" style={styles.formField} />
                  <TextField label="Height Inches" value={form.height_inches} onChangeText={(value) => setField('height_inches', value)} keyboardType="number-pad" placeholder="10" style={styles.formField} />
                </View>
                <TextField label="Weight" value={form.weight_lbs} onChangeText={(value) => setField('weight_lbs', value)} keyboardType="decimal-pad" placeholder="180.0 lbs" />
                <SelectorGroup
                  label="Activity Level"
                  value={form.activity_level}
                  options={profile.activity_level_options.map((option) => ({ key: option.key, label: option.label }))}
                  onChange={(value) => setField('activity_level', value)}
                />
                <SelectorGroup
                  label="BMR Formula"
                  value={form.bmr_formula}
                  options={profile.bmr_formula_options.map((option) => ({ key: option.key, label: option.label.replace(' Formula', '').replace(' Equation', '') }))}
                  onChange={(value) => setField('bmr_formula', value)}
                />
                {form.bmr_formula === 'katch_mcardle' ? (
                  <TextField label="Body-Fat Percentage" value={form.body_fat_percent} onChangeText={(value) => setField('body_fat_percent', value)} keyboardType="decimal-pad" placeholder="18.0%" />
                ) : null}
                <TextField label="Custom Weekly Goal" value={form.custom_goal_lbs_per_week} onChangeText={(value) => setField('custom_goal_lbs_per_week', value)} keyboardType="decimal-pad" placeholder="0.0 lbs/wk" />
                <PillButton onPress={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</PillButton>
              </View>
            </ModalSheet>
          </>
        ) : null}
      </ScrollView>
      </SafeAreaView>
    </PageTransition>
  );
}

function SelectorGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="caption" muted>{label}</AppText>
      <View style={styles.selectorWrap}>
        {options.map((option) => (
          <PillButton key={option.key} tone="plain" active={value === option.key} onPress={() => onChange(option.key)}>
            {option.label}
          </PillButton>
        ))}
      </View>
    </View>
  );
}

function WeightActionTile({
  icon: Icon,
  title,
  subtitle,
  meta,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  meta: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.weightActionTile,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        pressed && { backgroundColor: colors.surfacePressed },
      ]}>
      <View style={[styles.weightActionIcon, { backgroundColor: `${colors.primary}14` }]}>
        <Icon size={18} color={colors.primary} />
      </View>
      <View style={styles.weightActionCopy}>
        <AppText style={{ fontWeight: '800' }}>{title}</AppText>
        <AppText variant="caption" muted numberOfLines={1}>{subtitle}</AppText>
        <AppText variant="caption" color={colors.primary} style={{ fontWeight: '800' }} numberOfLines={1}>{meta}</AppText>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

function WeightEntryRow({
  entry,
  unit,
  deleting,
  onEdit,
  onDelete,
}: {
  entry: WeightEntry;
  unit: WeightUnit;
  deleting?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.weightEntryRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
      <View style={styles.weightEntryMain}>
        <View style={styles.weightEntryValueBlock}>
          <AppText style={{ fontWeight: '800' }}>{formatWeight(entry.weight_lbs, unit)}</AppText>
          <AppText variant="caption" muted>{entry.date_label}</AppText>
        </View>
        <View style={styles.weightEntryActions}>
          <IconButton icon={Edit3} onPress={onEdit} label="Edit weight" />
          <IconButton icon={Trash2} onPress={onDelete} danger label={deleting ? 'Deleting weight' : 'Delete weight'} />
        </View>
      </View>
      {entry.note ? (
        <AppText variant="caption" muted numberOfLines={2}>{entry.note}</AppText>
      ) : null}
    </View>
  );
}

function CompactMetricTile({
  label,
  value,
  meta,
  tone = 'default',
  style,
}: {
  label: string;
  value: string | number;
  meta?: string;
  tone?: 'default' | 'success' | 'warning' | 'accent' | 'info';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const toneColor = tone !== 'default' ? colors[tone] : colors.text;
  return (
    <View style={[styles.compactMetricTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="metric" color={toneColor}>{value}</AppText>
      {meta ? <AppText variant="caption" muted numberOfLines={2}>{meta}</AppText> : null}
    </View>
  );
}

function fromProfile(payload: ProfilePayload): ProfileForm {
  const profile = payload.profile;
  return {
    first_name: payload.user.first_name || '',
    last_name: payload.user.last_name || '',
    date_of_birth: profile.date_of_birth || '',
    sex_for_bmr: profile.sex_for_bmr || '',
    height_feet: profile.height_feet === null ? '' : String(profile.height_feet),
    height_inches: profile.height_inches === null ? '' : String(profile.height_inches),
    weight_lbs: profile.weight_lbs === null ? '' : String(profile.weight_lbs),
    target_weight_lbs: profile.target_weight_lbs === null ? '' : String(profile.target_weight_lbs),
    activity_level: profile.activity_level || 'sedentary',
    bmr_formula: profile.bmr_formula || 'katch_mcardle',
    body_fat_percent: profile.body_fat_percent === null ? '' : String(profile.body_fat_percent),
    custom_goal_lbs_per_week: profile.custom_goal_lbs_per_week === null ? '' : String(profile.custom_goal_lbs_per_week),
  };
}

function goalFromProfile(payload: ProfilePayload, unit: WeightUnit) {
  return {
    target_weight: formatWeightInput(payload.profile.target_weight_lbs, unit),
    weekly_rate: formatRateInput(payload.profile.custom_goal_lbs_per_week, unit),
  };
}

function humanizeFields(fields: string[]) {
  return fields.map((field) => field.replaceAll('_', ' ')).join(', ');
}

function bmiTone(zone: string | null | undefined): 'default' | 'success' | 'warning' | 'accent' | 'info' {
  if (zone === 'healthy') return 'success';
  if (zone === 'overweight') return 'warning';
  if (zone === 'obese') return 'accent';
  if (zone === 'underweight') return 'info';
  return 'default';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: 110,
    gap: spacing.lg,
  },
  profileNudge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  nudgeContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nudgeText: {
    flex: 1,
    minWidth: 0,
  },
  editor: {
    gap: spacing.lg,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weightCard: {
    gap: spacing.lg,
  },
  weightHeroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  weightHeroMetric: {
    flexGrow: 1,
    flexBasis: 140,
  },
  compactMetricTile: {
    minWidth: 110,
    minHeight: 84,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 3,
  },
  weightControlRow: {
    alignItems: 'flex-start',
  },
  weightStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  weightStatCard: {
    flexGrow: 1,
    flexBasis: 96,
  },
  weightActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  weightActionTile: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 92,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weightActionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightActionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  smallActionButton: {
    minHeight: 30,
    paddingHorizontal: 12,
  },
  weightHistoryList: {
    gap: spacing.md,
  },
  weightEntryRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  weightEntryMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  weightEntryValueBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  weightEntryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  modalStack: {
    gap: spacing.md,
  },
  modalIntroPanel: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  historySummaryPanel: {
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  countBadge: {
    minWidth: 34,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  historyToolbar: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  twoCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  formField: {
    flexGrow: 1,
    flexBasis: 140,
  },
  selectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  healthCard: {
    gap: spacing.lg,
  },
  healthMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  healthMetricTile: {
    flexGrow: 1,
    flexBasis: 96,
  },
  bmiBlock: {
    gap: spacing.md,
  },
  bmiTrack: {
    position: 'relative',
    flexDirection: 'row',
    gap: 3,
    height: 14,
    overflow: 'visible',
  },
  bmiSegment: {
    borderRadius: radius.pill,
  },
  bmiMarker: {
    position: 'absolute',
    top: -6,
    width: 10,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 2,
    transform: [{ translateX: -5 }],
  },
  bmiAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calorieBlock: {
    gap: spacing.md,
  },
  calorieGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  calorieTarget: {
    flexGrow: 1,
    flexBasis: 132,
  },
  detailsCard: {
    gap: spacing.md,
  },
  profileStatusRow: {
    minHeight: 64,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileStatusText: {
    flex: 1,
    minWidth: 0,
  },
  accountDetails: {
    gap: spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  accountValue: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    fontWeight: '700',
  },
});
