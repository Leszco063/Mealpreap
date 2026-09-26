# Stufe 1c-a – Erste sichtbare App – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine benutzbare, offline-fähige App mit den Bereichen Woche (Plan von Hand), Rezepte (Liste + Detail), Einkauf (Woche/Kochtag/Tag, abhakbar) und Haushalt (Budget, Kochtage, Personen, Ziel-Rechner), veröffentlicht über GitHub Pages.

**Architecture:** React-UI unter `src/ui/`, Datenhaltung mit RxDB (Dexie/IndexedDB im Browser, Memory-Storage in Tests) unter `src/db/`, Rechenlogik unverändert aus `src/domain/` plus zwei kleine Helfer. Der Katalog wird als `catalog.json` geladen. Navigation per Hash-Routing (`#/woche`, `#/rezepte/<id>` …), damit GitHub Pages ohne Server-Konfiguration funktioniert. Ein einziger lokaler Haushalt (`id = "haushalt"`) bis zum Sync in Stufe 3.

**Tech Stack:** React 19, Tailwind 4, RxDB 17 (`rxdb`, `rxjs`), vite-plugin-pwa, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-mealprep-planer-design.md` (§3, §5.2, §7, §9 Offline-Teil)

**Nicht in diesem Plan (folgt in 1c-b):** Kochtag-Ansicht mit Boxen, Abneigungen-Auswahl, eigene Rezepte/Preise, Bewertungen, Export/Import, Update-Hinweis, installierbare PNG-Icons, Playwright.

## Global Constraints

- Oberfläche komplett Deutsch, mobile-first (max. Breite 42 rem), heller und dunkler Modus über `dark:`-Klassen (System-Einstellung).
- Alle Rechnungen über `src/domain/` – keine Nährwert-/Preis-Logik in Komponenten.
- Datumswerte `YYYY-MM-DD`; Wochenstart Montag.
- Jede Schreiboperation setzt `updatedAt = Date.now()` und `householdId = "haushalt"` (Vorbereitung auf Sync).
- Git über das Bash-Tool, Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Keine Heredocs mit Anführungszeichen im Bash-Tool – Dateien mit dem Write-Werkzeug anlegen.

## Review Focus

- **Person löschen, die in Mahlzeiten eingeplant ist:** Portionen dieser Person verschwinden aus allen Mahlzeiten; Mahlzeiten ohne Esser werden gelöscht → Test in Task 2.
- **Woche ohne Kochtag / Datum vor erstem Kochtag:** vorgeschlagener Kochtag darf nie nach dem Esstag liegen und nie außerhalb der Haltbarkeit → Test in Task 1.
- **Leerer Haushalt (keine Personen):** Woche und Einkauf zeigen einen Hinweis statt leerer oder kaputter Ansicht → Browser-Prüfung Task 6/7.
- **Katalog nicht erreichbar (offline beim allerersten Start):** verständliche Fehlermeldung statt weißer Seite → Task 3.
- **Portionen auf 0 gesetzt:** Mahlzeit bleibt sichtbar, zählt nicht in Nährwerte/Einkauf → Test in Task 1 (dayNutrition) und bestehende Einkaufs-Tests.

---

### Task 1: Datum- und Planungshelfer

**Files:**
- Modify: `src/domain/dates.ts`, `src/domain/dates.test.ts`
- Create: `src/domain/plan.ts`, `src/domain/plan.test.ts`

**Interfaces:**
- Produces: `startOfWeek(d: IsoDate, weekStartsOn?: number): IsoDate`, `todayLocal(now?: Date): IsoDate`; `defaultPortions(persons: readonly Person[], slot: MealType): Record<string, number>`, `suggestCookDate(date: IsoDate, recipe: Recipe, cookWeekdays: readonly number[]): IsoDate`, `interface NutritionContext { lookupRecipe: (id: string) => Recipe | undefined; lookupIngredient: IngredientLookup }`, `dayNutrition(meals: readonly Meal[], date: IsoDate, personId: string, ctx: NutritionContext): Nutrients`

- [ ] **Step 1: Failing Tests** – an `src/domain/dates.test.ts` anhängen (Import-Zeile um `startOfWeek, todayLocal` erweitern):

```ts
describe('startOfWeek / todayLocal', () => {
  it('Montag als Wochenstart', () => {
    expect(startOfWeek('2026-09-30')).toBe('2026-09-28');
    expect(startOfWeek('2026-09-28')).toBe('2026-09-28');
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28');
  });
  it('Sonntag als Wochenstart', () => {
    expect(startOfWeek('2026-09-30', 7)).toBe('2026-09-27');
  });
  it('todayLocal nutzt lokale Zeit', () => {
    expect(todayLocal(new Date(2026, 8, 26, 23, 30))).toBe('2026-09-26');
    expect(todayLocal(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });
});
```

`src/domain/plan.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { dayNutrition, defaultPortions, suggestCookDate } from './plan';
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
```

- [ ] **Step 2: Ausführen** – `npx vitest run src/domain/dates.test.ts src/domain/plan.test.ts` → FAIL (`startOfWeek` fehlt / `./plan` fehlt).

- [ ] **Step 3: Implementieren** – an `src/domain/dates.ts` anhängen:

```ts
/** Erster Tag der Woche, in der d liegt (1 = Montag … 7 = Sonntag als Wochenstart) */
export function startOfWeek(d: IsoDate, weekStartsOn = 1): IsoDate {
  const diff = (isoWeekday(d) - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

/** Heutiges Datum in der lokalen Zeitzone des Geräts */
export function todayLocal(now: Date = new Date()): IsoDate {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}
```

`src/domain/plan.ts`:
```ts
import type { IsoDate, Meal, MealType, Nutrients, Person, Recipe } from './types';
import { addDays, isoWeekday } from './dates';
import { addNutrients, perPortion, scaleNutrients, ZERO } from './nutrition';
import { MissingIngredientError, type IngredientLookup } from './recipe';
import { UnitError } from './units';

/** Standard-Portionen: 1 für jede Person, die diesen Slot isst */
export function defaultPortions(persons: readonly Person[], slot: MealType): Record<string, number> {
  return Object.fromEntries(persons.filter((p) => p.mealSlots.includes(slot)).map((p) => [p.id, 1]));
}

/**
 * Vorschlag für den Kochtag: frische Gerichte am Esstag, vorkochbare am letzten
 * Kochtag, von dem aus das Gericht noch haltbar ist – sonst am Esstag selbst.
 */
export function suggestCookDate(date: IsoDate, recipe: Recipe, cookWeekdays: readonly number[]): IsoDate {
  if (recipe.storage.kind === 'fresh') return date;
  for (let back = 0; back <= recipe.storage.fridgeDays; back++) {
    const candidate = addDays(date, -back);
    if (cookWeekdays.includes(isoWeekday(candidate))) return candidate;
  }
  return date;
}

export interface NutritionContext {
  lookupRecipe: (id: string) => Recipe | undefined;
  lookupIngredient: IngredientLookup;
}

/** Nährwerte, die eine Person an einem Tag laut Plan isst. Fehlende Rezepte/Zutaten werden übersprungen. */
export function dayNutrition(meals: readonly Meal[], date: IsoDate, personId: string, ctx: NutritionContext): Nutrients {
  let total = ZERO;
  for (const meal of meals) {
    if (meal.date !== date) continue;
    const factor = meal.portions[personId] ?? 0;
    if (factor <= 0) continue;
    const recipe = ctx.lookupRecipe(meal.recipeId);
    if (!recipe) continue;
    try {
      total = addNutrients(total, scaleNutrients(perPortion(recipe, ctx.lookupIngredient), factor));
    } catch (e) {
      if (e instanceof MissingIngredientError || e instanceof UnitError) continue;
      throw e;
    }
  }
  return total;
}
```

- [ ] **Step 4: Ausführen** – `npx vitest run src/domain && npm run typecheck` → PASS.
- [ ] **Step 5: Commit** – `feat: Planungshelfer (Wochenstart, Kochtag-Vorschlag, Tagesnährwerte)`.

---

### Task 2: Datenhaltung mit RxDB

**Files:**
- Modify: `package.json` (Abhängigkeiten `rxdb`, `rxjs`)
- Create: `src/db/types.ts`, `src/db/schemas.ts`, `src/db/database.ts`, `src/db/repo.ts`, `src/db/hooks.ts`, `src/db/repo.test.ts`

**Interfaces:**
- Produces: `HouseholdDoc`, `PersonDoc`, `MealDoc`, `ShoppingCheckDoc`; `type MealprepDb`; `createMealprepDb(name, storage)`, `getDb(): Promise<MealprepDb>`; `HOUSEHOLD_ID = 'haushalt'`, `newId()`, `ensureHousehold(db)`, `saveHousehold(db, h)`, `savePerson(db, p: Person)`, `deletePerson(db, id)`, `saveMeal(db, m: Meal)`, `deleteMeal(db, id)`, `setChecked(db, weekStart, ingredientId, checked)`; Hooks `useHousehold(db)`, `usePersons(db)`, `useMeals(db, from, to)`, `useChecks(db, weekStart)`.

- [ ] **Step 1: Installieren** – `npm install rxdb rxjs` → Expected: ohne Fehler.

- [ ] **Step 2: `src/db/types.ts`**
```ts
import type { Meal, Person } from '../domain/types';

export interface HouseholdDoc {
  id: string;
  name: string;
  weeklyBudgetEur: number;
  /** 1 = Montag … 7 = Sonntag */
  cookDays: number[];
  weekStartsOn: number;
  updatedAt: number;
}

export type PersonDoc = Person & { householdId: string; updatedAt: number };
export type MealDoc = Meal & { householdId: string; updatedAt: number };

export interface ShoppingCheckDoc {
  /** `${weekStart}:${ingredientId}` */
  id: string;
  householdId: string;
  weekStart: string;
  ingredientId: string;
  checked: boolean;
  updatedAt: number;
}
```

- [ ] **Step 3: `src/db/schemas.ts`**
```ts
import type { RxJsonSchema } from 'rxdb/plugins/core';
import type { HouseholdDoc, MealDoc, PersonDoc, ShoppingCheckDoc } from './types';

const id = { type: 'string', maxLength: 100 } as const;
const stringArray = { type: 'array', items: { type: 'string' } } as const;

export const householdSchema: RxJsonSchema<HouseholdDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id,
    name: { type: 'string' },
    weeklyBudgetEur: { type: 'number' },
    cookDays: { type: 'array', items: { type: 'integer' } },
    weekStartsOn: { type: 'integer' },
    updatedAt: { type: 'number' },
  },
  required: ['id', 'name', 'weeklyBudgetEur', 'cookDays', 'weekStartsOn', 'updatedAt'],
};

export const personSchema: RxJsonSchema<PersonDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id,
    householdId: { type: 'string' },
    name: { type: 'string' },
    userId: { type: 'string' },
    targets: {
      type: 'object',
      properties: {
        kcal: { type: 'number' },
        proteinMin: { type: 'number' },
        fatMin: { type: 'number' },
        fatMax: { type: 'number' },
        carbsMin: { type: 'number' },
        carbsMax: { type: 'number' },
      },
      required: ['kcal', 'proteinMin'],
    },
    mealSlots: stringArray,
    diet: { type: 'string' },
    noPork: { type: 'boolean' },
    allergies: stringArray,
    dislikedIngredientIds: stringArray,
    maxMinutesWeekday: { type: 'number' },
    maxMinutesCookDay: { type: 'number' },
    updatedAt: { type: 'number' },
  },
  required: [
    'id',
    'householdId',
    'name',
    'targets',
    'mealSlots',
    'diet',
    'noPork',
    'allergies',
    'dislikedIngredientIds',
    'maxMinutesWeekday',
    'maxMinutesCookDay',
    'updatedAt',
  ],
};

