import { describe, expect, it } from 'vitest';
import { checkMeal, checkRecipeForPerson, checkSlot, checkStorage, checkTime, type MealCheckContext } from './rules';
import { makeLookup } from './recipe';
import { allIngredients, allRecipes, chili, lachsPfanne, overnightOats } from './fixtures.test-data';
import type { Meal, Person, Recipe } from './types';

const lookup = makeLookup(allIngredients);

function person(part: Partial<Person>): Person {
  return {
    id: 'a',
    name: 'Alex',
    targets: { kcal: 2500, proteinMin: 150 },
    mealSlots: ['breakfast', 'lunch', 'dinner'],
    diet: 'omnivore',
    noPork: false,
    allergies: [],
    dislikedIngredientIds: [],
    maxMinutesWeekday: 30,
    maxMinutesCookDay: 120,
    ...part,
  };
}

describe('checkRecipeForPerson', () => {
  it('passt → keine Verstöße', () => {
    expect(checkRecipeForPerson(chili, person({}), lookup)).toEqual([]);
  });

  it('Ernährungsform', () => {
    const v = checkRecipeForPerson(chili, person({ diet: 'vegetarian' }), lookup);
    expect(v).toEqual([
      { code: 'diet', personId: 'a', message: 'Chili passt nicht zur Ernährungsform von Alex (vegetarisch)' },
    ]);
  });

  it('kein Schwein', () => {
    const r: Recipe = { ...chili, title: 'Frikadellen', ingredients: [{ ingredientId: 'schweinehack', amount: 500, unit: 'g' }] };
    expect(checkRecipeForPerson(r, person({ noPork: true }), lookup).map((v) => v.code)).toEqual(['pork']);
  });

  it('Allergie – auch über optionale Zutaten', () => {
    const v = checkRecipeForPerson(chili, person({ allergies: ['milk'] }), lookup);
    expect(v).toEqual([
      { code: 'allergen', personId: 'a', message: 'Chili enthält Milch – Allergie/Unverträglichkeit von Alex' },
    ]);
  });

  it('abgelehnte Zutat', () => {
    const v = checkRecipeForPerson(chili, person({ dislikedIngredientIds: ['zwiebel'] }), lookup);
    expect(v).toEqual([{ code: 'disliked', personId: 'a', message: 'Chili enthält Zwiebel – mag Alex nicht' }]);
  });
});

describe('checkSlot / checkStorage / checkTime', () => {
  it('Slot', () => {
    expect(checkSlot(chili, 'dinner')).toEqual([]);
    expect(checkSlot(chili, 'breakfast')).toEqual([{ code: 'slot', message: 'Chili ist nicht als Frühstück gedacht' }]);
  });

  it('vorgekocht: nur an Kochtagen, frisch am selben Tag immer erlaubt', () => {
    expect(checkStorage({ cookDate: '2026-09-29', date: '2026-10-01' }, chili, false)).toEqual([
      { code: 'storage', message: 'Chili wird vorgekocht, aber 2026-09-29 ist kein Kochtag' },
    ]);
    expect(checkStorage({ cookDate: '2026-09-29', date: '2026-09-29' }, chili, false)).toEqual([]);
    expect(checkStorage({ cookDate: '2026-09-29', date: '2026-10-01' }, chili, true)).toEqual([]);
  });

  it('vorgekocht: innerhalb der Haltbarkeit ok, danach Verstoß', () => {
    expect(checkStorage({ cookDate: '2026-09-27', date: '2026-10-01' }, chili)).toEqual([]);
    expect(checkStorage({ cookDate: '2026-09-27', date: '2026-10-02' }, chili)).toEqual([
      { code: 'storage', message: 'Chili hält nur 4 Tage im Kühlschrank (hier 5 Tage)' },
    ]);
  });

  it('frisch: nur am selben Tag', () => {
    expect(checkStorage({ cookDate: '2026-09-28', date: '2026-09-28' }, lachsPfanne)).toEqual([]);
    expect(checkStorage({ cookDate: '2026-09-28', date: '2026-09-29' }, lachsPfanne)).toEqual([
      { code: 'storage', message: 'Lachs aus der Pfanne sollte am Tag der Zubereitung gegessen werden' },
    ]);
  });

  it('gegessen vor dem Kochen', () => {
    expect(checkStorage({ cookDate: '2026-09-28', date: '2026-09-27' }, overnightOats)).toEqual([
      { code: 'storage', message: 'Overnight Oats mit Quark wird gegessen, bevor es gekocht ist' },
    ]);
  });

  it('Zeitlimit werktags vs. Kochtag', () => {
    const p = person({ maxMinutesWeekday: 20, maxMinutesCookDay: 120 });
    expect(checkTime(lachsPfanne, p, false)).toEqual([
      { code: 'time', personId: 'a', message: 'Lachs aus der Pfanne dauert 25 Min. – Alex hat an diesem Tag max. 20 Min.' },
    ]);
    expect(checkTime(lachsPfanne, p, true)).toEqual([]);
  });
});

