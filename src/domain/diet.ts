import { DIETS, type Allergen, type Diet, type Flag, type Recipe } from './types';
import { MissingIngredientError, type IngredientLookup } from './recipe';

const ANIMAL_FLAGS: readonly Flag[] = ['meat', 'pork', 'fish', 'dairy', 'egg', 'honey'];

export interface RecipeProfile {
  flags: ReadonlySet<Flag>;
  allergens: ReadonlySet<Allergen>;
  ingredientIds: ReadonlySet<string>;
}

/**
 * Eigenschaften eines Rezepts aus seinen Zutaten.
 * Optionale Zutaten zählen mit – bei Allergien und Ernährungsform gilt Sicherheit vor Bequemlichkeit.
 */
export function recipeProfile(recipe: Recipe, lookup: IngredientLookup): RecipeProfile {
  const flags = new Set<Flag>();
  const allergens = new Set<Allergen>();
  const ingredientIds = new Set<string>();
  for (const ri of recipe.ingredients) {
    const ing = lookup(ri.ingredientId);
    if (!ing) throw new MissingIngredientError(recipe.id, ri.ingredientId);
    ingredientIds.add(ing.id);
    for (const f of ing.flags) flags.add(f);
    for (const a of ing.allergens) allergens.add(a);
  }
  if (flags.has('pork')) flags.add('meat');
  if (ANIMAL_FLAGS.some((f) => flags.has(f))) flags.add('animal');
  return { flags, allergens, ingredientIds };
}

export function fitsDiet(diet: Diet, flags: ReadonlySet<Flag>): boolean {
  switch (diet) {
    case 'omnivore':
      return true;
    case 'pescetarian':
      return !flags.has('meat');
    case 'vegetarian':
      return !flags.has('meat') && !flags.has('fish');
    case 'vegan':
      return !flags.has('animal');
  }
}

export function dietsOf(flags: ReadonlySet<Flag>): Diet[] {
  return DIETS.filter((d) => fitsDiet(d, flags));
}
