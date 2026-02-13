// Modularized date utilities for /c/pulse

export function toDateKey(value: string | Date): string {
  return new Date(value).toISOString().split('T')[0];
}

export function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

export function endOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0));
}

export function startOfWeekUTC(date: Date): { s: Date; e: Date } {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  const s = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff, 0, 0, 0, 0));
  const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + 7, 0, 0, 0, 0));
  return { s, e };
}

export function startOfMonthUTC(date: Date): { s: Date; e: Date } {
  const s = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const e = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { s, e };
}

export function startOfYearUTC(date: Date): { s: Date; e: Date } {
  const s = new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  const e = new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0));
  return { s, e };
}
