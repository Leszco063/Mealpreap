import type { Ingredient, Recipe } from './types';

// Testdaten für alle Domänen-Tests. Werte an BLS angelehnt, bewusst gerundet.

export const haferflocken: Ingredient = {
  id: 'haferflocken',
  name: 'Haferflocken',
  blsCode: 'C133000',
  category: 'trockenware',
  per100g: { kcal: 348, protein: 13.2, fat: 6.7, carbs: 53.3, fiber: 11, sugar: 1, salt: 0 },
  packages: [{ sizeG: 500, priceEur: 0.69 }],
  priceAsOf: '2026-09-26',
  flags: [],
  allergens: ['gluten'],
  pantryStaple: false,
};

export const magerquark: Ingredient = {
  id: 'magerquark',
  name: 'Magerquark',
  blsCode: 'M713100',
  category: 'kuehlregal',
  per100g: { kcal: 66, protein: 11.9, fat: 0.2, carbs: 3.7, fiber: 0, sugar: 3.7, salt: 0.1 },
  packages: [
    { sizeG: 250, priceEur: 0.79 },
    { sizeG: 500, priceEur: 1.29 },
  ],
  priceAsOf: '2026-09-26',
  flags: ['animal', 'dairy'],
  allergens: ['milk'],
  pantryStaple: false,
};

export const milch: Ingredient = {
  id: 'milch',
  name: 'Milch 1,5 %',
  blsCode: 'M111200',
  category: 'kuehlregal',
  per100g: { kcal: 44, protein: 3.5, fat: 1.5, carbs: 3.9, fiber: 0, sugar: 3.9, salt: 0.1 },
  densityGPerMl: 1.03,
  packages: [{ sizeG: 1030, priceEur: 0.99 }],
  priceAsOf: '2026-09-26',
  flags: ['animal', 'dairy'],
  allergens: ['milk'],
  pantryStaple: false,
};

export const rinderhack: Ingredient = {
  id: 'rinderhack',
  name: 'Rinderhackfleisch',
  blsCode: 'U010100',
  category: 'fleisch-fisch',
  per100g: { kcal: 224, protein: 19.1, fat: 16.4, carbs: 0, fiber: 0, sugar: 0, salt: 0.1 },
  packages: [{ sizeG: 500, priceEur: 4.99 }],
  priceAsOf: '2026-09-26',
  flags: ['animal', 'meat'],
  allergens: [],
  pantryStaple: false,
};

export const schweinehack: Ingredient = {
  id: 'schweinehack',
  name: 'Schweinehackfleisch',
  blsCode: 'U020100',
  category: 'fleisch-fisch',
  per100g: { kcal: 271, protein: 17.9, fat: 22.1, carbs: 0, fiber: 0, sugar: 0, salt: 0.1 },
  packages: [{ sizeG: 500, priceEur: 3.99 }],
  priceAsOf: '2026-09-26',
  // bewusst ohne 'meat' und 'animal': diet.ts muss beides aus 'pork' ableiten
  flags: ['pork'],
  allergens: [],
  pantryStaple: false,
};

export const zwiebel: Ingredient = {
  id: 'zwiebel',
  name: 'Zwiebel',
  blsCode: 'G480100',
  category: 'obst-gemuese',
  per100g: { kcal: 34, protein: 1.2, fat: 0.2, carbs: 6, fiber: 1.4, sugar: 6, salt: 0 },
  pieceWeightG: 80,
  packages: [{ sizeG: 1000, priceEur: 1.29 }],
  priceAsOf: '2026-09-26',
  flags: [],
  allergens: [],
  pantryStaple: false,
};

export const olivenoel: Ingredient = {
  id: 'olivenoel',
  name: 'Olivenöl',
  blsCode: 'Q120000',
  category: 'gewuerze-oele',
  per100g: { kcal: 899, protein: 0, fat: 99.9, carbs: 0, fiber: 0, sugar: 0, salt: 0 },
  densityGPerMl: 0.92,
  packages: [{ sizeG: 690, priceEur: 6.49 }],
  priceAsOf: '2026-09-26',
  flags: [],
  allergens: [],
  pantryStaple: false,
};

export const salz: Ingredient = {
  id: 'salz',
  name: 'Salz',
  blsCode: 'R113000',
  category: 'gewuerze-oele',
  per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, salt: 95.4 },
  densityGPerMl: 1.2,
  packages: [{ sizeG: 500, priceEur: 0.29 }],
  priceAsOf: '2026-09-26',
  flags: [],
  allergens: [],
  pantryStaple: true,
};

export const lachs: Ingredient = {
  id: 'lachs',
  name: 'Lachsfilet',
  blsCode: null,
  category: 'fleisch-fisch',
  per100g: { kcal: 180, protein: 20, fat: 11, carbs: 0, fiber: 0, sugar: 0, salt: 0.1 },
  packages: [{ sizeG: 250, priceEur: 4.49 }],
  priceAsOf: '2026-09-26',
  flags: ['animal', 'fish'],
  allergens: ['fish'],
  pantryStaple: false,
};

export const allIngredients: Ingredient[] = [
  haferflocken,
  magerquark,
  milch,
  rinderhack,
  schweinehack,
  zwiebel,
  olivenoel,
  salz,
  lachs,
];

export const overnightOats: Recipe = {
  id: 'overnight-oats',
  title: 'Overnight Oats mit Quark',
  description: '',
  servings: 1,
  ingredients: [
    { ingredientId: 'haferflocken', amount: 50, unit: 'g' },
    { ingredientId: 'magerquark', amount: 150, unit: 'g' },
    { ingredientId: 'milch', amount: 100, unit: 'ml' },
  ],
  steps: ['Alles verrühren und über Nacht kühl stellen.'],
  prepMinutes: 5,
  cookMinutes: 0,
  mealTypes: ['breakfast'],
  storage: { kind: 'prep', fridgeDays: 2, freezable: false },
  tags: [],
  source: 'starter',
  version: 1,
};

export const chili: Recipe = {
  id: 'chili',
  title: 'Chili',
  description: '',
  servings: 4,
  ingredients: [
    { ingredientId: 'rinderhack', amount: 500, unit: 'g' },
    { ingredientId: 'zwiebel', amount: 1, unit: 'stk' },
    { ingredientId: 'olivenoel', amount: 1, unit: 'el' },
    { ingredientId: 'salz', amount: 1, unit: 'tl' },
    { ingredientId: 'magerquark', amount: 100, unit: 'g', optional: true, note: 'als Topping' },
  ],
  steps: ['Anbraten.', 'Köcheln.'],
  prepMinutes: 15,
  cookMinutes: 30,
  mealTypes: ['lunch', 'dinner'],
  storage: { kind: 'prep', fridgeDays: 4, freezable: true },
  tags: [],
  source: 'starter',
  version: 1,
};

export const lachsPfanne: Recipe = {
  id: 'lachs-pfanne',
  title: 'Lachs aus der Pfanne',
  description: '',
  servings: 2,
  ingredients: [
    { ingredientId: 'lachs', amount: 250, unit: 'g' },
    { ingredientId: 'olivenoel', amount: 1, unit: 'el' },
  ],
  steps: ['Braten.'],
  prepMinutes: 10,
  cookMinutes: 15,
  mealTypes: ['dinner'],
  storage: { kind: 'fresh' },
  tags: [],
  source: 'starter',
  version: 1,
};

export const allRecipes: Recipe[] = [overnightOats, chili, lachsPfanne];
