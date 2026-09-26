import { describe, expect, it } from 'vitest';
import { bmr, suggestTargets } from './targets';

describe('targets', () => {
  it('Grundumsatz Mifflin-St-Jeor', () => {
    expect(bmr({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male', activity: 'moderate', goal: 'maintain' })).toBe(1780);
    expect(
      bmr({ weightKg: 60, heightCm: 165, ageYears: 28, sex: 'female', activity: 'light', goal: 'lose' }),
    ).toBeCloseTo(1330.25, 2);
  });

  it('Mann, halten, moderat aktiv', () => {
    expect(
      suggestTargets({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male', activity: 'moderate', goal: 'maintain' }),
    ).toEqual({ kcal: 2760, proteinMin: 128, fatMin: 77, fatMax: 107, carbsMin: 321, carbsMax: 389 });
  });

  it('Frau, abnehmen, leicht aktiv', () => {
    expect(
      suggestTargets({ weightKg: 60, heightCm: 165, ageYears: 28, sex: 'female', activity: 'light', goal: 'lose' }),
    ).toEqual({ kcal: 1550, proteinMin: 120, fatMin: 43, fatMax: 60, carbsMin: 133, carbsMax: 171 });
  });

  it('unrealistische Eingaben werden abgelehnt', () => {
    const ok = { weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male' as const, activity: 'moderate' as const, goal: 'maintain' as const };
    expect(() => suggestTargets({ ...ok, weightKg: 20 })).toThrow('Gewicht');
    expect(() => suggestTargets({ ...ok, heightCm: 300 })).toThrow('Größe');
    expect(() => suggestTargets({ ...ok, ageYears: 10 })).toThrow('Alter');
  });
});
