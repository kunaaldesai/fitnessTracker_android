import { router, useFocusEffect } from 'expo-router';
import { Moon, RefreshCw, Sun, User } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityHeatmap, MuscleSplitBars, VolumeLineChart } from '@/components/fittrack/Charts';
import { PageTransition } from '@/components/fittrack/PageTransition';
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
  PillButton,
  SegmentedControl,
} from '@/components/fittrack/ui';
import { spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { waitForFreshFitnessData } from '@/services/fitnessDataFreshness';
import { fitnessApi } from '@/services/fitnessApi';
import type { AnalyticsPayload, WorkoutCalendarPayload } from '@/types/fitness';
import { formatNumber } from '@/utils/fitnessMath';

const RANGE_OPTIONS = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all', label: 'All' },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]['key'];

export default function AnalyticsScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const [range, setRange] = useState<RangeKey>('3m');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [volumeCategory, setVolumeCategory] = useState('all');
  const [splitMetric, setSplitMetric] = useState('total_sets');
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [calendar, setCalendar] = useState<WorkoutCalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const analyticsRequestId = useRef(0);
  const customDateFiltersApplied = useRef(false);
  const focusRefreshAfterInitialLoad = useRef(false);
  const loadAnalyticsRef = useRef(loadAnalytics);

  useEffect(() => {
    customDateFiltersApplied.current = false;
    loadAnalytics();
    // Custom date fields should only reload after the Apply action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, volumeCategory, splitMetric]);

  useEffect(() => {
    loadAnalyticsRef.current = loadAnalytics;
  });

  useFocusEffect(
    useCallback(() => {
      if (!focusRefreshAfterInitialLoad.current) {
        focusRefreshAfterInitialLoad.current = true;
        return undefined;
      }
      loadAnalyticsRef.current(customDateFiltersApplied.current);
      return undefined;
    }, []),
  );

  async function loadAnalytics(customDates = false, waitForWorkoutWrites = true) {
    const requestId = analyticsRequestId.current + 1;
    analyticsRequestId.current = requestId;
    customDateFiltersApplied.current = customDates;
    setLoading(true);
    setError('');
    if (waitForWorkoutWrites) {
      await waitForFreshFitnessData();
      if (requestId !== analyticsRequestId.current) return;
    }
    const params = {
      range: customDates && (startDate || endDate) ? 'custom' : range,
      start_date: customDates ? startDate : undefined,
      end_date: customDates ? endDate : undefined,
      volume_category: volumeCategory,
      split_metric: splitMetric,
    };
    const [analyticsResponse, calendarResponse] = await Promise.all([
      fitnessApi.getAnalytics(params),
      fitnessApi.getWorkoutCalendar(params),
    ]);
    if (requestId !== analyticsRequestId.current) return;
    if (analyticsResponse.status !== 'ok') {
      setError(analyticsResponse.error || 'Unable to load analytics.');
      setLoading(false);
      return;
    }
    setAnalytics(analyticsResponse);
    if (calendarResponse.status === 'ok') {
      setCalendar(calendarResponse);
    }
    setLoading(false);
  }

  const splitRows = useMemo(() => {
    if (!analytics) return [];
    return analytics.muscle_split_by_metric?.[splitMetric] || analytics.muscle_split || [];
  }, [analytics, splitMetric]);

  return (
    <PageTransition tabOrder={1}>
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
        <Header
          title="Analytics"
          right={
            <>
              <IconButton icon={RefreshCw} onPress={() => loadAnalytics(customDateFiltersApplied.current)} label="Refresh" />
              <IconButton icon={User} onPress={() => router.push('/profile')} label="Profile" />
              <IconButton icon={mode === 'dark' ? Sun : Moon} onPress={toggleMode} label="Toggle theme" />
            </>
          }
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <AppText variant="title">Overview</AppText>
            <SegmentedControl value={range} options={[...RANGE_OPTIONS]} onChange={setRange} />
          </View>

          <View style={styles.dateFilters}>
            <DateField label="Start" value={startDate} onChange={setStartDate} placeholder="Any" style={styles.dateInput} />
            <DateField label="End" value={endDate} onChange={setEndDate} placeholder="Any" style={styles.dateInput} />
            <PillButton onPress={() => loadAnalytics(true)} style={styles.applyButton}>Apply</PillButton>
          </View>

          <InlineError message={error} />

          {loading ? <LoadingState label="Loading analytics..." /> : null}
          {!loading && !analytics ? <EmptyState title="No analytics" body="Log workouts to unlock analytics." /> : null}

          {analytics ? (
            <>
              <View style={styles.metricGrid}>
                <View style={styles.metricGridRow}>
                  <MetricCard label="Total Volume" value={formatNumber(analytics.summary.total_volume)} suffix="lbs" style={styles.dashboardMetricCard} />
                  <MetricCard label="Sets" value={analytics.summary.sets_completed} style={styles.dashboardMetricCard} />
                </View>
                <View style={styles.metricGridRow}>
                  <MetricCard label="Exercises" value={analytics.summary.exercise_count} style={styles.dashboardMetricCard} />
                  <MetricCard label="Days" value={analytics.summary.workout_days} style={styles.dashboardMetricCard} />
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <AppText variant="label" muted>Personal Records</AppText>
                <PillButton tone="plain" onPress={() => router.push('/(tabs)/records')}>View All</PillButton>
              </View>
              <View style={styles.prGrid}>
                {analytics.personal_records.slice(0, 3).map((record) => (
                  <Card key={record.exercise_name} style={styles.prCard}>
                    <AppText style={{ fontWeight: '800' }} numberOfLines={1}>{record.exercise_name}</AppText>
                    <AppText variant="caption" muted>{record.category}</AppText>
                    <AppText variant="metric">{formatNumber(record.max_one_rm)}</AppText>
                    <AppText variant="caption" muted>estimated 1RM</AppText>
                  </Card>
                ))}
                {!analytics.personal_records.length ? <EmptyState title="No PRs yet" body="PR cards appear after completed sets." /> : null}
              </View>

              <Card style={styles.chartCard}>
                <View style={styles.cardTitleRow}>
                  <View>
                    <AppText variant="subheading">Volume Progression</AppText>
                    <AppText variant="caption" muted>Total lifted by day</AppText>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {analytics.volume_category_options.map((option) => (
                    <PillButton key={option.key} tone="plain" active={volumeCategory === option.key} onPress={() => setVolumeCategory(option.key)}>
                      {option.label}
                    </PillButton>
                  ))}
                </ScrollView>
                <VolumeLineChart points={analytics.volume_progression} />
              </Card>

              <Card style={styles.chartCard}>
                <View style={styles.cardTitleRow}>
                  <AppText variant="subheading">Muscle Split</AppText>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {analytics.muscle_split_metrics.map((option) => (
                    <PillButton key={option.key} tone="plain" active={splitMetric === option.key} onPress={() => setSplitMetric(option.key)}>
                      {option.label}
                    </PillButton>
                  ))}
                </ScrollView>
                <MuscleSplitBars rows={splitRows} />
              </Card>

              <Card style={styles.chartCard}>
                <View style={styles.cardTitleRow}>
                  <View>
                    <AppText variant="subheading">Activity</AppText>
                    <AppText variant="caption" muted>{calendar?.total_workout_days || 0} workout days</AppText>
                  </View>
                </View>
                <ActivityHeatmap calendar={calendar} />
              </Card>

              <Card style={styles.recentCard}>
                <AppText variant="subheading">Recent Activity</AppText>
                {analytics.recent_activity.slice(0, 10).map((row) => (
                  <View key={`${row.exercise_id}-${row.date}`} style={[styles.activityRow, { borderTopColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontWeight: '800' }}>{row.exercise_name}</AppText>
                      <AppText variant="caption" muted>{row.date_label} | {row.sets_completed} sets | {row.best_set_label}</AppText>
                    </View>
                    <AppText variant="caption" color={colors.primary} style={{ fontWeight: '800' }}>
                      {formatNumber(row.volume)} lbs
                    </AppText>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  topRow: {
    gap: spacing.md,
  },
  dateFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  dateInput: {
    flexGrow: 1,
    flexBasis: 132,
  },
  applyButton: {
    minHeight: 42,
    minWidth: 86,
  },
  metricGrid: {
    gap: spacing.md,
  },
  metricGridRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dashboardMetricCard: {
    flex: 1,
    minWidth: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prGrid: {
    gap: spacing.md,
  },
  prCard: {
    gap: 3,
  },
  chartCard: {
    gap: spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  recentCard: {
    gap: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
});
