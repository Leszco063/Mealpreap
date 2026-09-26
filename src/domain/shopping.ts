import { CATEGORIES, type Category, type Ingredient, type IsoDate, type Meal, type Recipe } from './types';
import type { IngredientLookup } from './recipe';
import { toGrams, UnitError } from './units';
import { choosePackages, packagesFor, type PackageChoice, type PriceOverrides } from './pricing';

export interface ShoppingContext {
  lookupIngredient: IngredientLookup;
  lookupRecipe: (id: string) => Recipe | undefined;
  overrides?: PriceOverrides;
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export interface ShoppingItem {
  ingredientId: string;
  name: string;
  category: Category;
  neededG: number;
  pantryStaple: boolean;
  choice: PackageChoice | null;
  priceEur: number | null;
}

export interface ShoppingList {
  items: ShoppingItem[];
  totalEur: number;
  warnings: string[];
}

/** Einkaufsliste für alle Mahlzeiten, deren Kochtag im Zeitraum liegt (Grenzen inklusive). */
export function buildShoppingList(meals: readonly Meal[], ctx: ShoppingContext, range: DateRange): ShoppingList {
  const needed = new Map<string, { ingredient: Ingredient; grams: number }>();
  const warnings: string[] = [];

  for (const meal of meals) {
    if (meal.cookDate < range.from || meal.cookDate > range.to) continue;
    const recipe = ctx.lookupRecipe(meal.recipeId);
    if (!recipe) {
      warnings.push(`Rezept ${meal.recipeId} ist nicht mehr verfügbar (${meal.date})`);
      continue;
    }
    const portions = Object.values(meal.portions).reduce((sum, p) => sum + Math.max(0, p), 0);
    if (portions === 0) continue;
    const factor = portions / recipe.servings;

    for (const ri of recipe.ingredients) {
      if (ri.optional) continue;
      const ingredient = ctx.lookupIngredient(ri.ingredientId);
      if (!ingredient) {
        warnings.push(`${recipe.title}: Zutat ${ri.ingredientId} ist nicht mehr verfügbar`);
        continue;
      }
      let grams: number;
      try {
        grams = toGrams(ri.amount, ri.unit, ingredient) * factor;
      } catch (e) {
        if (!(e instanceof UnitError)) throw e;
        warnings.push(`${recipe.title}: ${e.message}`);
        continue;
      }
      const entry = needed.get(ingredient.id);
      if (entry) entry.grams += grams;
      else needed.set(ingredient.id, { ingredient, grams });
    }
  }

  const items: ShoppingItem[] = [];
  for (const { ingredient, grams } of needed.values()) {
    const base = {
      ingredientId: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      neededG: grams,
      pantryStaple: ingredient.pantryStaple,
    };
    if (ingredient.pantryStaple) {
      items.push({ ...base, choice: null, priceEur: null });
      continue;
    }
    const choice = choosePackages(grams, packagesFor(ingredient, ctx.overrides));
    if (!choice) warnings.push(`Kein Preis für ${ingredient.name} hinterlegt`);
    items.push({ ...base, choice, priceEur: choice ? choice.totalEur : null });
  }

  items.sort(
    (a, b) =>
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name, 'de'),
  );
  const totalCents = items.reduce((sum, i) => sum + Math.round((i.priceEur ?? 0) * 100), 0);
  return { items, totalEur: totalCents / 100, warnings };
}
