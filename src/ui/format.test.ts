import { describe, expect, it } from 'vitest';
import { fmtAmount, fmtDay, fmtEur, fmtGram, fmtKcal } from './format';

describe('format', () => {
  it('Euro deutsch', () => {
    expect(fmtEur(2.16)).toMatch(/^2,16\s€$/);
  });
  it('kcal gerundet', () => {
    expect(fmtKcal(317.8)).toBe('318 kcal');
  });
  it('Gramm und Kilogramm', () => {
    expect(fmtGram(537.5)).toBe('538 g');
    expect(fmtGram(1500)).toBe('1,5 kg');
  });
  it('Wochentag und Datum', () => {
    expect(fmtDay('2026-09-28')).toBe('Mo 28.09.');
  });
  it('Menge mit Einheit', () => {
    expect(fmtAmount(0.5, 'stk')).toBe('0,5 Stk.');
    expect(fmtAmount(2, 'el')).toBe('2 EL');
  });
});
