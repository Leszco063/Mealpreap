import { describe, expect, it } from 'vitest';
import { buildShoppingList, type ShoppingContext } from './shopping';
import { makeLookup } from './recipe';
import { allIngredients, allRecipes } from './fixtures.test-data';
import type { Meal } from './types';

const ctx: ShoppingContext = {
  lookupIngredient: makeLookup(allIngredients),
  lookupRecipe: makeLookup(allRecipes),
};

function meal(part: Partial<Meal>): Meal {
  return {
    id: 'm',
    date: '2026-09-28',
    slot: 'lunch',
    recipeId: 'chili',
    cookDate: '2026-09-27',
    portions: { a: 1, b: 1 },
    pinned: false,
    ...part,
  };
}

const woche = { from: '2026-09-27', to: '2026-10-03' };

describe('buildShoppingList', () => {
  it('fasst Mahlzeiten zusammen, rundet auf Packungen, sortiert nach Bereich', () => {
    const list = buildShoppingList(
      [meal({ id: '1', portions: { a: 1.4, b: 0.9 } }), meal({ id: '2', date: '2026-09-29' })],
      ctx,
      woche,
    );
    // Faktor (2,3 + 2) / 4 = 1,075
    expect(list.items.map((i) => i.ingredientId)).toEqual(['zwiebel', 'rinderhack', 'olivenoel', 'salz']);
    const hack = list.items.find((i) => i.ingredientId === 'rinderhack');
    expect(hack?.neededG).toBeCloseTo(537.5, 5);
    expect(hack?.choice?.picks).toEqual([{ sizeG: 500, priceEur: 4.99, count: 2 }]);
    expect(hack?.priceEur).toBe(9.98);
    const salzItem = list.items.find((i) => i.ingredientId === 'salz');
    expect(salzItem?.pantryStaple).toBe(true);
    expect(salzItem?.priceEur).toBeNull();
    expect(list.totalEur).toBe(17.76);
    expect(list.warnings).toEqual([]);
  });

  it('optionale Zutaten stehen nicht auf der Liste', () => {
    const list = buildShoppingList([meal({})], ctx, woche);
    expect(list.items.some((i) => i.ingredientId === 'magerquark')).toBe(false);
  });

  it('filtert nach Kochtag, nicht nach Esstag', () => {
    const list = buildShoppingList(
      [meal({ date: '2026-09-28', cookDate: '2026-09-26' })],
      ctx,
      { from: '2026-09-27', to: '2026-09-27' },
    );
    expect(list.items).toEqual([]);
  });

  it('0 Portionen oder negative Werte zählen nicht', () => {
    const list = buildShoppingList([meal({ portions: { a: 0, b: -1 } })], ctx, woche);
    expect(list.items).toEqual([]);
    expect(list.totalEur).toBe(0);
  });

  it('gelöschtes Rezept oder gelöschte Zutat → Warnung statt Absturz', () => {
    const ohneZwiebel: ShoppingContext = {
      ...ctx,
      lookupIngredient: makeLookup(allIngredients.filter((i) => i.id !== 'zwiebel')),
    };
    const list = buildShoppingList([meal({ recipeId: 'weg' }), meal({ id: '2' })], ohneZwiebel, woche);
    expect(list.warnings).toEqual([
      'Rezept weg ist nicht mehr verfügbar (2026-09-28)',
      'Chili: Zutat zwiebel ist nicht mehr verfügbar',
    ]);
    expect(list.items.map((i) => i.ingredientId)).toEqual(['rinderhack', 'olivenoel', 'salz']);
  });

  it('Rezept mit 0 Grundportionen → Warnung statt Absturz', () => {
    const kaputt = { ...allRecipes[1]!, id: 'kaputt', title: 'Kaputt', servings: 0 };
    const c: ShoppingContext = { ...ctx, lookupRecipe: makeLookup([...allRecipes, kaputt]) };
    const list = buildShoppingList([meal({ recipeId: 'kaputt' })], c, woche);
    expect(list.items).toEqual([]);
    expect(list.warnings).toEqual(['Kaputt: ungültige Portionsanzahl 0']);
  });

  it('Zutat ohne Preis → Warnung, Summe ohne diese Zutat', () => {
    const ohnePreis: ShoppingContext = {
      ...ctx,
      lookupIngredient: makeLookup(allIngredients.map((i) => (i.id === 'olivenoel' ? { ...i, packages: [] } : i))),
    };
    const list = buildShoppingList([meal({})], ohnePreis, woche);
    expect(list.warnings).toEqual(['Kein Preis für Olivenöl hinterlegt']);
    expect(list.items.find((i) => i.ingredientId === 'olivenoel')?.priceEur).toBeNull();
  });
});
