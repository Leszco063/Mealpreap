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
  /** `${listKey}:${ingredientId}` */
  id: string;
  householdId: string;
  /** Zeitraum der Einkaufsliste, siehe listKey() */
  listKey: string;
  ingredientId: string;
  checked: boolean;
  updatedAt: number;
}
