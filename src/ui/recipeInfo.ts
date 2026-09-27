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
