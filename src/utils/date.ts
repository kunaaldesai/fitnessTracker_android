export function todayIso(): string {
  return formatLocalIsoDate(new Date());
}

export function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function shiftIsoDate(value: string, days: number): string {
  const parsed = parseIsoDate(value) || new Date();
  parsed.setDate(parsed.getDate() + days);
  return formatLocalIsoDate(parsed);
}

export function shortDateLabel(value: string | null | undefined): string {
  const parsed = parseIsoDate(value || '');
  if (!parsed) return value || '';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fullDateLabel(value: string | null | undefined): string {
  const parsed = parseIsoDate(value || '');
  if (!parsed) return value || '';
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
