import { z } from 'zod';
import { ALLERGENS, CATEGORIES, FLAGS, MEAL_TYPES, UNITS } from '../../src/domain/types';

export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'nur a-z, 0-9 und einzelne Bindestriche erlaubt');

const positive = z.number().positive();
const nonNegative = z.number().nonnegative();

export const ingredientRowSchema = z.strictObject({
  line: z.number().int(),
  id: idSchema,
  name: z.string().min(1),
  blsCode: z
    .string()
    .regex(/^[A-Z0-9]{7}$/, 'BLS-Code hat 7 Zeichen (z. B. C133000)')
    .nullable(),
  category: z.enum(CATEGORIES),
  densityGPerMl: positive.optional(),
  pieceWeightG: positive.optional(),
  packages: z.array(z.strictObject({ sizeG: positive, priceEur: nonNegative })),
  priceAsOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als JJJJ-MM-TT'),
  flags: z.array(z.enum(FLAGS)),
  allergens: z.array(z.enum(ALLERGENS)),
  pantryStaple: z.boolean(),
  manual: z.strictObject({
    kcal: nonNegative.optional(),
    protein: nonNegative.optional(),
    fat: nonNegative.optional(),
    carbs: nonNegative.optional(),
    fiber: nonNegative.optional(),
    sugar: nonNegative.optional(),
    salt: nonNegative.optional(),
  }),
});

export const recipeFileSchema = z.strictObject({
  id: idSchema,
  title: z.string().min(1),
  description: z.string().default(''),
  servings: z.number().int().min(1),
  prepMinutes: z.number().int().min(0),
  cookMinutes: z.number().int().min(0),
  mealTypes: z.array(z.enum(MEAL_TYPES)).min(1),
  storage: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('prep'), fridgeDays: z.number().int().min(1).max(5), freezable: z.boolean() }),
    z.strictObject({ kind: z.literal('fresh') }),
  ]),
  tags: z.array(z.string()).default([]),
  version: z.number().int().min(1).default(1),
  ingredients: z
    .array(
      z.strictObject({
        ingredient: idSchema,
        amount: positive,
        unit: z.enum(UNITS),
        note: z.string().optional(),
        optional: z.boolean().optional(),
      }),
    )
    .min(1),
  steps: z.array(z.string().min(1)).min(1),
});

export type RecipeFile = z.infer<typeof recipeFileSchema>;