export const mealSchema: RxJsonSchema<MealDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id,
    householdId: { type: 'string' },
    date: { type: 'string' },
    slot: { type: 'string' },
    recipeId: { type: 'string' },
    cookDate: { type: 'string' },
    portions: { type: 'object' },
    pinned: { type: 'boolean' },
    updatedAt: { type: 'number' },
  },
  required: ['id', 'householdId', 'date', 'slot', 'recipeId', 'cookDate', 'portions', 'pinned', 'updatedAt'],
};

export const shoppingCheckSchema: RxJsonSchema<ShoppingCheckDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id,
    householdId: { type: 'string' },
    weekStart: { type: 'string' },
    ingredientId: { type: 'string' },
    checked: { type: 'boolean' },
    updatedAt: { type: 'number' },
  },
  required: ['id', 'householdId', 'weekStart', 'ingredientId', 'checked', 'updatedAt'],
};
```

- [ ] **Step 4: `src/db/database.ts`**
```ts
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
```

- [ ] **Step 5: Failing Test `src/db/repo.test.ts`**
```ts
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
```

- [ ] **Step 6: Ausführen** – `npx vitest run src/db` → FAIL (`./repo` fehlt).

- [ ] **Step 7: `src/db/repo.ts`**
```ts
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
```

- [ ] **Step 8: `src/db/hooks.ts`** (keine Unit-Tests; wird im Browser geprüft)
```ts
import { useEffect, useState } from 'react';
import type { MealprepDb } from './database';
import { HOUSEHOLD_ID } from './repo';
import type { HouseholdDoc, MealDoc, PersonDoc } from './types';

export function useHousehold(db: MealprepDb): HouseholdDoc | null {
  const [value, setValue] = useState<HouseholdDoc | null>(null);
  useEffect(() => {
    const sub = db.households.findOne(HOUSEHOLD_ID).$.subscribe((doc) => setValue(doc ? doc.toMutableJSON() : null));
    return () => sub.unsubscribe();
  }, [db]);
  return value;
}

export function usePersons(db: MealprepDb): PersonDoc[] {
  const [value, setValue] = useState<PersonDoc[]>([]);
  useEffect(() => {
    const sub = db.persons.find().$.subscribe((docs) =>
      setValue(docs.map((d) => d.toMutableJSON()).sort((a, b) => a.name.localeCompare(b.name, 'de'))),
    );
    return () => sub.unsubscribe();
  }, [db]);
  return value;
}

/** Mahlzeiten mit Esstag im Zeitraum (inklusive) */
export function useMeals(db: MealprepDb, from: string, to: string): MealDoc[] {
  const [value, setValue] = useState<MealDoc[]>([]);
  useEffect(() => {
    const sub = db.meals
      .find({ selector: { date: { $gte: from, $lte: to } } })
      .$.subscribe((docs) => setValue(docs.map((d) => d.toMutableJSON())));
    return () => sub.unsubscribe();
  }, [db, from, to]);
  return value;
}

/** Abhak-Status der Einkaufsliste einer Woche: ingredientId → abgehakt */
export function useChecks(db: MealprepDb, weekStart: string): Map<string, boolean> {
  const [value, setValue] = useState<Map<string, boolean>>(new Map());
  useEffect(() => {
    const sub = db.shoppingchecks
      .find({ selector: { weekStart } })
      .$.subscribe((docs) => setValue(new Map(docs.map((d) => [d.ingredientId, d.checked]))));
    return () => sub.unsubscribe();
  }, [db, weekStart]);
  return value;
}
```

- [ ] **Step 9: Ausführen** – `npx vitest run src/db && npm run typecheck && npm run lint` → PASS. Falls die RxDB-Typen bei `upsert`/`toMutableJSON` andere Rückgabetypen melden: Ruling im Ledger, Typ-Anpassung minimal halten (kein `any`).
- [ ] **Step 10: Commit** – `feat: Datenhaltung mit RxDB (Haushalt, Personen, Mahlzeiten, Abhaken)`.

---

### Task 3: App-Rahmen – Katalog laden, Kontext, Navigation

**Files:**
- Create: `src/ui/format.ts`, `src/ui/format.test.ts`, `src/ui/recipeInfo.ts`, `src/ui/recipeInfo.test.ts`, `src/ui/context.ts`, `src/ui/router.ts`, `src/ui/components.tsx`, `src/ui/Shell.tsx`, `.claude/launch.json`
- Modify: `src/App.tsx`, `index.html`

**Interfaces:**
- Consumes: `getDb`, `ensureHousehold` (Task 2); Domain-Module.
- Produces: `useApp(): AppData` mit `{ db, catalog, lookupRecipe, lookupIngredient, recipeInfos }`; `useRoute(): string[]`, `go(path: string)`; Formatierer `fmtEur`, `fmtKcal`, `fmtGram`, `fmtNum`, `fmtOne`, `fmtDay`, `fmtAmount`, `WEEKDAY_SHORT`, `UNIT_LABEL`; UI-Bausteine `Screen`, `Card`, `Chip`, `Button`, `Field`, `inputClass`, `NumberInput`, `ProgressBar`, `Modal`, `Badge`; `RecipeInfo`, `buildRecipeInfos(catalog)`.

- [ ] **Step 1: Failing Tests**

`src/ui/format.test.ts`:
```ts
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
```

`src/ui/recipeInfo.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildRecipeInfos } from './recipeInfo';
import { allIngredients, allRecipes } from '../domain/fixtures.test-data';

