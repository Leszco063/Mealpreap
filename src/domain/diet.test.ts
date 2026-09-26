import { describe, expect, it } from 'vitest';
import { dietsOf, fitsDiet, recipeProfile } from './diet';
import { makeLookup } from './recipe';
import { allIngredients, chili, lachsPfanne, overnightOats } from './fixtures.test-data';
import type { Recipe } from './types';

const lookup = makeLookup(allIngredients);

describe('diet', () => {
  it('vegetarisches Rezept mit Milch', () => {
    const p = recipeProfile(overnightOats, lookup);
    expect(dietsOf(p.flags)).toEqual(['omnivore', 'pescetarian', 'vegetarian']);
    expect([...p.allergens].sort()).toEqual(['gluten', 'milk']);
  });

  it('Fleischgericht passt nur zu omnivore; optionale Zutaten zählen für Allergene', () => {
    const p = recipeProfile(chili, lookup);
    expect(dietsOf(p.flags)).toEqual(['omnivore']);
    expect(p.allergens.has('milk')).toBe(true);
    expect(p.ingredientIds.has('magerquark')).toBe(true);
  });

  it('Fisch ist pescetarisch, nicht vegetarisch', () => {
    const p = recipeProfile(lachsPfanne, lookup);
    expect(fitsDiet('pescetarian', p.flags)).toBe(true);
    expect(fitsDiet('vegetarian', p.flags)).toBe(false);
  });

  it('pork impliziert meat und animal', () => {
    const r: Recipe = { ...chili, ingredients: [{ ingredientId: 'schweinehack', amount: 500, unit: 'g' }] };
    const p = recipeProfile(r, lookup);
    expect(p.flags.has('meat')).toBe(true);
    expect(p.flags.has('animal')).toBe(true);
    expect(fitsDiet('pescetarian', p.flags)).toBe(false);
  });

  it('rein pflanzlich ist vegan', () => {
    const r: Recipe = {
      ...chili,
      ingredients: [
        { ingredientId: 'haferflocken', amount: 50, unit: 'g' },
        { ingredientId: 'olivenoel', amount: 1, unit: 'el' },
      ],
    };
    expect(dietsOf(recipeProfile(r, lookup).flags)).toEqual(['omnivore', 'pescetarian', 'vegetarian', 'vegan']);
  });

  it('unbekannte Zutat wird gemeldet, die übrigen Zutaten zählen weiter', () => {
    const r: Recipe = {
      ...chili,
      ingredients: [
        { ingredientId: 'weg', amount: 1, unit: 'g' },
        { ingredientId: 'magerquark', amount: 100, unit: 'g' },
      ],
    };
    const p = recipeProfile(r, lookup);
    expect(p.missingIngredientIds).toEqual(['weg']);
    expect(p.allergens.has('milk')).toBe(true);
  });
});
