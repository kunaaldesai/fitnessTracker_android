import { useEffect, useRef, useState } from 'react';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Modal, Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { AppText } from '@/components/fittrack/ui';
import { radius, spacing } from '@/constants/fittrackTheme';
import { useAppTheme } from '@/context/AppThemeContext';
import type { MuscleSplitRow, VolumePoint, WeightChartPoint, WorkoutCalendarPayload } from '@/types/fitness';
import { shortDateLabel } from '@/utils/date';
import { formatNumber } from '@/utils/fitnessMath';
import type { WeightUnit } from '@/utils/weightTracking';
import { formatWeight } from '@/utils/weightTracking';

const chartWidth = 330;

type ChartCoord<T> = {
  x: number;
  y: number;
  row: T;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function nearestIndex<T>(coords: ChartCoord<T>[], event: GestureResponderEvent, layoutWidth: number) {
  const tapX = (event.nativeEvent.locationX / Math.max(1, layoutWidth)) * chartWidth;
  return coords.reduce((bestIndex, coord, index) => {
    const bestDistance = Math.abs(coords[bestIndex]?.x - tapX);
    const nextDistance = Math.abs(coord.x - tapX);
    return nextDistance < bestDistance ? index : bestIndex;
  }, 0);
}

function tooltipPosition(x: number, y: number, layoutWidth: number, width: number, height: number, tooltipHeight: number) {
  const left = clamp((x / chartWidth) * layoutWidth - width / 2, 4, Math.max(4, layoutWidth - width - 4));
  const top = clamp(y - tooltipHeight - 10, 4, Math.max(4, height - tooltipHeight - 4));
  return { left, top };
}

function useChartClickAway(active: boolean, onDismiss: () => void) {
  const containerRef = useRef<View | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !active || typeof document === 'undefined') return undefined;

    function handlePointerDown(event: Event) {
      const node = containerRef.current as unknown as { contains?: (target: EventTarget | null) => boolean } | null;
      if (node?.contains?.(event.target)) return;
      onDismiss();
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [active, onDismiss]);

  return containerRef;
}

function ChartDismissOverlay({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  if (Platform.OS === 'web' || !visible) return null;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss chart details"
        onPress={onDismiss}
        style={styles.chartDismissOverlay}
      />
    </Modal>
  );
}

function TooltipMetricLine({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.tooltipMetricLine}>
      <View style={[styles.tooltipDot, { backgroundColor: color }]} />
      <AppText variant="caption" style={styles.tooltipMetricLabel}>{label}</AppText>
      <AppText variant="caption" style={styles.tooltipMetricValue}>{value}</AppText>
    </View>
  );
}

