import { router } from 'expo-router';
import { ArrowLeft, LogOut, Moon, Save, Sun } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppText,
  Card,
  Header,
  IconButton,
  InlineError,
  LoadingState,
  MetricCard,
  PillButton,
  TextField,
} from '@/components/fittrack/ui';
import { radius, spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/context/AuthContext';
import { fitnessApi } from '@/services/fitnessApi';
import type { ProfilePayload } from '@/types/fitness';
import { formatNumber } from '@/utils/fitnessMath';

type ProfileForm = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex_for_bmr: string;
  height_feet: string;
  height_inches: string;
  weight_lbs: string;
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
  activity_level: 'sedentary',
  bmr_formula: 'katch_mcardle',
  body_fat_percent: '',
  custom_goal_lbs_per_week: '',
};

export default function ProfileScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError('');
    const response = await fitnessApi.getProfile();
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to load profile.');
      setLoading(false);
      return;
    }
    setProfile(response);
    setForm(fromProfile(response));
    setLoading(false);
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
    setProfile(response);
    setForm(fromProfile(response));
    setEditorOpen(false);
    setMessage('Profile updated.');
    setSaving(false);
  }

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const missing = useMemo(() => {
    if (!profile) return [];
    const all = new Set<string>();
    Object.values(profile.missing_fields || {}).forEach((fields) => fields.forEach((field) => all.add(field)));
    return Array.from(all);
  }, [profile]);

  return (
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
            <View style={styles.identityGrid}>
              <MetricCard label="Display Name" value={profile.user.display_name || '-'} />
              <MetricCard label="Email" value={profile.user.email || '-'} />
            </View>

            <Card style={styles.summaryCard}>
              <View style={[styles.statusBadge, { backgroundColor: missing.length ? `${colors.accent}18` : `${colors.success}18` }]}>
                <View style={[styles.statusDot, { backgroundColor: missing.length ? colors.accent : colors.success }]} />
                <AppText variant="caption" color={missing.length ? colors.accent : colors.success} style={{ fontWeight: '800' }}>
                  {missing.length ? 'Profile Incomplete' : 'Profile Ready'}
                </AppText>
              </View>
              <AppText variant="subheading">Health Summary</AppText>
              <AppText muted>
                {missing.length
                  ? `Add ${humanizeFields(missing)} to unlock your full BMI, BMR, TDEE, and calorie targets.`
                  : 'Everything needed for BMI, BMR, TDEE, and calorie recommendations is saved.'}
              </AppText>
              <PillButton onPress={() => setEditorOpen((open) => !open)} style={{ alignSelf: 'flex-start' }}>
                {editorOpen ? 'Hide Editor' : 'Update Profile'}
              </PillButton>
            </Card>

            {editorOpen ? (
              <Card style={styles.editor}>
                <View style={styles.cardTitleRow}>
                  <View>
                    <AppText variant="subheading">Profile Settings</AppText>
                    <AppText variant="caption" muted>Keep metrics current for calorie recommendations.</AppText>
                  </View>
                  <IconButton icon={Save} onPress={saveProfile} active label="Save profile" />
                </View>

                <View style={styles.twoCol}>
                  <TextField label="First Name" value={form.first_name} onChangeText={(value) => setField('first_name', value)} />
                  <TextField label="Last Name" value={form.last_name} onChangeText={(value) => setField('last_name', value)} />
                </View>
                <View style={styles.twoCol}>
                  <TextField label="Date of Birth" value={form.date_of_birth} onChangeText={(value) => setField('date_of_birth', value)} placeholder="YYYY-MM-DD" />
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
                <View style={styles.twoCol}>
                  <TextField label="Height Feet" value={form.height_feet} onChangeText={(value) => setField('height_feet', value)} keyboardType="number-pad" placeholder="5" />
                  <TextField label="Height Inches" value={form.height_inches} onChangeText={(value) => setField('height_inches', value)} keyboardType="number-pad" placeholder="10" />
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
              </Card>
            ) : null}

            <View style={styles.metricGrid}>
              <MetricCard label="BMI" value={profile.metrics.bmi ?? '--'} meta={profile.metrics.bmi_category || 'Add height and weight.'} tone={bmiTone(profile.metrics.bmi_zone)} />
              <MetricCard label="BMR" value={profile.metrics.bmr ? formatNumber(profile.metrics.bmr) : '--'} meta={profile.metrics.bmr ? 'calories/day at rest' : 'Needs formula inputs.'} />
              <MetricCard label="TDEE" value={profile.metrics.tdee ? formatNumber(profile.metrics.tdee) : '--'} meta={profile.metrics.activity_multiplier ? `Activity x ${profile.metrics.activity_multiplier}` : 'Set activity level.'} />
            </View>

            <Card style={styles.bmiCard}>
              <View style={styles.cardTitleRow}>
                <View>
                  <AppText variant="subheading">BMI Range</AppText>
                  <AppText variant="caption" muted>Your marker updates after saving.</AppText>
                </View>
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
            </Card>

            <Card style={styles.calorieCard}>
              <AppText variant="subheading">Recommended Calories</AppText>
              <AppText variant="caption" muted>Based on selected formula and activity level.</AppText>
              <View style={styles.calorieGrid}>
                {Object.entries(profile.metrics.recommended_calories || {}).map(([key, target]) => (
                  <Card key={key} style={[styles.calorieTarget, { backgroundColor: colors.surfaceAlt }]}>
                    <AppText variant="label">{target.label}</AppText>
                    <AppText variant="heading">{formatNumber(target.calories)} cal</AppText>
                    <AppText variant="caption" muted>{target.rate_lbs_per_week > 0 ? '+' : ''}{target.rate_lbs_per_week} lbs/week</AppText>
                  </Card>
                ))}
                {!Object.keys(profile.metrics.recommended_calories || {}).length ? (
                  <InlineError message="Complete your profile to calculate calorie targets." />
                ) : null}
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
  options: Array<{ key: string; label: string }>;
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
    activity_level: profile.activity_level || 'sedentary',
    bmr_formula: profile.bmr_formula || 'katch_mcardle',
    body_fat_percent: profile.body_fat_percent === null ? '' : String(profile.body_fat_percent),
    custom_goal_lbs_per_week: profile.custom_goal_lbs_per_week === null ? '' : String(profile.custom_goal_lbs_per_week),
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
  identityGrid: {
    gap: spacing.md,
  },
  summaryCard: {
    gap: spacing.md,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
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
  twoCol: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  selectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  bmiCard: {
    gap: spacing.lg,
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
  calorieCard: {
    gap: spacing.sm,
  },
  calorieGrid: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  calorieTarget: {
    gap: 3,
    shadowOpacity: 0,
    elevation: 0,
  },
});
