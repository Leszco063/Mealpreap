import type { RxJsonSchema } from 'rxdb/plugins/core';
import type { HouseholdDoc, MealDoc, PersonDoc, ShoppingCheckDoc } from './types';

const id = { type: 'string', maxLength: 100 } as const;
const stringArray = { type: 'array', items: { type: 'string' } } as const;

export const householdSchema: RxJsonSchema<HouseholdDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id,
    name: { type: 'string' },
    weeklyBudgetEur: { type: 'number' },
    cookDays: { type: 'array', items: { type: 'integer' } },
    weekStartsOn: { type: 'integer' },
    updatedAt: { type: 'number' },
  },
  required: ['id', 'name', 'weeklyBudgetEur', 'cookDays', 'weekStartsOn', 'updatedAt'],
};

export const personSchema: RxJsonSchema<PersonDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id,
    householdId: { type: 'string' },
    name: { type: 'string' },
    userId: { type: 'string' },
    targets: {
      type: 'object',
      properties: {
        kcal: { type: 'number' },
        proteinMin: { type: 'number' },
        fatMin: { type: 'number' },
        fatMax: { type: 'number' },
        carbsMin: { type: 'number' },
        carbsMax: { type: 'number' },
      },
      required: ['kcal', 'proteinMin'],
    },
    mealSlots: stringArray,
    diet: { type: 'string' },
    noPork: { type: 'boolean' },
    allergies: stringArray,
    dislikedIngredientIds: stringArray,
    maxMinutesWeekday: { type: 'number' },
    maxMinutesCookDay: { type: 'number' },
    updatedAt: { type: 'number' },
  },
  required: [
    'id',
    'householdId',
    'name',
    'targets',
    'mealSlots',
    'diet',
    'noPork',
    'allergies',
    'dislikedIngredientIds',
    'maxMinutesWeekday',
    'maxMinutesCookDay',
    'updatedAt',
  ],
};

export const mealSchema: RxJsonSchema<MealDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id,
    householdId: { type: 'string' },
    date: { type: 'string' },
    slot: { type: 'string' },
    recipeId: { type: 'string' },
    cookDate: { type: 'string' },
    portions: { type: 'object' },
    pinned: { type: 'boolean' },
    updatedAt: { type: 'number' },
  },
  required: ['id', 'householdId', 'date', 'slot', 'recipeId', 'cookDate', 'portions', 'pinned', 'updatedAt'],
};

export const shoppingCheckSchema: RxJsonSchema<ShoppingCheckDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id,
    householdId: { type: 'string' },
    weekStart: { type: 'string' },
    ingredientId: { type: 'string' },
    checked: { type: 'boolean' },
    updatedAt: { type: 'number' },
  },
  required: ['id', 'householdId', 'weekStart', 'ingredientId', 'checked', 'updatedAt'],
};
