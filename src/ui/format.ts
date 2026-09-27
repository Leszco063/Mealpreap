import type { IsoDate, Unit } from '../domain/types';
import { isoWeekday } from '../domain/dates';

const num1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const num2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export const UNIT_LABEL: Record<Unit, string> = { g: 'g', ml: 'ml', stk: 'Stk.', el: 'EL', tl: 'TL' };

export const fmtEur = (n: number) => eur.format(n);
export const fmtKcal = (n: number) => `${Math.round(n)} kcal`;
export const fmtGram = (n: number) => (n >= 1000 ? `${num2.format(n / 1000)} kg` : `${Math.round(n)} g`);
export const fmtNum = (n: number) => num2.format(n);
export const fmtOne = (n: number) => num1.format(n);

export function fmtDay(d: IsoDate): string {
  const [, month, day] = d.split('-');
  return `${WEEKDAY_SHORT[isoWeekday(d) - 1]} ${day}.${month}.`;
}

export function fmtAmount(amount: number, unit: Unit): string {
  return `${num2.format(amount)} ${UNIT_LABEL[unit]}`;
}