describe('buildRecipeInfos', () => {
  it('berechnet Nährwerte, Preis, Ernährungsform und Zeit je Rezept', () => {
    const infos = buildRecipeInfos({ version: 't', ingredients: allIngredients, recipes: allRecipes });
    expect(infos.size).toBe(3);
    const oats = infos.get('overnight-oats');
    expect(oats?.perPortion.kcal).toBeCloseTo(318.32, 2);
    expect(oats?.eurPerPortion).toBeCloseTo(0.555, 3);
    expect(oats?.diets).toContain('vegetarian');
    expect(oats?.minutes).toBe(5);
  });
});
```

- [ ] **Step 2: Ausführen** – `npx vitest run src/ui` → FAIL.

- [ ] **Step 3: `src/ui/format.ts`**
```ts
import type { IsoDate, Unit } from '../domain/types';
import { isoWeekday } from '../domain/dates';

const num1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const num2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export const UNIT_LABEL: Record<Unit, string> = { g: 'g', ml: 'ml', stk: 'Stk.', el: 'EL', tl: 'TL' };

export const fmtEur = (n: number) => eur.format(n);
export const fmtKcal = (n: number) => `${Math.round(n)} kcal`;
export const fmtGram = (n: number) => (n >= 1000 ? `${num2.format(n / 1000)} kg` : `${Math.round(n)} g`);
export const fmtNum = (n: number) => num2.format(n);
export const fmtOne = (n: number) => num1.format(n);

export function fmtDay(d: IsoDate): string {
  const [, month, day] = d.split('-');
  return `${WEEKDAY_SHORT[isoWeekday(d) - 1]} ${day}.${month}.`;
}

export function fmtAmount(amount: number, unit: Unit): string {
  return `${num2.format(amount)} ${UNIT_LABEL[unit]}`;
}
```

`src/ui/recipeInfo.ts`:
```ts
import type { Catalog, Diet, Nutrients, Recipe } from '../domain/types';
import { makeLookup } from '../domain/recipe';
import { perPortion } from '../domain/nutrition';
import { recipeCostPerPortion } from '../domain/pricing';
import { dietsOf, recipeProfile } from '../domain/diet';

export interface RecipeInfo {
  recipe: Recipe;
  perPortion: Nutrients;
  eurPerPortion: number;
  diets: Diet[];
  minutes: number;
}

/** Einmal beim Start berechnete Kennzahlen je Rezept (für Listen und Auswahl) */
export function buildRecipeInfos(catalog: Catalog): Map<string, RecipeInfo> {
  const lookup = makeLookup(catalog.ingredients);
  return new Map(
    catalog.recipes.map((recipe) => [
      recipe.id,
      {
        recipe,
        perPortion: perPortion(recipe, lookup),
        eurPerPortion: recipeCostPerPortion(recipe, lookup).eur,
        diets: dietsOf(recipeProfile(recipe, lookup).flags),
        minutes: recipe.prepMinutes + recipe.cookMinutes,
      },
    ]),
  );
}
```

- [ ] **Step 4: Ausführen** – `npx vitest run src/ui` → PASS (6 Tests).

- [ ] **Step 5: Kontext, Router, Bausteine**

`src/ui/context.ts`:
```ts
import { createContext, useContext } from 'react';
import type { Catalog, Recipe } from '../domain/types';
import type { IngredientLookup } from '../domain/recipe';
import type { MealprepDb } from '../db/database';
import type { RecipeInfo } from './recipeInfo';

export interface AppData {
  db: MealprepDb;
  catalog: Catalog;
  lookupRecipe: (id: string) => Recipe | undefined;
  lookupIngredient: IngredientLookup;
  recipeInfos: Map<string, RecipeInfo>;
}

export const AppContext = createContext<AppData | null>(null);

export function useApp(): AppData {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppContext fehlt');
  return value;
}
```

`src/ui/router.ts`:
```ts
import { useEffect, useState } from 'react';

