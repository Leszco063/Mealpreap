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
