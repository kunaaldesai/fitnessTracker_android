import { describe, expect, it } from 'vitest';

import type { WeightEntry, WeightHistorySummary } from '@/types/fitness';

import {
  convertInputValue,
  convertRateInputValue,
  formatRateInput,
  formatWeight,
  formatWeightInput,
  kgToLbs,
  latestEntry,
  lbsToKg,
  rateUnitToLbs,
  summaryDelta,
  unitToLbs,
} from './weightTracking';

describe('weightTracking', () => {
  it('converts pounds and kilograms for storage and display', () => {
    expect(lbsToKg(180)).toBe(81.65);
    expect(kgToLbs(80)).toBe(176.37);
    expect(unitToLbs('80', 'kg')).toBe(176.37);
    expect(unitToLbs('180', 'lb')).toBe(180);
    expect(unitToLbs('bad', 'lb')).toBeNull();
    expect(rateUnitToLbs('-0.5', 'kg')).toBe(-1.1);
  });

  it('formats weight values and converts typed input between units', () => {
    expect(formatWeight(180, 'lb')).toBe('180 lb');
    expect(formatWeight(180, 'kg')).toBe('81.6 kg');
    expect(formatWeightInput(180, 'kg')).toBe('81.6');
    expect(convertInputValue('180', 'lb', 'kg')).toBe('81.6');
    expect(convertInputValue('81.6', 'kg', 'lb')).toBe('179.9');
    expect(formatRateInput(-1, 'kg')).toBe('-0.45');
    expect(convertRateInputValue('-1', 'lb', 'kg')).toBe('-0.45');
  });

  it('finds the latest entry by date', () => {
    const entries = [
      { id: '2026-06-01', date: '2026-06-01' },
      { id: '2026-06-03', date: '2026-06-03' },
      { id: '2026-06-02', date: '2026-06-02' },
    ] as WeightEntry[];
    expect(latestEntry(entries)?.id).toBe('2026-06-03');
  });

  it('formats summary deltas by selected unit', () => {
    const summary = {
      range_change_lbs: -2,
      range_change_kg: -0.91,
      change_7d_lbs: 1,
      change_7d_kg: 0.45,
      change_30d_lbs: null,
      change_30d_kg: null,
      average_weekly_change_lbs: -0.5,
      average_weekly_change_kg: -0.23,
    } as WeightHistorySummary;
    expect(summaryDelta(summary, 'range', 'lb')).toBe('-2 lb');
    expect(summaryDelta(summary, '7d', 'kg')).toBe('+0.5 kg');
    expect(summaryDelta(summary, '30d', 'lb')).toBe('--');
    expect(summaryDelta(summary, 'weekly', 'kg')).toBe('-0.2 kg');
  });
});
