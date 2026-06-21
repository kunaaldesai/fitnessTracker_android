import type { WeightEntry, WeightHistorySummary } from '@/types/fitness';

import { formatDecimal, formatNumber, toNumberOrNull } from './fitnessMath';

export type WeightUnit = 'lb' | 'kg';

const KG_PER_LB = 0.45359237;
const LB_PER_KG = 1 / KG_PER_LB;

export function lbsToKg(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number((Number(value) * KG_PER_LB).toFixed(2));
}

export function kgToLbs(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number((Number(value) * LB_PER_KG).toFixed(2));
}

export function weightToUnit(valueLbs: number | null | undefined, unit: WeightUnit): number | null {
  if (valueLbs === null || valueLbs === undefined || !Number.isFinite(Number(valueLbs))) return null;
  return unit === 'kg' ? Number(valueLbs) * KG_PER_LB : Number(valueLbs);
}

export function unitToLbs(value: string | number | null | undefined, unit: WeightUnit): number | null {
  const parsed = toNumberOrNull(value);
  if (parsed === null || parsed <= 0) return null;
  return unit === 'kg' ? kgToLbs(parsed) : Number(parsed.toFixed(2));
}

export function rateUnitToLbs(value: string | number | null | undefined, unit: WeightUnit): number | null {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return null;
  return unit === 'kg' ? kgToLbs(parsed) : Number(parsed.toFixed(2));
}

export function formatWeight(valueLbs: number | null | undefined, unit: WeightUnit, digits = 1): string {
  const converted = weightToUnit(valueLbs, unit);
  if (converted === null) return '--';
  return `${formatNumber(converted, digits)} ${unit}`;
}

export function formatWeightInput(valueLbs: number | null | undefined, unit: WeightUnit): string {
  const converted = weightToUnit(valueLbs, unit);
  if (converted === null) return '';
  return formatDecimal(converted, 1);
}

export function formatRateInput(valueLbs: number | null | undefined, unit: WeightUnit): string {
  const converted = weightToUnit(valueLbs, unit);
  if (converted === null) return '';
  return formatDecimal(converted, 2);
}

export function convertInputValue(value: string, fromUnit: WeightUnit, toUnit: WeightUnit): string {
  if (!value || fromUnit === toUnit) return value;
  const lbs = unitToLbs(value, fromUnit);
  return formatWeightInput(lbs, toUnit);
}

export function convertRateInputValue(value: string, fromUnit: WeightUnit, toUnit: WeightUnit): string {
  if (!value || fromUnit === toUnit) return value;
  const lbs = rateUnitToLbs(value, fromUnit);
  return formatRateInput(lbs, toUnit);
}

export function signedWeightDelta(valueLbs: number | null | undefined, unit: WeightUnit): string {
  if (valueLbs === null || valueLbs === undefined || !Number.isFinite(Number(valueLbs))) return '--';
  const converted = weightToUnit(Number(valueLbs), unit);
  if (converted === null) return '--';
  const prefix = converted > 0 ? '+' : '';
  return `${prefix}${formatNumber(converted, 1)} ${unit}`;
}

export function latestEntry(entries: WeightEntry[]): WeightEntry | null {
  const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1] || null;
}

export function summaryDelta(summary: WeightHistorySummary | null, key: 'range' | '7d' | '30d' | 'weekly', unit: WeightUnit): string {
  if (!summary) return '--';
  const valueByKey = {
    range: unit === 'kg' ? summary.range_change_kg : summary.range_change_lbs,
    '7d': unit === 'kg' ? summary.change_7d_kg : summary.change_7d_lbs,
    '30d': unit === 'kg' ? summary.change_30d_kg : summary.change_30d_lbs,
    weekly: unit === 'kg' ? summary.average_weekly_change_kg : summary.average_weekly_change_lbs,
  };
  const value = valueByKey[key];
  if (value === null || value === undefined) return '--';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatNumber(value, 1)} ${unit}`;
}
