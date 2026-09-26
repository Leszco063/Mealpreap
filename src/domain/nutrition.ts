import { NUTRIENT_KEYS, type Nutrients, type Recipe } from './types';
import { recipeGrams, type IngredientLookup } from './recipe';

export const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, salt: 0 };

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  const r = { ...ZERO };
  for (const k of NUTRIENT_KEYS) r[k] = a[k] + b[k];
  return r;
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const r = { ...ZERO };
  for (const k of NUTRIENT_KEYS) r[k] = n[k] * factor;
  return r;
}

/** Nährwerte des ganzen Rezepts (alle Grundportionen), ohne optionale Zutaten. */
export function recipeTotals(recipe: Recipe, lookup: IngredientLookup): Nutrients {
  let total = ZERO;
  for (const { ingredient, grams } of recipeGrams(recipe, lookup)) {
    total = addNutrients(total, scaleNutrients(ingredient.per100g, grams / 100));
  }
  return total;
}

export function perPortion(recipe: Recipe, lookup: IngredientLookup): Nutrients {
  return scaleNutrients(recipeTotals(recipe, lookup), 1 / recipe.servings);
}

/** Energie aus Makros nach BLS-Formel (ohne Alkohol, org. Säuren, Zuckeralkohole). */
export function computedKcal(n: Nutrients): number {
  return 4 * n.protein + 4 * n.carbs + 9 * n.fat + 2 * n.fiber;
}

export function isPlausible(n: Nutrients): boolean {
  return Math.abs(n.kcal - computedKcal(n)) <= Math.max(0.15 * n.kcal, 10);
}
