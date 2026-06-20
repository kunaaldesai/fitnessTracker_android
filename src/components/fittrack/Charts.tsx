import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/fittrack/ui';
import { radius, spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import type { MuscleSplitRow, VolumePoint, WorkoutCalendarPayload } from '@/types/fitness';
import { formatNumber } from '@/utils/fitnessMath';

export function VolumeLineChart({ points, height = 190 }: { points: VolumePoint[]; height?: number }) {
  const { colors } = useAppTheme();
  const chartWidth = 330;
  const padding = 28;
  const rows = points.slice(-18);
  const maxValue = Math.max(...rows.map((row) => Number(row.volume || 0)), 1);
  const coords = rows.map((row, index) => {
    const x = padding + (index * (chartWidth - padding * 2)) / Math.max(rows.length - 1, 1);
    const y = height - padding - (Number(row.volume || 0) / maxValue) * (height - padding * 2);
    return { x, y, row };
  });

  if (!rows.length) {
    return (
      <View style={[styles.emptyChart, { height }]}>
        <AppText muted>No volume yet</AppText>
      </View>
    );
  }

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        {[0, 1, 2].map((line) => {
          const y = padding + (line * (height - padding * 2)) / 2;
          return <Line key={line} x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke={colors.border} strokeWidth={1} />;
        })}
        <Polyline
          points={coords.map(({ x, y }) => `${x},${y}`).join(' ')}
          fill="none"
          stroke={colors.primary}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map(({ x, y, row }, index) => (
          <Circle key={`${row.date}-${index}`} cx={x} cy={y} r={3.5} fill={colors.primary} />
        ))}
        <SvgText x={padding} y={height - 8} fill={colors.muted} fontSize="10" fontWeight="600">
          {rows[0]?.date_label || ''}
        </SvgText>
        <SvgText x={chartWidth - padding} y={height - 8} fill={colors.muted} fontSize="10" fontWeight="600" textAnchor="end">
          {rows[rows.length - 1]?.date_label || ''}
        </SvgText>
      </Svg>
    </View>
  );
}

export function MuscleSplitBars({ rows }: { rows: MuscleSplitRow[] }) {
  const { colors } = useAppTheme();
  if (!rows.length) {
    return <AppText muted>No split data yet</AppText>;
  }
  return (
    <View style={styles.barList}>
      {rows.map((row) => (
        <View key={`${row.metric}-${row.group}`} style={styles.barRow}>
          <View style={styles.barHeader}>
            <AppText style={{ fontWeight: '700' }}>{row.group}</AppText>
            <AppText muted variant="caption">
              {formatNumber(row.value, row.unit === '%' ? 1 : 0)} {row.unit}
            </AppText>
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${Math.max(4, row.percent)}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ActivityHeatmap({ calendar }: { calendar: WorkoutCalendarPayload | null }) {
  const { colors } = useAppTheme();
  const levelColors = [
    colors.surfaceAlt,
    `${colors.primary}38`,
    `${colors.primary}70`,
    `${colors.primary}aa`,
    colors.primary,
  ];
  if (!calendar) {
    return <AppText muted>No activity yet</AppText>;
  }
  return (
    <View style={styles.heatmapWrap}>
      <View style={styles.streakRow}>
        <AppText variant="caption" muted>
          Current {calendar.current_streak}d
        </AppText>
        <AppText variant="caption" muted>
          Longest {calendar.longest_streak}d
        </AppText>
      </View>
      <View style={styles.heatmap}>
        {calendar.weeks.slice(-18).map((week, weekIndex) => (
          <View key={weekIndex} style={styles.heatmapColumn}>
            {week.map((day, dayIndex) => (
              <View
                key={`${day.date || 'empty'}-${dayIndex}`}
                style={[
                  styles.heatCell,
                  {
                    backgroundColor: levelColors[Math.max(0, Math.min(4, day.level || 0))],
                    opacity: day.date ? 1 : 0,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: {
    width: '100%',
    overflow: 'hidden',
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  barList: {
    gap: spacing.md,
  },
  barRow: {
    gap: 6,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  barTrack: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  heatmapWrap: {
    gap: spacing.sm,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heatmap: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-start',
  },
  heatmapColumn: {
    gap: 4,
  },
  heatCell: {
    width: 13,
    height: 13,
    borderRadius: 3,
  },
});
