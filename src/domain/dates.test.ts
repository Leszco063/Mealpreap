import { describe, expect, it } from 'vitest';
import { addDays, cookDayRanges, diffDays, isoWeekday, startOfWeek, todayLocal, weekDates } from './dates';

describe('dates', () => {
  it('addDays über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('addDays über die Zeitumstellung verschiebt keinen Tag', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('diffDays', () => {
    expect(diffDays('2026-09-27', '2026-10-01')).toBe(4);
    expect(diffDays('2026-10-01', '2026-09-27')).toBe(-4);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('isoWeekday: Montag = 1, Sonntag = 7', () => {
    expect(isoWeekday('2026-09-28')).toBe(1);
    expect(isoWeekday('2026-09-26')).toBe(6);
    expect(isoWeekday('2026-09-27')).toBe(7);
  });

  it('lehnt ungültige Daten ab', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow('Ungültiges Datum');
    expect(() => addDays('26-9-1', 1)).toThrow('Ungültiges Datum');
  });

  it('weekDates liefert 7 Tage', () => {
    expect(weekDates('2026-09-28')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('cookDayRanges: erster Tag kein Kochtag → Vorlauf-Zeitraum ohne Kochtag', () => {
    // Woche Mo 28.09. – So 04.10., Kochtage Mi (3) und So (7)
    expect(cookDayRanges('2026-09-28', [3, 7])).toEqual([
      { cookDate: null, from: '2026-09-28', to: '2026-09-29' },
      { cookDate: '2026-09-30', from: '2026-09-30', to: '2026-10-03' },
      { cookDate: '2026-10-04', from: '2026-10-04', to: '2026-10-04' },
    ]);
  });

  it('cookDayRanges: Kochtag am Wochenstart', () => {
    expect(cookDayRanges('2026-09-28', [1, 4])).toEqual([
      { cookDate: '2026-09-28', from: '2026-09-28', to: '2026-09-30' },
      { cookDate: '2026-10-01', from: '2026-10-01', to: '2026-10-04' },
    ]);
  });

  it('cookDayRanges: ohne Kochtage ein Zeitraum für die ganze Woche', () => {
    expect(cookDayRanges('2026-09-28', [])).toEqual([
      { cookDate: null, from: '2026-09-28', to: '2026-10-04' },
    ]);
  });
});

describe('startOfWeek / todayLocal', () => {
  it('Montag als Wochenstart', () => {
    expect(startOfWeek('2026-09-30')).toBe('2026-09-28');
    expect(startOfWeek('2026-09-28')).toBe('2026-09-28');
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28');
  });
  it('Sonntag als Wochenstart', () => {
    expect(startOfWeek('2026-09-30', 7)).toBe('2026-09-27');
  });
  it('todayLocal nutzt lokale Zeit', () => {
    expect(todayLocal(new Date(2026, 8, 26, 23, 30))).toBe('2026-09-26');
    expect(todayLocal(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });
});