describe('checkMeal', () => {
  const persons = [person({ id: 'a', name: 'Alex' }), person({ id: 'b', name: 'Bea', diet: 'vegetarian' })];
  const ctx: MealCheckContext = {
    lookupIngredient: lookup,
    lookupRecipe: makeLookup(allRecipes),
    persons,
    cookWeekdays: [7],
  };
  const base: Meal = {
    id: 'm1',
    date: '2026-09-28',
    slot: 'lunch',
    recipeId: 'chili',
    cookDate: '2026-09-27',
    portions: { a: 1.4, b: 0.9 },
    pinned: false,
  };

  it('prüft jede essende Person', () => {
    expect(checkMeal(base, ctx).map((v) => [v.code, v.personId])).toEqual([['diet', 'b']]);
  });

  it('Personen mit 0 Portionen werden ignoriert', () => {
    expect(checkMeal({ ...base, portions: { a: 1, b: 0 } }, ctx)).toEqual([]);
  });

  it('Portionen für eine unbekannte Person → missing', () => {
    expect(checkMeal({ ...base, portions: { a: 1, zz: 1, yy: 0 } }, ctx)).toEqual([
      { code: 'missing', personId: 'zz', message: 'Person zz gibt es nicht mehr im Haushalt' },
    ]);
  });

  it('vorgekocht an einem Nicht-Kochtag → storage', () => {
    // Dienstag gekocht, Donnerstag gegessen, Kochtag ist nur Sonntag
    const v = checkMeal({ ...base, portions: { a: 1 }, cookDate: '2026-09-29', date: '2026-10-01' }, ctx);
    // zusätzlich 'time': 45 Min. an einem Werktag bei 30 Min. Limit
    expect(v.map((x) => x.code)).toEqual(['storage', 'time']);
    expect(v[0]?.message).toBe('Chili wird vorgekocht, aber 2026-09-29 ist kein Kochtag');
  });

  it('fehlende Zutat verdeckt keine anderen Verstöße (Allergie bleibt sichtbar)', () => {
    const ohneZwiebel = { ...ctx, lookupIngredient: makeLookup(allIngredients.filter((i) => i.id !== 'zwiebel')) };
    const allergisch = { ...ctx, ...ohneZwiebel, persons: [person({ id: 'a', allergies: ['milk'] })] };
    expect(checkMeal({ ...base, portions: { a: 1 } }, allergisch).map((v) => v.code)).toEqual(['missing', 'allergen']);
  });

  it('Kochtag-Zeitlimit gilt am Kochtag (Sonntag)', () => {
    const lang: Recipe = { ...chili, id: 'lang', cookMinutes: 90 };
    const c = { ...ctx, lookupRecipe: makeLookup([...allRecipes, lang]) };
    expect(checkMeal({ ...base, recipeId: 'lang', portions: { a: 1 } }, c)).toEqual([]);
    expect(
      checkMeal({ ...base, recipeId: 'lang', portions: { a: 1 }, cookDate: '2026-09-28' }, c).map((v) => v.code),
    ).toEqual(['time']);
  });

  it('fehlendes Rezept oder fehlende Zutat → missing statt Absturz', () => {
    expect(checkMeal({ ...base, recipeId: 'weg' }, ctx)).toEqual([
      { code: 'missing', message: 'Rezept weg ist nicht mehr verfügbar' },
    ]);
    const ohneZwiebel = { ...ctx, lookupIngredient: makeLookup(allIngredients.filter((i) => i.id !== 'zwiebel')) };
    expect(checkMeal({ ...base, portions: { a: 1 } }, ohneZwiebel).map((v) => v.code)).toEqual(['missing']);
  });
});