export function VolumeLineChart({
  points,
  height = 190,
  metricLabel = 'Volume',
  formatValue,
}: {
  points: VolumePoint[];
  height?: number;
  metricLabel?: string;
  formatValue?: (value: number, row: VolumePoint) => string;
}) {
  const { colors } = useAppTheme();
  const [layoutWidth, setLayoutWidth] = useState(chartWidth);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const chartRef = useChartClickAway(selectedIndex !== null, () => setSelectedIndex(null));
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

  const selectedCoordIndex = selectedIndex === null ? null : Math.min(selectedIndex, coords.length - 1);
  const selected = selectedCoordIndex === null ? null : coords[selectedCoordIndex];
  const tooltip = selected ? tooltipPosition(selected.x, selected.y, layoutWidth, 158, height, 72) : null;
  const valueText = selected
    ? formatValue
      ? formatValue(Number(selected.row.volume || 0), selected.row)
      : `${formatNumber(selected.row.volume)} lbs`
    : '';

  return (
    <View ref={chartRef} style={styles.chartWrap} onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width || chartWidth)}>
      <ChartDismissOverlay visible={selectedIndex !== null} onDismiss={() => setSelectedIndex(null)} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${metricLabel} chart`}
        onPress={(event) => setSelectedIndex(nearestIndex(coords, event, layoutWidth))}
        style={[styles.interactiveChart, { height }]}>
        <Svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
          {[0, 1, 2].map((line) => {
            const y = padding + (line * (height - padding * 2)) / 2;
            return <Line key={line} x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke={colors.border} strokeWidth={1} />;
          })}
          {selected ? (
            <Line x1={selected.x} y1={padding} x2={selected.x} y2={height - padding} stroke={colors.muted} strokeWidth={1.2} strokeDasharray="4 5" />
          ) : null}
          <Polyline
            points={coords.map(({ x, y }) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={colors.primary}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coords.map(({ x, y, row }, index) => {
            const active = index === selectedCoordIndex;
            return <Circle key={`${row.date}-${index}`} cx={x} cy={y} r={active ? 5 : 3.5} fill={colors.primary} stroke={active ? colors.surface : 'transparent'} strokeWidth={active ? 2 : 0} />;
          })}
          <SvgText x={padding} y={height - 8} fill={colors.muted} fontSize="10" fontWeight="600">
            {rows[0]?.date_label || ''}
          </SvgText>
          <SvgText x={chartWidth - padding} y={height - 8} fill={colors.muted} fontSize="10" fontWeight="600" textAnchor="end">
            {rows[rows.length - 1]?.date_label || ''}
          </SvgText>
        </Svg>
        {selected && tooltip ? (
          <View
            pointerEvents="none"
            style={[
              styles.chartTooltip,
              {
                left: tooltip.left,
                top: tooltip.top,
                width: 158,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}>
            <AppText style={styles.tooltipTitle} numberOfLines={1}>{selected.row.date_label || selected.row.date}</AppText>
            <TooltipMetricLine color={colors.primary} label={metricLabel} value={valueText} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export function WeightLineChart({
  points,
  targetWeightLbs,
  unit,
  height = 190,
}: {
  points: WeightChartPoint[];
  targetWeightLbs?: number | null;
  unit: WeightUnit;
  height?: number;
}) {
  const { colors } = useAppTheme();
  const [layoutWidth, setLayoutWidth] = useState(chartWidth);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const chartRef = useChartClickAway(selectedIndex !== null, () => setSelectedIndex(null));
  const padding = 24;
  const axisLabelWidth = 32;
  const plotLeft = padding + axisLabelWidth;
  const plotRight = chartWidth - padding;
  const plotTop = padding;
  const plotBottom = height - padding;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotHeight = Math.max(1, plotBottom - plotTop);
  const rows = points.slice(-24);
  const weights = rows.map((row) => Number(row.weight_lbs || 0)).filter((value) => value > 0);
  if (targetWeightLbs) weights.push(Number(targetWeightLbs));
  const minWeight = weights.length ? Math.min(...weights) : 0;
  const maxWeight = weights.length ? Math.max(...weights) : 1;
  const paddedMin = weights.length ? minWeight - Math.max(2, (maxWeight - minWeight) * 0.18) : 0;
  const paddedMax = weights.length ? maxWeight + Math.max(2, (maxWeight - minWeight) * 0.18) : 1;
  const range = Math.max(paddedMax - paddedMin, 1);

  function yForWeight(weightLbs: number) {
    return plotBottom - ((weightLbs - paddedMin) / range) * plotHeight;
  }

  const coords = rows.map((row, index) => {
    const x = plotLeft + (index * plotWidth) / Math.max(rows.length - 1, 1);
    return { x, y: yForWeight(Number(row.weight_lbs || 0)), row };
  });

  if (!rows.length) {
    return (
      <View style={[styles.emptyChart, { height }]}>
        <AppText muted>No weight data yet</AppText>
      </View>
    );
  }

  const targetY = targetWeightLbs ? yForWeight(targetWeightLbs) : null;
  const yAxisLabelX = plotLeft - 4;
  const yAxisMaxLabelY = Math.max(14, plotTop - 10);
  const yAxisMinLabelY = plotBottom - 6;
  const selectedCoordIndex = selectedIndex === null ? null : Math.min(selectedIndex, coords.length - 1);
  const selected = selectedCoordIndex === null ? null : coords[selectedCoordIndex];
  const tooltip = selected ? tooltipPosition(selected.x, selected.y, layoutWidth, 174, height, 96) : null;

  return (
    <View ref={chartRef} style={styles.chartWrap} onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width || chartWidth)}>
      <ChartDismissOverlay visible={selectedIndex !== null} onDismiss={() => setSelectedIndex(null)} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Weight chart"
        onPress={(event) => setSelectedIndex(nearestIndex(coords, event, layoutWidth))}
        style={[styles.interactiveChart, { height }]}>
        <Svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
          {[0, 1, 2].map((line) => {
            const y = plotTop + (line * plotHeight) / 2;
            return <Line key={line} x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke={colors.border} strokeWidth={1} />;
          })}
          {targetY !== null ? (
            <>
              <Line
                x1={plotLeft}
                y1={targetY}
                x2={plotRight}
                y2={targetY}
                stroke={colors.warning}
                strokeWidth={1.8}
                strokeDasharray="6 5"
              />
              <SvgText x={plotRight} y={Math.max(13, targetY - 6)} fill={colors.warning} fontSize="10" fontWeight="700" textAnchor="end">
                Target
              </SvgText>
            </>
          ) : null}
          {selected ? (
            <Line x1={selected.x} y1={plotTop} x2={selected.x} y2={plotBottom} stroke={colors.muted} strokeWidth={1.2} strokeDasharray="4 5" />
          ) : null}
          <Polyline
            points={coords.map(({ x, y }) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={colors.primary}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coords.map(({ x, y, row }, index) => {
            const active = index === selectedCoordIndex;
            return <Circle key={`${row.date}-${index}`} cx={x} cy={y} r={active ? 5 : 3.7} fill={colors.primary} stroke={active ? colors.surface : 'transparent'} strokeWidth={active ? 2 : 0} />;
          })}
          <SvgText x={yAxisLabelX} y={yAxisMaxLabelY} fill={colors.muted} fontSize="10" fontWeight="600" textAnchor="end">
            {formatWeight(paddedMax, unit)}
          </SvgText>
          <SvgText x={yAxisLabelX} y={yAxisMinLabelY} fill={colors.muted} fontSize="10" fontWeight="600" textAnchor="end">
            {formatWeight(paddedMin, unit)}
          </SvgText>
          <SvgText x={plotLeft} y={height - 8} fill={colors.muted} fontSize="10" fontWeight="600">
            {rows[0]?.date_label || ''}
          </SvgText>
          <SvgText x={plotRight} y={height - 8} fill={colors.muted} fontSize="10" fontWeight="600" textAnchor="end">
            {rows[rows.length - 1]?.date_label || ''}
          </SvgText>
        </Svg>
        {selected && tooltip ? (
          <View
            pointerEvents="none"
            style={[
              styles.chartTooltip,
              {
                left: tooltip.left,
                top: tooltip.top,
                width: 174,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}>
            <AppText style={styles.tooltipTitle} numberOfLines={1}>{selected.row.date_label || selected.row.date}</AppText>
            <TooltipMetricLine color={colors.primary} label="Weight" value={formatWeight(selected.row.weight_lbs, unit)} />
            {typeof selected.row.bmi === 'number' ? <TooltipMetricLine color={colors.info} label="BMI" value={formatNumber(selected.row.bmi, 1)} /> : null}
            {targetWeightLbs ? <TooltipMetricLine color={colors.warning} label="Target" value={formatWeight(targetWeightLbs, unit)} /> : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export function MuscleSplitBars({ rows }: { rows: MuscleSplitRow[] }) {
  const { colors } = useAppTheme();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const chartRef = useChartClickAway(selectedKey !== null, () => setSelectedKey(null));
  if (!rows.length) {
    return <AppText muted>No split data yet</AppText>;
  }
  const selected = rows.find((row) => `${row.metric}-${row.group}` === selectedKey) || null;
  return (
    <View ref={chartRef} style={styles.barList}>
      <ChartDismissOverlay visible={selectedKey !== null} onDismiss={() => setSelectedKey(null)} />
      {rows.map((row) => {
        const rowKey = `${row.metric}-${row.group}`;
        const active = rowKey === selectedKey;
        return (
          <Pressable
            key={rowKey}
            accessibilityRole="button"
            accessibilityLabel={`${row.group} split`}
            onPress={() => setSelectedKey(rowKey)}
            style={({ pressed }) => [styles.barRow, pressed && { opacity: 0.75 }]}>
            <View style={styles.barHeader}>
              <AppText style={{ fontWeight: '700' }}>{row.group}</AppText>
              <AppText muted variant="caption">
                {formatNumber(row.value, row.unit === '%' ? 1 : 0)} {row.unit}
              </AppText>
            </View>
            <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt, borderColor: active ? colors.primary : 'transparent' }]}>
              <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${Math.max(4, row.percent)}%` }]} />
            </View>
          </Pressable>
        );
      })}
      {selected ? (
        <View style={[styles.inlineDetail, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <AppText style={styles.tooltipTitle}>{selected.group}</AppText>
          <AppText variant="caption" muted>
            {formatNumber(selected.percent, 1)}% | {formatNumber(selected.value, selected.unit === '%' ? 1 : 0)} {selected.unit}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export function ActivityHeatmap({ calendar }: { calendar: WorkoutCalendarPayload | null }) {
  const { colors } = useAppTheme();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const chartRef = useChartClickAway(selectedDate !== null, () => setSelectedDate(null));
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
  const days = calendar.weeks.flat().filter((day) => day.date);
  const selected = days.find((day) => day.date === selectedDate) || null;
  return (
    <View ref={chartRef} style={styles.heatmapWrap}>
      <ChartDismissOverlay visible={selectedDate !== null} onDismiss={() => setSelectedDate(null)} />
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
              <Pressable
                key={`${day.date || 'empty'}-${dayIndex}`}
                disabled={!day.date}
                accessibilityRole="button"
                accessibilityLabel={day.date ? `${shortDateLabel(day.date)} activity` : undefined}
                onPress={() => setSelectedDate(day.date)}
                style={[
                  styles.heatCell,
                  {
                    backgroundColor: levelColors[Math.max(0, Math.min(4, day.level || 0))],
                    borderColor: day.date && selected?.date === day.date ? colors.primary : 'transparent',
                    opacity: day.date ? 1 : 0,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      {selected ? (
        <View style={[styles.inlineDetail, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <AppText style={styles.tooltipTitle}>{shortDateLabel(selected.date)}</AppText>
          <AppText variant="caption" muted>
            {selected.has_workout ? `${formatNumber(selected.volume)} lbs logged` : 'No workout logged'}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: {
    width: '100%',
    overflow: 'hidden',
  },
  interactiveChart: {
    width: '100%',
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTooltip: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  chartDismissOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tooltipTitle: {
    fontWeight: '800',
  },
  tooltipMetricLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipMetricLabel: {
    flex: 1,
    fontWeight: '700',
  },
  tooltipMetricValue: {
    fontWeight: '800',
  },
  inlineDetail: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
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
    borderWidth: 1,
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
    borderWidth: 1,
  },
});
