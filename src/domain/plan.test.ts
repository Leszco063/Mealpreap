import { describe, expect, it } from 'vitest';
import { dayNutrition, defaultPortions, shoppingMealRange, suggestCookDate, visibleSlots } from './plan';
import { makeLookup } from './recipe';
import { allIngredients, allRecipes, chili, lachsPfanne, overnightOats } from './fixtures.test-data';
import type { Meal, Person } from './types';

function person(id: string, slots: Person['mealSlots']): Person {
  return {
    id,
    name: id,
    targets: { kcal: 2000, proteinMin: 100 },
    mealSlots: slots,
    diet: 'omnivore',
    noPork: false,
    allergies: [],
    dislikedIngredientIds: [],
    maxMinutesWeekday: 30,
    maxMinutesCookDay: 120,
  };
}

describe('defaultPortions', () => {
  it('eine Portion für jede Person, die diesen Slot isst', () => {
    const persons = [person('a', ['breakfast', 'lunch']), person('b', ['lunch'])];
    expect(defaultPortions(persons, 'lunch')).toEqual({ a: 1, b: 1 });
    expect(defaultPortions(persons, 'breakfast')).toEqual({ a: 1 });
    expect(defaultPortions(persons, 'dinner')).toEqual({});
  });
});

describe('suggestCookDate', () => {
  // Kochtage Mi (3) und So (7); 2026-09-30 ist ein Mittwoch
  it('frische Gerichte am Esstag', () => {
    expect(suggestCookDate('2026-10-01', lachsPfanne, [3, 7])).toBe('2026-10-01');
  });
  it('vorkochbar: letzter Kochtag innerhalb der Haltbarkeit', () => {
    expect(suggestCookDate('2026-10-02', chili, [3, 7])).toBe('2026-09-30');
    expect(suggestCookDate('2026-09-30', chili, [3, 7])).toBe('2026-09-30');
  });
  it('kein Kochtag in Reichweite → Esstag', () => {
    // Overnight Oats hält 2 Tage; 2026-10-03 (Sa): Mi liegt 3 Tage zurück
    expect(suggestCookDate('2026-10-03', overnightOats, [3, 7])).toBe('2026-10-03');
    expect(suggestCookDate('2026-10-03', chili, [])).toBe('2026-10-03');
  });
});

describe('dayNutrition', () => {
  const ctx = { lookupRecipe: makeLookup(allRecipes), lookupIngredient: makeLookup(allIngredients) };
  const base = { id: 'm', slot: 'lunch' as const, pinned: false, cookDate: '2026-09-28' };
  const meals: Meal[] = [
    { ...base, id: '1', date: '2026-09-28', recipeId: 'chili', portions: { a: 1.5 } },
    { ...base, id: '2', date: '2026-09-28', recipeId: 'overnight-oats', portions: { a: 1, b: 0 } },
    { ...base, id: '3', date: '2026-09-29', recipeId: 'chili', portions: { a: 1 } },
    { ...base, id: '4', date: '2026-09-28', recipeId: 'geloescht', portions: { a: 1 } },
  ];
  it('summiert Portionen einer Person an einem Tag', () => {
    expect(dayNutrition(meals, '2026-09-28', 'a', ctx).kcal).toBeCloseTo(317.8155 * 1.5 + 318.32, 2);
  });
  it('0 Portionen und fremde Personen zählen nicht', () => {
    expect(dayNutrition(meals, '2026-09-28', 'b', ctx).kcal).toBe(0);
  });
});

describe('suggestCookDate mit Untergrenze (kein Kochtag in der Vergangenheit)', () => {
  it('überspringt Kochtage vor notBefore', () => {
    // Mo 28.09. geplant am Mo 28.09.; So 27.09. liegt in der Vergangenheit → Esstag
    expect(suggestCookDate('2026-09-28', chili, [3, 7], '2026-09-28')).toBe('2026-09-28');
    // Fr 02.10. geplant am Mo 28.09.; Mi 30.09. ist erlaubt
    expect(suggestCookDate('2026-10-02', chili, [3, 7], '2026-09-28')).toBe('2026-09-30');
  });
  it('Esstag in der Vergangenheit bleibt Esstag', () => {
    expect(suggestCookDate('2026-09-25', chili, [3, 7], '2026-09-28')).toBe('2026-09-25');
  });
});

describe('visibleSlots', () => {
  it('Slots der Personen plus Slots, in denen schon etwas geplant ist', () => {
    const persons = [person('a', ['lunch', 'dinner'])];
    const m: Meal = { id: 'x', date: '2026-09-28', slot: 'breakfast', recipeId: 'overnight-oats', cookDate: '2026-09-28', portions: { a: 1 }, pinned: false };
    expect(visibleSlots(persons, [])).toEqual(['lunch', 'dinner']);
    expect(visibleSlots(persons, [m])).toEqual(['breakfast', 'lunch', 'dinner']);
  });
});

describe('shoppingMealRange', () => {
  it('lädt Mahlzeiten bis eine Woche nach Wochenende (vorgekocht diese Woche, gegessen nächste)', () => {
    expect(shoppingMealRange('2026-09-28')).toEqual({ from: '2026-09-28', to: '2026-10-11' });
  });
});
