import type { Ingredient, Unit } from './types';

export const ML_PER_UNIT = { ml: 1, el: 15, tl: 5 } as const;

export class UnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitError';
  }
}

type Convertible = Pick<Ingredient, 'densityGPerMl' | 'pieceWeightG'>;

export function canConvert(unit: Unit, ing: Convertible): boolean {
  if (unit === 'g') return true;
  if (unit === 'stk') return ing.pieceWeightG !== undefined;
  return ing.densityGPerMl !== undefined;
}

/** Rechnet eine Menge in Gramm um. */
export function toGrams(amount: number, unit: Unit, ing: Convertible & Pick<Ingredient, 'name'>): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new UnitError(`${ing.name}: ungültige Menge ${amount}`);
  }
  switch (unit) {
    case 'g':
      return amount;
    case 'stk':
      if (ing.pieceWeightG === undefined) throw new UnitError(`${ing.name}: Stückgewicht fehlt`);
      return amount * ing.pieceWeightG;
    case 'ml':
    case 'el':
    case 'tl':
      if (ing.densityGPerMl === undefined) throw new UnitError(`${ing.name}: Dichte fehlt für Einheit ${unit}`);
      return amount * ML_PER_UNIT[unit] * ing.densityGPerMl;
  }
}
