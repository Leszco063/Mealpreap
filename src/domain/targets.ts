import type { Targets } from './types';

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface BodyData {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activity: Activity;
  goal: Goal;
}

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_FACTOR: Record<Goal, number> = { lose: 0.85, maintain: 1, gain: 1.1 };
const PROTEIN_G_PER_KG: Record<Goal, number> = { lose: 2.0, maintain: 1.6, gain: 1.8 };

function assertRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} muss zwischen ${min} und ${max} liegen`);
  }
}

/** Grundumsatz nach Mifflin-St-Jeor in kcal */
export function bmr(b: BodyData): number {
  return 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.ageYears + (b.sex === 'male' ? 5 : -161);
}

export function suggestTargets(b: BodyData): Required<Targets> {
  assertRange(b.weightKg, 30, 300, 'Gewicht (kg)');
  assertRange(b.heightCm, 120, 230, 'Größe (cm)');
  assertRange(b.ageYears, 14, 100, 'Alter (Jahre)');

  const kcal = Math.round((bmr(b) * ACTIVITY_FACTOR[b.activity] * GOAL_FACTOR[b.goal]) / 10) * 10;
  const proteinMin = Math.round(b.weightKg * PROTEIN_G_PER_KG[b.goal]);
  const fatMin = Math.round((kcal * 0.25) / 9);
  const fatMax = Math.round((kcal * 0.35) / 9);
  const carbsMin = Math.max(0, Math.round((kcal - proteinMin * 4 - fatMax * 9) / 4));
  const carbsMax = Math.max(0, Math.round((kcal - proteinMin * 4 - fatMin * 9) / 4));
  return { kcal, proteinMin, fatMin, fatMax, carbsMin, carbsMax };
}
