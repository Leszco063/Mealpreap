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
  try {
    const created = await db.households.insert({ ...DEFAULT_HOUSEHOLD, updatedAt: Date.now() });
    return created.toMutableJSON();
  } catch (e) {
    // Gleichzeitiger zweiter Aufruf (z. B. React StrictMode, zweiter Tab) hat ihn schon angelegt
    if ((e as { code?: string }).code !== 'CONFLICT') throw e;
    const winner = await db.households.findOne(HOUSEHOLD_ID).exec();
    if (!winner) throw e;
    return winner.toMutableJSON();
  }
}

export async function saveHousehold(db: MealprepDb, household: Omit<HouseholdDoc, 'updatedAt'>): Promise<void> {
  await db.households.upsert({ ...household, updatedAt: Date.now() });
}

/** Ändert den Haushalt auf Basis des aktuell gespeicherten Stands – schnelle Klicks gehen nicht verloren. */
export async function updateHousehold(db: MealprepDb, change: (h: HouseholdDoc) => HouseholdDoc): Promise<void> {
  const doc = await db.households.findOne(HOUSEHOLD_ID).exec();
  if (!doc) return;
  await doc.incrementalModify((current) => ({ ...change(current), updatedAt: Date.now() }));
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

/**
 * Ändert die Portion einer Person um delta (auf 0,25 gerundet) auf Basis des gespeicherten Stands.
 * 0 entfernt die Person aus der Mahlzeit.
 */
export async function changePortion(db: MealprepDb, mealId: string, personId: string, delta: number): Promise<void> {
  const doc = await db.meals.findOne(mealId).exec();
  if (!doc) return;
  await doc.incrementalModify((current) => {
    const next = Math.max(0, Math.round(((current.portions[personId] ?? 0) + delta) * 4) / 4);
    const portions = { ...current.portions, [personId]: next };
    if (next === 0) delete portions[personId];
    return { ...current, portions, updatedAt: Date.now() };
  });
}

export async function deleteMeal(db: MealprepDb, mealId: string): Promise<void> {
  await db.meals.findOne(mealId).remove();
}

/** Schlüssel einer Einkaufsliste: jeder Zeitraum (Woche, Kochtag, Tag) hat eigene Haken */
export function listKey(from: string, to: string): string {
  return `${from}_${to}`;
}

export async function setChecked(db: MealprepDb, key: string, ingredientId: string, checked: boolean): Promise<void> {
  await db.shoppingchecks.upsert({
    id: `${key}:${ingredientId}`,
    householdId: HOUSEHOLD_ID,
    listKey: key,
    ingredientId,
    checked,
    updatedAt: Date.now(),
  });
}
