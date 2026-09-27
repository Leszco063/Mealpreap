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
