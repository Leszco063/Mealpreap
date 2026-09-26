import type { Allergen, Category, Flag, Nutrients, Package } from '../../src/domain/types';
import { NUTRIENT_KEYS } from '../../src/domain/types';
import { ingredientRowSchema } from './schema';

export const CSV_COLUMNS = [
  'id',
  'name',
  'blsCode',
  'category',
  'densityGPerMl',
  'pieceWeightG',
  'packages',
  'priceAsOf',
  'flags',
  'allergens',
  'pantryStaple',
  ...NUTRIENT_KEYS,
] as const;
type Column = (typeof CSV_COLUMNS)[number];

export interface IngredientRow {
  line: number;
  id: string;
  name: string;
  blsCode: string | null;
  category: Category;
  densityGPerMl?: number;
  pieceWeightG?: number;
  packages: Package[];
  priceAsOf: string;
  flags: Flag[];
  allergens: Allergen[];
  pantryStaple: boolean;
  manual: Partial<Nutrients>;
}

/** Leer → undefined, ungültig → NaN (wird vom Schema abgelehnt). Dezimalkomma erlaubt. */
export function parseNumber(s: string): number | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : Number.NaN;
}

function splitList(s: string): string[] {
  return s
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
}

function parsePackages(s: string): { sizeG: number; priceEur: number }[] {
  return splitList(s).map((part) => {
    const [size = '', price = ''] = part.split(':');
    return { sizeG: parseNumber(size) ?? Number.NaN, priceEur: parseNumber(price) ?? Number.NaN };
  });
}

export function parseIngredientsCsv(text: string): { rows: IngredientRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const header = (lines[0] ?? '').split(';').map((s) => s.trim());
  if (header.join(';') !== CSV_COLUMNS.join(';')) {
    return { rows: [], errors: [`ingredients.csv: Kopfzeile muss lauten: ${CSV_COLUMNS.join(';')}`] };
  }

  const rows: IngredientRow[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((raw, idx) => {
    const line = idx + 2;
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) return;
    const cells = raw.split(';');
    if (cells.length !== CSV_COLUMNS.length) {
      errors.push(`Zeile ${line}: ${cells.length} Spalten statt ${CSV_COLUMNS.length}`);
      return;
    }
    const get = (c: Column) => (cells[CSV_COLUMNS.indexOf(c)] ?? '').trim();
    const id = get('id');

    const staple = get('pantryStaple').toLowerCase();
    if (!['', 'ja', 'nein'].includes(staple)) {
      errors.push(`Zeile ${line} (${id || '?'}): pantryStaple muss "ja", "nein" oder leer sein`);
      return;
    }

    const manual: Partial<Nutrients> = {};
    for (const key of NUTRIENT_KEYS) {
      const value = parseNumber(get(key));
      if (value !== undefined) manual[key] = value;
    }

    const candidate = {
      line,
      id,
      name: get('name'),
      blsCode: get('blsCode') || null,
      category: get('category'),
      densityGPerMl: parseNumber(get('densityGPerMl')),
      pieceWeightG: parseNumber(get('pieceWeightG')),
      packages: parsePackages(get('packages')),
      priceAsOf: get('priceAsOf'),
      flags: splitList(get('flags')),
      allergens: splitList(get('allergens')),
      pantryStaple: staple === 'ja',
      manual,
    };
    const result = ingredientRowSchema.safeParse(candidate);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`Zeile ${line} (${id || '?'}): ${issue.path.join('.')} – ${issue.message}`);
      }
      return;
    }
    rows.push(result.data);
  });
  return { rows, errors };
}
