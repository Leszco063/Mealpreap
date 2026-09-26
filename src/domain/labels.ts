import type { Allergen, Category, Diet, MealType } from './types';

export const DIET_LABEL: Record<Diet, string> = {
  omnivore: 'alles',
  pescetarian: 'pescetarisch',
  vegetarian: 'vegetarisch',
  vegan: 'vegan',
};

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
};

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  gluten: 'Gluten',
  crustaceans: 'Krebstiere',
  egg: 'Ei',
  fish: 'Fisch',
  peanuts: 'Erdnüsse',
  soy: 'Soja',
  milk: 'Milch',
  nuts: 'Schalenfrüchte',
  celery: 'Sellerie',
  mustard: 'Senf',
  sesame: 'Sesam',
  sulphites: 'Sulfite',
  lupin: 'Lupinen',
  molluscs: 'Weichtiere',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  'obst-gemuese': 'Obst & Gemüse',
  backwaren: 'Backwaren',
  'fleisch-fisch': 'Fleisch & Fisch',
  kuehlregal: 'Kühlregal',
  tiefkuehl: 'Tiefkühl',
  trockenware: 'Trockenware',
  konserven: 'Konserven',
  'gewuerze-oele': 'Gewürze & Öle',
  getraenke: 'Getränke',
  sonstiges: 'Sonstiges',
};
