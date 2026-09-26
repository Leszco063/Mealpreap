import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { NUTRIENT_KEYS, type Catalog, type Ingredient, type Nutrients, type Recipe } from '../../src/domain/types';
import { makeLookup, type IngredientLookup } from '../../src/domain/recipe';
import { canConvert } from '../../src/domain/units';
import { computedKcal, isPlausible, perPortion, ZERO } from '../../src/domain/nutrition';
import type { BlsEntry } from '../bls/parse';
import { parseIngredientsCsv, type IngredientRow } from './csv';
import { recipeFileSchema } from './schema';

export interface BuildInput {
  bls: readonly BlsEntry[];
  ingredientsCsv: string;
  recipeFiles: readonly { fileName: string; text: string }[];
  /** Inhalt von catalog/ids.lock */
  lockedIds: readonly string[];
  /** Inhalt von catalog/retired-ids.txt */
  retiredIds: readonly string[];
}

export interface BuildResult {
  catalog: Catalog | null;
  errors: string[];
  /** alle aktuell vergebenen IDs, z. B. 'zutat:haferflocken', 'rezept:chili-con-carne' */
  ids: string[];
}

function resolveNutrients(
  row: IngredientRow,
  blsByCode: ReadonlyMap<string, BlsEntry>,
  where: string,
  errors: string[],
): Nutrients | null {
  const manualCount = NUTRIENT_KEYS.filter((k) => row.manual[k] !== undefined).length;
  if (row.blsCode) {
    if (manualCount > 0) {
      errors.push(`${where}: entweder blsCode oder eigene Nährwerte angeben, nicht beides`);
      return null;
    }
    const entry = blsByCode.get(row.blsCode);
    if (!entry) {
      errors.push(`${where}: BLS-Code ${row.blsCode} unbekannt`);
      return null;
    }
    if (entry.incomplete) {
      errors.push(
        `${where}: BLS-Eintrag ${row.blsCode} ist unvollständig – anderen Code wählen oder Nährwerte selbst angeben`,
      );
      return null;
    }
    return { ...entry.per100g };
  }
  if (manualCount !== NUTRIENT_KEYS.length) {
    errors.push(`${where}: ohne blsCode müssen alle Nährwerte angegeben sein (${NUTRIENT_KEYS.join(', ')})`);
    return null;
  }
  const n: Nutrients = { ...ZERO };
  for (const k of NUTRIENT_KEYS) n[k] = row.manual[k] ?? 0;
  // BLS-Werte gelten als geprüft; nur eigene Werte werden auf Plausibilität kontrolliert
  if (!isPlausible(n)) {
    errors.push(`${where}: Nährwerte pro 100 g unplausibel (kcal ${n.kcal}, berechnet ${Math.round(computedKcal(n))})`);
    return null;
  }
  return n;
}

function validateRecipe(recipe: Recipe, lookup: IngredientLookup): string[] {
  const errors: string[] = [];
  for (const ri of recipe.ingredients) {
    const ing = lookup(ri.ingredientId);
    if (!ing) {
      errors.push(`Zutat ${ri.ingredientId} gibt es nicht in ingredients.csv`);
      continue;
    }
    if (!canConvert(ri.unit, ing)) {
      const missing = ri.unit === 'stk' ? 'pieceWeightG' : 'densityGPerMl';
      errors.push(`${ing.name}: Einheit ${ri.unit} nicht umrechenbar (${missing} fehlt)`);
    }
    if (ing.blsCode === null) {
      errors.push(`${ing.name}: Startrezepte dürfen nur Zutaten mit BLS-Code verwenden`);
    }
  }
  if (errors.length > 0) return errors;
  const n = perPortion(recipe, lookup);
  if (n.kcal < 50 || n.kcal > 1500) errors.push(`kcal pro Portion ${Math.round(n.kcal)} außerhalb 50–1500`);
  else if (!isPlausible(n)) {
    errors.push(`Nährwerte pro Portion unplausibel (kcal ${Math.round(n.kcal)}, berechnet ${Math.round(computedKcal(n))})`);
  }
  return errors;
}

