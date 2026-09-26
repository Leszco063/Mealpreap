import { describe, expect, it } from 'vitest';
import { canConvert, toGrams, UnitError } from './units';
import { makeLookup, MissingIngredientError, recipeGrams } from './recipe';
import { allIngredients, chili, milch, olivenoel, rinderhack, salz, zwiebel } from './fixtures.test-data';

describe('toGrams', () => {
  it('g bleibt g', () => {
    expect(toGrams(250, 'g', rinderhack)).toBe(250);
  });
  it('ml, EL, TL über Dichte', () => {
    expect(toGrams(100, 'ml', milch)).toBeCloseTo(103);
    expect(toGrams(1, 'el', olivenoel)).toBeCloseTo(13.8);
    expect(toGrams(1, 'tl', salz)).toBeCloseTo(6);
  });
  it('Stück über Stückgewicht', () => {
    expect(toGrams(2, 'stk', zwiebel)).toBe(160);
  });
  it('fehlendes Stückgewicht → UnitError', () => {
    expect(() => toGrams(1, 'stk', rinderhack)).toThrow(UnitError);
    expect(() => toGrams(1, 'stk', rinderhack)).toThrow('Stückgewicht fehlt');
  });
  it('fehlende Dichte → UnitError', () => {
    expect(() => toGrams(1, 'el', rinderhack)).toThrow('Dichte fehlt');
  });
  it('negative oder ungültige Mengen → UnitError', () => {
    expect(() => toGrams(-1, 'g', rinderhack)).toThrow(UnitError);
    expect(() => toGrams(Number.NaN, 'g', rinderhack)).toThrow(UnitError);
  });
  it('canConvert', () => {
    expect(canConvert('g', rinderhack)).toBe(true);
    expect(canConvert('stk', rinderhack)).toBe(false);
    expect(canConvert('stk', zwiebel)).toBe(true);
    expect(canConvert('ml', milch)).toBe(true);
    expect(canConvert('tl', zwiebel)).toBe(false);
  });
});

describe('recipeGrams', () => {
  const lookup = makeLookup(allIngredients);

  it('rechnet Rezeptzutaten in Gramm, ohne optionale', () => {
    const grams = recipeGrams(chili, lookup);
    expect(grams.map((g) => [g.ingredient.id, g.grams])).toEqual([
      ['rinderhack', 500],
      ['zwiebel', 80],
      ['olivenoel', expect.closeTo(13.8, 5)],
      ['salz', expect.closeTo(6, 5)],
    ]);
  });

  it('mit includeOptional auch optionale Zutaten', () => {
    const ids = recipeGrams(chili, lookup, { includeOptional: true }).map((g) => g.ingredient.id);
    expect(ids).toContain('magerquark');
  });

  it('fasst doppelte Zutaten zusammen', () => {
    const doppelt = {
      ...chili,
      ingredients: [
        { ingredientId: 'zwiebel', amount: 1, unit: 'stk' as const },
        { ingredientId: 'zwiebel', amount: 40, unit: 'g' as const },
      ],
    };
    expect(recipeGrams(doppelt, lookup)).toEqual([{ ingredient: zwiebel, grams: 120 }]);
  });

  it('unbekannte Zutat → MissingIngredientError', () => {
    const kaputt = { ...chili, ingredients: [{ ingredientId: 'gibts-nicht', amount: 1, unit: 'g' as const }] };
    expect(() => recipeGrams(kaputt, lookup)).toThrow(MissingIngredientError);
  });
});