/** Hash-Routing: '#/rezepte/chili' → ['rezepte', 'chili'] */
export function useRoute(): string[] {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function go(path: string): void {
  window.location.hash = `#/${path}`;
}
```

`src/ui/components.tsx`:
```tsx
import type { ReactNode } from 'react';

export function Screen({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-4">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        {actions}
      </header>
      {children}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 ${className}`}>
      {children}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm ${
        active
          ? 'border-green-700 bg-green-700 text-white'
          : 'border-stone-300 text-stone-700 dark:border-stone-700 dark:text-stone-300'
      }`}
    >
      {children}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const styles = {
    primary: 'bg-green-700 text-white hover:bg-green-800',
    secondary:
      'border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800',
    danger:
      'border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles}`}>
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-stone-600 dark:text-stone-400">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'rounded-xl border border-stone-300 bg-white px-3 py-2 text-base dark:border-stone-700 dark:bg-stone-950';

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={inputClass}
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

/** Balken für einen Zielwert: min allein = Mindestwert, min+max = Zielbereich */
export function ProgressBar({ label, value, min, max }: { label: string; value: number; min: number; max?: number }) {
  const target = max ?? min;
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const ok = value >= min && (max === undefined || value <= max);
  const goal = max !== undefined ? `${Math.round(min)}–${Math.round(max)}` : `≥ ${Math.round(min)}`;
  return (
    <div className="text-xs">
      <div className="flex justify-between">
        <span>{label}</span>
        <span>
          {Math.round(value)} / {goal}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-stone-200 dark:bg-stone-800">
        <div className={`h-2 rounded-full ${ok ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-stone-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Schließen" className="text-2xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'stone' }: { children: ReactNode; tone?: 'stone' | 'green' | 'amber' | 'red' }) {
  const t = {
    stone: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    green: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${t}`}>{children}</span>;
}
```

`src/ui/Shell.tsx` (Bildschirme werden in Task 4–7 ergänzt; bis dahin Platzhalter-Texte):
```tsx
import { useRoute, go } from './router';
import { Screen } from './components';

const TABS = [
  { path: 'woche', label: 'Woche', icon: '📅' },
  { path: 'rezepte', label: 'Rezepte', icon: '📖' },
  { path: 'einkauf', label: 'Einkauf', icon: '🛒' },
  { path: 'haushalt', label: 'Haushalt', icon: '🏠' },
] as const;

export function Shell() {
  const route = useRoute();
  const [section = 'woche'] = route;
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <main>
        <Screen title={TABS.find((t) => t.path === section)?.label ?? 'Mealprep'}>
          <p className="text-stone-500">Dieser Bereich folgt gleich.</p>
        </Screen>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((t) => (
            <li key={t.path} className="flex-1">
              <button
                type="button"
                onClick={() => go(t.path)}
                aria-current={section === t.path ? 'page' : undefined}
                className={`flex w-full flex-col items-center py-2 text-xs ${
                  section === t.path ? 'text-green-700 dark:text-green-400' : 'text-stone-500'
                }`}
              >
                <span className="text-lg" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
```

`src/App.tsx` (ersetzt den Platzhalter):
```tsx
import { useEffect, useState } from 'react';
import { makeLookup } from './domain/recipe';
import type { Catalog } from './domain/types';
import { getDb } from './db/database';
import { ensureHousehold } from './db/repo';
import { AppContext, type AppData } from './ui/context';
import { buildRecipeInfos } from './ui/recipeInfo';
import { Shell } from './ui/Shell';

async function loadCatalog(): Promise<Catalog> {
  const res = await fetch(`${import.meta.env.BASE_URL}catalog.json`);
  if (!res.ok) throw new Error(`Rezeptkatalog konnte nicht geladen werden (HTTP ${res.status}).`);
  return (await res.json()) as Catalog;
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-stone-50 p-6 text-center text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-sm text-stone-600 dark:text-stone-400">{text}</p>
    </main>
  );
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalog, db] = await Promise.all([loadCatalog(), getDb()]);
        await ensureHousehold(db);
        if (cancelled) return;
        setData({
          db,
          catalog,
          lookupRecipe: makeLookup(catalog.recipes),
          lookupIngredient: makeLookup(catalog.ingredients),
          recipeInfos: buildRecipeInfos(catalog),
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Message
        title="Start fehlgeschlagen"
        text={`${error} Beim allerersten Öffnen wird eine Internetverbindung gebraucht; danach funktioniert die App offline.`}
      />
    );
  }
  if (!data) return <Message title="Mealprep-Planer" text="Lädt …" />;
  return (
    <AppContext.Provider value={data}>
      <Shell />
    </AppContext.Provider>
  );
}
```

`src/main.tsx` bleibt unverändert. In `index.html` im `<head>` ergänzen:
```html
    <meta name="theme-color" content="#15803d" />
    <link rel="icon" href="./icon.svg" type="image/svg+xml" />
```

`public/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#15803d"/><path d="M14 36h36a18 18 0 0 1-36 0z" fill="#fff"/><path d="M24 26c0-4 4-4 4-8M32 26c0-4 4-4 4-8M40 26c0-4 4-4 4-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>
```

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "mealprep",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--", "--port", "5173", "--strictPort"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 6: Prüfen** – `npm run verify` → grün. Dann Vorschau starten (`preview_start` mit `mealprep`), Konsole auf Fehler prüfen, Screenshot: untere Navigation mit 4 Bereichen sichtbar, Platzhaltertext, keine Fehlermeldung.
- [ ] **Step 7: Commit** – `feat: App-Rahmen mit Katalog, Datenbank, Navigation`.

---

### Task 4: Rezepte – Liste und Detail

**Files:**
- Create: `src/ui/screens/RecipesScreen.tsx`, `src/ui/screens/RecipeDetailScreen.tsx`
- Modify: `src/ui/Shell.tsx`

**Interfaces:**
- Consumes: `useApp`, `go`, Bausteine, Formatierer (Task 3); `recipeTotals`, `recipeGrams`, `scaleNutrients` (Domain).
- Produces: `RecipesScreen`, `RecipeCard({ info, onClick })`, `StorageBadge({ recipe })`, `RecipeDetailScreen({ id })`.

- [ ] **Step 1: `src/ui/screens/RecipesScreen.tsx`**
```tsx
import { useMemo, useState } from 'react';
import { MEAL_TYPES, type MealType, type Recipe } from '../../domain/types';
import { MEAL_TYPE_LABEL } from '../../domain/labels';
import { useApp } from '../context';
import { go } from '../router';
import { Badge, Card, Chip, inputClass, Screen } from '../components';
import { fmtEur, fmtKcal, fmtOne } from '../format';
import type { RecipeInfo } from '../recipeInfo';

export function StorageBadge({ recipe }: { recipe: Recipe }) {
  if (recipe.storage.kind === 'fresh') return <Badge tone="amber">frisch essen</Badge>;
  return (
    <Badge tone="green">
      vorkochbar · {recipe.storage.fridgeDays} Tage{recipe.storage.freezable ? ' · ❄' : ''}
    </Badge>
  );
}

export function RecipeCard({ info, onClick }: { info: RecipeInfo; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">{info.recipe.title}</h3>
          <span className="shrink-0 text-sm text-stone-500">{fmtEur(info.eurPerPortion)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{fmtKcal(info.perPortion.kcal)}</Badge>
          <Badge>{fmtOne(info.perPortion.protein)} g Protein</Badge>
          <Badge>{info.minutes} Min.</Badge>
          <StorageBadge recipe={info.recipe} />
        </div>
      </Card>
    </button>
  );
}

export function RecipesScreen() {
  const { recipeInfos } = useApp();
  const [query, setQuery] = useState('');
  const [meal, setMeal] = useState<MealType | null>(null);
  const [prepOnly, setPrepOnly] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...recipeInfos.values()]
      .filter(
        (i) =>
          (!meal || i.recipe.mealTypes.includes(meal)) &&
          (!prepOnly || i.recipe.storage.kind === 'prep') &&
          (!vegOnly || i.diets.includes('vegetarian')) &&
          i.recipe.title.toLowerCase().includes(q),
      )
      .sort((a, b) => a.recipe.title.localeCompare(b.recipe.title, 'de'));
  }, [recipeInfos, query, meal, prepOnly, vegOnly]);

  return (
    <Screen title="Rezepte">
      <input
        className={`${inputClass} w-full`}
        placeholder="Rezept suchen …"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {MEAL_TYPES.map((m) => (
          <Chip key={m} active={meal === m} onClick={() => setMeal(meal === m ? null : m)}>
            {MEAL_TYPE_LABEL[m]}
          </Chip>
        ))}
        <Chip active={prepOnly} onClick={() => setPrepOnly(!prepOnly)}>
          vorkochbar
        </Chip>
        <Chip active={vegOnly} onClick={() => setVegOnly(!vegOnly)}>
          vegetarisch
        </Chip>
      </div>
      <p className="mt-3 text-sm text-stone-500">{list.length} Rezepte</p>
      <ul className="mt-2 flex flex-col gap-3">
        {list.map((i) => (
          <li key={i.recipe.id}>
            <RecipeCard info={i} onClick={() => go(`rezepte/${i.recipe.id}`)} />
          </li>
        ))}
      </ul>
    </Screen>
  );
}
```

- [ ] **Step 2: `src/ui/screens/RecipeDetailScreen.tsx`**
```tsx
import { useState } from 'react';
import { NUTRIENT_KEYS, type NutrientKey } from '../../domain/types';
import { MEAL_TYPE_LABEL } from '../../domain/labels';
import { recipeGrams } from '../../domain/recipe';
import { recipeTotals, scaleNutrients } from '../../domain/nutrition';
import { useApp } from '../context';
import { go } from '../router';
import { Badge, Button, Card, Screen } from '../components';
import { fmtAmount, fmtEur, fmtNum, fmtOne } from '../format';
import { StorageBadge } from './RecipesScreen';

const NUTRIENT_LABEL: Record<NutrientKey, string> = {
  kcal: 'Energie (kcal)',
  protein: 'Eiweiß (g)',
  fat: 'Fett (g)',
  carbs: 'Kohlenhydrate (g)',
  fiber: 'Ballaststoffe (g)',
  sugar: 'davon Zucker (g)',
  salt: 'Salz (g)',
};

export function RecipeDetailScreen({ id }: { id: string }) {
  const { recipeInfos, lookupIngredient } = useApp();
  const info = recipeInfos.get(id);
  const [servings, setServings] = useState(info?.recipe.servings ?? 1);

  if (!info) {
    return (
      <Screen title="Rezept nicht gefunden">
        <Button onClick={() => go('rezepte')}>Zur Rezeptliste</Button>
      </Screen>
    );
  }

  const r = info.recipe;
  const factor = servings / r.servings;
  const totalGrams = recipeGrams(r, lookupIngredient).reduce((sum, g) => sum + g.grams, 0);
  const per100 = scaleNutrients(recipeTotals(r, lookupIngredient), totalGrams > 0 ? 100 / totalGrams : 0);

  return (
    <Screen
      title={r.title}
      actions={
        <Button variant="secondary" onClick={() => go('rezepte')}>
          Zurück
        </Button>
      }
    >
      <p className="text-stone-600 dark:text-stone-400">{r.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StorageBadge recipe={r} />
        <Badge>{info.minutes} Min.</Badge>
        <Badge>{fmtEur(info.eurPerPortion)} pro Portion</Badge>
        {r.mealTypes.map((m) => (
          <Badge key={m}>{MEAL_TYPE_LABEL[m]}</Badge>
        ))}
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Zutaten</h2>
          <div className="flex items-center gap-2 text-sm">
            <button type="button" className="h-8 w-8 rounded-full border" onClick={() => setServings(Math.max(1, servings - 1))}>
              −
            </button>
            <span>{servings} Portionen</span>
            <button type="button" className="h-8 w-8 rounded-full border" onClick={() => setServings(servings + 1)}>
              +
            </button>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {r.ingredients.map((ri, idx) => {
            const ing = lookupIngredient(ri.ingredientId);
            return (
              <li key={idx} className="flex justify-between gap-2">
                <span>
                  {ing?.name ?? ri.ingredientId}
                  {ri.note ? <span className="text-stone-500"> ({ri.note})</span> : null}
                  {ri.optional ? <span className="text-stone-500"> – optional</span> : null}
                </span>
                <span className="shrink-0 text-stone-600 dark:text-stone-400">{fmtAmount(ri.amount * factor, ri.unit)}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold">Zubereitung</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          {r.steps.map((s, idx) => (
            <li key={idx}>{s}</li>
          ))}
        </ol>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold">Nährwerte</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500">
              <th className="font-normal"></th>
              <th className="text-right font-normal">pro Portion</th>
              <th className="text-right font-normal">pro 100 g</th>
            </tr>
          </thead>
          <tbody>
            {NUTRIENT_KEYS.map((k) => (
              <tr key={k} className="border-t border-stone-100 dark:border-stone-800">
                <td className="py-1">{NUTRIENT_LABEL[k]}</td>
                <td className="text-right">{k === 'kcal' ? Math.round(info.perPortion[k]) : fmtOne(info.perPortion[k])}</td>
                <td className="text-right">{k === 'kcal' ? Math.round(per100[k]) : fmtOne(per100[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-stone-500">
          Berechnet aus dem Bundeslebensmittelschlüssel; Portion = {fmtNum(totalGrams / r.servings)} g.
        </p>
      </Card>

      {r.sources && r.sources.length > 0 && (
        <p className="mt-4 text-xs text-stone-500">
          Inspiriert von:{' '}
          {r.sources.map((s, idx) => (
            <a key={s} href={s} target="_blank" rel="noreferrer" className="underline">
              {new URL(s).hostname.replace(/^www\./, '')}
              {idx < (r.sources?.length ?? 0) - 1 ? ', ' : ''}
            </a>
          ))}
        </p>
      )}
    </Screen>
  );
}
```

- [ ] **Step 3: `Shell.tsx` verdrahten** – den Platzhalter-`<main>`-Inhalt ersetzen:
```tsx
      <main>
        {section === 'rezepte' && route[1] ? (
          <RecipeDetailScreen key={route[1]} id={route[1]} />
        ) : section === 'rezepte' ? (
          <RecipesScreen />
        ) : (
          <Screen title={TABS.find((t) => t.path === section)?.label ?? 'Mealprep'}>
            <p className="text-stone-500">Dieser Bereich folgt gleich.</p>
          </Screen>
        )}
      </main>
```
und importieren: `import { RecipesScreen } from './screens/RecipesScreen';`, `import { RecipeDetailScreen } from './screens/RecipeDetailScreen';`.

- [ ] **Step 4: Prüfen** – `npm run typecheck && npm run lint`; Vorschau `#/rezepte`: 49 Rezepte, Filter „Frühstück“ reduziert die Liste, Suche „chili“ findet 1; Detail `#/rezepte/chili-con-carne`: Portionen ändern skaliert Mengen (4 → 2 halbiert 500 g Hack auf 250 g), Nährwerttabelle zeigt 672 kcal pro Portion. Screenshot.
- [ ] **Step 5: Commit** – `feat: Rezeptliste mit Filtern und Rezeptdetail`.

---

### Task 5: Haushalt – Budget, Kochtage, Personen, Ziel-Rechner

**Files:**
- Create: `src/ui/screens/HouseholdScreen.tsx`, `src/ui/screens/PersonForm.tsx`
- Modify: `src/ui/Shell.tsx`

**Interfaces:**
- Consumes: `useHousehold`, `usePersons`, `saveHousehold`, `savePerson`, `deletePerson`, `newId` (Task 2); `suggestTargets` (Domain).
- Produces: `HouseholdScreen`, `PersonForm({ initial, onSave, onClose })`.

- [ ] **Step 1: `src/ui/screens/PersonForm.tsx`**
```tsx
import { useState } from 'react';
import { ALLERGENS, DIETS, MEAL_TYPES, type Person, type Targets } from '../../domain/types';
import { ALLERGEN_LABEL, DIET_LABEL, MEAL_TYPE_LABEL } from '../../domain/labels';
import { suggestTargets, type Activity, type Goal, type Sex } from '../../domain/targets';
import { newId } from '../../db/repo';
import { Button, Chip, Field, inputClass, Modal, NumberInput } from '../components';

const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: 'kaum Bewegung',
  light: 'leicht aktiv (1–2× Sport/Woche)',
  moderate: 'mäßig aktiv (3–4×)',
  active: 'sehr aktiv (5–6×)',
  very_active: 'extrem aktiv / körperliche Arbeit',
};
const GOAL_LABEL: Record<Goal, string> = { lose: 'abnehmen', maintain: 'Gewicht halten', gain: 'Muskelaufbau' };

function emptyPerson(): Person {
  return {
    id: newId(),
    name: '',
    targets: { kcal: 2000, proteinMin: 100 },
    mealSlots: ['breakfast', 'lunch', 'dinner'],
    diet: 'omnivore',
    noPork: false,
    allergies: [],
    dislikedIngredientIds: [],
    maxMinutesWeekday: 30,
    maxMinutesCookDay: 120,
  };
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function PersonForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Person;
  onSave: (p: Person) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState<Person>(initial ?? emptyPerson());
  const [body, setBody] = useState<{ weightKg?: number; heightCm?: number; ageYears?: number; sex: Sex; activity: Activity; goal: Goal }>({
    sex: 'male',
    activity: 'moderate',
    goal: 'maintain',
  });
  const [calcError, setCalcError] = useState<string | null>(null);

  const set = <K extends keyof Person>(key: K, value: Person[K]) => setP((prev) => ({ ...prev, [key]: value }));
  const setTarget = <K extends keyof Targets>(key: K, value: Targets[K]) =>
    setP((prev) => ({ ...prev, targets: { ...prev.targets, [key]: value } }));

  const calculate = () => {
    try {
      const t = suggestTargets({
        weightKg: body.weightKg ?? 0,
        heightCm: body.heightCm ?? 0,
        ageYears: body.ageYears ?? 0,
        sex: body.sex,
        activity: body.activity,
        goal: body.goal,
      });
      setP((prev) => ({ ...prev, targets: t }));
      setCalcError(null);
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : String(e));
    }
  };

  const valid = p.name.trim() !== '' && p.targets.kcal > 0 && p.targets.proteinMin > 0 && p.mealSlots.length > 0;

  return (
    <Modal title={initial ? `${initial.name} bearbeiten` : 'Person hinzufügen'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <input className={inputClass} value={p.name} onChange={(e) => set('name', e.target.value)} />
        </Field>

        <details className="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
          <summary className="cursor-pointer text-sm font-medium">Ziel-Rechner (optional)</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Gewicht (kg)">
              <NumberInput value={body.weightKg} onChange={(v) => setBody({ ...body, weightKg: v })} />
            </Field>
            <Field label="Größe (cm)">
              <NumberInput value={body.heightCm} onChange={(v) => setBody({ ...body, heightCm: v })} />
            </Field>
            <Field label="Alter">
              <NumberInput value={body.ageYears} onChange={(v) => setBody({ ...body, ageYears: v })} />
            </Field>
            <Field label="Formel">
              <select className={inputClass} value={body.sex} onChange={(e) => setBody({ ...body, sex: e.target.value as Sex })}>
                <option value="male">männlich</option>
                <option value="female">weiblich</option>
              </select>
            </Field>
            <Field label="Aktivität">
              <select className={inputClass} value={body.activity} onChange={(e) => setBody({ ...body, activity: e.target.value as Activity })}>
                {Object.entries(ACTIVITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ziel">
              <select className={inputClass} value={body.goal} onChange={(e) => setBody({ ...body, goal: e.target.value as Goal })}>
                {Object.entries(GOAL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Button variant="secondary" onClick={calculate}>
              Ziele berechnen
            </Button>
          </div>
          {calcError && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{calcError}</p>}
        </details>

        <div className="grid grid-cols-2 gap-3">
          <Field label="kcal pro Tag">
            <NumberInput value={p.targets.kcal} onChange={(v) => setTarget('kcal', v ?? 0)} />
          </Field>
          <Field label="Protein min. (g)">
            <NumberInput value={p.targets.proteinMin} onChange={(v) => setTarget('proteinMin', v ?? 0)} />
          </Field>
          <Field label="Fett min. (g)">
            <NumberInput value={p.targets.fatMin} onChange={(v) => setTarget('fatMin', v)} />
          </Field>
          <Field label="Fett max. (g)">
            <NumberInput value={p.targets.fatMax} onChange={(v) => setTarget('fatMax', v)} />
          </Field>
          <Field label="Kohlenhydrate min. (g)">
            <NumberInput value={p.targets.carbsMin} onChange={(v) => setTarget('carbsMin', v)} />
          </Field>
          <Field label="Kohlenhydrate max. (g)">
            <NumberInput value={p.targets.carbsMax} onChange={(v) => setTarget('carbsMax', v)} />
          </Field>
        </div>

        <Field label="Mahlzeiten">
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((m) => (
              <Chip key={m} active={p.mealSlots.includes(m)} onClick={() => set('mealSlots', toggle(p.mealSlots, m))}>
                {MEAL_TYPE_LABEL[m]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Ernährungsform">
          <div className="flex flex-wrap gap-2">
            {DIETS.map((d) => (
              <Chip key={d} active={p.diet === d} onClick={() => set('diet', d)}>
                {DIET_LABEL[d]}
              </Chip>
            ))}
            <Chip active={p.noPork} onClick={() => set('noPork', !p.noPork)}>
              kein Schwein
            </Chip>
          </div>
        </Field>

        <Field label="Allergien und Unverträglichkeiten">
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <Chip key={a} active={p.allergies.includes(a)} onClick={() => set('allergies', toggle(p.allergies, a))}>
                {ALLERGEN_LABEL[a]}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Max. Minuten werktags">
            <NumberInput value={p.maxMinutesWeekday} onChange={(v) => set('maxMinutesWeekday', v ?? 0)} />
          </Field>
          <Field label="Max. Minuten am Kochtag">
            <NumberInput value={p.maxMinutesCookDay} onChange={(v) => set('maxMinutesCookDay', v ?? 0)} />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={!valid} onClick={() => onSave({ ...p, name: p.name.trim() })}>
            Speichern
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: `src/ui/screens/HouseholdScreen.tsx`**
```tsx
import { useState } from 'react';
import type { Person } from '../../domain/types';
import { DIET_LABEL } from '../../domain/labels';
import { useHousehold, usePersons } from '../../db/hooks';
import { deletePerson, saveHousehold, savePerson } from '../../db/repo';
import { useApp } from '../context';
import { Button, Card, Chip, Field, NumberInput, Screen } from '../components';
import { WEEKDAY_SHORT } from '../format';
import { PersonForm } from './PersonForm';

export function HouseholdScreen() {
  const { db } = useApp();
  const household = useHousehold(db);
  const persons = usePersons(db);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);

  if (!household) return null;

  const toggleCookDay = (day: number) => {
    const cookDays = household.cookDays.includes(day)
      ? household.cookDays.filter((d) => d !== day)
      : [...household.cookDays, day].sort();
    void saveHousehold(db, { ...household, cookDays });
  };

  return (
    <Screen title="Haushalt">
      <Card>
        <div className="flex flex-col gap-4">
          <Field label="Wochenbudget (€)">
            <NumberInput
              value={household.weeklyBudgetEur}
              min={0}
              step={5}
              onChange={(v) => void saveHousehold(db, { ...household, weeklyBudgetEur: v ?? 0 })}
            />
          </Field>
          <Field label="Kochtage">
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_SHORT.map((label, idx) => (
                <Chip key={label} active={household.cookDays.includes(idx + 1)} onClick={() => toggleCookDay(idx + 1)}>
                  {label}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Personen</h2>
        <Button onClick={() => setEditing('new')}>+ Person</Button>
      </div>
      {persons.length === 0 && (
        <p className="mt-2 text-sm text-stone-500">Noch niemand angelegt. Füge dich und deine Mitesser hinzu.</p>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {persons.map((p) => (
          <li key={p.id}>
            <Card>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="text-sm text-stone-500">
                    {p.targets.kcal} kcal · ≥ {p.targets.proteinMin} g Protein · {DIET_LABEL[p.diet]}
                    {p.allergies.length > 0 ? ` · ${p.allergies.length} Allergie(n)` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setEditing(p)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`${p.name} löschen? Portionen in geplanten Mahlzeiten werden entfernt.`)) {
                        void deletePerson(db, p.id);
                      }
                    }}
                  >
                    Löschen
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-stone-500">
        Nährwerte: Max Rubner-Institut (2025), Bundeslebensmittelschlüssel (BLS) 4.0, CC BY 4.0. Preise: Richtwerte
        (Aldi Süd, Stand 09/2026) bzw. Schätzungen.
      </p>

      {editing && (
        <PersonForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(person) => {
            void savePerson(db, person);
            setEditing(null);
          }}
        />
      )}
    </Screen>
  );
}
```

`PersonDoc` enthält zusätzlich `householdId`/`updatedAt`; beim Bearbeiten wird das an `PersonForm` übergeben und von `savePerson` überschrieben – unkritisch.

- [ ] **Step 3: `Shell.tsx`** – vor dem Platzhalter-Zweig ergänzen: `) : section === 'haushalt' ? (<HouseholdScreen />` und importieren.
- [ ] **Step 4: Prüfen** – Vorschau `#/haushalt`: Budget ändern bleibt nach Neuladen erhalten; Person „Alex“ mit Ziel-Rechner (80 kg, 180 cm, 30 J., männlich, mäßig, halten) anlegen → Ziele 2760 kcal / 128 g; zweite Person anlegen, bearbeiten, löschen. Screenshot.
- [ ] **Step 5: Commit** – `feat: Haushalt mit Budget, Kochtagen, Personen und Ziel-Rechner`.

---

### Task 6: Woche – Plan von Hand

**Files:**
- Create: `src/ui/screens/WeekScreen.tsx`, `src/ui/screens/MealPicker.tsx`, `src/ui/WeekNav.tsx`
- Modify: `src/ui/Shell.tsx`

**Interfaces:**
- Consumes: `useHousehold`, `usePersons`, `useMeals`, `saveMeal`, `deleteMeal`, `newId` (Task 2); `startOfWeek`, `todayLocal`, `addDays`, `weekDates`, `isoWeekday`, `defaultPortions`, `suggestCookDate`, `dayNutrition` (Domain/Task 1); `checkMeal`, `checkRecipeForPerson`, `buildShoppingList`.
- Produces: `WeekNav({ weekStart, onChange })`, `WeekScreen`, `MealPicker({ date, slot, persons, cookDays, onClose })`.

- [ ] **Step 1: `src/ui/WeekNav.tsx`**
```tsx
import { addDays, startOfWeek, todayLocal } from '../domain/dates';
import { fmtDay } from './format';

export function WeekNav({ weekStart, onChange }: { weekStart: string; onChange: (weekStart: string) => void }) {
  const isCurrent = weekStart === startOfWeek(todayLocal());
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-2 text-sm shadow-sm dark:bg-stone-900">
      <button type="button" className="rounded-xl px-3 py-1" aria-label="Vorige Woche" onClick={() => onChange(addDays(weekStart, -7))}>
        ‹
      </button>
      <button type="button" className="font-medium" onClick={() => onChange(startOfWeek(todayLocal()))}>
        {fmtDay(weekStart)} – {fmtDay(addDays(weekStart, 6))}
        {isCurrent ? ' · diese Woche' : ''}
      </button>
      <button type="button" className="rounded-xl px-3 py-1" aria-label="Nächste Woche" onClick={() => onChange(addDays(weekStart, 7))}>
        ›
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `src/ui/screens/MealPicker.tsx`**
```tsx
import { useMemo, useState } from 'react';
import type { IsoDate, MealType, Person } from '../../domain/types';
import { MEAL_TYPE_LABEL } from '../../domain/labels';
import { checkRecipeForPerson } from '../../domain/rules';
import { defaultPortions, suggestCookDate } from '../../domain/plan';
import { newId, saveMeal } from '../../db/repo';
import { useApp } from '../context';
import { Badge, inputClass, Modal } from '../components';
import { fmtDay, fmtEur, fmtKcal, fmtOne } from '../format';
import { StorageBadge } from './RecipesScreen';

export function MealPicker({
  date,
  slot,
  persons,
  cookDays,
  onClose,
}: {
  date: IsoDate;
  slot: MealType;
  persons: Person[];
  cookDays: number[];
  onClose: () => void;
}) {
  const { db, recipeInfos, lookupIngredient } = useApp();
  const [query, setQuery] = useState('');
  const eaters = persons.filter((p) => p.mealSlots.includes(slot));

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...recipeInfos.values()]
      .filter((i) => i.recipe.mealTypes.includes(slot) && i.recipe.title.toLowerCase().includes(q))
      .map((i) => ({
        info: i,
        problems: eaters.flatMap((p) => checkRecipeForPerson(i.recipe, p, lookupIngredient)),
      }))
      .sort((a, b) => a.problems.length - b.problems.length || a.info.recipe.title.localeCompare(b.info.recipe.title, 'de'));
  }, [recipeInfos, slot, query, eaters, lookupIngredient]);

  const choose = (recipeId: string) => {
    const recipe = recipeInfos.get(recipeId)?.recipe;
    if (!recipe) return;
    void saveMeal(db, {
      id: newId(),
      date,
      slot,
      recipeId,
      cookDate: suggestCookDate(date, recipe, cookDays),
      portions: defaultPortions(persons, slot),
      pinned: false,
    });
    onClose();
  };

  return (
    <Modal title={`${MEAL_TYPE_LABEL[slot]} am ${fmtDay(date)}`} onClose={onClose}>
      <input className={`${inputClass} w-full`} placeholder="Suchen …" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <ul className="mt-3 flex flex-col gap-2">
        {options.map(({ info, problems }) => (
          <li key={info.recipe.id}>
            <button
              type="button"
              onClick={() => choose(info.recipe.id)}
              className="w-full rounded-xl border border-stone-200 p-3 text-left hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800"
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">{info.recipe.title}</span>
                <span className="text-sm text-stone-500">{fmtEur(info.eurPerPortion)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge>{fmtKcal(info.perPortion.kcal)}</Badge>
                <Badge>{fmtOne(info.perPortion.protein)} g P</Badge>
                <StorageBadge recipe={info.recipe} />
                {problems.length > 0 && <Badge tone="red">⚠ {problems[0]?.message}</Badge>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
```

- [ ] **Step 3: `src/ui/screens/WeekScreen.tsx`**
```tsx
import { useState } from 'react';
import { MEAL_TYPES, type IsoDate, type MealType } from '../../domain/types';
import { MEAL_TYPE_LABEL } from '../../domain/labels';
import { addDays, isoWeekday, startOfWeek, todayLocal, weekDates } from '../../domain/dates';
import { dayNutrition } from '../../domain/plan';
import { checkMeal } from '../../domain/rules';
import { buildShoppingList } from '../../domain/shopping';
import { useHousehold, useMeals, usePersons } from '../../db/hooks';
import { deleteMeal, saveMeal } from '../../db/repo';
import type { HouseholdDoc, MealDoc, PersonDoc } from '../../db/types';
import { useApp } from '../context';
import { go } from '../router';
import { Badge, Button, Card, ProgressBar, Screen } from '../components';
import { fmtDay, fmtEur, fmtNum } from '../format';
import { WeekNav } from '../WeekNav';
import { MealPicker } from './MealPicker';

function MealRow({ meal, persons, household }: { meal: MealDoc; persons: PersonDoc[]; household: HouseholdDoc }) {
  const { db, lookupRecipe, lookupIngredient } = useApp();
  const recipe = lookupRecipe(meal.recipeId);
  const violations = checkMeal(meal, { lookupIngredient, lookupRecipe, persons, cookWeekdays: household.cookDays });

  const changePortion = (personId: string, delta: number) => {
    const next = Math.max(0, Math.round(((meal.portions[personId] ?? 0) + delta) * 4) / 4);
    const portions = { ...meal.portions, [personId]: next };
    if (next === 0) delete portions[personId];
    void saveMeal(db, { ...meal, portions });
  };

  return (
    <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="text-left font-medium hover:underline" onClick={() => go(`rezepte/${meal.recipeId}`)}>
          {recipe?.title ?? 'Rezept nicht mehr verfügbar'}
        </button>
        <button type="button" aria-label="Mahlzeit entfernen" className="text-stone-400 hover:text-red-600" onClick={() => void deleteMeal(db, meal.id)}>
          ✕
        </button>
      </div>
      {meal.cookDate !== meal.date && <p className="text-xs text-stone-500">vorgekocht am {fmtDay(meal.cookDate)}</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        {persons.map((p) => (
          <div key={p.id} className="flex items-center gap-1 text-sm">
            <span className="text-stone-600 dark:text-stone-400">{p.name}</span>
            <button type="button" className="h-7 w-7 rounded-full border" aria-label={`${p.name} weniger`} onClick={() => changePortion(p.id, -0.25)}>
              −
            </button>
            <span className="w-9 text-center">{fmtNum(meal.portions[p.id] ?? 0)}</span>
            <button type="button" className="h-7 w-7 rounded-full border" aria-label={`${p.name} mehr`} onClick={() => changePortion(p.id, 0.25)}>
              +
            </button>
          </div>
        ))}
      </div>
      {violations.map((v, idx) => (
        <p key={idx} className="mt-1 text-xs text-red-700 dark:text-red-400">
          ⚠ {v.message}
        </p>
      ))}
    </div>
  );
}

export function WeekScreen() {
  const { db, lookupRecipe, lookupIngredient } = useApp();
  const household = useHousehold(db);
  const persons = usePersons(db);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayLocal()));
  const weekEnd = addDays(weekStart, 6);
  const meals = useMeals(db, weekStart, weekEnd);
  const [picker, setPicker] = useState<{ date: IsoDate; slot: MealType } | null>(null);

  if (!household) return null;

  if (persons.length === 0) {
    return (
      <Screen title="Woche">
        <Card>
          <p>Lege zuerst im Bereich „Haushalt“ mindestens eine Person mit ihren Zielen an.</p>
          <div className="mt-3">
            <Button onClick={() => go('haushalt')}>Zum Haushalt</Button>
          </div>
        </Card>
      </Screen>
    );
  }

  const slots = MEAL_TYPES.filter((m) => persons.some((p) => p.mealSlots.includes(m)));
  const shopping = buildShoppingList(meals, { lookupIngredient, lookupRecipe }, { from: weekStart, to: weekEnd });
  const budgetOk = shopping.totalEur <= household.weeklyBudgetEur;

  return (
    <Screen title="Woche">
      <WeekNav weekStart={weekStart} onChange={setWeekStart} />

      <Card className="mt-3">
        <div className="flex items-center justify-between text-sm">
          <span>Einkauf diese Woche</span>
          <span className={budgetOk ? '' : 'font-semibold text-amber-700 dark:text-amber-400'}>
            {fmtEur(shopping.totalEur)} von {fmtEur(household.weeklyBudgetEur)}
          </span>
        </div>
      </Card>

      <div className="mt-3 flex flex-col gap-3">
        {weekDates(weekStart).map((date) => {
          const isCookDay = household.cookDays.includes(isoWeekday(date));
          return (
            <Card key={date}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-semibold">{fmtDay(date)}</h2>
                {isCookDay && <Badge tone="green">Kochtag</Badge>}
                {date === todayLocal() && <Badge>heute</Badge>}
              </div>
              <div className="flex flex-col gap-3">
                {slots.map((slot) => (
                  <div key={slot}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm text-stone-500">{MEAL_TYPE_LABEL[slot]}</h3>
                      <button type="button" className="text-sm text-green-700 dark:text-green-400" onClick={() => setPicker({ date, slot })}>
                        + Gericht
                      </button>
                    </div>
                    <div className="mt-1 flex flex-col gap-2">
                      {meals
                        .filter((m) => m.date === date && m.slot === slot)
                        .map((m) => (
                          <MealRow key={m.id} meal={m} persons={persons} household={household} />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 border-t border-stone-100 pt-3 dark:border-stone-800 sm:grid-cols-2">
                {persons.map((p) => {
                  const n = dayNutrition(meals, date, p.id, { lookupRecipe, lookupIngredient });
                  return (
                    <div key={p.id} className="flex flex-col gap-1">
                      <span className="text-xs font-medium">{p.name}</span>
                      <ProgressBar label="kcal" value={n.kcal} min={p.targets.kcal * 0.9} max={p.targets.kcal * 1.1} />
                      <ProgressBar label="Protein (g)" value={n.protein} min={p.targets.proteinMin} />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {picker && (
        <MealPicker date={picker.date} slot={picker.slot} persons={persons} cookDays={household.cookDays} onClose={() => setPicker(null)} />
      )}
    </Screen>
  );
}
```

- [ ] **Step 4: `Shell.tsx`** – Zweig `section === 'woche'` → `<WeekScreen />` ergänzen (auch als Standard, wenn `route` leer ist) und importieren.
- [ ] **Step 5: Prüfen** – Vorschau `#/woche` (mit 2 Personen aus Task 5): Chili am Montag-Mittag einplanen → Kochtag-Vorschlag „vorgekocht am So“ (Kochtage Mi/So), Portion + erhöht die kcal-Balken, Budget-Zähler steigt; Gericht mit Milch bei einer Person mit Milch-Allergie zeigt ⚠-Hinweis; Mahlzeit entfernen. Wochenwechsel ‹ › funktioniert. Screenshot.
- [ ] **Step 6: Commit** – `feat: Wochenplan von Hand mit Portionen, Tageszielen und Budget`.

---

### Task 7: Einkauf

**Files:**
- Create: `src/ui/screens/ShoppingScreen.tsx`
- Modify: `src/ui/Shell.tsx`

**Interfaces:**
- Consumes: `useHousehold`, `useMeals`, `useChecks`, `setChecked` (Task 2); `buildShoppingList`, `cookDayRanges`, `weekDates`, `CATEGORY_LABEL` (Domain); `WeekNav` (Task 6).
- Produces: `ShoppingScreen`.

- [ ] **Step 1: `src/ui/screens/ShoppingScreen.tsx`**
```tsx
import { useState } from 'react';
import { CATEGORIES } from '../../domain/types';
import { CATEGORY_LABEL } from '../../domain/labels';
import { addDays, cookDayRanges, startOfWeek, todayLocal, weekDates } from '../../domain/dates';
import { buildShoppingList } from '../../domain/shopping';
import { useChecks, useHousehold, useMeals } from '../../db/hooks';
import { setChecked } from '../../db/repo';
import { useApp } from '../context';
import { Card, Chip, Screen } from '../components';
import { fmtDay, fmtEur, fmtGram } from '../format';
import { WeekNav } from '../WeekNav';

type Mode = 'woche' | 'kochtag' | 'tag';

export function ShoppingScreen() {
  const { db, lookupRecipe, lookupIngredient } = useApp();
  const household = useHousehold(db);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayLocal()));
  const [mode, setMode] = useState<Mode>('woche');
  const [rangeIdx, setRangeIdx] = useState(0);
  const [dayIdx, setDayIdx] = useState(0);
  const weekEnd = addDays(weekStart, 6);
  // Mahlzeiten großzügig laden: gekocht in dieser Woche, gegessen ggf. danach
  const meals = useMeals(db, weekStart, addDays(weekEnd, 7));
  const checks = useChecks(db, weekStart);

  if (!household) return null;

  const ranges = cookDayRanges(weekStart, household.cookDays);
  const days = weekDates(weekStart);
  const selectedRange = ranges[Math.min(rangeIdx, ranges.length - 1)];
  const selectedDay = days[dayIdx] ?? weekStart;
  const range =
    mode === 'woche'
      ? { from: weekStart, to: weekEnd }
      : mode === 'kochtag' && selectedRange
        ? { from: selectedRange.from, to: selectedRange.to }
        : { from: selectedDay, to: selectedDay };

  const list = buildShoppingList(meals, { lookupIngredient, lookupRecipe }, range);
  const buy = list.items.filter((i) => !i.pantryStaple);
  const staples = list.items.filter((i) => i.pantryStaple);
  const openEur = buy.filter((i) => !checks.get(i.ingredientId)).reduce((s, i) => s + (i.priceEur ?? 0), 0);

  return (
    <Screen title="Einkauf">
      <WeekNav weekStart={weekStart} onChange={setWeekStart} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip active={mode === 'woche'} onClick={() => setMode('woche')}>
          ganze Woche
        </Chip>
        <Chip active={mode === 'kochtag'} onClick={() => setMode('kochtag')}>
          pro Kochtag
        </Chip>
        <Chip active={mode === 'tag'} onClick={() => setMode('tag')}>
          pro Tag
        </Chip>
      </div>
      {mode === 'kochtag' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {ranges.map((r, idx) => (
            <Chip key={r.from} active={idx === Math.min(rangeIdx, ranges.length - 1)} onClick={() => setRangeIdx(idx)}>
              {r.cookDate ? `Kochtag ${fmtDay(r.cookDate)}` : 'bis zum 1. Kochtag'} ({fmtDay(r.from)}–{fmtDay(r.to)})
            </Chip>
          ))}
        </div>
      )}
      {mode === 'tag' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {days.map((d, idx) => (
            <Chip key={d} active={idx === dayIdx} onClick={() => setDayIdx(idx)}>
              {fmtDay(d)}
            </Chip>
          ))}
        </div>
      )}

      <Card className="mt-3">
        <div className="flex justify-between text-sm">
          <span>Summe</span>
          <span className="font-semibold">{fmtEur(list.totalEur)}</span>
        </div>
        <div className="flex justify-between text-xs text-stone-500">
          <span>noch offen</span>
          <span>{fmtEur(openEur)}</span>
        </div>
      </Card>

      {list.items.length === 0 && (
        <p className="mt-4 text-sm text-stone-500">Für diesen Zeitraum ist nichts eingeplant. Plane zuerst Gerichte in der Woche.</p>
      )}

      {CATEGORIES.map((cat) => {
        const items = buy.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-stone-500">{CATEGORY_LABEL[cat]}</h2>
            <Card className="flex flex-col divide-y divide-stone-100 p-0 dark:divide-stone-800">
              {items.map((i) => {
                const done = checks.get(i.ingredientId) ?? false;
                return (
                  <label key={i.ingredientId} className="flex cursor-pointer items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-green-700"
                      checked={done}
                      onChange={(e) => void setChecked(db, weekStart, i.ingredientId, e.target.checked)}
                    />
                    <span className={`flex-1 ${done ? 'text-stone-400 line-through' : ''}`}>
                      {i.name}
                      <span className="block text-xs text-stone-500">
                        {i.choice
                          ? i.choice.picks.map((p) => `${p.count}× ${fmtGram(p.sizeG)}`).join(' + ')
                          : 'kein Preis hinterlegt'}{' '}
                        · benötigt {fmtGram(i.neededG)}
                      </span>
                    </span>
                    <span className="text-sm">{i.priceEur !== null ? fmtEur(i.priceEur) : '–'}</span>
                  </label>
                );
              })}
            </Card>
          </section>
        );
      })}

      {staples.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-stone-500">Grundvorrat prüfen</h2>
          <p className="text-sm">{staples.map((s) => s.name).join(', ')}</p>
        </section>
      )}

      {list.warnings.length > 0 && (
        <section className="mt-4 text-xs text-amber-700 dark:text-amber-400">
          {list.warnings.map((w) => (
            <p key={w}>⚠ {w}</p>
          ))}
        </section>
      )}
    </Screen>
  );
}
```

- [ ] **Step 2: `Shell.tsx`** – Zweig `section === 'einkauf'` → `<ShoppingScreen />`; den Platzhalter-Zweig entfernen (alle vier Bereiche existieren nun; unbekannte Route → `WeekScreen`).
- [ ] **Step 3: Prüfen** – Vorschau `#/einkauf` mit dem Plan aus Task 6: Woche zeigt Hackfleisch in Packungen, Summe = Budget-Zähler der Woche; „pro Kochtag“ zeigt Zeiträume; Abhaken bleibt nach Neuladen; „noch offen“ sinkt. Screenshot.
- [ ] **Step 4: Commit** – `feat: Einkaufsliste nach Woche, Kochtag und Tag, abhakbar`.

---

### Task 8: Offline-Betrieb und Veröffentlichung

**Files:**
- Modify: `package.json` (`vite-plugin-pwa`), `vite.config.ts`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: Service Worker mit vorgespeicherter App und `catalog.json`; Web-App-Manifest; Deploy auf GitHub Pages bei Push auf `main`.

- [ ] **Step 1: Installieren** – `npm install -D vite-plugin-pwa`.
- [ ] **Step 2: `vite.config.ts`**
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative Pfade, damit die App unter https://<name>.github.io/<repo>/ läuft
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: !!process.env.VITEST,
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Mealprep-Planer',
        short_name: 'Mealprep',
        description: 'Wochenplan, Rezepte und Einkaufsliste für Mealprep',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#fafaf9',
        theme_color: '#15803d',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
```
- [ ] **Step 3: `.github/workflows/deploy.yml`**
```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
- [ ] **Step 4: Prüfen** – `npm run verify` → grün; `dist/sw.js` und `dist/manifest.webmanifest` existieren; `npx vite preview --port 4173` im Browser öffnen, Seite laden, dann im Browser offline schalten nicht möglich → stattdessen prüfen, dass `navigator.serviceWorker.controller` nach Neuladen gesetzt ist (javascript_tool).
- [ ] **Step 5: Commit** – `feat: Offline-Betrieb (PWA) und Deploy auf GitHub Pages`.
- [ ] **Step 6: Nutzer-Schritt (nicht automatisierbar):** In GitHub unter *Settings → Pages → Build and deployment → Source* „GitHub Actions“ wählen. Der Deploy startet, sobald die Branches nach `main` gemergt sind – das entscheidet der Nutzer.
