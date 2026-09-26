export const NUTRIENT_KEYS = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'salt'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
/** Nährwerte; kcal in kcal, alles andere in Gramm */
export type Nutrients = Record<NutrientKey, number>;

export const UNITS = ['g', 'ml', 'stk', 'el', 'tl'] as const;
export type Unit = (typeof UNITS)[number];

/** Reihenfolge = Sortierung der Einkaufsliste */
export const CATEGORIES = [
  'obst-gemuese',
  'backwaren',
  'fleisch-fisch',
  'kuehlregal',
  'tiefkuehl',
  'trockenware',
  'konserven',
  'gewuerze-oele',
  'getraenke',
  'sonstiges',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const FLAGS = ['animal', 'meat', 'pork', 'fish', 'dairy', 'egg', 'honey'] as const;
export type Flag = (typeof FLAGS)[number];

/** Die 14 EU-Hauptallergene */
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'egg',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const DIETS = ['omnivore', 'pescetarian', 'vegetarian', 'vegan'] as const;
export type Diet = (typeof DIETS)[number];

/** Datum als 'YYYY-MM-DD' */
export type IsoDate = string;

export interface Package {
  sizeG: number;
  priceEur: number;
}

export interface Ingredient {
  id: string;
  name: string;
  blsCode: string | null;
  category: Category;
  per100g: Nutrients;
  densityGPerMl?: number;
  pieceWeightG?: number;
  packages: Package[];
  priceAsOf: string;
  flags: Flag[];
  allergens: Allergen[];
  pantryStaple: boolean;
}

export type Storage = { kind: 'prep'; fridgeDays: number; freezable: boolean } | { kind: 'fresh' };

export interface RecipeIngredient {
  ingredientId: string;
  amount: number;
  unit: Unit;
  note?: string;
  optional?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  prepMinutes: number;
  cookMinutes: number;
  mealTypes: MealType[];
  storage: Storage;
  tags: string[];
  source: 'starter' | 'own' | 'import';
  url?: string;
  basedOn?: string;
  version: number;
}

export interface Targets {
  kcal: number;
  proteinMin: number;
  fatMin?: number;
  fatMax?: number;
  carbsMin?: number;
  carbsMax?: number;
}

export interface Person {
  id: string;
  name: string;
  userId?: string;
  targets: Targets;
  mealSlots: MealType[];
  diet: Diet;
  noPork: boolean;
  allergies: Allergen[];
  dislikedIngredientIds: string[];
  maxMinutesWeekday: number;
  maxMinutesCookDay: number;
}

export interface Meal {
  id: string;
  date: IsoDate;
  slot: MealType;
  recipeId: string;
  /** Tag der Zubereitung; bei frischen Gerichten = date */
  cookDate: IsoDate;
  /** personId → Portionsfaktor, z. B. { a: 1.4, b: 0.9 } */
  portions: Record<string, number>;
  pinned: boolean;
}

export interface Catalog {
  version: string;
  ingredients: Ingredient[];
  recipes: Recipe[];
}
