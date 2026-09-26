import { afterEach, describe, expect, it } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createMealprepDb, type MealprepDb } from './database';
import { deletePerson, ensureHousehold, HOUSEHOLD_ID, saveMeal, savePerson, setChecked } from './repo';
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

  it('setChecked schreibt pro Woche und Zutat ein Dokument', async () => {
    await freshDb();
    await setChecked(db, '2026-09-28', 'zwiebel', true);
    await setChecked(db, '2026-09-28', 'zwiebel', false);
    const docs = await db.shoppingchecks.find().exec();
    expect(docs.map((d) => [d.id, d.checked])).toEqual([['2026-09-28:zwiebel', false]]);
  });
});
