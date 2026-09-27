import { MEAL_TYPES, type IsoDate, type Meal, type MealType, type Nutrients, type Person, type Recipe } from './types';
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
 * Kochtage vor `notBefore` (z. B. heute) werden nicht vorgeschlagen.
 */
export function suggestCookDate(
  date: IsoDate,
  recipe: Recipe,
  cookWeekdays: readonly number[],
  notBefore?: IsoDate,
): IsoDate {
  if (recipe.storage.kind === 'fresh') return date;
  for (let back = 0; back <= recipe.storage.fridgeDays; back++) {
    const candidate = addDays(date, -back);
    if (notBefore !== undefined && candidate < notBefore) break;
    if (cookWeekdays.includes(isoWeekday(candidate))) return candidate;
  }
  return date;
}

/** Slots, die in der Woche angezeigt werden: die der Personen plus alle, in denen schon etwas geplant ist */
export function visibleSlots(persons: readonly Person[], meals: readonly Meal[]): MealType[] {
  return MEAL_TYPES.filter((m) => persons.some((p) => p.mealSlots.includes(m)) || meals.some((x) => x.slot === m));
}

/**
 * Zeitraum (Esstage), aus dem Mahlzeiten für Einkauf und Budget einer Woche geladen werden:
 * auch Gerichte, die diese Woche vorgekocht, aber erst nächste Woche gegessen werden.
 */
export function shoppingMealRange(weekStart: IsoDate): { from: IsoDate; to: IsoDate } {
  return { from: weekStart, to: addDays(weekStart, 13) };
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
