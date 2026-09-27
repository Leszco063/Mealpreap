import { afterEach, describe, expect, it } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createMealprepDb, type MealprepDb } from './database';
import { changePortion, deletePerson, ensureHousehold, HOUSEHOLD_ID, saveMeal, savePerson, setChecked, updateHousehold } from './repo';
import type { Meal, Person } from '../domain/types';

let db: MealprepDb;
let counter = 0;
async function freshDb() {
  db = await createMealprepDb(`test${Date.now()}x${counter++}`, getRxStorageMemory());
  return db;
}
afterEach(async () => {
  await db.remove();
});

const alex: Person = {
  id: 'a',
  name: 'Alex',
  targets: { kcal: 2500, proteinMin: 150 },
  mealSlots: ['lunch'],
  diet: 'omnivore',
  noPork: false,
  allergies: [],
  dislikedIngredientIds: [],
  maxMinutesWeekday: 30,
  maxMinutesCookDay: 120,
};
const meal = (id: string, portions: Record<string, number>): Meal => ({
  id,
  date: '2026-09-28',
  slot: 'lunch',
  recipeId: 'chili',
  cookDate: '2026-09-27',
  portions,
  pinned: false,
});

describe('repo', () => {
  it('ensureHousehold legt genau einen Standard-Haushalt an', async () => {
    await freshDb();
    const first = await ensureHousehold(db);
    const second = await ensureHousehold(db);
    expect(first.id).toBe(HOUSEHOLD_ID);
    expect(second.weeklyBudgetEur).toBe(first.weeklyBudgetEur);
    expect(await db.households.count().exec()).toBe(1);
  });

  it('ensureHousehold verträgt gleichzeitige Aufrufe (React StrictMode)', async () => {
    await freshDb();
    const [a, b] = await Promise.all([ensureHousehold(db), ensureHousehold(db)]);
    expect(a.id).toBe(HOUSEHOLD_ID);
    expect(b.id).toBe(HOUSEHOLD_ID);
    expect(await db.households.count().exec()).toBe(1);
  });

  it('savePerson speichert mit Haushalt und Zeitstempel', async () => {
    await freshDb();
    await savePerson(db, alex);
    const doc = await db.persons.findOne('a').exec();
    expect(doc?.householdId).toBe(HOUSEHOLD_ID);
    expect(doc?.updatedAt).toBeGreaterThan(0);
  });

  it('deletePerson entfernt die Person aus allen Mahlzeiten und löscht leere Mahlzeiten', async () => {
    await freshDb();
    await savePerson(db, alex);
    await savePerson(db, { ...alex, id: 'b', name: 'Bea' });
    await saveMeal(db, meal('m1', { a: 1, b: 1 }));
    await saveMeal(db, meal('m2', { a: 1 }));
    await deletePerson(db, 'a');
    expect(await db.persons.findOne('a').exec()).toBeNull();
    expect((await db.meals.findOne('m1').exec())?.toMutableJSON().portions).toEqual({ b: 1 });
    expect(await db.meals.findOne('m2').exec()).toBeNull();
  });

  it('setChecked schreibt pro Einkaufsliste und Zutat ein Dokument', async () => {
    await freshDb();
    await setChecked(db, '2026-09-28_2026-10-04', 'zwiebel', true);
    await setChecked(db, '2026-09-28_2026-10-04', 'zwiebel', false);
    await setChecked(db, '2026-09-30_2026-10-03', 'zwiebel', true);
    const docs = await db.shoppingchecks.find().exec();
    expect(docs.map((d) => [d.id, d.checked]).sort()).toEqual([
      ['2026-09-28_2026-10-04:zwiebel', false],
      ['2026-09-30_2026-10-03:zwiebel', true],
    ]);
  });

  it('changePortion verliert bei schnellen Klicks keine Änderung', async () => {
    await freshDb();
    await saveMeal(db, meal('m1', { a: 1, b: 1 }));
    await Promise.all([changePortion(db, 'm1', 'a', 0.25), changePortion(db, 'm1', 'a', 0.25), changePortion(db, 'm1', 'b', -0.25)]);
    expect((await db.meals.findOne('m1').exec())?.toMutableJSON().portions).toEqual({ a: 1.5, b: 0.75 });
  });

  it('changePortion auf 0 entfernt die Person aus der Mahlzeit', async () => {
    await freshDb();
    await saveMeal(db, meal('m1', { a: 0.25, b: 1 }));
    await changePortion(db, 'm1', 'a', -0.25);
    expect((await db.meals.findOne('m1').exec())?.toMutableJSON().portions).toEqual({ b: 1 });
  });

  it('updateHousehold verliert bei schnellen Änderungen nichts', async () => {
    await freshDb();
    await ensureHousehold(db);
    await Promise.all([
      updateHousehold(db, (h) => ({ ...h, cookDays: [...h.cookDays, 1] })),
      updateHousehold(db, (h) => ({ ...h, cookDays: [...h.cookDays, 5] })),
      updateHousehold(db, (h) => ({ ...h, weeklyBudgetEur: 90 })),
    ]);
    const h = (await db.households.findOne(HOUSEHOLD_ID).exec())?.toMutableJSON();
    expect(h?.cookDays.sort()).toEqual([1, 3, 5, 7]);
    expect(h?.weeklyBudgetEur).toBe(90);
  });
});
