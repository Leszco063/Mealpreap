import { createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb/plugins/core';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { householdSchema, mealSchema, personSchema, shoppingCheckSchema } from './schemas';
import type { HouseholdDoc, MealDoc, PersonDoc, ShoppingCheckDoc } from './types';

export interface MealprepCollections {
  households: RxCollection<HouseholdDoc>;
  persons: RxCollection<PersonDoc>;
  meals: RxCollection<MealDoc>;
  shoppingchecks: RxCollection<ShoppingCheckDoc>;
}
export type MealprepDb = RxDatabase<MealprepCollections>;
type Storage = Parameters<typeof createRxDatabase>[0]['storage'];

export async function createMealprepDb(name: string, storage: Storage): Promise<MealprepDb> {
  const db = await createRxDatabase<MealprepCollections>({ name, storage, multiInstance: false });
  await db.addCollections({
    households: { schema: householdSchema },
    persons: { schema: personSchema },
    meals: { schema: mealSchema },
    shoppingchecks: { schema: shoppingCheckSchema },
  });
  return db;
}

let dbPromise: Promise<MealprepDb> | null = null;

/** Die Datenbank im Browser (IndexedDB über Dexie), einmal pro Seite erzeugt */
export function getDb(): Promise<MealprepDb> {
  dbPromise ??= createMealprepDb('mealprep', getRxStorageDexie());
  return dbPromise;
}
