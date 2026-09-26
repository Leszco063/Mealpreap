import { describe, expect, it } from 'vitest';
import { computedKcal, isPlausible, perPortion, recipeTotals } from './nutrition';
import { makeLookup } from './recipe';
import { allIngredients, chili, overnightOats } from './fixtures.test-data';

const lookup = makeLookup(allIngredients);

describe('nutrition', () => {
  it('summiert Nährwerte eines Rezepts (ml über Dichte)', () => {
    const n = recipeTotals(overnightOats, lookup);
    expect(n.kcal).toBeCloseTo(318.32, 2);
    expect(n.protein).toBeCloseTo(28.055, 3);
    expect(n.fat).toBeCloseTo(5.195, 3);
    expect(n.carbs).toBeCloseTo(36.217, 3);
    expect(n.fiber).toBeCloseTo(5.5, 3);
    expect(n.sugar).toBeCloseTo(10.067, 3);
    expect(n.salt).toBeCloseTo(0.253, 3);
  });

  it('pro Portion, optionale Zutaten zählen nicht', () => {
    const n = perPortion(chili, lookup);
    expect(n.kcal).toBeCloseTo(317.8155, 3);
    expect(n.protein).toBeCloseTo(24.115, 3);
    expect(n.fat).toBeCloseTo(23.9865, 3);
    expect(n.salt).toBeCloseTo(1.556, 3);
  });

  it('computedKcal nach BLS-Formel inkl. Ballaststoffe', () => {
    expect(computedKcal({ kcal: 0, protein: 10, fat: 10, carbs: 10, fiber: 10, sugar: 0, salt: 0 })).toBe(190);
  });

  it('isPlausible', () => {
    expect(isPlausible(recipeTotals(overnightOats, lookup))).toBe(true);
    expect(isPlausible({ kcal: 100, protein: 20, fat: 10, carbs: 20, fiber: 0, sugar: 0, salt: 0 })).toBe(false);
    // kleine Werte: 10 kcal Toleranz
    expect(isPlausible({ kcal: 8, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, salt: 0 })).toBe(true);
    expect(isPlausible({ kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, salt: 95 })).toBe(true);
  });
});
