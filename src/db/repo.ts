import type { Meal, Person } from '../domain/types';
import type { MealprepDb } from './database';
import type { HouseholdDoc } from './types';

export const HOUSEHOLD_ID = 'haushalt';

export const DEFAULT_HOUSEHOLD: Omit<HouseholdDoc, 'updatedAt'> = {
  id: HOUSEHOLD_ID,
  name: 'Unser Haushalt',
  weeklyBudgetEur: 70,
  cookDays: [7, 3],
  weekStartsOn: 1,
};

export function newId(): string {
  return crypto.randomUUID();
}

export async function ensureHousehold(db: MealprepDb): Promise<HouseholdDoc> {
  const existing = await db.households.findOne(HOUSEHOLD_ID).exec();
  if (existing) return existing.toMutableJSON();
  const created = await db.households.insert({ ...DEFAULT_HOUSEHOLD, updatedAt: Date.now() });
  return created.toMutableJSON();
}

export async function saveHousehold(db: MealprepDb, household: Omit<HouseholdDoc, 'updatedAt'>): Promise<void> {
  await db.households.upsert({ ...household, updatedAt: Date.now() });
}

export async function savePerson(db: MealprepDb, person: Person): Promise<void> {
  await db.persons.upsert({ ...person, householdId: HOUSEHOLD_ID, updatedAt: Date.now() });
}

/** Löscht eine Person und entfernt sie aus allen Mahlzeiten; Mahlzeiten ohne Esser werden gelöscht. */
export async function deletePerson(db: MealprepDb, personId: string): Promise<void> {
  const meals = await db.meals.find().exec();
  for (const doc of meals) {
    const m = doc.toMutableJSON();
    if (!(personId in m.portions)) continue;
    const portions = { ...m.portions };
    delete portions[personId];
    if (Object.keys(portions).length === 0) await doc.remove();
    else await doc.incrementalPatch({ portions, updatedAt: Date.now() });
  }
  await db.persons.findOne(personId).remove();
}

export async function saveMeal(db: MealprepDb, meal: Meal): Promise<void> {
  await db.meals.upsert({ ...meal, householdId: HOUSEHOLD_ID, updatedAt: Date.now() });
}

export async function deleteMeal(db: MealprepDb, mealId: string): Promise<void> {
  await db.meals.findOne(mealId).remove();
}

export async function setChecked(db: MealprepDb, weekStart: string, ingredientId: string, checked: boolean): Promise<void> {
  await db.shoppingchecks.upsert({
    id: `${weekStart}:${ingredientId}`,
    householdId: HOUSEHOLD_ID,
    weekStart,
    ingredientId,
    checked,
    updatedAt: Date.now(),
  });
}
