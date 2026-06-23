import { router, useFocusEffect } from 'expo-router';
import { Moon, Search, Sun, User } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VolumeLineChart } from '@/components/fittrack/Charts';
import { PageTransition } from '@/components/fittrack/PageTransition';
import {
  AppText,
  Card,
  DateField,
  EmptyState,
  FloatingRefreshStatus,
  Header,
  IconButton,
  InlineError,
  LoadingState,
  MetricCard,
  ModalSheet,
  PillButton,
  TextField,
} from '@/components/fittrack/ui';
import { spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import { waitForFreshFitnessData } from '@/services/fitnessDataFreshness';
import { fitnessApi } from '@/services/fitnessApi';
import type { ExerciseHistoryPayload, PersonalRecord, RecordsPayload } from '@/types/fitness';
import { formatNumber } from '@/utils/fitnessMath';

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'date', label: 'Latest' },
  { key: 'weight', label: 'Weight' },
  { key: 'onerm', label: '1RM' },
  { key: 'volume', label: 'Volume' },
];

export default function RecordsScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<RecordsPayload | null>(null);
  const [history, setHistory] = useState<ExerciseHistoryPayload | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const recordsRequestId = useRef(0);
  const customDateFiltersApplied = useRef(false);
  const focusRefreshAfterInitialLoad = useRef(false);
  const searchSortReady = useRef(false);
  const pageRef = useRef(page);
  const loadRecordsRef = useRef(loadRecords);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    loadRecordsRef.current = loadRecords;
  });

  useFocusEffect(
    useCallback(() => {
      if (!focusRefreshAfterInitialLoad.current) {
        focusRefreshAfterInitialLoad.current = true;
        return undefined;
      }
      loadRecordsRef.current(pageRef.current, customDateFiltersApplied.current);
      return undefined;
    }, []),
  );

  useEffect(() => {
    if (!searchSortReady.current) {
      searchSortReady.current = true;
      return undefined;
    }
    const timer = setTimeout(() => {
      customDateFiltersApplied.current = false;
      if (pageRef.current === 1) {
        loadRecords(1);
      } else {
        setPage(1);
      }
    }, 240);
    return () => clearTimeout(timer);
    // Date fields apply explicitly; search and sort are debounced here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort]);

  useEffect(() => {
    customDateFiltersApplied.current = false;
    loadRecords(page);
    // Pagination reloads should not implicitly apply edited date filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function loadRecords(nextPage = page, applyDates = false, waitForWorkoutWrites = true) {
    const requestId = recordsRequestId.current + 1;
    recordsRequestId.current = requestId;
    customDateFiltersApplied.current = applyDates;
    const hasCachedRecords = Boolean(records);
    setLoading(!hasCachedRecords);
    setRefreshing(hasCachedRecords);
    setError('');
    try {
      if (waitForWorkoutWrites) {
        await waitForFreshFitnessData();
        if (requestId !== recordsRequestId.current) return;
      }
      const response = await fitnessApi.getRecords({
        q: query,
        sort,
        page: nextPage,
        page_size: 18,
        range: applyDates && (startDate || endDate) ? 'custom' : 'all',
        start_date: applyDates ? startDate : undefined,
        end_date: applyDates ? endDate : undefined,
      });
      if (requestId !== recordsRequestId.current) return;
      if (response.status !== 'ok') {
        setError(response.error || 'Unable to load records.');
        return;
      }
      setRecords(response);
    } catch {
      if (requestId === recordsRequestId.current) {
        setError('Unable to load records.');
      }
    } finally {
      if (requestId === recordsRequestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  async function openHistory(record: PersonalRecord) {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistory(null);
    const response = await fitnessApi.getExerciseHistory(record.exercise_name);
    if (response.status === 'ok') {
      setHistory(response);
    }
    setHistoryLoading(false);
  }

  const chartPoints = useMemo(
    () =>
      (history?.sessions || []).map((session) => ({
        date: session.date,
        date_label: session.date_label,
        volume: Number(session.max_one_rm || session.max_weight || session.volume || 0),
      })),
    [history],
  );

  return (
    <PageTransition tabOrder={2}>
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Records"
        right={
          <>
            <IconButton icon={User} onPress={() => router.push('/profile')} label="Profile" />
            <IconButton icon={mode === 'dark' ? Sun : Moon} onPress={toggleMode} label="Toggle theme" />
          </>
        }
      />
      <FloatingRefreshStatus visible={refreshing} label="Updating records" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.muted} />
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises..."
            style={{ flex: 1 }}
            inputStyle={{ backgroundColor: 'transparent', paddingHorizontal: 0 }}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SORT_OPTIONS.map((option) => (
            <PillButton key={option.key} tone="plain" active={sort === option.key} onPress={() => setSort(option.key)}>
              Sort: {option.label}
            </PillButton>
          ))}
        </ScrollView>

        <View style={styles.dateFilters}>
          <DateField label="Start" value={startDate} onChange={setStartDate} placeholder="Any" style={styles.dateInput} />
          <DateField label="End" value={endDate} onChange={setEndDate} placeholder="Any" style={styles.dateInput} />
          <PillButton onPress={() => loadRecords(1, true)} style={styles.applyButton}>Apply</PillButton>
        </View>

        <InlineError message={error} />
        {loading && !records ? <LoadingState label="Loading records..." /> : null}

        {records ? (
          <>
            <View style={styles.metricGrid}>
              <View style={styles.metricGridRow}>
                <MetricCard label="Total Exercises" value={records.summary.total_exercises} style={styles.dashboardMetricCard} />
                <MetricCard label="New PRs (30d)" value={records.summary.new_prs_30d} tone="success" style={styles.dashboardMetricCard} />
              </View>
              <View style={styles.metricGridRow}>
                <MetricCard
                  label="Strongest Lift"
                  value={records.summary.strongest_lift?.exercise_name || '-'}
                  meta={records.summary.strongest_lift ? `${formatNumber(records.summary.strongest_lift.max_weight)} lbs` : undefined}
                  style={styles.dashboardMetricCard}
                />
                <MetricCard
                  label="Most Improved"
                  value={records.summary.most_improved?.exercise_name || '-'}
                  meta={records.summary.most_improved ? `+${formatNumber(records.summary.most_improved.improvement_since_first)} 1RM` : undefined}
                  style={styles.dashboardMetricCard}
                />
              </View>
            </View>

            <View style={styles.recordList}>
              {records.records.map((record) => (
                <RecordCard key={record.exercise_name} record={record} onPress={() => openHistory(record)} />
              ))}
              {!loading && !records.records.length ? (
                <EmptyState title="No records found" body="Try a different search or add more workouts." />
              ) : null}
            </View>

            <View style={[styles.pagination, { borderTopColor: colors.border }]}>
              <AppText variant="caption" muted>
                Page {records.paging.page} of {records.paging.total_pages}
              </AppText>
              <View style={styles.paginationButtons}>
                <PillButton tone="plain" disabled={!records.paging.has_previous} onPress={() => setPage((current) => Math.max(1, current - 1))}>
                  Previous
                </PillButton>
                <PillButton disabled={!records.paging.has_next} onPress={() => setPage((current) => current + 1)}>
                  Next
                </PillButton>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <ModalSheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title={history?.exercise_name || 'History'}>
        {historyLoading ? <LoadingState label="Loading history..." /> : null}
        {history ? (
          <>
            <Card style={{ gap: spacing.sm }}>
              <AppText variant="subheading">{history.exercise_name}</AppText>
              <AppText variant="caption" muted>
                {history.category} | {history.session_count} sessions
              </AppText>
              <VolumeLineChart
                points={chartPoints}
                height={170}
                metricLabel="1RM"
                formatValue={(value) => `${formatNumber(value)} lbs`}
              />
            </Card>
            {history.sessions.map((session) => (
              <Card key={session.date} style={styles.sessionRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '800' }}>{session.date_label}</AppText>
                  <AppText variant="caption" muted>{session.sets_completed} sets | {session.best_set_label}</AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText color={colors.primary} style={{ fontWeight: '800' }}>{formatNumber(session.max_one_rm)}</AppText>
                  <AppText variant="caption" muted>1RM</AppText>
                </View>
              </Card>
            ))}
          </>
        ) : null}
      </ModalSheet>
      </SafeAreaView>
    </PageTransition>
  );
}

function RecordCard({ record, onPress }: { record: PersonalRecord; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Card pressable onPress={onPress} style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={{ flex: 1 }}>
          <AppText variant="subheading" numberOfLines={1}>{record.exercise_name}</AppText>
          <AppText variant="caption" muted>{record.category} | {record.session_count} sessions</AppText>
        </View>
        <AppText color={record.one_rm_delta && record.one_rm_delta > 0 ? colors.success : colors.muted} style={{ fontWeight: '800' }}>
          {record.one_rm_delta && record.one_rm_delta > 0 ? `+${formatNumber(record.one_rm_delta)}` : 'View'}
        </AppText>
      </View>
      <View style={styles.recordStats}>
        <View style={styles.recordStat}>
          <AppText variant="label">Max Weight</AppText>
          <AppText variant="heading">{formatNumber(record.max_weight)} lbs</AppText>
          <AppText variant="caption" muted>{record.max_weight_date_label}</AppText>
        </View>
        <View style={styles.recordStat}>
          <AppText variant="label">Est. 1RM</AppText>
          <AppText variant="heading">{formatNumber(record.max_one_rm)} lbs</AppText>
          <AppText variant="caption" muted>{record.max_one_rm_date_label}</AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  dateFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.sm,
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
  recordList: {
    gap: spacing.md,
  },
  recordCard: {
    gap: spacing.md,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recordStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  recordStat: {
    flexGrow: 1,
    flexBasis: 132,
  },
  pagination: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
