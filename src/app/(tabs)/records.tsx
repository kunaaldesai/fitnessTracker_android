import { router } from 'expo-router';
import { Moon, Search, Sun, User } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VolumeLineChart } from '@/components/fittrack/Charts';
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
  PillButton,
  TextField,
} from '@/components/fittrack/ui';
import { spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadRecords(1);
    }, 240);
    return () => clearTimeout(timer);
  }, [query, sort]);

  useEffect(() => {
    loadRecords(page);
  }, [page]);

  async function loadRecords(nextPage = page, applyDates = false) {
    setLoading(true);
    setError('');
    const response = await fitnessApi.getRecords({
      q: query,
      sort,
      page: nextPage,
      page_size: 18,
      range: applyDates && (startDate || endDate) ? 'custom' : 'all',
      start_date: applyDates ? startDate : undefined,
      end_date: applyDates ? endDate : undefined,
    });
    if (response.status !== 'ok') {
      setError(response.error || 'Unable to load records.');
      setLoading(false);
      return;
    }
    setRecords(response);
    setLoading(false);
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
          <TextField label="Start" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
          <TextField label="End" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
          <PillButton onPress={() => loadRecords(1, true)} style={styles.applyButton}>Apply</PillButton>
        </View>

        <InlineError message={error} />
        {loading ? <LoadingState label="Loading records..." /> : null}

        {records ? (
          <>
            <View style={styles.metricGrid}>
              <MetricCard label="Total Exercises" value={records.summary.total_exercises} />
              <MetricCard label="New PRs (30d)" value={records.summary.new_prs_30d} tone="success" />
              <MetricCard
                label="Strongest Lift"
                value={records.summary.strongest_lift?.exercise_name || '-'}
                meta={records.summary.strongest_lift ? `${formatNumber(records.summary.strongest_lift.max_weight)} lbs` : undefined}
              />
              <MetricCard
                label="Most Improved"
                value={records.summary.most_improved?.exercise_name || '-'}
                meta={records.summary.most_improved ? `+${formatNumber(records.summary.most_improved.improvement_since_first)} 1RM` : undefined}
              />
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
              <VolumeLineChart points={chartPoints} height={170} />
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
        <View>
          <AppText variant="label">Max Weight</AppText>
          <AppText variant="heading">{formatNumber(record.max_weight)} lbs</AppText>
          <AppText variant="caption" muted>{record.max_weight_date_label}</AppText>
        </View>
        <View>
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
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  applyButton: {
    minHeight: 42,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
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
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pagination: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
