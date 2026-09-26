import { NUTRIENT_KEYS, type NutrientKey, type Nutrients } from '../../src/domain/types';

export interface BlsEntry {
  code: string;
  name: string;
  nameEn: string;
  per100g: Nutrients;
  /** true, wenn mindestens ein Wert im BLS fehlt ('-'); fehlende Werte stehen als 0 drin */
  incomplete: boolean;
}

/** BLS-Nährstoffcodes, siehe BLS_4_0_Components_DE_EN.xlsx */
export const BLS_COLUMNS: Record<NutrientKey, string> = {
  kcal: 'ENERCC',
  protein: 'PROT625',
  fat: 'FAT',
  carbs: 'CHO',
  fiber: 'FIBT',
  sugar: 'SUGAR',
  salt: 'NACL',
};

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'richText' in v && Array.isArray(v.richText)) {
    return v.richText.map((part: { text?: string }) => part.text ?? '').join('');
  }
  return String(v);
}

export function parseValue(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = cellText(v).trim();
  if (s === '' || s === '-') return null;
  if (s.startsWith('<')) return 0; // unter Nachweis-/Bestimmungsgrenze
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function findColumn(header: readonly unknown[], match: (h: string) => boolean, label: string): number {
  const i = header.findIndex((h) => match(cellText(h).trim()));
  if (i === -1) throw new Error(`BLS-Kopfzeile: Spalte ${label} nicht gefunden`);
  return i;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function parseRows(header: readonly unknown[], rows: readonly (readonly unknown[])[]): BlsEntry[] {
  const codeCol = findColumn(header, (h) => h === 'BLS Code', 'BLS Code');
  const nameCol = findColumn(header, (h) => h === 'Lebensmittelbezeichnung', 'Lebensmittelbezeichnung');
  const nameEnCol = findColumn(header, (h) => h === 'Food name', 'Food name');
  const nutrientCols = {} as Record<NutrientKey, number>;
  for (const key of NUTRIENT_KEYS) {
    const code = BLS_COLUMNS[key];
    nutrientCols[key] = findColumn(header, (h) => h.startsWith(`${code} `) && h.includes('['), code);
  }

  const entries: BlsEntry[] = [];
  for (const row of rows) {
    const code = cellText(row[codeCol]).trim();
    if (!code) continue;
    let incomplete = false;
    const per100g = {} as Nutrients;
    for (const key of NUTRIENT_KEYS) {
      const value = parseValue(row[nutrientCols[key]]);
      if (value === null) incomplete = true;
      per100g[key] = round3(value ?? 0);
    }
    entries.push({
      code,
      name: cellText(row[nameCol]).trim(),
      nameEn: cellText(row[nameEnCol]).trim(),
      per100g,
      incomplete,
    });
  }
  return entries;
}
