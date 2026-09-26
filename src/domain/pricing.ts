import type { Ingredient, Package, Recipe } from './types';
import { recipeGrams, type IngredientLookup } from './recipe';

/** Eigene Preise des Haushalts: ingredientId → Packungen */
export type PriceOverrides = ReadonlyMap<string, readonly Package[]>;

export function packagesFor(ing: Ingredient, overrides?: PriceOverrides): readonly Package[] {
  const own = overrides?.get(ing.id);
  return own && own.length > 0 ? own : ing.packages;
}

export function pricePerGram(ing: Ingredient, overrides?: PriceOverrides): number | null {
  let best: number | null = null;
  for (const p of packagesFor(ing, overrides)) {
    if (p.sizeG <= 0) continue;
    const perGram = p.priceEur / p.sizeG;
    if (best === null || perGram < best) best = perGram;
  }
  return best;
}

export interface PackagePick {
  sizeG: number;
  priceEur: number;
  count: number;
}

export interface PackageChoice {
  picks: PackagePick[];
  totalG: number;
  totalEur: number;
}

/**
 * Günstigste Packungskombination mit mindestens neededG Gramm.
 * Bei gleichem Preis gewinnt die Kombination mit weniger Rest.
 * Rechnet intern in ganzen Gramm und ganzen Cent (dynamische Programmierung).
 */
export function choosePackages(neededG: number, packages: readonly Package[]): PackageChoice | null {
  const usable = packages
    .filter((p) => p.sizeG > 0 && p.priceEur >= 0)
    .map((p) => ({ size: Math.round(p.sizeG), cents: Math.round(p.priceEur * 100), pkg: p }))
    .filter((u) => u.size > 0);
  if (usable.length === 0) return null;
  const needed = Math.max(0, Math.ceil(neededG - 1e-9));
  if (needed === 0) return { picks: [], totalG: 0, totalEur: 0 };

  const limit = needed + Math.max(...usable.map((u) => u.size));
  const cost = new Array<number>(limit + 1).fill(Infinity);
  const via = new Array<number>(limit + 1).fill(-1);
  cost[0] = 0;
  for (let a = 1; a <= limit; a++) {
    for (const [i, u] of usable.entries()) {
      if (u.size > a) continue;
      const candidate = (cost[a - u.size] ?? Infinity) + u.cents;
      if (candidate < (cost[a] ?? Infinity)) {
        cost[a] = candidate;
        via[a] = i;
      }
    }
  }

  let best = -1;
  for (let a = needed; a <= limit; a++) {
    const c = cost[a] ?? Infinity;
    if (c !== Infinity && (best === -1 || c < (cost[best] ?? Infinity))) best = a;
  }
  if (best === -1) return null;

  const counts = new Map<number, number>();
  for (let a = best; a > 0; ) {
    const i = via[a] ?? -1;
    const u = usable[i];
    if (!u) break;
    counts.set(i, (counts.get(i) ?? 0) + 1);
    a -= u.size;
  }
  const picks: PackagePick[] = [];
  for (const [i, u] of usable.entries()) {
    const count = counts.get(i);
    if (count) picks.push({ sizeG: u.pkg.sizeG, priceEur: u.pkg.priceEur, count });
  }
  picks.sort((x, y) => y.sizeG - x.sizeG);
  return { picks, totalG: best, totalEur: (cost[best] ?? 0) / 100 };
}

export interface CostResult {
  /** anteiliger Warenwert pro Portion (ohne Grundvorrat, ohne Packungsreste) */
  eur: number;
  missingPrices: string[];
}

export function recipeCostPerPortion(
  recipe: Recipe,
  lookup: IngredientLookup,
  overrides?: PriceOverrides,
): CostResult {
  let eur = 0;
  const missingPrices: string[] = [];
  for (const { ingredient, grams } of recipeGrams(recipe, lookup)) {
    if (ingredient.pantryStaple) continue;
    const perGram = pricePerGram(ingredient, overrides);
    if (perGram === null) {
      missingPrices.push(ingredient.id);
      continue;
    }
    eur += perGram * grams;
  }
  return { eur: eur / recipe.servings, missingPrices };
}
