import { router } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  LogOut,
  Plus,
  Scale,
  Sun,
  Moon,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [weightForm, setWeightForm] = useState<WeightEntryForm>(() => emptyWeightForm());
  const [editWeightForm, setEditWeightForm] = useState<WeightEntryForm>(() => emptyWeightForm());
  const [goalForm, setGoalForm] = useState({ target_weight: '', weekly_rate: '' });
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lb');
  const [weightRange, setWeightRange] = useState<WeightRange>('3m');
  const [loading, setLoading] = useState(true);
  const [weightLoading, setWeightLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [deletingWeightId, setDeletingWeightId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  useEffect(() => {
    const timer = setTimeout(loadProfile, 0);
    return () => clearTimeout(timer);
  }, [loadProfile]);

  useEffect(() => {
    const timer = setTimeout(loadWeightHistory, 0);
    return () => clearTimeout(timer);
  }, [loadWeightHistory]);

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
    loadWeightHistory();
  }

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openProfileEditor() {
    setDetailsOpen(true);
    setEditorOpen(true);
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
    setWeightHistory(response.weight_history);
    setWeightForm(emptyWeightForm());
    setMessage('Weight logged.');
    setWeightSaving(false);
    loadProfile();
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
    setWeightHistory(response.weight_history);
    setEditingWeightId(null);
    setMessage('Weight updated.');
    setWeightSaving(false);
    loadProfile();
  }

  async function deleteWeightEntry(entryId: string) {
    setDeletingWeightId(entryId);
    setError('');
    setMessage('');
    const response = await fitnessApi.deleteWeightEntry(entryId);
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to delete weight.');
      setDeletingWeightId(null);
      return;
    }
    setWeightHistory(response.weight_history);
    if (editingWeightId === entryId) setEditingWeightId(null);
    setMessage('Weight deleted.');
    setDeletingWeightId(null);
    loadProfile();
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
    setMessage('Weight goal updated.');
    setGoalSaving(false);
    loadWeightHistory();
  }

  const missing = useMemo(() => {
    if (!profile) return [];
    const all = new Set<string>();
    Object.values(profile.missing_fields || {}).forEach((fields) => fields.forEach((field) => all.add(field)));
    return Array.from(all);
  }, [profile]);

  const weightSummary = weightHistory?.summary || null;
  const recentWeightEntries = weightHistory?.entries.slice(0, 5) || [];
  const goalDelta = signedWeightDelta(weightSummary?.target_delta_lbs, weightUnit);
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
                  meta={weightHistory?.goal?.estimated_goal_date_label ? `ETA ${weightHistory.goal.estimated_goal_date_label}` : 'Set goal below'}
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

              <View style={[styles.weightPanel, { backgroundColor: colors.surfaceAlt }]}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.iconTitleRow}>
                    <Plus size={16} color={colors.primary} />
                    <AppText style={{ fontWeight: '800' }}>Log Weight</AppText>
                  </View>
                  <PillButton onPress={saveWeightEntry} disabled={weightSaving} style={styles.smallActionButton}>
                    {weightSaving && !editingWeightId ? 'Saving...' : 'Save'}
                  </PillButton>
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
                  placeholder="Optional"
                />
              </View>

              <View style={[styles.weightPanel, { backgroundColor: colors.surfaceAlt }]}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.iconTitleRow}>
                    <Target size={16} color={colors.primary} />
                    <AppText style={{ fontWeight: '800' }}>Goal</AppText>
                  </View>
                  <PillButton onPress={saveWeightGoal} disabled={goalSaving} style={styles.smallActionButton}>
                    {goalSaving ? 'Saving...' : 'Save'}
                  </PillButton>
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

              <View style={styles.weightHistoryList}>
                <View style={styles.cardTitleRow}>
                  <AppText style={{ fontWeight: '800' }}>Recent Weigh-ins</AppText>
                  <AppText variant="caption" muted>{weightHistory?.entries.length || 0} total</AppText>
                </View>
                {!recentWeightEntries.length ? (
                  <InlineError message="Log your first weight to start the trend." />
                ) : null}
                {recentWeightEntries.map((entry) => {
                  const editing = editingWeightId === entry.id;
                  return (
                    <View key={entry.id} style={[styles.weightEntryRow, { borderColor: colors.border }]}>
                      <View style={styles.weightEntryHeader}>
                        <View>
                          <AppText style={{ fontWeight: '800' }}>{formatWeight(entry.weight_lbs, weightUnit)}</AppText>
                          <AppText variant="caption" muted>{entry.date_label}{entry.note ? ` | ${entry.note}` : ''}</AppText>
                        </View>
                        <View style={styles.weightEntryActions}>
                          <IconButton icon={editing ? X : Edit3} onPress={() => editing ? setEditingWeightId(null) : beginEditWeight(entry)} label={editing ? 'Cancel edit' : 'Edit weight'} />
                          <IconButton icon={Trash2} onPress={() => deleteWeightEntry(entry.id)} danger label="Delete weight" />
                        </View>
                      </View>
                      {editing ? (
                        <View style={styles.weightEditPanel}>
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
                          <PillButton onPress={saveEditedWeight} disabled={weightSaving || deletingWeightId === entry.id}>
                            {weightSaving ? 'Saving...' : 'Save Changes'}
                          </PillButton>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
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
  weightPanel: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
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
  weightEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  weightEntryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  weightEditPanel: {
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
