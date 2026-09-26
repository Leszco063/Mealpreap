import type { Catalog, Diet, MealType } from '../../src/domain/types';
import { MEAL_TYPES } from '../../src/domain/types';
import { MEAL_TYPE_LABEL } from '../../src/domain/labels';
import { makeLookup } from '../../src/domain/recipe';
import { perPortion } from '../../src/domain/nutrition';
import { recipeCostPerPortion } from '../../src/domain/pricing';
import { dietsOf, recipeProfile } from '../../src/domain/diet';

export interface ReportRow {
  id: string;
  title: string;
  mealTypes: MealType[];
  storage: string;
  servings: number;
  minutes: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  eurPerPortion: number;
  diets: Diet[];
  flags: string[];
}

/** Zielbereich kcal pro Portion je Mahlzeit (siehe Plan 1b, Global Constraints) */
const KCAL_RANGE: Record<MealType, [number, number]> = {
  breakfast: [300, 550],
  lunch: [450, 800],
  dinner: [450, 800],
  snack: [100, 300],
};

export function recipeReport(catalog: Catalog): ReportRow[] {
  const lookup = makeLookup(catalog.ingredients);
  return catalog.recipes.map((r) => {
    const n = perPortion(r, lookup);
    const eur = recipeCostPerPortion(r, lookup).eur;
    const flags: string[] = [];
    const main = r.mealTypes[0] ?? 'lunch';
    const [min, max] = KCAL_RANGE[main];
    if (n.kcal < min) flags.push('kcal<Ziel');
    if (n.kcal > max) flags.push('kcal>Ziel');
    if (eur < 0.3) flags.push('preis<0,30');
    if (eur > 5) flags.push('preis>5');
    if (r.storage.kind === 'prep' && r.servings > r.storage.fridgeDays * 2) flags.push('portionen>tage');
    return {
      id: r.id,
      title: r.title,
      mealTypes: r.mealTypes,
      storage: r.storage.kind === 'prep' ? `prep ${r.storage.fridgeDays} T.${r.storage.freezable ? ' ❄' : ''}` : 'frisch',
      servings: r.servings,
      minutes: r.prepMinutes + r.cookMinutes,
      kcal: n.kcal,
      protein: n.protein,
      fat: n.fat,
      carbs: n.carbs,
      eurPerPortion: eur,
      diets: dietsOf(recipeProfile(r, lookup).flags),
      flags,
    };
  });
}

export interface ReportSummary {
  recipes: number;
  byMealType: Record<MealType, number>;
  prep: number;
  fresh: number;
  vegetarian: number;
  vegan: number;
  flagged: number;
}

export function summarize(rows: ReportRow[]): ReportSummary {
  const byMealType = Object.fromEntries(MEAL_TYPES.map((m) => [m, 0])) as Record<MealType, number>;
  for (const r of rows) for (const m of r.mealTypes) byMealType[m] += 1;
  return {
    recipes: rows.length,
    byMealType,
    prep: rows.filter((r) => r.storage.startsWith('prep')).length,
    fresh: rows.filter((r) => r.storage === 'frisch').length,
    vegetarian: rows.filter((r) => r.diets.includes('vegetarian')).length,
    vegan: rows.filter((r) => r.diets.includes('vegan')).length,
    flagged: rows.filter((r) => r.flags.length > 0).length,
  };
}

const de1 = (n: number) => n.toFixed(1).replace('.', ',');
const de2 = (n: number) => n.toFixed(2).replace('.', ',');

export function formatReport(rows: ReportRow[], s: ReportSummary): string {
  const lines = [
    '# Katalog-Report',
    '',
    `${s.recipes} Rezepte · vorkochbar ${s.prep} · frisch ${s.fresh} · vegetarisch ${s.vegetarian} · vegan ${s.vegan} · mit Hinweisen ${s.flagged}`,
    '',
    MEAL_TYPES.map((m) => `${MEAL_TYPE_LABEL[m]}: ${s.byMealType[m]}`).join(' · '),
    '',
    '| Rezept | Mahlzeit | Lagerung | Port. | Min. | kcal | P | F | KH | €/Port. | Hinweise |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of [...rows].sort((a, b) => a.title.localeCompare(b.title, 'de'))) {
    lines.push(
      `| ${r.title} | ${r.mealTypes.map((m) => MEAL_TYPE_LABEL[m]).join(', ')} | ${r.storage} | ${r.servings} | ${r.minutes} | ${Math.round(r.kcal)} | ${de1(r.protein)} | ${de1(r.fat)} | ${de1(r.carbs)} | ${de2(r.eurPerPortion)} | ${r.flags.join(', ')} |`,
    );
  }
  return lines.join('\n') + '\n';
}
