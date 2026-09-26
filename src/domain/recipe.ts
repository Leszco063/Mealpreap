import type { Ingredient, Recipe } from './types';
import { toGrams } from './units';

export type IngredientLookup = (id: string) => Ingredient | undefined;

export function makeLookup<T extends { id: string }>(items: readonly T[]): (id: string) => T | undefined {
  const map = new Map(items.map((item) => [item.id, item] as const));
  return (id) => map.get(id);
}

export class MissingIngredientError extends Error {
  readonly recipeId: string;
  readonly ingredientId: string;
  constructor(recipeId: string, ingredientId: string) {
    super(`Rezept ${recipeId}: Zutat ${ingredientId} ist nicht (mehr) verfügbar`);
    this.name = 'MissingIngredientError';
    this.recipeId = recipeId;
    this.ingredientId = ingredientId;
  }
}

export interface GramEntry {
  ingredient: Ingredient;
  grams: number;
}

/** Zutaten eines Rezepts in Gramm (für alle Grundportionen), doppelte Zutaten zusammengefasst. */
export function recipeGrams(
  recipe: Recipe,
  lookup: IngredientLookup,
  opts: { includeOptional?: boolean } = {},
): GramEntry[] {
  const byId = new Map<string, GramEntry>();
  for (const ri of recipe.ingredients) {
    if (ri.optional && !opts.includeOptional) continue;
    const ingredient = lookup(ri.ingredientId);
    if (!ingredient) throw new MissingIngredientError(recipe.id, ri.ingredientId);
    const grams = toGrams(ri.amount, ri.unit, ingredient);
    const entry = byId.get(ingredient.id);
    if (entry) entry.grams += grams;
    else byId.set(ingredient.id, { ingredient, grams });
  }
  return [...byId.values()];
}
