import type { IsoDate } from './types';

/*
 * Datumswerte sind immer 'YYYY-MM-DD' ohne Uhrzeit.
 * Gerechnet wird in UTC, damit die Zeitumstellung keinen Tag verschiebt.
 */

const DAY_MS = 86_400_000;

function fromUtc(t: number): IsoDate {
  return new Date(t).toISOString().slice(0, 10);
}

function toUtc(d: IsoDate): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Ungültiges Datum: ${d}`);
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Date.UTC rollt 30.02. still auf den 02.03. – das fangen wir ab
  if (fromUtc(t) !== d) throw new Error(`Ungültiges Datum: ${d}`);
  return t;
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromUtc(toUtc(d) + n * DAY_MS);
}

export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 1 = Montag … 7 = Sonntag */
export function isoWeekday(d: IsoDate): number {
  const w = new Date(toUtc(d)).getUTCDay();
  return w === 0 ? 7 : w;
}

export function weekDates(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export interface CookDayRange {
  /** null = Tage vor dem ersten Kochtag der Woche */
  cookDate: IsoDate | null;
  from: IsoDate;
  to: IsoDate;
}

/**
 * Teilt die Woche in Einkaufs-Zeiträume: jeder Kochtag bis vor den nächsten Kochtag.
 * Tage vor dem ersten Kochtag bilden einen eigenen Zeitraum ohne Kochtag.
 */
export function cookDayRanges(weekStart: IsoDate, cookWeekdays: readonly number[]): CookDayRange[] {
  const weekEnd = addDays(weekStart, 6);
  const starts = weekDates(weekStart).filter((d) => cookWeekdays.includes(isoWeekday(d)));
  const ranges: CookDayRange[] = [];
  const first = starts[0];
  if (first === undefined) return [{ cookDate: null, from: weekStart, to: weekEnd }];
  if (first !== weekStart) ranges.push({ cookDate: null, from: weekStart, to: addDays(first, -1) });
  starts.forEach((start, i) => {
    const next = starts[i + 1];
    ranges.push({ cookDate: start, from: start, to: next ? addDays(next, -1) : weekEnd });
  });
  return ranges;
}

/** Erster Tag der Woche, in der d liegt (1 = Montag … 7 = Sonntag als Wochenstart) */
export function startOfWeek(d: IsoDate, weekStartsOn = 1): IsoDate {
  const diff = (isoWeekday(d) - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

/** Heutiges Datum in der lokalen Zeitzone des Geräts */
export function todayLocal(now: Date = new Date()): IsoDate {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}