export function buildCatalog(input: BuildInput): BuildResult {
  const errors: string[] = [];
  const seen = new Set<string>();
  const blsByCode = new Map(input.bls.map((e) => [e.code, e] as const));

  // Zutaten
  const csv = parseIngredientsCsv(input.ingredientsCsv);
  errors.push(...csv.errors);
  const ingredients: Ingredient[] = [];
  for (const row of csv.rows) {
    const where = `ingredients.csv Zeile ${row.line} (${row.id})`;
    const key = `zutat:${row.id}`;
    if (seen.has(key)) {
      errors.push(`${where}: ID doppelt`);
      continue;
    }
    seen.add(key);
    const per100g = resolveNutrients(row, blsByCode, where, errors);
    if (!per100g) continue;
    if (!row.pantryStaple && row.packages.length === 0) {
      errors.push(`${where}: keine Packung mit Preis angegeben`);
      continue;
    }
    ingredients.push({
      id: row.id,
      name: row.name,
      blsCode: row.blsCode,
      category: row.category,
      per100g,
      densityGPerMl: row.densityGPerMl,
      pieceWeightG: row.pieceWeightG,
      packages: row.packages,
      priceAsOf: row.priceAsOf,
      flags: row.flags,
      allergens: row.allergens,
      pantryStaple: row.pantryStaple,
    });
  }

  // Rezepte
  const lookup = makeLookup(ingredients);
  const recipes: Recipe[] = [];
  for (const file of input.recipeFiles) {
    if (!file.fileName.endsWith('.yaml')) {
      errors.push(`${file.fileName}: Rezeptdateien müssen auf .yaml enden`);
      continue;
    }
    let data: unknown;
    try {
      data = parseYaml(file.text);
    } catch (e) {
      errors.push(`${file.fileName}: YAML-Fehler – ${(e as Error).message}`);
      continue;
    }
    const parsed = recipeFileSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${file.fileName}: ${issue.path.join('.')} – ${issue.message}`);
      }
      continue;
    }
    const f = parsed.data;
    if (file.fileName !== `${f.id}.yaml`) {
      errors.push(`${file.fileName}: Dateiname muss ${f.id}.yaml lauten`);
      continue;
    }
    const key = `rezept:${f.id}`;
    if (seen.has(key)) {
      errors.push(`${file.fileName}: ID doppelt`);
      continue;
    }
    seen.add(key);
    const recipe: Recipe = {
      id: f.id,
      title: f.title,
      description: f.description,
      servings: f.servings,
      ingredients: f.ingredients.map((i) => ({
        ingredientId: i.ingredient,
        amount: i.amount,
        unit: i.unit,
        note: i.note,
        optional: i.optional,
      })),
      steps: f.steps,
      prepMinutes: f.prepMinutes,
      cookMinutes: f.cookMinutes,
      mealTypes: f.mealTypes,
      storage: f.storage,
      tags: f.tags,
      source: 'starter',
      version: f.version,
      sources: f.sources,
    };
    const recipeErrors = validateRecipe(recipe, lookup);
    if (recipeErrors.length > 0) {
      errors.push(...recipeErrors.map((m) => `${file.fileName}: ${m}`));
      continue;
    }
    recipes.push(recipe);
  }

  // Stabile IDs
  const ids = [...seen].sort();
  const retired = new Set(input.retiredIds);
  for (const id of input.lockedIds) {
    if (!seen.has(id) && !retired.has(id)) {
      errors.push(`ID ${id} wurde entfernt – in catalog/retired-ids.txt eintragen, falls das Absicht ist`);
    }
  }
  for (const id of retired) {
    if (seen.has(id)) errors.push(`ID ${id} steht in retired-ids.txt, wird aber noch benutzt`);
  }

  if (errors.length > 0) return { catalog: null, errors, ids };

  ingredients.sort((a, b) => a.id.localeCompare(b.id));
  recipes.sort((a, b) => a.id.localeCompare(b.id));
  const body = { ingredients, recipes };
  const version = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  return { catalog: { version, ...body }, errors: [], ids };
}
