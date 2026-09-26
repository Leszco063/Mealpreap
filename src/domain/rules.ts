import type { Meal, MealType, Person, Recipe } from './types';
import { ALLERGEN_LABEL, DIET_LABEL, MEAL_TYPE_LABEL } from './labels';
import { fitsDiet, recipeProfile } from './diet';
import type { IngredientLookup } from './recipe';
import { diffDays, isoWeekday } from './dates';

export type ViolationCode = 'diet' | 'pork' | 'allergen' | 'disliked' | 'slot' | 'storage' | 'time' | 'missing';

export interface Violation {
  code: ViolationCode;
  personId?: string;
  message: string;
}

export function checkRecipeForPerson(recipe: Recipe, person: Person, lookup: IngredientLookup): Violation[] {
  const profile = recipeProfile(recipe, lookup);
  const v: Violation[] = [];
  const personId = person.id;
  if (!fitsDiet(person.diet, profile.flags)) {
    v.push({
      code: 'diet',
      personId,
      message: `${recipe.title} passt nicht zur Ernährungsform von ${person.name} (${DIET_LABEL[person.diet]})`,
    });
  }
  if (person.noPork && profile.flags.has('pork')) {
    v.push({ code: 'pork', personId, message: `${recipe.title} enthält Schweinefleisch – ${person.name} isst kein Schwein` });
  }
  for (const allergen of person.allergies) {
    if (profile.allergens.has(allergen)) {
      v.push({
        code: 'allergen',
        personId,
        message: `${recipe.title} enthält ${ALLERGEN_LABEL[allergen]} – Allergie/Unverträglichkeit von ${person.name}`,
      });
    }
  }
  for (const id of person.dislikedIngredientIds) {
    if (profile.ingredientIds.has(id)) {
      const name = lookup(id)?.name ?? id;
      v.push({ code: 'disliked', personId, message: `${recipe.title} enthält ${name} – mag ${person.name} nicht` });
    }
  }
  return v;
}

export function checkSlot(recipe: Recipe, slot: MealType): Violation[] {
  if (recipe.mealTypes.includes(slot)) return [];
  return [{ code: 'slot', message: `${recipe.title} ist nicht als ${MEAL_TYPE_LABEL[slot]} gedacht` }];
}

/**
 * Haltbarkeit (Spec §6, Regel 3): Vorgekochtes wird an einem Kochtag gekocht (oder am Esstag selbst)
 * und innerhalb der Kühlschrank-Tage gegessen; Frisches am Tag der Zubereitung.
 */
export function checkStorage(meal: Pick<Meal, 'date' | 'cookDate'>, recipe: Recipe, isCookDay = true): Violation[] {
  const days = diffDays(meal.cookDate, meal.date);
  if (days < 0) {
    return [{ code: 'storage', message: `${recipe.title} wird gegessen, bevor es gekocht ist` }];
  }
  if (recipe.storage.kind === 'fresh') {
    if (days === 0) return [];
    return [{ code: 'storage', message: `${recipe.title} sollte am Tag der Zubereitung gegessen werden` }];
  }
  const v: Violation[] = [];
  if (days > 0 && !isCookDay) {
    v.push({ code: 'storage', message: `${recipe.title} wird vorgekocht, aber ${meal.cookDate} ist kein Kochtag` });
  }
  if (days > recipe.storage.fridgeDays) {
    v.push({
      code: 'storage',
      message: `${recipe.title} hält nur ${recipe.storage.fridgeDays} Tage im Kühlschrank (hier ${days} Tage)`,
    });
  }
  return v;
}

export function checkTime(recipe: Recipe, person: Person, isCookDay: boolean): Violation[] {
  const minutes = recipe.prepMinutes + recipe.cookMinutes;
  const limit = isCookDay ? person.maxMinutesCookDay : person.maxMinutesWeekday;
  if (minutes <= limit) return [];
  return [
    {
      code: 'time',
      personId: person.id,
      message: `${recipe.title} dauert ${minutes} Min. – ${person.name} hat ${isCookDay ? 'am Kochtag' : 'an diesem Tag'} max. ${limit} Min.`,
    },
  ];
}

export interface MealCheckContext {
  lookupIngredient: IngredientLookup;
  lookupRecipe: (id: string) => Recipe | undefined;
  persons: readonly Person[];
  /** 1 = Montag … 7 = Sonntag */
  cookWeekdays: readonly number[];
}

/** Alle harten Regeln für eine Mahlzeit im Plan. */
export function checkMeal(meal: Meal, ctx: MealCheckContext): Violation[] {
  const recipe = ctx.lookupRecipe(meal.recipeId);
  if (!recipe) return [{ code: 'missing', message: `Rezept ${meal.recipeId} ist nicht mehr verfügbar` }];
  const eaters = ctx.persons.filter((p) => (meal.portions[p.id] ?? 0) > 0);
  const isCookDay = ctx.cookWeekdays.includes(isoWeekday(meal.cookDate));
  const v: Violation[] = [];
  for (const [personId, portion] of Object.entries(meal.portions)) {
    if (portion > 0 && !ctx.persons.some((p) => p.id === personId)) {
      v.push({ code: 'missing', personId, message: `Person ${personId} gibt es nicht mehr im Haushalt` });
    }
  }
  v.push(...checkSlot(recipe, meal.slot), ...checkStorage(meal, recipe, isCookDay));
  for (const id of recipeProfile(recipe, ctx.lookupIngredient).missingIngredientIds) {
    v.push({ code: 'missing', message: `${recipe.title}: Zutat ${id} ist nicht mehr verfügbar` });
  }
  for (const p of eaters) {
    v.push(...checkRecipeForPerson(recipe, p, ctx.lookupIngredient), ...checkTime(recipe, p, isCookDay));
  }
  return v;
}
