export function getUtcDateKey(value: string | Date): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function shiftUtcDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDateOnly(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateKey = getUtcDateKey(value);
  if (!dateKey) return 'Date unavailable';

  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, options);
}

export function daysUntilDateOnly(value: string | Date): number | null {
  const targetDateKey = getUtcDateKey(value);
  if (!targetDateKey) return null;

  const todayKey = new Date().toISOString().slice(0, 10);
  const target = new Date(`${targetDateKey}T00:00:00Z`);
  const today = new Date(`${todayKey}T00:00:00Z`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
